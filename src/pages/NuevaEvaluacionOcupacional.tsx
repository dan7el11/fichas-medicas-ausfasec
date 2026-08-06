// HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN MÉDICA OCUPACIONAL (formato unificado
// SNS-MSP/HCU-form.123/2025). Reemplaza a los formularios SO-RE-38/39/40/41: un
// solo formulario con selector de TIPO DE EVALUACIÓN (ingreso/periódico/
// reintegro/retiro) para catalogar y buscar. Los antecedentes se toman del
// expediente secuencial del trabajador (se autocompletan y se actualizan).
// Reutiliza SignosVitalesForm, SeccionI (examen físico), BuscadorCIE10 y catálogos.
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/Toast';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { registrarAuditoria } from '../services/auditoria';
import { useAuth } from '../contexts/AuthContext';
import SignosVitalesForm from '../components/SignosVitalesForm';
import BuscadorCIE10 from '../components/BuscadorCIE10';
import { useEmpresa } from '../hooks/useEmpresa';
import { SeccionI } from '../components/evaluacion/SeccionesEvaluacion';
import { getExpedienteAntecedentes, fusionarYGuardarAntecedentes } from '../services/antecedentes';
import { nombreProfesionalDe, codigoProfesionalDe } from '../utils/medicalHelpers';
import {
  OPCIONES_RECOMENDACIONES, REGIONES_EXAMEN_FISICO,
  RIESGOS_FISICOS, RIESGOS_SEGURIDAD, RIESGOS_QUIMICOS_U, RIESGOS_BIOLOGICOS, RIESGOS_ERGONOMICOS_U, RIESGOS_PSICOSOCIALES_U,
  GRUPOS_PRIORITARIOS, GRUPOS_SANGUINEOS, LATERALIDADES, TIPOS_EVALUACION_OCUP,
  emptyAntecedenteEmpleo, emptyAntecedentesGineco, emptyAntecedentesReproductivos, emptyDatosPersonales,
} from '../utils/catalogosEvaluacion';
import type {
  Trabajador, SignosVitales, HabitoToxico, EstiloVida, ExamenFisicoHallazgo, ExamenComplementario,
  Diagnostico, Usuario, FactorRiesgoPuesto, DatosPersonalesSO41, CondicionEspecial,
  AntecedentesGineco, AntecedentesReproductivos, AntecedenteEmpleo, ExpedienteAntecedentes,
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

// Grupo de casillas de un factor de riesgo (Sección G)
function GrupoRiesgo({ titulo, color, items, sel, onToggle }: { titulo: string; color: string; items: string[]; sel: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className={`${color} px-3 py-1.5 text-xs font-bold text-white`}>{titulo}</div>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
        {items.map(op => (
          <label key={op} className={`flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded ${sel.includes(op) ? 'bg-blue-50 font-semibold text-blue-800' : 'hover:bg-slate-50'}`}>
            <input type="checkbox" checked={sel.includes(op)} onChange={() => onToggle(op)} /> {op}
          </label>
        ))}
      </div>
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

  // A. Datos
  const [datosPersonales, setDatosPersonales] = useState<DatosPersonalesSO41>(emptyDatosPersonales());
  // B. Motivo
  const [tipoEvaluacion, setTipoEvaluacion] = useState<string>(tipoQuery && TIPOS_EVALUACION_OCUP.some(t => t.valor === tipoQuery) ? tipoQuery : 'periodica');
  const [fechaAtencion, setFechaAtencion] = useState(new Date().toISOString().slice(0, 10));
  const [fechaIngresoTrabajo, setFechaIngresoTrabajo] = useState('');
  const [fechaReingreso, setFechaReingreso] = useState('');
  const [fechaUltimoDia, setFechaUltimoDia] = useState('');
  const [motivoConsulta, setMotivoConsulta] = useState('');
  // C. Antecedentes
  const [clinicosTexto, setClinicosTexto] = useState('');
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
  // D
  const [enfermedadActual, setEnfermedadActual] = useState('');
  // E
  const [signos, setSignos] = useState<SignosVitales>({ presionSistolica: '', presionDiastolica: '', temperatura: '', frecuenciaCardiaca: '', frecuenciaRespiratoria: '', saturacion: '', peso: '', talla: '', imc: 0, perimetroAbdominal: '' });
  // F
  const [efSel, setEfSel] = useState<Set<string>>(new Set());
  const [efHallazgos, setEfHallazgos] = useState<ExamenFisicoHallazgo[]>([]);
  // G
  const [factores, setFactores] = useState<FactorRiesgoPuesto>({ puestoArea: '', actividades: '', tiempoTrabajoMeses: '', fisicos: [], mecanicos: [], quimicos: [], biologicos: [], ergonomicos: [], psicosociales: [], medidasPreventivas: '' });
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
  const esReintegro = tipoEvaluacion === 'reintegro';
  const esMujer = trabajador?.sexo === 'F';

  // Aplica un expediente de antecedentes al formulario (autocompletado).
  const aplicarExpediente = useCallback((exp: ExpedienteAntecedentes | null, tallaFallback?: string) => {
    if (!exp) { if (tallaFallback) setSignos(prev => ({ ...prev, talla: tallaFallback })); return; }
    if (exp.datosPersonales) setDatosPersonales(prev => ({ ...prev, ...exp.datosPersonales }));
    if (exp.condicionEspecial) setCondicion({ ...emptyCondicion(), ...exp.condicionEspecial });
    if (exp.antecedentesClinicosTexto) setClinicosTexto(exp.antecedentesClinicosTexto);
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
      if (trabDoc.exists()) { trab = { id: trabDoc.id, ...trabDoc.data() } as Trabajador; setTrabajador(trab); setFactores(prev => ({ ...prev, puestoArea: trab!.puestoTrabajo })); }
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
            setClinicosTexto(ev.antecedentesClinicosTexto || ev.antecedentesClinicosQuirurgicos || '');
            setFamiliaresTexto(ev.antecedentesFamiliaresTexto || '');
            if (ev.antecedentesGineco) setGineco({ ...emptyAntecedentesGineco(), ...ev.antecedentesGineco });
            if (ev.antecedentesReproductivos) setReproductivos({ ...emptyAntecedentesReproductivos(), ...ev.antecedentesReproductivos });
            if (ev.habitosToxicos) setHabitos(ev.habitosToxicos);
            if (ev.estiloVida) setEstiloVida(ev.estiloVida);
            setEnfermedadActual(ev.enfermedadActual || '');
            if (ev.signosVitales) setSignos(ev.signosVitales);
            if (ev.examenFisicoHallazgos) {
              setEfHallazgos(ev.examenFisicoHallazgos);
              const s = new Set<string>();
              ev.examenFisicoHallazgos.forEach((h: any) => { const n = h.codigo.match(/^\d+/)?.[0]; const c = h.codigo.replace(/^\d+/, ''); if (n && c) s.add(`${n}-${c}`); });
              setEfSel(s);
            }
            if (ev.factoresRiesgo) setFactores(ev.factoresRiesgo);
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
      }
    };
    cargar();
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
  const toggleRiesgo = (cat: keyof Pick<FactorRiesgoPuesto, 'fisicos' | 'mecanicos' | 'quimicos' | 'biologicos' | 'ergonomicos' | 'psicosociales'>, v: string) =>
    setFactores(prev => { const arr = prev[cat]; return { ...prev, [cat]: arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v] }; });
  const updateHabito = (i: number, f: keyof HabitoToxico, v: any) => setHabitos(prev => { const u = [...prev]; u[i] = { ...u[i], [f]: v }; return u; });
  const updateEmpleo = (i: number, f: keyof AntecedenteEmpleo, v: any) => setEmpleos(prev => { const u = [...prev]; u[i] = { ...u[i], [f]: v }; return u; });
  const updGineco = (p: Partial<AntecedentesGineco>) => setGineco(prev => ({ ...prev, ...p }));
  const updRepro = (p: Partial<AntecedentesReproductivos>) => setReproductivos(prev => ({ ...prev, ...p }));

  // ===== GUARDAR =====
  const handleGuardar = async () => {
    if (!trabajadorId || !user || !trabajador) return;
    const errores: string[] = [];
    if (!motivoConsulta.trim()) errores.push('Indica el motivo de consulta (Sección B).');
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
        fechaAtencion,
        fechaIngresoTrabajo,
        ...(esReintegro ? { fechaReingreso, fechaUltimoDiaLaboral: fechaUltimoDia } : {}),
        motivoConsulta,
        antecedentesClinicosTexto: clinicosTexto,
        antecedentesFamiliaresTexto: familiaresTexto,
        condicionEspecial: condicion,
        habitosToxicos: habitos,
        estiloVida,
        enfermedadActual,
        signosVitales: signos,
        examenFisicoHallazgos: efHallazgos,
        factoresRiesgo: factores,
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
          antecedentesFamiliaresTexto: familiaresTexto,
          habitosToxicos: habitos,
          estiloVida,
          antecedentesEmpleos: empleosLimpios,
          ...(esMujer ? { antecedentesGineco: gineco } : { antecedentesReproductivos: reproductivos }),
        };
        await fusionarYGuardarAntecedentes(trabajadorId, nuevosAntec, { evaluacionId: evaluacionId ?? undefined, medicoId: user.uid });
      } catch (err) { console.warn('No se pudo actualizar el expediente de antecedentes:', err); }

      // Al terminar se ofrece el Certificado de Aptitud (SO-RE-20).
      navigate(evaluacionId ? `/trabajador/${trabajadorId}?certificado=${evaluacionId}` : `/trabajador/${trabajadorId}`);
    } catch (error) {
      console.error('Error al guardar:', error);
      toast.error('Hubo un error al procesar la evaluación.');
    } finally {
      setGuardando(false);
    }
  };

  if (!trabajador) return <div className="min-h-screen p-8 text-center text-slate-500">Cargando datos del trabajador...</div>;

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de atención</label>
              <input type="date" value={fechaAtencion} onChange={e => setFechaAtencion(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de ingreso al trabajo</label>
              <input type="date" value={fechaIngresoTrabajo} onChange={e => setFechaIngresoTrabajo(e.target.value)} className={INPUT} />
            </div>
            {esReintegro && (
              <>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de reintegro</label><input type="date" value={fechaReingreso} onChange={e => setFechaReingreso(e.target.value)} className={INPUT} /></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">Último día laboral / salida</label><input type="date" value={fechaUltimoDia} onChange={e => setFechaUltimoDia(e.target.value)} className={INPUT} /></div>
              </>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Observación / motivo <span className="text-red-500">*</span></label>
            <textarea rows={2} value={motivoConsulta} onChange={e => setMotivoConsulta(e.target.value)} className={`${INPUT} ${!motivoConsulta.trim() ? 'border-red-300 bg-red-50' : ''}`} placeholder="Motivo o condición de la evaluación…" />
          </div>
        </div>

        {/* C. ANTECEDENTES PERSONALES */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800 border-b pb-2">C. ANTECEDENTES PERSONALES</h2>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Antecedentes clínicos y quirúrgicos</label>
            <textarea rows={2} value={clinicosTexto} onChange={e => setClinicosTexto(e.target.value)} className={INPUT} placeholder="Descripción…" />
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

        {/* G. FACTORES DE RIESGO */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-1 border-b pb-2">G. FACTORES DE RIESGO DEL TRABAJO ACTUAL</h2>
          <p className="text-xs text-slate-500 mb-4">Marca los factores presentes en el puesto. Se imprimen como matriz en la página 2 (horizontal).</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <input type="text" className={INPUT} value={factores.puestoArea} onChange={e => setFactores(p => ({ ...p, puestoArea: e.target.value }))} placeholder="Puesto de trabajo" />
            <input type="text" className={INPUT + ' md:col-span-2'} value={factores.actividades} onChange={e => setFactores(p => ({ ...p, actividades: e.target.value }))} placeholder="Actividades importantes dentro de la jornada laboral" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GrupoRiesgo titulo="FÍSICO" color="bg-blue-600" items={RIESGOS_FISICOS} sel={factores.fisicos} onToggle={v => toggleRiesgo('fisicos', v)} />
            <GrupoRiesgo titulo="DE SEGURIDAD (locativos, mecánicos, eléctricos)" color="bg-red-600" items={RIESGOS_SEGURIDAD} sel={factores.mecanicos} onToggle={v => toggleRiesgo('mecanicos', v)} />
            <GrupoRiesgo titulo="QUÍMICO" color="bg-amber-600" items={RIESGOS_QUIMICOS_U} sel={factores.quimicos} onToggle={v => toggleRiesgo('quimicos', v)} />
            <GrupoRiesgo titulo="BIOLÓGICO" color="bg-green-600" items={RIESGOS_BIOLOGICOS} sel={factores.biologicos} onToggle={v => toggleRiesgo('biologicos', v)} />
            <GrupoRiesgo titulo="ERGONÓMICO" color="bg-purple-600" items={RIESGOS_ERGONOMICOS_U} sel={factores.ergonomicos} onToggle={v => toggleRiesgo('ergonomicos', v)} />
            <GrupoRiesgo titulo="PSICOSOCIAL" color="bg-pink-600" items={RIESGOS_PSICOSOCIALES_U} sel={factores.psicosociales} onToggle={v => toggleRiesgo('psicosociales', v)} />
          </div>
          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-700 mb-1">Medidas preventivas</label>
            <textarea rows={2} className={INPUT} value={factores.medidasPreventivas} onChange={e => setFactores(p => ({ ...p, medidasPreventivas: e.target.value }))} />
          </div>
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
