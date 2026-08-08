// HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN MÉDICA OCUPACIONAL (formato unificado
// SNS-MSP/HCU-form.123/2025). Reemplaza a los formularios SO-RE-38/39/40/41: un
// solo formulario con selector de TIPO DE EVALUACIÓN (ingreso/periódico/
// reintegro/retiro) para catalogar y buscar. Los antecedentes se toman del
// expediente secuencial del trabajador (se autocompletan y se actualizan).
// Reutiliza SignosVitalesForm, SeccionI (examen físico), BuscadorCIE10 y catálogos.
import { useState, useEffect, useCallback, Fragment } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, getDocs, query, where, collection, addDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { registrarAuditoria } from '../services/auditoria';
import { useAuth } from '../contexts/AuthContext';
import SignosVitalesForm from '../components/SignosVitalesForm';
import BuscadorCIE10 from '../components/BuscadorCIE10';
import { useEmpresa } from '../hooks/useEmpresa';
import { SeccionI } from '../components/evaluacion/SeccionesEvaluacion';
import { getExpedienteAntecedentes, fusionarYGuardarAntecedentes } from '../services/antecedentes';
import { getPerfilRiesgo } from '../services/perfilesRiesgo';
import type { PerfilRiesgoCargo } from '../types/perfilRiesgo';
import { nombreProfesionalDe, codigoProfesionalDe } from '../utils/medicalHelpers';
import {
  OPCIONES_RECOMENDACIONES, REGIONES_EXAMEN_FISICO, MATRIZ_RIESGOS,
  GRUPOS_PRIORITARIOS, GRUPOS_SANGUINEOS, LATERALIDADES, TIPOS_EVALUACION_OCUP,
  emptyAntecedenteEmpleo, emptyAntecedentesGineco, emptyAntecedentesReproductivos, emptyDatosPersonales,
  emptyAntecedenteClinico, emptyAntecedenteQuirurgico, emptyAlergia,
} from '../utils/catalogosEvaluacion';
import { funcionesDeCargo, perfilDeCargo, MAX_ACTIVIDADES, FUNCIONES_AUTOCOMPLETAR } from '../constants/funcionesCargo';
import { resumirAntecedentes } from '../utils/resumenAntecedentes';
import { CAMPOS_FECHA_POR_TIPO, ETIQUETA_CAMPO_FECHA, AYUDA_CAMPO_FECHA, type CampoFechaEvaluacion } from '../utils/catalogosEvaluacion';
import type {
  Trabajador, SignosVitales, HabitoToxico, EstiloVida, ExamenFisicoHallazgo, ExamenComplementario,
  Diagnostico, Usuario, FactorRiesgoPuesto, DatosPersonalesSO41, CondicionEspecial,
  AntecedentesGineco, AntecedentesReproductivos, AntecedenteEmpleo, ExpedienteAntecedentes,
  AntecedenteClinico, AntecedenteQuirurgico, Alergia,
} from '../types';

const emptyCondicion = (): CondicionEspecial => ({
  autorizaTransfusiones: null, tratamientoHormonal: null, tratamientoHormonalCual: '', condicionPreexistente: '',
});

const SiNo = ({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) => (
  <div className="flex gap-1.5">
    {([true, false] as const).map(val => (
      <button key={String(val)} type="button" onClick={() => onChange(value === val ? null : val)}
        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${value === val ? (val ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-600 text-white border-slate-600') : 'bg-white text-slate-600 border-slate-300'}`}>
        {val ? 'Sí' : 'No'}
      </button>
    ))}
  </div>
);

/** Encabezado de un bloque de antecedentes con su pregunta Sí/No. */
const TituloSiNo = ({ titulo, valor, onChange }: { titulo: string; valor: boolean | null; onChange: (v: boolean | null) => void }) => (
  <div className="flex items-center gap-3 flex-wrap">
    <label className="text-xs font-bold text-slate-700 uppercase">{titulo}</label>
    <SiNo value={valor} onChange={onChange} />
  </div>
);

/**
 * Matriz de la Sección G (igual que la página 2 del formato): una fila por
 * factor de riesgo y una columna por actividad de la jornada (1..7). Se marca
 * en qué actividades está presente cada riesgo.
 */
function MatrizRiesgos({ actividades, marcadas, onToggle }: {
  actividades: string[];
  marcadas: Record<string, number[]>;
  onToggle: (riesgo: string, actIdx: number) => void;
}) {
  const nCols = Math.max(1, actividades.length);
  return (
    <div className="border border-slate-200 rounded-lg overflow-x-auto">
      <table className="w-full text-xs" style={{ borderCollapse: 'collapse', minWidth: 560 }}>
        <thead>
          <tr className="bg-slate-100">
            <th className="text-left px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-slate-100" style={{ minWidth: 210 }}>FACTOR DE RIESGO</th>
            {Array.from({ length: nCols }, (_, i) => (
              <th key={i} className="px-1 py-1.5 font-bold text-slate-600 text-center" style={{ width: 34 }}
                title={actividades[i] || `Actividad ${i + 1}`}>{i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIZ_RIESGOS.map(cat => (
            <Fragment key={cat.clave}>
              <tr><td colSpan={nCols + 1} className={`${cat.color} text-white font-bold px-2 py-1 text-[11px]`}>{cat.categoria}</td></tr>
              {cat.subgrupos.map(g => (
                <Fragment key={(g.subcategoria ?? '') + cat.clave}>
                  {g.subcategoria && <tr><td colSpan={nCols + 1} className="bg-slate-50 px-2 py-0.5 text-[10.5px] font-bold text-slate-500">{g.subcategoria}</td></tr>}
                  {g.items.map(item => {
                    const sel = marcadas[item] ?? [];
                    return (
                      <tr key={item} className={sel.length ? 'bg-blue-50/60' : 'hover:bg-slate-50'}>
                        <td className={`px-2 py-1 border-t border-slate-100 sticky left-0 ${sel.length ? 'bg-blue-50/60 font-semibold text-blue-900' : 'bg-white'}`}>{item}</td>
                        {Array.from({ length: nCols }, (_, i) => (
                          <td key={i} className="text-center border-t border-l border-slate-100 py-1">
                            <input type="checkbox" checked={sel.includes(i)} onChange={() => onToggle(item, i)}
                              title={actividades[i] ? `${item} — ${actividades[i]}` : `Actividad ${i + 1}`} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const INPUT = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500';
const INPUT_XS = 'w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs';

export default function NuevaEvaluacionOcupacional() {
  const { trabajadorId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const editEvalId = searchParams.get('editId');
  // Etiqueta inicial por query (?tipo=retiro) para catalogar rápido.
  const tipoQuery = searchParams.get('tipo');
  const { user } = useAuth();
  const { empresa: EMP } = useEmpresa();

  const [trabajador, setTrabajador] = useState<Trabajador | null>(null);
  const [medicoData, setMedicoData] = useState<Usuario | null>(null);
  const [guardando, setGuardando] = useState(false);
  // El formulario no se monta hasta terminar la carga: SignosVitalesForm y las
  // demás secciones deben nacer ya con los datos de la evaluación que se edita.
  const [cargando, setCargando] = useState(true);

  // A. Datos
  const [datosPersonales, setDatosPersonales] = useState<DatosPersonalesSO41>(emptyDatosPersonales());
  // B. Motivo
  const [tipoEvaluacion, setTipoEvaluacion] = useState<string>(tipoQuery && TIPOS_EVALUACION_OCUP.some(t => t.valor === tipoQuery) ? tipoQuery : 'periodica');
  const [fechaAtencion, setFechaAtencion] = useState(new Date().toISOString().slice(0, 10));
  const [fechaIngresoTrabajo, setFechaIngresoTrabajo] = useState('');
  const [fechaReingreso, setFechaReingreso] = useState('');
  const [fechaUltimoDia, setFechaUltimoDia] = useState('');
  const [motivoConsulta, setMotivoConsulta] = useState('');
  // C. Antecedentes.
  // La captura es la de siempre (Sí/No + detalle por antecedente); el formato
  // unificado los imprime resumidos en un único recuadro, y ese resumen es
  // `clinicosTexto`, que se recalcula solo a partir del detalle.
  const [clinicosQ, setClinicosQ] = useState<boolean | null>(null);
  const [clinicos, setClinicos] = useState<AntecedenteClinico[]>([]);
  const [quirurgicosQ, setQuirurgicosQ] = useState<boolean | null>(null);
  const [quirurgicos, setQuirurgicos] = useState<AntecedenteQuirurgico[]>([]);
  const [alergiasQ, setAlergiasQ] = useState<boolean | null>(null);
  const [alergias, setAlergias] = useState<Alergia[]>([]);
  /** Texto heredado de evaluaciones antiguas que no tienen el detalle. */
  const [clinicosTextoManual, setClinicosTextoManual] = useState('');
  const [familiaresTexto, setFamiliaresTexto] = useState('');
  const [condicion, setCondicion] = useState<CondicionEspecial>(emptyCondicion());
  const [gineco, setGineco] = useState<AntecedentesGineco>(emptyAntecedentesGineco());
  const [reproductivos, setReproductivos] = useState<AntecedentesReproductivos>(emptyAntecedentesReproductivos());
  const [habitos, setHabitos] = useState<HabitoToxico[]>([
    { tipo: 'tabaco', consume: false, tiempoConsumo: '', cantidad: '', exConsumidor: false, tiempoAbstinencia: '' },
    { tipo: 'alcohol', consume: false, tiempoConsumo: '', cantidad: '', exConsumidor: false, tiempoAbstinencia: '' },
    { tipo: 'drogas', consume: false, tiempoConsumo: '', cantidad: '', exConsumidor: false, tiempoAbstinencia: '' },
  ]);
  const [estiloVida, setEstiloVida] = useState<EstiloVida>({ actividadFisica: false, tipoActividad: '', tiempoCantidad: '', medicacionHabitual: '', medicacionCantidad: '' });
  const [observacionHabitos, setObservacionHabitos] = useState('');
  // D
  const [enfermedadActual, setEnfermedadActual] = useState('');
  // E
  const [signos, setSignos] = useState<SignosVitales>({ presionSistolica: '', presionDiastolica: '', temperatura: '', frecuenciaCardiaca: '', frecuenciaRespiratoria: '', saturacion: '', peso: '', talla: '', imc: 0, perimetroAbdominal: '' });
  // F
  const [efSel, setEfSel] = useState<Set<string>>(new Set());
  const [efHallazgos, setEfHallazgos] = useState<ExamenFisicoHallazgo[]>([]);
  // G — factores de riesgo + actividades de la jornada (matriz riesgo × actividad)
  const [factores, setFactores] = useState<FactorRiesgoPuesto>({ puestoArea: '', actividades: '', tiempoTrabajoMeses: '', fisicos: [], mecanicos: [], quimicos: [], biologicos: [], ergonomicos: [], psicosociales: [], medidasPreventivas: '' });
  const [actividades, setActividades] = useState<string[]>([]);
  // Medidas preventivas por actividad (van al pie de cada columna de la matriz).
  const [medidasActs, setMedidasActs] = useState<string[]>([]);
  const [riesgoActs, setRiesgoActs] = useState<Record<string, number[]>>({});
  /** Funciones del cargo disponibles para añadir manualmente (más allá de las 6). */
  const [funcionesCargo, setFuncionesCargo] = useState<string[]>([]);
  /** Perfil de riesgo del cargo aplicado al abrir la evaluación (si lo hay). */
  const [perfilRiesgo, setPerfilRiesgo] = useState<PerfilRiesgoCargo | null>(null);
  // H
  const [empleos, setEmpleos] = useState<AntecedenteEmpleo[]>([]);
  // I
  const [actividadesExtra, setActividadesExtra] = useState('');
  // J
  const [examenes, setExamenes] = useState<ExamenComplementario[]>([{ nombre: '', fecha: '', resultado: '' }]);
  // K
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([{ descripcion: '', cie: '', tipo: 'definitivo' }]);
  // L
  const [aptitud, setAptitud] = useState<'apto' | 'aptoObservacion' | 'aptoLimitaciones' | 'noApto'>('apto');
  const [aptitudObs, setAptitudObs] = useState('');
  // M
  const [recomendaciones, setRecomendaciones] = useState<string[]>([]);
  const [recomendacionesOtras, setRecomendacionesOtras] = useState('');
  // N. Retiro
  const [retiroRealizada, setRetiroRealizada] = useState<boolean | null>(null);
  const [retiroRelacion, setRetiroRelacion] = useState<boolean | null>(null);
  const [retiroObs, setRetiroObs] = useState('');

  const esRetiro = tipoEvaluacion === 'retiro';
  const esMujer = trabajador?.sexo === 'F';

  // Fechas exigidas por el formato para el tipo elegido (Sección B).
  const fechasDelTipo = CAMPOS_FECHA_POR_TIPO[tipoEvaluacion] ?? CAMPOS_FECHA_POR_TIPO.periodica;
  const valorFecha: Record<CampoFechaEvaluacion, string> = {
    fechaAtencion, fechaIngresoTrabajo, fechaReingreso, fechaUltimoDia,
  };
  const setFecha: Record<CampoFechaEvaluacion, (v: string) => void> = {
    fechaAtencion: setFechaAtencion,
    fechaIngresoTrabajo: setFechaIngresoTrabajo,
    fechaReingreso: setFechaReingreso,
    fechaUltimoDia: setFechaUltimoDia,
  };

  // Resumen de antecedentes que se imprime en el recuadro del formato.
  const resumenClinicos = resumirAntecedentes({
    clinicosQ, clinicos, quirurgicosQ, quirurgicos, alergiasQ, alergias,
  });
  const clinicosTexto = resumenClinicos || clinicosTextoManual;

  // Aplica un expediente de antecedentes al formulario (autocompletado).
  const aplicarExpediente = useCallback((exp: ExpedienteAntecedentes | null, tallaFallback?: string) => {
    if (!exp) { if (tallaFallback) setSignos(prev => ({ ...prev, talla: tallaFallback })); return; }
    if (exp.datosPersonales) setDatosPersonales(prev => ({ ...prev, ...exp.datosPersonales }));
    if (exp.condicionEspecial) setCondicion({ ...emptyCondicion(), ...exp.condicionEspecial });
    if (exp.antecedentesClinicosTexto) setClinicosTextoManual(exp.antecedentesClinicosTexto);
    if (exp.antecedentesClinicosQ !== undefined) setClinicosQ(exp.antecedentesClinicosQ ?? null);
    if (exp.antecedentesClinicosLista?.length) setClinicos(exp.antecedentesClinicosLista);
    if (exp.antecedentesQuirurgicosQ !== undefined) setQuirurgicosQ(exp.antecedentesQuirurgicosQ ?? null);
    if (exp.antecedentesQuirurgicosLista?.length) setQuirurgicos(exp.antecedentesQuirurgicosLista);
    if (exp.alergiasTiene !== undefined) setAlergiasQ(exp.alergiasTiene ?? null);
    if (exp.alergias?.length) setAlergias(exp.alergias);
    if (exp.antecedentesFamiliaresTexto) setFamiliaresTexto(exp.antecedentesFamiliaresTexto);
    if (exp.antecedentesGineco) setGineco({ ...emptyAntecedentesGineco(), ...exp.antecedentesGineco });
    if (exp.antecedentesReproductivos) setReproductivos({ ...emptyAntecedentesReproductivos(), ...exp.antecedentesReproductivos });
    if (exp.habitosToxicos?.length) setHabitos(exp.habitosToxicos);
    if (exp.estiloVida) setEstiloVida(exp.estiloVida);
    if (exp.antecedentesEmpleos?.length) setEmpleos(exp.antecedentesEmpleos);
  }, []);

  // ===== CARGA =====
  useEffect(() => {
    const cargar = async () => {
      if (!trabajadorId || !user) return;
      const trabDoc = await getDoc(doc(db, 'trabajadores', trabajadorId));
      let trab: Trabajador | null = null;
      if (trabDoc.exists()) {
        trab = { id: trabDoc.id, ...trabDoc.data() } as Trabajador;
        setTrabajador(trab);
        setFactores(prev => ({ ...prev, puestoArea: trab!.puestoTrabajo }));
        // Funciones del cargo: se proponen las primeras como actividades de la
        // jornada (columnas 1..n de la matriz). El médico puede ajustarlas.
        const perfil = perfilDeCargo(trab.puestoTrabajo || '');
        if (perfil) setFuncionesCargo(perfil.funciones);
      }
      const medicoDoc = await getDoc(doc(db, 'usuarios', user.uid));
      if (medicoDoc.exists()) setMedicoData(medicoDoc.data() as Usuario);
      // Precargar fecha de nacimiento del trabajador en datos personales
      if (trab && (trab as any).fechaNacimiento) setDatosPersonales(prev => ({ ...prev, fechaNacimiento: (trab as any).fechaNacimiento }));

      if (editEvalId) {
        try {
          const evDoc = await getDoc(doc(db, 'evaluaciones', editEvalId));
          if (evDoc.exists()) {
            const ev = evDoc.data();
            setTipoEvaluacion(ev.tipoEvaluacion || 'periodica');
            setFechaAtencion(ev.fechaAtencion || new Date().toISOString().slice(0, 10));
            setFechaIngresoTrabajo(ev.fechaIngresoTrabajo || '');
            setFechaReingreso(ev.fechaReingreso || '');
            setFechaUltimoDia(ev.fechaUltimoDiaLaboral || '');
            setMotivoConsulta(ev.motivoConsulta || '');
            if (ev.datosPersonales) setDatosPersonales({ ...emptyDatosPersonales(), ...ev.datosPersonales });
            if (ev.condicionEspecial) setCondicion({ ...emptyCondicion(), ...ev.condicionEspecial });
            setClinicosTextoManual(ev.antecedentesClinicosTexto || ev.antecedentesClinicosQuirurgicos || '');
            setClinicosQ(ev.antecedentesClinicosQ ?? null);
            setClinicos(ev.antecedentesClinicosLista ?? []);
            setQuirurgicosQ(ev.antecedentesQuirurgicosQ ?? null);
            setQuirurgicos(ev.antecedentesQuirurgicosLista ?? []);
            setAlergiasQ(ev.alergiasTiene ?? null);
            setAlergias(ev.alergias ?? []);
            setFamiliaresTexto(ev.antecedentesFamiliaresTexto || '');
            if (ev.antecedentesGineco) setGineco({ ...emptyAntecedentesGineco(), ...ev.antecedentesGineco });
            if (ev.antecedentesReproductivos) setReproductivos({ ...emptyAntecedentesReproductivos(), ...ev.antecedentesReproductivos });
            if (ev.habitosToxicos) setHabitos(ev.habitosToxicos);
            if (ev.estiloVida) setEstiloVida(ev.estiloVida);
            setObservacionHabitos(ev.observacionHabitos || '');
            setEnfermedadActual(ev.enfermedadActual || '');
            if (ev.signosVitales) setSignos(ev.signosVitales);
            if (ev.examenFisicoHallazgos) {
              setEfHallazgos(ev.examenFisicoHallazgos);
              const s = new Set<string>();
              ev.examenFisicoHallazgos.forEach((h: any) => { const n = h.codigo.match(/^\d+/)?.[0]; const c = h.codigo.replace(/^\d+/, ''); if (n && c) s.add(`${n}-${c}`); });
              setEfSel(s);
            }
            if (ev.factoresRiesgo) {
              setFactores(ev.factoresRiesgo);
              setActividades(ev.factoresRiesgo.actividadesJornada ?? []);
              setRiesgoActs(ev.factoresRiesgo.riesgoActividades ?? {});
              setMedidasActs(ev.factoresRiesgo.medidasActividades ?? []);
            }
            if (ev.antecedentesEmpleos) setEmpleos(ev.antecedentesEmpleos);
            setActividadesExtra(ev.actividadesExtraLaborales || '');
            if (ev.examenesComplementarios) setExamenes(ev.examenesComplementarios);
            if (ev.diagnosticos) setDiagnosticos(ev.diagnosticos);
            setAptitud(ev.aptitudMedica || 'apto');
            setAptitudObs(ev.aptitudObservacion || '');
            if (ev.recomendaciones) setRecomendaciones(Array.isArray(ev.recomendaciones) ? ev.recomendaciones : []);
            setRecomendacionesOtras(ev.recomendacionesOtras || '');
            setRetiroRealizada(ev.retiroEvaluacionRealizada ?? null);
            setRetiroRelacion(ev.retiroRelacionadaTrabajo ?? null);
            setRetiroObs(ev.retiroObservacion || '');
          }
        } catch (err) { console.error('Error al cargar la evaluación:', err); }
      } else {
        // Autocompletar desde el expediente de antecedentes secuencial.
        try {
          const exp = await getExpedienteAntecedentes(trabajadorId);
          aplicarExpediente(exp);
        } catch (err) { console.error('Error al cargar antecedentes:', err); }
        // En una evaluación NUEVA los signos vitales se toman de cero, salvo la
        // talla: no varía a corto plazo, así que se arrastra de la última
        // evaluación registrada para no volver a medirla.
        try {
          const previas = await getDocs(query(collection(db, 'evaluaciones'), where('trabajadorId', '==', trabajadorId)));
          const ordenadas = previas.docs
            .map(d => d.data() as any)
            .sort((a, b) => (b.fecha?.seconds ?? 0) - (a.fecha?.seconds ?? 0));
          const talla = ordenadas.find(e => e.signosVitales?.talla)?.signosVitales?.talla;
          if (talla) setSignos(prev => ({ ...prev, talla }));
        } catch (err) { console.warn('No se pudo precargar la talla:', err); }
        // Autocompletar la Sección G con el perfil de riesgo del cargo: sus
        // actividades representativas y, sobre ellas, los factores de riesgo
        // que el análisis auditado marcó para cada una.
        let perfilAplicado = false;
        try {
          const perfil = await getPerfilRiesgo(trab?.puestoTrabajo || '');
          if (perfil?.actividades.length) {
            setActividades(perfil.actividades.slice(0, MAX_ACTIVIDADES));
            // Se descartan las marcas de actividades recortadas por el máximo.
            const dentro: Record<string, number[]> = {};
            Object.entries(perfil.riesgoActividades).forEach(([factor, idxs]) => {
              const v = idxs.filter(i => i < MAX_ACTIVIDADES);
              if (v.length) dentro[factor] = v;
            });
            setRiesgoActs(dentro);
            setPerfilRiesgo(perfil);
            perfilAplicado = true;
          }
        } catch (err) { console.warn('No se pudo aplicar el perfil de riesgo del cargo:', err); }
        // Sin perfil de riesgo se cae a las primeras funciones del cargo.
        if (!perfilAplicado) {
          const sugeridas = funcionesDeCargo(trab?.puestoTrabajo || '', FUNCIONES_AUTOCOMPLETAR);
          if (sugeridas.length) setActividades(sugeridas);
        }
      }
    };
    cargar().finally(() => setCargando(false));
  }, [trabajadorId, user, editEvalId, aplicarExpediente]);

  // ===== HANDLERS =====
  const toggleEf = (key: string, numero: number, codigo: string, region: string, subregion: string) => {
    const s = new Set(efSel);
    if (s.has(key)) { s.delete(key); setEfHallazgos(prev => prev.filter(h => h.codigo !== `${numero}${codigo}`)); }
    else { s.add(key); setEfHallazgos(prev => [...prev, { codigo: `${numero}${codigo}`, region, subregion, descripcion: '' }]); }
    setEfSel(s);
  };
  const updateHallazgo = (codigo: string, descripcion: string) => setEfHallazgos(prev => prev.map(h => h.codigo === codigo ? { ...h, descripcion } : h));
  const handleSignos = useCallback((d: SignosVitales) => setSignos(d), []);
  /** Marca/desmarca un riesgo en una actividad concreta de la jornada. */
  const toggleRiesgoActividad = (riesgo: string, actIdx: number) => {
    setRiesgoActs(prev => {
      const actuales = prev[riesgo] ?? [];
      const nuevos = actuales.includes(actIdx) ? actuales.filter(i => i !== actIdx) : [...actuales, actIdx].sort((a, b) => a - b);
      const out = { ...prev };
      if (nuevos.length) out[riesgo] = nuevos; else delete out[riesgo];
      return out;
    });
  };

  /** Arreglos por categoría derivados de la matriz (compatibilidad con el resto del sistema). */
  const categoriasDesdeMatriz = (mapa: Record<string, number[]>): Pick<FactorRiesgoPuesto, 'fisicos' | 'mecanicos' | 'quimicos' | 'biologicos' | 'ergonomicos' | 'psicosociales'> => {
    const out = { fisicos: [] as string[], mecanicos: [] as string[], quimicos: [] as string[], biologicos: [] as string[], ergonomicos: [] as string[], psicosociales: [] as string[] };
    MATRIZ_RIESGOS.forEach(cat => {
      cat.subgrupos.forEach(g => g.items.forEach(item => {
        if ((mapa[item] ?? []).length) out[cat.clave].push(item);
      }));
    });
    return out;
  };
  /** Vuelve a dejar la Sección G tal como la define el perfil de riesgo del cargo. */
  const aplicarPerfilRiesgo = () => {
    if (!perfilRiesgo) return;
    setActividades(perfilRiesgo.actividades.slice(0, MAX_ACTIVIDADES));
    const dentro: Record<string, number[]> = {};
    Object.entries(perfilRiesgo.riesgoActividades).forEach(([factor, idxs]) => {
      const v = idxs.filter(i => i < MAX_ACTIVIDADES);
      if (v.length) dentro[factor] = v;
    });
    setRiesgoActs(dentro);
    setMedidasActs([]);
    toast.info('Sección G restablecida con el perfil del cargo.');
  };

  const updClinico = (i: number, f: keyof AntecedenteClinico, v: any) => setClinicos(prev => prev.map((x, j) => j === i ? { ...x, [f]: v } : x));
  const updQuirurgico = (i: number, f: keyof AntecedenteQuirurgico, v: any) => setQuirurgicos(prev => prev.map((x, j) => j === i ? { ...x, [f]: v } : x));
  const updAlergia = (i: number, f: keyof Alergia, v: any) => setAlergias(prev => prev.map((x, j) => j === i ? { ...x, [f]: v } : x));
  const updateHabito = (i: number, f: keyof HabitoToxico, v: any) => setHabitos(prev => { const u = [...prev]; u[i] = { ...u[i], [f]: v }; return u; });
  const updateEmpleo = (i: number, f: keyof AntecedenteEmpleo, v: any) => setEmpleos(prev => { const u = [...prev]; u[i] = { ...u[i], [f]: v }; return u; });
  const updGineco = (p: Partial<AntecedentesGineco>) => setGineco(prev => ({ ...prev, ...p }));
  const updRepro = (p: Partial<AntecedentesReproductivos>) => setReproductivos(prev => ({ ...prev, ...p }));

  // ===== GUARDAR =====
  const handleGuardar = async () => {
    if (!trabajadorId || !user || !trabajador) return;
    const errores: string[] = [];
    if (!motivoConsulta.trim()) errores.push('Indica el motivo de consulta (Sección B).');
    fechasDelTipo.obligatorias.forEach(campo => {
      if (!valorFecha[campo]) errores.push(`Completa «${ETIQUETA_CAMPO_FECHA[campo]}» (Sección B).`);
    });
    if (!signos.presionSistolica || !signos.presionDiastolica || !signos.frecuenciaCardiaca || !signos.peso || !signos.talla)
      errores.push('Completa los signos vitales mínimos: PA, FC, Peso y Talla (Sección E).');
    const dxValidos = diagnosticos.filter(d => d.descripcion.trim() !== '');
    if (dxValidos.length === 0) errores.push('Agrega al menos un diagnóstico (Sección K).');
    if (errores.length) { errores.forEach(e => toast.warning(e)); return; }

    setGuardando(true);
    try {
      const hoy = new Date();
      const numeroArchivo = `${EMP.prefijoArchivo || 'HCO'}-${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`;
      const empleosLimpios = empleos.filter(e => e.empresa.trim() || e.puesto.trim() || e.actividades.trim());

      const evaluacionData: any = {
        trabajadorId,
        tipoEvaluacion,
        formato: 'ocupacional-unificado',
        medicoId: user.uid,
        medicoNombre: nombreProfesionalDe(medicoData) || '',
        medicoCedula: codigoProfesionalDe(medicoData),
        datosPersonales,
        // Solo se guardan las fechas que pide el tipo de evaluación; las demás
        // se limpian para no arrastrar valores de un tipo anterior.
        fechaAtencion,
        fechaIngresoTrabajo: fechasDelTipo.campos.includes('fechaIngresoTrabajo') ? fechaIngresoTrabajo : '',
        fechaReingreso: fechasDelTipo.campos.includes('fechaReingreso') ? fechaReingreso : '',
        fechaUltimoDiaLaboral: fechasDelTipo.campos.includes('fechaUltimoDia') ? fechaUltimoDia : '',
        motivoConsulta,
        antecedentesClinicosTexto: clinicosTexto,
        antecedentesClinicosQ: clinicosQ,
        antecedentesClinicosLista: clinicosQ === true ? clinicos.filter(c => c.enfermedad.trim()) : [],
        antecedentesQuirurgicosQ: quirurgicosQ,
        antecedentesQuirurgicosLista: quirurgicosQ === true ? quirurgicos.filter(q => q.procedimiento.trim()) : [],
        alergiasTiene: alergiasQ,
        alergias: alergiasQ === true ? alergias.filter(a => a.alergeno.trim()) : [],
        antecedentesFamiliaresTexto: familiaresTexto,
        condicionEspecial: condicion,
        habitosToxicos: habitos,
        estiloVida,
        observacionHabitos,
        enfermedadActual,
        signosVitales: signos,
        examenFisicoHallazgos: efHallazgos,
        factoresRiesgo: {
          ...factores,
          ...categoriasDesdeMatriz(riesgoActs),
          actividadesJornada: actividades.filter(a => a.trim()),
          riesgoActividades: riesgoActs,
          medidasActividades: actividades.map((a, i) => (a.trim() ? (medidasActs[i] || '') : '')).filter((_, i) => actividades[i]?.trim()),
          // Texto plano de respaldo (informes y formatos antiguos).
          actividades: actividades.filter(a => a.trim()).join('; '),
          medidasPreventivas: medidasActs.filter(m => m && m.trim()).join(' · '),
        },
        antecedentesEmpleos: empleosLimpios,
        actividadesExtraLaborales: actividadesExtra,
        examenesComplementarios: examenes.filter(e => e.nombre.trim() !== ''),
        diagnosticos: dxValidos,
        aptitudMedica: aptitud,
        aptitudObservacion: aptitudObs,
        recomendaciones,
        recomendacionesOtras,
        ...(esRetiro ? { retiroEvaluacionRealizada: retiroRealizada, retiroRelacionadaTrabajo: retiroRelacion, retiroObservacion: retiroObs } : {}),
      };
      if (esMujer) evaluacionData.antecedentesGineco = gineco;
      else evaluacionData.antecedentesReproductivos = reproductivos;

      let evaluacionId = editEvalId;
      if (editEvalId) {
        await updateDoc(doc(db, 'evaluaciones', editEvalId), { ...evaluacionData, updatedAt: hoy, updatedBy: user.uid });
        await registrarAuditoria('editar', 'evaluacion', editEvalId, `Editó la evaluación ocupacional (${tipoEvaluacion}) de ${trabajador.primerApellido} ${trabajador.primerNombre}`);
        toast.success('Evaluación actualizada.');
      } else {
        evaluacionData.fecha = hoy;
        evaluacionData.numeroHistoriaClinica = trabajador.cedula;
        evaluacionData.numeroArchivo = numeroArchivo;
        evaluacionData.createdAt = hoy;
        evaluacionData.createdBy = user.uid;
        const ref = await addDoc(collection(db, 'evaluaciones'), evaluacionData);
        evaluacionId = ref.id;
        await updateDoc(doc(db, 'trabajadores', trabajadorId), { evaluaciones: arrayUnion(ref.id), updatedAt: hoy, updatedBy: user.uid });
        await registrarAuditoria('crear', 'evaluacion', ref.id, `Evaluación ocupacional (${tipoEvaluacion}) de ${trabajador.primerApellido} ${trabajador.primerNombre}`);
        toast.success('Evaluación guardada.');
      }

      // Guardar/actualizar el expediente de antecedentes secuencial del trabajador.
      try {
        const nuevosAntec: Partial<ExpedienteAntecedentes> = {
          trabajadorId,
          datosPersonales,
          condicionEspecial: condicion,
          antecedentesClinicosTexto: clinicosTexto,
          antecedentesClinicosQ: clinicosQ,
          antecedentesClinicosLista: clinicosQ === true ? clinicos.filter(c => c.enfermedad.trim()) : [],
          antecedentesQuirurgicosQ: quirurgicosQ,
          antecedentesQuirurgicosLista: quirurgicosQ === true ? quirurgicos.filter(q => q.procedimiento.trim()) : [],
          alergiasTiene: alergiasQ,
          alergias: alergiasQ === true ? alergias.filter(a => a.alergeno.trim()) : [],
          antecedentesFamiliaresTexto: familiaresTexto,
          habitosToxicos: habitos,
          estiloVida,
          antecedentesEmpleos: empleosLimpios,
          ...(esMujer ? { antecedentesGineco: gineco } : { antecedentesReproductivos: reproductivos }),
        };
        await fusionarYGuardarAntecedentes(trabajadorId, nuevosAntec, { evaluacionId: evaluacionId ?? undefined, medicoId: user.uid });
      } catch (err) { console.warn('No se pudo actualizar el expediente de antecedentes:', err); }

      // El formato unificado ya incluye la aptitud y las recomendaciones, así
      // que no se emite un certificado aparte al terminar.
      navigate(`/trabajador/${trabajadorId}`);
    } catch (error) {
      console.error('Error al guardar:', error);
      toast.error('Hubo un error al procesar la evaluación.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando || !trabajador) return <div className="min-h-screen p-8 text-center text-slate-500">Cargando datos del trabajador...</div>;

  const totalRiesgos = factores.fisicos.length + factores.mecanicos.length + factores.quimicos.length + factores.biologicos.length + factores.ergonomicos.length + factores.psicosociales.length;

  const FilaTamizaje = ({ label, ex, onChange }: { label: string; ex: any; onChange: (p: any) => void }) => (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-center bg-slate-50 p-2.5 rounded-lg text-xs">
      <span className="font-semibold col-span-2">{label}</span>
      <div className="flex gap-1.5">
        {([true, false] as const).map(v => (
          <button key={String(v)} type="button" onClick={() => onChange({ realizado: ex.realizado === v ? null : v })}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${ex.realizado === v ? (v ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-600 text-white border-slate-600') : 'bg-white text-slate-600 border-slate-300'}`}>{v ? 'Sí' : 'No'}</button>
        ))}
      </div>
      <input type="text" placeholder="Tiempo (años)" value={ex.tiempoAnios} onChange={e => onChange({ tiempoAnios: e.target.value })} className={INPUT_XS} disabled={ex.realizado !== true} />
      <input type="text" placeholder="Resultado (solo si interfiere)" value={ex.resultado} onChange={e => onChange({ resultado: e.target.value })} className={INPUT_XS + ' md:col-span-2'} disabled={ex.realizado !== true} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Encabezado */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-slate-800 leading-tight">HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN MÉDICA OCUPACIONAL</h1>
              <p className="text-slate-500 text-xs md:text-sm mt-1">SNS-MSP/HCU-form.123/2025 | {EMP.institucion} | RUC: {EMP.ruc}</p>
            </div>
            <button onClick={() => navigate(`/trabajador/${trabajadorId}`)} className="self-start md:self-auto text-slate-500 hover:text-slate-800 text-sm font-medium bg-slate-100 px-4 py-2 rounded-lg">Cancelar</button>
          </div>
        </div>

        {/* A. DATOS */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">A. DATOS DEL ESTABLECIMIENTO - DATOS DEL USUARIO</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-blue-50 p-3 rounded-lg mb-4">
            <div><span className="font-semibold text-slate-600">Trabajador:</span> {trabajador.primerApellido} {trabajador.segundoApellido} {trabajador.primerNombre}</div>
            <div><span className="font-semibold text-slate-600">Cédula:</span> {trabajador.cedula}</div>
            <div><span className="font-semibold text-slate-600">Sexo:</span> {trabajador.sexo === 'M' ? 'Masculino' : 'Femenino'}</div>
            <div><span className="font-semibold text-slate-600">Puesto:</span> {trabajador.puestoTrabajo}</div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Grupo de atención prioritaria</label>
            <div className="flex gap-1.5 flex-wrap">
              {GRUPOS_PRIORITARIOS.map(g => {
                const on = (datosPersonales.gruposPrioritarios ?? []).includes(g);
                return (
                  <button key={g} type="button" onClick={() => setDatosPersonales(prev => { const arr = prev.gruposPrioritarios ?? []; return { ...prev, gruposPrioritarios: on ? arr.filter(x => x !== g) : [...arr, g] }; })}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'}`}>{g}</button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de nacimiento</label>
              <input type="date" value={datosPersonales.fechaNacimiento ?? ''} onChange={e => setDatosPersonales(prev => ({ ...prev, fechaNacimiento: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Grupo sanguíneo</label>
              <select value={datosPersonales.grupoSanguineo} onChange={e => setDatosPersonales(prev => ({ ...prev, grupoSanguineo: e.target.value }))} className={INPUT}>
                <option value="">—</option>{GRUPOS_SANGUINEOS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lateralidad</label>
              <select value={datosPersonales.lateralidad} onChange={e => setDatosPersonales(prev => ({ ...prev, lateralidad: e.target.value }))} className={INPUT}>
                <option value="">—</option>{LATERALIDADES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* B. MOTIVO + TIPO DE EVALUACIÓN */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 border-b pb-2">B. MOTIVO DE CONSULTA</h2>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Tipo de evaluación (etiqueta para búsqueda) <span className="text-red-500">*</span></label>
            <div className="flex gap-2 flex-wrap">
              {TIPOS_EVALUACION_OCUP.map(t => (
                <button key={t.valor} type="button" onClick={() => setTipoEvaluacion(t.valor)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${tipoEvaluacion === t.valor ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'}`}>{t.label}</button>
              ))}
            </div>
          </div>
          {/* Las fechas que se piden dependen del tipo: un retiro necesita
              ingreso y último día laboral; un reintegro, además, la fecha de
              reincorporación. */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {fechasDelTipo.campos.map(campo => {
              const obligatoria = fechasDelTipo.obligatorias.includes(campo);
              const falta = obligatoria && !valorFecha[campo];
              const ayuda = AYUDA_CAMPO_FECHA[tipoEvaluacion]?.[campo];
              return (
                <div key={campo}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {ETIQUETA_CAMPO_FECHA[campo]} {obligatoria && <span className="text-red-500">*</span>}
                  </label>
                  <input type="date" value={valorFecha[campo]} onChange={e => setFecha[campo](e.target.value)}
                    className={`${INPUT} ${falta ? 'border-red-300 bg-red-50' : ''}`} />
                  {ayuda && <p className="m-0 mt-1 text-[11px] text-slate-400">{ayuda}</p>}
                </div>
              );
            })}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Observación / motivo <span className="text-red-500">*</span></label>
            <textarea rows={2} value={motivoConsulta} onChange={e => setMotivoConsulta(e.target.value)} className={`${INPUT} ${!motivoConsulta.trim() ? 'border-red-300 bg-red-50' : ''}`} placeholder="Motivo o condición de la evaluación…" />
          </div>
        </div>

        {/* C. ANTECEDENTES PERSONALES */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800 border-b pb-2">C. ANTECEDENTES PERSONALES</h2>
          {/* Captura detallada (como en los formatos anteriores): Sí/No por
              bloque y, si es Sí, los datos de cada antecedente. El formato
              unificado los imprime resumidos en un solo recuadro. */}
          <div className="space-y-4">
            {/* ── Clínicos ── */}
            <div>
              <TituloSiNo titulo="Antecedentes clínicos" valor={clinicosQ}
                onChange={v => { setClinicosQ(v); if (v && clinicos.length === 0) setClinicos([emptyAntecedenteClinico()]); }} />
              {clinicosQ === true && (
                <div className="space-y-3 mt-2">
                  {clinicos.map((ac, i) => (
                    <div key={i} className="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-blue-800">Antecedente clínico #{i + 1}</span>
                        <button type="button" onClick={() => setClinicos(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">¿Qué enfermedad/condición padece?</label>
                          <input type="text" value={ac.enfermedad} onChange={e => updClinico(i, 'enfermedad', e.target.value)} className={INPUT_XS} placeholder="Ej: HTA, diabetes…" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">¿Desde hace cuánto?</label>
                          <input type="text" value={ac.desdeCuando} onChange={e => updClinico(i, 'desdeCuando', e.target.value)} className={INPUT_XS} placeholder="Ej: 6 años, 2018…" />
                        </div>
                      </div>
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1.5 cursor-pointer">
                          <input type="checkbox" checked={ac.tomaMedicacion} onChange={e => updClinico(i, 'tomaMedicacion', e.target.checked)} /> ¿Toma medicación?
                        </label>
                        {ac.tomaMedicacion && (
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 ml-5">
                            <input type="text" value={ac.medicacionNombre} onChange={e => updClinico(i, 'medicacionNombre', e.target.value)} className={INPUT_XS} placeholder="Medicamento" />
                            <input type="text" value={ac.medicacionDosis} onChange={e => updClinico(i, 'medicacionDosis', e.target.value)} className={INPUT_XS} placeholder="Dosis" />
                            <input type="text" value={ac.medicacionFrecuencia} onChange={e => updClinico(i, 'medicacionFrecuencia', e.target.value)} className={INPUT_XS} placeholder="Frecuencia" />
                            <select value={ac.adherencia ?? ''} onChange={e => updClinico(i, 'adherencia', e.target.value)} className={INPUT_XS + ' bg-white'}>
                              <option value="">Adherencia…</option><option value="buena">Buena</option><option value="irregular">Irregular</option><option value="mala">Mala</option>
                            </select>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1.5 cursor-pointer">
                          <input type="checkbox" checked={ac.seguimientoEspecialista} onChange={e => updClinico(i, 'seguimientoEspecialista', e.target.checked)} /> ¿Seguimiento por especialista?
                        </label>
                        {ac.seguimientoEspecialista && (
                          <input type="text" value={ac.especialista} onChange={e => updClinico(i, 'especialista', e.target.value)} className={INPUT_XS} placeholder="Especialidad o nombre del especialista…" />
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">¿Complicaciones u hospitalizaciones?</label>
                        <input type="text" value={ac.complicaciones} onChange={e => updClinico(i, 'complicaciones', e.target.value)} className={INPUT_XS} placeholder="Ninguna / describir…" />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setClinicos(prev => [...prev, emptyAntecedenteClinico()])} className="text-blue-600 text-xs font-medium hover:underline">+ Agregar otro antecedente clínico</button>
                </div>
              )}
            </div>

            {/* ── Alergias ── */}
            <div>
              <TituloSiNo titulo="Alergias" valor={alergiasQ}
                onChange={v => { setAlergiasQ(v); if (v && alergias.length === 0) setAlergias([emptyAlergia()]); }} />
              {alergiasQ === true && (
                <div className="space-y-3 mt-2">
                  {alergias.map((al, i) => (
                    <div key={i} className="bg-amber-50 p-3 rounded-lg border border-amber-200 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-amber-800">Alergia #{i + 1}</span>
                        <button type="button" onClick={() => setAlergias(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">¿A qué es alérgico?</label>
                          <input type="text" value={al.alergeno} onChange={e => updAlergia(i, 'alergeno', e.target.value)} className={INPUT_XS} placeholder="Penicilina, mariscos, polen…" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">Intensidad de la reacción</label>
                          <input type="text" value={al.intensidadReaccion} onChange={e => updAlergia(i, 'intensidadReaccion', e.target.value)} className={INPUT_XS} placeholder="Leve, moderada, severa…" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">Síntomas</label>
                          <input type="text" value={al.sintomas} onChange={e => updAlergia(i, 'sintomas', e.target.value)} className={INPUT_XS} placeholder="Urticaria, disnea…" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">Tratamiento habitual</label>
                          <input type="text" value={al.tratamientoHabitual} onChange={e => updAlergia(i, 'tratamientoHabitual', e.target.value)} className={INPUT_XS} placeholder="Ninguno / antihistamínico…" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setAlergias(prev => [...prev, emptyAlergia()])} className="text-amber-700 text-xs font-medium hover:underline">+ Agregar otra alergia</button>
                </div>
              )}
            </div>

            {/* ── Quirúrgicos ── */}
            <div>
              <TituloSiNo titulo="Antecedentes quirúrgicos" valor={quirurgicosQ}
                onChange={v => { setQuirurgicosQ(v); if (v && quirurgicos.length === 0) setQuirurgicos([emptyAntecedenteQuirurgico()]); }} />
              {quirurgicosQ === true && (
                <div className="space-y-3 mt-2">
                  {quirurgicos.map((aq, i) => (
                    <div key={i} className="bg-purple-50 p-3 rounded-lg border border-purple-200 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-purple-800">Antecedente quirúrgico #{i + 1}</span>
                        <button type="button" onClick={() => setQuirurgicos(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">¿Qué procedimiento fue realizado?</label>
                          <input type="text" value={aq.procedimiento} onChange={e => updQuirurgico(i, 'procedimiento', e.target.value)} className={INPUT_XS} placeholder="Nombre del procedimiento…" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">Fecha aproximada</label>
                          <input type="text" value={aq.fechaAproximada} onChange={e => updQuirurgico(i, 'fechaAproximada', e.target.value)} className={INPUT_XS} placeholder="Ej: 2019, hace 3 años…" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">¿Hubo complicaciones?</label>
                        <input type="text" value={aq.complicaciones} onChange={e => updQuirurgico(i, 'complicaciones', e.target.value)} className={INPUT_XS} placeholder="Ninguna / describir…" />
                      </div>
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1.5 cursor-pointer">
                          <input type="checkbox" checked={aq.recuperacionCompleta} onChange={e => updQuirurgico(i, 'recuperacionCompleta', e.target.checked)} /> ¿Recuperación completa?
                        </label>
                        {!aq.recuperacionCompleta && (
                          <input type="text" value={aq.secuelas} onChange={e => updQuirurgico(i, 'secuelas', e.target.value)} className={INPUT_XS} placeholder="Secuelas posteriores…" />
                        )}
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setQuirurgicos(prev => [...prev, emptyAntecedenteQuirurgico()])} className="text-purple-600 text-xs font-medium hover:underline">+ Agregar otro antecedente quirúrgico</button>
                </div>
              )}
            </div>

            {/* Vista previa del recuadro que se imprime en el PDF */}
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase text-slate-500">
                Recuadro del formato · Antecedentes clínicos y quirúrgicos
              </div>
              <p className={`m-0 px-3 py-2.5 text-xs ${clinicosTexto ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                {clinicosTexto || 'Responde los bloques de arriba: aquí verás la línea que se imprimirá.'}
              </p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Antecedentes familiares</label>
            <textarea rows={2} value={familiaresTexto} onChange={e => setFamiliaresTexto(e.target.value)} className={INPUT} placeholder="Descripción…" />
          </div>
          {/* Condición especial urgencias */}
          <div className="border border-slate-200 rounded-lg p-3 space-y-2.5">
            <p className="text-[11px] font-bold text-slate-500 uppercase m-0">Condición especial para urgencias (referido por el paciente)</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-700">En caso de requerir transfusiones, autoriza:</span>
              <SiNo value={condicion.autorizaTransfusiones} onChange={v => setCondicion(p => ({ ...p, autorizaTransfusiones: v }))} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-700">¿Bajo tratamiento hormonal?</span>
              <SiNo value={condicion.tratamientoHormonal} onChange={v => setCondicion(p => ({ ...p, tratamientoHormonal: v }))} />
              {condicion.tratamientoHormonal === true && <input type="text" placeholder="¿Cuál?" value={condicion.tratamientoHormonalCual} onChange={e => setCondicion(p => ({ ...p, tratamientoHormonalCual: e.target.value }))} className={INPUT_XS + ' w-48'} />}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Condición preexistente</label>
              <input type="text" value={condicion.condicionPreexistente} onChange={e => setCondicion(p => ({ ...p, condicionPreexistente: e.target.value }))} className={INPUT_XS} placeholder="Condición preexistente relevante…" />
            </div>
          </div>

          {/* Gineco / reproductivos según sexo */}
          {esMujer ? (
            <div className="border border-pink-200 rounded-lg overflow-hidden">
              <div className="bg-pink-50 px-4 py-2 text-xs font-bold text-pink-800 uppercase">Antecedentes gineco-obstétricos</div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="col-span-2"><label className="text-xs text-slate-600 mb-1 block">Última menstruación</label><input type="date" value={gineco.fum} onChange={e => updGineco({ fum: e.target.value })} className={INPUT_XS} /></div>
                  {(['gestas', 'partos', 'cesareas', 'abortos'] as const).map(k => (
                    <div key={k}><label className="text-xs text-slate-600 mb-1 block capitalize">{k}</label><input type="number" min={0} value={(gineco as any)[k]} onChange={e => updGineco({ [k]: e.target.value } as any)} className={INPUT_XS} /></div>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700">Método de planificación familiar:</span>
                  <SiNo value={gineco.planificacionFamiliar} onChange={v => updGineco({ planificacionFamiliar: v })} />
                  {gineco.planificacionFamiliar === true && <input type="text" value={gineco.planificacionTipo} onChange={e => updGineco({ planificacionTipo: e.target.value })} className={INPUT_XS + ' w-44'} placeholder="¿Cuál?" />}
                </div>
                <div className="space-y-2">
                  <FilaTamizaje label="Papanicolaou" ex={gineco.papanicolaou} onChange={p => updGineco({ papanicolaou: { ...gineco.papanicolaou, ...p } })} />
                  <FilaTamizaje label="Mamografía" ex={gineco.mamografia} onChange={p => updGineco({ mamografia: { ...gineco.mamografia, ...p } })} />
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-cyan-200 rounded-lg overflow-hidden">
              <div className="bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-800 uppercase">Antecedentes reproductivos masculinos</div>
              <div className="p-4 space-y-3">
                <FilaTamizaje label="Antígeno prostático" ex={reproductivos.antigenoProstatico} onChange={p => updRepro({ antigenoProstatico: { ...reproductivos.antigenoProstatico, ...p } })} />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700">Método de planificación familiar:</span>
                  <SiNo value={reproductivos.planificacionFamiliar} onChange={v => updRepro({ planificacionFamiliar: v })} />
                  {reproductivos.planificacionFamiliar === true && <input type="text" value={reproductivos.planificacionTipo} onChange={e => updRepro({ planificacionTipo: e.target.value })} className={INPUT_XS + ' w-44'} placeholder="¿Cuál?" />}
                </div>
              </div>
            </div>
          )}

          {/* Consumo de sustancias + estilo de vida */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Consumo de sustancias</label>
            <div className="space-y-2">
              {habitos.map((h, i) => (
                <div key={h.tipo} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-center text-sm bg-slate-50 p-2.5 rounded-lg">
                  <span className="font-semibold capitalize col-span-2 md:col-span-1">{h.tipo === 'drogas' ? 'Otras' : h.tipo}</span>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={h.consume} onChange={e => updateHabito(i, 'consume', e.target.checked)} /><span className="text-xs">Consume</span></label>
                  <input type="text" placeholder="Tiempo consumo" value={h.tiempoConsumo} onChange={e => updateHabito(i, 'tiempoConsumo', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <label className="flex items-center gap-1"><input type="checkbox" checked={h.exConsumidor} onChange={e => updateHabito(i, 'exConsumidor', e.target.checked)} /><span className="text-xs">Ex consumidor</span></label>
                  <input type="text" placeholder="T. abstinencia" value={h.tiempoAbstinencia} onChange={e => updateHabito(i, 'tiempoAbstinencia', e.target.value)} className="px-2 py-1 border rounded text-xs md:col-span-2" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Estilo de vida</label>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <label className="flex items-center gap-2"><input type="checkbox" checked={estiloVida.actividadFisica} onChange={e => setEstiloVida(p => ({ ...p, actividadFisica: e.target.checked }))} /><span className="text-xs font-medium">Actividad física</span></label>
              <input type="text" placeholder="¿Cuál?" value={estiloVida.tipoActividad} onChange={e => setEstiloVida(p => ({ ...p, tipoActividad: e.target.value }))} className="flex-1 min-w-[120px] px-2 py-1 border rounded text-xs" />
              <input type="text" placeholder="Tiempo" value={estiloVida.tiempoCantidad} onChange={e => setEstiloVida(p => ({ ...p, tiempoCantidad: e.target.value }))} className="flex-1 min-w-[120px] px-2 py-1 border rounded text-xs" />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-medium text-slate-700">Medicación habitual:</span>
              <input type="text" placeholder="¿Cuál?" value={estiloVida.medicacionHabitual} onChange={e => setEstiloVida(p => ({ ...p, medicacionHabitual: e.target.value }))} className="flex-1 min-w-[120px] px-2 py-1 border rounded text-xs" />
              <input type="text" placeholder="Cantidad" value={estiloVida.medicacionCantidad} onChange={e => setEstiloVida(p => ({ ...p, medicacionCantidad: e.target.value }))} className="flex-1 min-w-[120px] px-2 py-1 border rounded text-xs" />
            </div>
          </div>
          <div>
            {/* Va al renglón «Observación» que el formato imprime bajo el
                bloque de consumo de sustancias y estilo de vida. */}
            <label className="block text-xs font-bold text-slate-700 mb-1">Observación de hábitos y estilo de vida</label>
            <input type="text" value={observacionHabitos} onChange={e => setObservacionHabitos(e.target.value)} className={INPUT_XS}
              placeholder="Ej: alcohol, frecuencia de consumo 2 veces al mes." />
          </div>
        </div>

        {/* D. ENFERMEDAD ACTUAL */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">D. ENFERMEDAD O PROBLEMA ACTUAL</h2>
          <textarea rows={3} value={enfermedadActual} onChange={e => setEnfermedadActual(e.target.value)} className={INPUT} placeholder="Descripción…" />
        </div>

        {/* E. CONSTANTES VITALES */}
        <SignosVitalesForm onDataChange={handleSignos} initialData={signos} />

        {/* F. EXAMEN FÍSICO REGIONAL */}
        <SeccionI titulo="F. EXAMEN FÍSICO REGIONAL" REGIONES={REGIONES_EXAMEN_FISICO} seleccionados={efSel} hallazgos={efHallazgos} onToggle={toggleEf} onHallazgo={updateHallazgo} />

        {/* G. FACTORES DE RIESGO — matriz riesgo × actividad (igual que la pág. 2) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-1 border-b pb-2">G. FACTORES DE RIESGO DEL TRABAJO ACTUAL</h2>
          <p className="text-xs text-slate-500 mb-3">Marca en qué actividad de la jornada está presente cada factor. Se imprime tal cual en la página 2 (horizontal).</p>

          {perfilRiesgo ? (
            <div className="mb-3 flex items-start gap-2 flex-wrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <span className="text-[11.5px] text-emerald-900 flex-1 min-w-[220px]">
                Autocompletado con el <strong>perfil de riesgo del cargo</strong> «{perfilRiesgo.cargo}»:
                {' '}{perfilRiesgo.actividades.length} actividades y {Object.keys(perfilRiesgo.riesgoActividades).length} factores.
                Ajusta lo que no corresponda a este trabajador.
              </span>
              <button type="button" onClick={aplicarPerfilRiesgo}
                className="text-[11.5px] font-semibold text-emerald-800 border border-emerald-300 bg-white rounded px-2 py-0.5">
                ↻ Reaplicar perfil
              </button>
            </div>
          ) : (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
              El cargo «{trabajador.puestoTrabajo}» todavía no tiene perfil de riesgo por función.
              Márcalo a mano aquí y regístralo en Perfiles de riesgo para que se autocomplete la próxima vez.
            </div>
          )}

          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Puesto de trabajo</label>
            <input type="text" className={INPUT} value={factores.puestoArea} onChange={e => setFactores(p => ({ ...p, puestoArea: e.target.value }))} placeholder="Puesto de trabajo" />
          </div>

          {/* Actividades importantes de la jornada (columnas 1..7 de la matriz) */}
          <div className="rounded-lg border p-3 mb-3" style={{ borderColor: '#e4e6ea', background: '#f9fafb' }}>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-700">Actividades importantes dentro de la jornada laboral ({actividades.length}/{MAX_ACTIVIDADES})</label>
              <div className="flex gap-2">
                {funcionesCargo.length > 0 && (
                  <button type="button" onClick={() => { setActividades(funcionesCargo.slice(0, FUNCIONES_AUTOCOMPLETAR)); setMedidasActs([]); }}
                    className="text-[11.5px] font-semibold text-blue-700 border border-blue-200 bg-blue-50 rounded px-2 py-0.5">
                    ↻ Autocompletar del cargo
                  </button>
                )}
                {actividades.length < MAX_ACTIVIDADES && (
                  <button type="button" onClick={() => setActividades(a => [...a, ''])} className="text-[11.5px] font-bold text-blue-600 hover:underline">+ Añadir actividad</button>
                )}
              </div>
            </div>
            {funcionesCargo.length === 0 && (
              <p className="m-0 mb-2 text-[11px] text-amber-700">El cargo «{trabajador.puestoTrabajo}» no está en el catálogo de funciones: escribe las actividades a mano.</p>
            )}
            {actividades.length === 0 && <p className="m-0 text-[11.5px] text-slate-400 italic">Sin actividades. Añade al menos una para poder marcar los riesgos.</p>}
            <div className="space-y-1.5">
              {actividades.map((a, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="w-6 h-6 grid place-items-center rounded bg-slate-200 text-[11px] font-bold text-slate-600 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 space-y-1">
                    <input list="funciones-cargo" type="text" value={a} onChange={e => setActividades(arr => arr.map((x, j) => j === i ? e.target.value : x))}
                      className={INPUT_XS} placeholder={`Actividad ${i + 1}`} />
                    <input type="text" value={medidasActs[i] || ''}
                      onChange={e => setMedidasActs(arr => { const out = [...arr]; while (out.length <= i) out.push(''); out[i] = e.target.value; return out; })}
                      className={INPUT_XS + ' bg-emerald-50'} placeholder={`Medidas preventivas de la actividad ${i + 1} (pie de su columna)`} />
                  </div>
                  <button type="button" title="Quitar actividad"
                    onClick={() => { setActividades(arr => arr.filter((_, j) => j !== i)); setMedidasActs(arr => arr.filter((_, j) => j !== i)); setRiesgoActs(prev => {
                      // Al quitar una actividad se reindexan las marcas de la matriz.
                      const out: Record<string, number[]> = {};
                      Object.entries(prev).forEach(([r, idxs]) => {
                        const nuevos = idxs.filter(k => k !== i).map(k => (k > i ? k - 1 : k));
                        if (nuevos.length) out[r] = nuevos;
                      });
                      return out;
                    }); }}
                    className="text-red-400 hover:text-red-600 px-1"><X size={14} /></button>
                </div>
              ))}
              <datalist id="funciones-cargo">{funcionesCargo.map(f => <option key={f} value={f} />)}</datalist>
            </div>
          </div>

          <MatrizRiesgos actividades={actividades} marcadas={riesgoActs} onToggle={toggleRiesgoActividad} />

          <p className="text-[11px] text-slate-500 mt-3">
            Las medidas preventivas se escriben por actividad (campo verde de cada una) y se imprimen al pie de su columna en la matriz.
          </p>
          {totalRiesgos > 0 && <p className="text-[11px] text-slate-400 mt-2">{totalRiesgos} factores marcados.</p>}
        </div>

        {/* H. ACTIVIDAD LABORAL / INCIDENTES / ACCIDENTES */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <div className="flex items-center justify-between mb-2 border-b pb-2">
            <h2 className="text-sm font-bold text-slate-800">H. ACTIVIDAD LABORAL / INCIDENTES / ACCIDENTES / ENFERMEDADES OCUPACIONALES</h2>
            <button type="button" onClick={() => setEmpleos(prev => [...prev, emptyAntecedenteEmpleo()])} className="text-blue-600 text-xs font-bold hover:underline">+ Agregar</button>
          </div>
          {empleos.length === 0 && <p className="text-xs text-slate-400 italic">Sin empleos anteriores ni novedades registradas.</p>}
          <div className="space-y-3">
            {empleos.map((e, i) => (
              <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">Registro #{i + 1}</span>
                    <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={!!e.esActual} onChange={ev => updateEmpleo(i, 'esActual', ev.target.checked)} /> Trabajo actual</label>
                  </div>
                  <button type="button" onClick={() => setEmpleos(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input type="text" placeholder="Centro de trabajo" value={e.empresa} onChange={ev => updateEmpleo(i, 'empresa', ev.target.value)} className={INPUT_XS} />
                  <input type="text" placeholder="Actividades que desempeñaba" value={e.actividades} onChange={ev => updateEmpleo(i, 'actividades', ev.target.value)} className={INPUT_XS + ' md:col-span-2'} />
                  <input type="number" min={0} placeholder="Tiempo (meses)" value={e.tiempoMeses} onChange={ev => updateEmpleo(i, 'tiempoMeses', ev.target.value)} className={INPUT_XS} />
                </div>
                <div className="flex items-center gap-3 flex-wrap text-[11px]">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={!!e.incidente} onChange={ev => updateEmpleo(i, 'incidente', ev.target.checked)} /> Incidente</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={!!e.accidente} onChange={ev => updateEmpleo(i, 'accidente', ev.target.checked)} /> Accidente</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={!!e.enfermedadProfesional} onChange={ev => updateEmpleo(i, 'enfermedadProfesional', ev.target.checked)} /> Enfermedad profesional</label>
                  {(e.accidente || e.enfermedadProfesional) && (
                    <span className="flex items-center gap-1.5"><span className="font-semibold">Calificado IESS:</span><SiNo value={e.calificadoIess ?? null} onChange={v => updateEmpleo(i, 'calificadoIess', v)} /></span>
                  )}
                </div>
                {(e.accidente || e.enfermedadProfesional || e.incidente) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input type="date" value={e.fechaCalificacion ?? ''} onChange={ev => updateEmpleo(i, 'fechaCalificacion', ev.target.value)} className={INPUT_XS} />
                    <input type="text" placeholder="Especificar" value={e.especificar ?? ''} onChange={ev => updateEmpleo(i, 'especificar', ev.target.value)} className={INPUT_XS} />
                  </div>
                )}
                <input type="text" placeholder="Observaciones" value={e.observaciones} onChange={ev => updateEmpleo(i, 'observaciones', ev.target.value)} className={INPUT_XS} />
              </div>
            ))}
          </div>
        </div>

        {/* I. ACTIVIDADES EXTRA LABORALES */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">I. ACTIVIDADES EXTRA LABORALES</h2>
          <textarea rows={2} value={actividadesExtra} onChange={e => setActividadesExtra(e.target.value)} className={INPUT} placeholder="Deportes, otros trabajos, pasatiempos relevantes…" />
        </div>

        {/* J. EXÁMENES */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">J. RESULTADOS DE EXÁMENES GENERALES Y ESPECÍFICOS</h2>
          {examenes.map((ex, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input type="text" placeholder="Nombre del examen" value={ex.nombre} onChange={e => { const u = [...examenes]; u[i] = { ...u[i], nombre: e.target.value }; setExamenes(u); }} className="w-1/3 px-2 py-1 border rounded text-sm" />
              <input type="date" value={ex.fecha} onChange={e => { const u = [...examenes]; u[i] = { ...u[i], fecha: e.target.value }; setExamenes(u); }} className="w-1/6 px-2 py-1 border rounded text-sm" />
              <input type="text" placeholder="Resultado" value={ex.resultado} onChange={e => { const u = [...examenes]; u[i] = { ...u[i], resultado: e.target.value }; setExamenes(u); }} className="flex-1 px-2 py-1 border rounded text-sm" />
              <button type="button" onClick={() => setExamenes(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 font-bold px-2">×</button>
            </div>
          ))}
          <button type="button" onClick={() => setExamenes(prev => [...prev, { nombre: '', fecha: '', resultado: '' }])} className="text-blue-600 text-xs font-medium mt-2 hover:underline">+ Agregar fila</button>
        </div>

        {/* K. DIAGNÓSTICO */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">K. DIAGNÓSTICO <span className="text-red-500">*</span></h2>
          {diagnosticos.map((dx, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
              <div className="md:col-span-3">
                <BuscadorCIE10 valorActual={dx.descripcion ? `${dx.cie} - ${dx.descripcion}` : ''} onSeleccionar={(c, d) => { const u = [...diagnosticos]; u[i] = { ...u[i], cie: c, descripcion: d }; setDiagnosticos(u); }} />
              </div>
              <select value={dx.tipo} onChange={e => { const u = [...diagnosticos]; u[i] = { ...u[i], tipo: e.target.value as any }; setDiagnosticos(u); }} className="px-2 py-1 border rounded text-sm bg-white">
                <option value="presuntivo">Presuntivo</option><option value="definitivo">Definitivo</option>
              </select>
            </div>
          ))}
          {diagnosticos.length < 6 && <button type="button" onClick={() => setDiagnosticos(prev => [...prev, { descripcion: '', cie: '', tipo: 'definitivo' }])} className="text-blue-600 text-xs font-medium mt-2 hover:underline">+ Agregar diagnóstico</button>}
        </div>

        {/* L. APTITUD */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">L. APTITUD MÉDICA PARA EL TRABAJO</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {[['apto', 'APTO'], ['aptoObservacion', 'APTO EN OBSERVACIÓN'], ['aptoLimitaciones', 'APTO CON LIMITACIONES'], ['noApto', 'NO APTO']].map(([v, l]) => (
              <label key={v} className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer text-xs font-semibold ${aptitud === v ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="apt" checked={aptitud === v} onChange={() => setAptitud(v as any)} className="hidden" /><span>{l}</span>
              </label>
            ))}
          </div>
          <textarea rows={2} className={INPUT} value={aptitudObs} onChange={e => setAptitudObs(e.target.value)} placeholder="Observaciones (limitaciones, reubicación si aplica)…" />
        </div>

        {/* M. RECOMENDACIONES */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">M. RECOMENDACIONES Y/O TRATAMIENTO</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
            {OPCIONES_RECOMENDACIONES.map(op => (
              <label key={op} className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded cursor-pointer hover:bg-slate-100">
                <input type="checkbox" checked={recomendaciones.includes(op)} onChange={e => { if (e.target.checked) setRecomendaciones(p => [...p, op]); else setRecomendaciones(p => p.filter(r => r !== op)); }} /><span>{op}</span>
              </label>
            ))}
          </div>
          <textarea rows={2} className={INPUT} value={recomendacionesOtras} onChange={e => setRecomendacionesOtras(e.target.value)} placeholder="Otras recomendaciones específicas…" />
        </div>

        {/* N. RETIRO (solo tipo retiro) */}
        {esRetiro && (
          <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-4 md:p-6 space-y-3">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2">N. RETIRO (evaluación)</h2>
            <div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold text-slate-700">Se realiza la evaluación:</span><SiNo value={retiroRealizada} onChange={setRetiroRealizada} /></div>
            <div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold text-slate-700">La condición de salud está relacionada con el trabajo:</span><SiNo value={retiroRelacion} onChange={setRetiroRelacion} /></div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Observación</label><textarea rows={2} className={INPUT} value={retiroObs} onChange={e => setRetiroObs(e.target.value)} /></div>
          </div>
        )}

        {/* Firmas + guardar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <p className="text-xs text-slate-600 italic mb-4">CERTIFICO QUE LO ANTERIORMENTE EXPRESADO EN RELACIÓN A MI ESTADO DE SALUD ES VERDAD. SE ME HA INFORMADO LAS MEDIDAS PREVENTIVAS A TOMAR PARA DISMINUIR O MITIGAR LOS RIESGOS RELACIONADOS CON MI ACTIVIDAD LABORAL.</p>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="text-xs font-bold text-slate-700 mb-2">O. DATOS DEL PROFESIONAL</h4>
              <p><span className="font-semibold">Nombre:</span> {nombreProfesionalDe(medicoData) || 'Cargando...'}</p>
              <p><span className="font-semibold">Código:</span> {codigoProfesionalDe(medicoData) || 'Cargando...'}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="text-xs font-bold text-slate-700 mb-2">P. FIRMA O HUELLA DEL TRABAJADOR</h4>
              <p className="text-slate-500 text-xs italic">Firma del trabajador al momento de la consulta presencial</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pb-8">
          <button onClick={handleGuardar} disabled={guardando} className="w-full sm:w-auto bg-blue-600 text-white font-semibold py-3 px-10 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-70 shadow-md text-sm">
            {guardando ? 'Guardando...' : editEvalId ? 'Guardar Cambios' : 'Guardar Evaluación Ocupacional'}
          </button>
        </div>
      </div>
    </div>
  );
}
