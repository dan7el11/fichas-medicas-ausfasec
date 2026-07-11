// HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN PREOCUPACIONAL - INICIO (SO-RE-41).
// Sigue la hoja oficial (3 páginas, secciones A–Q). Usa los MISMOS nombres de
// campo que la evaluación periódica (SO-RE-38) para que los antecedentes
// registrados aquí sean la partida y se precarguen en evaluaciones posteriores.
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/Toast';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, updateDoc, arrayUnion, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { registrarAuditoria } from '../services/auditoria';
import { useAuth } from '../contexts/AuthContext';
import SignosVitalesForm from '../components/SignosVitalesForm';
import BuscadorCIE10 from '../components/BuscadorCIE10';
import { useEmpresa } from '../hooks/useEmpresa';
import { SeccionE, SeccionG, SeccionI } from '../components/evaluacion/SeccionesEvaluacion';
import {
  OPCIONES_RECOMENDACIONES, SISTEMAS, REGIONES_EXAMEN_FISICO, TIPOS_ANTECEDENTES_FAMILIARES,
  RIESGOS_FISICOS, RIESGOS_MECANICOS, RIESGOS_QUIMICOS, RIESGOS_BIOLOGICOS, RIESGOS_ERGONOMICOS, RIESGOS_PSICOSOCIALES,
  CATEGORIAS_RIESGO_EMPLEO,
  emptyAntecedenteClinico, emptyAntecedenteQuirurgico, emptyAlergia, emptyAntecedenteEmpleo,
  emptyAntecedentesGineco, emptyAntecedentesReproductivos,
} from '../utils/catalogosEvaluacion';
import type {
  Trabajador, SignosVitales, HabitoToxico, EstiloVida, AccidenteTrabajo, EnfermedadProfesional,
  AntecedenteFamiliar, ExamenFisicoHallazgo, ExamenComplementario, Diagnostico, Usuario,
  FactorRiesgoPuesto, AntecedenteClinico, AntecedenteQuirurgico, Alergia, MedicacionHabitual,
  AntecedenteEmpleo, AntecedentesGineco, AntecedentesReproductivos, ExamenTamizaje,
} from '../types';

const INPUT_XS = 'w-full px-2 py-1.5 border rounded-lg text-xs';

// Fila de examen de tamizaje (PAP, mamografía, PSA…): SI/NO + tiempo + resultado.
// Definido FUERA del componente principal para que React no lo remonte en cada
// render (si no, los inputs pierden el foco al escribir).
function FilaTamizaje({ label, ex, onChange }: { label: string; ex: ExamenTamizaje; onChange: (patch: Partial<ExamenTamizaje>) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-center bg-slate-50 p-2.5 rounded-lg text-xs">
      <span className="font-semibold col-span-2 md:col-span-2">{label}</span>
      <div className="flex gap-1.5">
        {([true, false] as const).map(val => (
          <button key={String(val)} type="button" onClick={() => onChange({ realizado: ex.realizado === val ? null : val })}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${ex.realizado === val ? (val ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-600 text-white border-slate-600') : 'bg-white text-slate-600 border-slate-300'}`}>
            {val ? 'Sí' : 'No'}
          </button>
        ))}
      </div>
      <input type="text" placeholder="Tiempo (años)" value={ex.tiempoAnios} onChange={e => onChange({ tiempoAnios: e.target.value })} className={INPUT_XS} disabled={ex.realizado !== true} />
      <input type="text" placeholder="Resultado" value={ex.resultado} onChange={e => onChange({ resultado: e.target.value })} className={INPUT_XS + ' md:col-span-2'} disabled={ex.realizado !== true} />
    </div>
  );
}

function SiNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <div className="flex gap-1.5">
      {([true, false] as const).map(val => (
        <button key={String(val)} type="button" onClick={() => onChange(value === val ? null : val)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${value === val ? (val ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-600 text-white border-slate-600') : 'bg-white text-slate-600 border-slate-300'}`}>
          {val ? 'Sí' : 'No'}
        </button>
      ))}
    </div>
  );
}

export default function NuevaPreocupacional() {
  const { trabajadorId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const editEvalId = searchParams.get('editId');
  const { user } = useAuth();
  const { empresa: DATOS_EMPRESA } = useEmpresa();

  const [trabajador, setTrabajador] = useState<Trabajador | null>(null);
  const [medicoData, setMedicoData] = useState<Usuario | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [mostrarModalExamenes, setMostrarModalExamenes] = useState(false);
  const [examenesDisponibles, setExamenesDisponibles] = useState<any[]>([]);
  const [examenesSeleccionadosModal, setExamenesSeleccionadosModal] = useState<string[]>([]);
  const [cargandoExamenesHist, setCargandoExamenesHist] = useState(false);

  // ===== ESTADOS DEL FORMULARIO (mismos nombres de campo que SO-RE-38) =====

  // B. Motivo de consulta
  const [motivoConsulta, setMotivoConsulta] = useState('EVALUACIÓN MÉDICA PREOCUPACIONAL DE INGRESO');

  // C. Antecedentes personales
  const [antecedentesClinicosQ, setAntecedentesClinicosQ] = useState<boolean | null>(null);
  const [antecedentesClinicosLista, setAntecedentesClinicosLista] = useState<AntecedenteClinico[]>([]);
  const [antecedentesQuirurgicosQ, setAntecedentesQuirurgicosQ] = useState<boolean | null>(null);
  const [antecedentesQuirurgicosLista, setAntecedentesQuirurgicosLista] = useState<AntecedenteQuirurgico[]>([]);
  const [alergiasTiene, setAlergiasTiene] = useState<boolean | null>(null);
  const [alergias, setAlergias] = useState<Alergia[]>([]);
  const [antecedentesGineco, setAntecedentesGineco] = useState<AntecedentesGineco>(emptyAntecedentesGineco());
  const [antecedentesReproductivos, setAntecedentesReproductivos] = useState<AntecedentesReproductivos>(emptyAntecedentesReproductivos());
  const [habitosToxicos, setHabitosToxicos] = useState<HabitoToxico[]>([
    { tipo: 'tabaco', consume: false, tiempoConsumo: '', cantidad: '', exConsumidor: false, tiempoAbstinencia: '' },
    { tipo: 'alcohol', consume: false, tiempoConsumo: '', cantidad: '', exConsumidor: false, tiempoAbstinencia: '' },
    { tipo: 'drogas', consume: false, tiempoConsumo: '', cantidad: '', exConsumidor: false, tiempoAbstinencia: '' },
  ]);
  const [estiloVida, setEstiloVida] = useState<EstiloVida>({
    actividadFisica: false, tipoActividad: '', tiempoCantidad: '',
    medicacionHabitual: '', medicacionCantidad: '',
  });
  const [medicacionesHabituales, setMedicacionesHabituales] = useState<MedicacionHabitual[]>([]);

  // D. Antecedentes de trabajo
  const [edadInicioLaboral, setEdadInicioLaboral] = useState('');
  const [antecedentesEmpleos, setAntecedentesEmpleos] = useState<AntecedenteEmpleo[]>([]);
  const [accidenteTrabajo, setAccidenteTrabajo] = useState<AccidenteTrabajo>({
    descripcion: '', calificado: false, especificacion: '',
    fechaAnio: '', fechaMes: '', fechaDia: '', observaciones: '',
  });
  const [enfermedadProfesional, setEnfermedadProfesional] = useState<EnfermedadProfesional>({
    descripcion: '', calificada: false, especificacion: '',
    fechaAnio: '', fechaMes: '', fechaDia: '', observaciones: '',
  });

  // E. Antecedentes familiares
  const [antecedentesFamiliares, setAntecedentesFamiliares] = useState<AntecedenteFamiliar[]>([]);

  // F. Factores de riesgo del puesto de trabajo actual
  const [factoresRiesgo, setFactoresRiesgo] = useState<FactorRiesgoPuesto>({
    puestoArea: '', actividades: '', tiempoTrabajoMeses: '',
    fisicos: [], mecanicos: [], quimicos: [], biologicos: [],
    ergonomicos: [], psicosociales: [], medidasPreventivas: '',
  });

  // G. Actividades extra laborales
  const [actividadesExtraLaborales, setActividadesExtraLaborales] = useState('');

  // H. Enfermedad actual
  const [enfermedadActual, setEnfermedadActual] = useState('');

  // I. Revisión de órganos y sistemas
  const [revisionSistemasSeleccionados, setRevisionSistemasSeleccionados] = useState<string[]>([]);
  const [revisionSistemasDescripciones, setRevisionSistemasDescripciones] = useState<Record<string, string>>({});

  // J. Constantes vitales
  const [signosVitales, setSignosVitales] = useState<SignosVitales>({
    presionSistolica: '', presionDiastolica: '', temperatura: '',
    frecuenciaCardiaca: '', frecuenciaRespiratoria: '', saturacion: '',
    peso: '', talla: '', imc: 0, perimetroAbdominal: '',
  });

  // K. Examen físico regional
  const [examenFisicoSeleccionados, setExamenFisicoSeleccionados] = useState<Set<string>>(new Set());
  const [examenFisicoHallazgos, setExamenFisicoHallazgos] = useState<ExamenFisicoHallazgo[]>([]);

  // L. Exámenes complementarios
  const [examenesComplementarios, setExamenesComplementarios] = useState<ExamenComplementario[]>([
    { nombre: '', fecha: '', resultado: '' },
  ]);

  // M. Diagnósticos
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([
    { descripcion: '', cie: '', tipo: 'definitivo' },
  ]);

  // N. Aptitud médica
  const [aptitudMedica, setAptitudMedica] = useState<'apto' | 'aptoObservacion' | 'aptoLimitaciones' | 'noApto'>('apto');
  const [aptitudObservacion, setAptitudObservacion] = useState('');
  const [aptitudLimitaciones, setAptitudLimitaciones] = useState('');

  // O. Recomendaciones
  const [recomendaciones, setRecomendaciones] = useState<string[]>([]);
  const [recomendacionesOtras, setRecomendacionesOtras] = useState('');

  // ===== CARGA DE DATOS =====
  useEffect(() => {
    const cargarDatos = async () => {
      if (!trabajadorId || !user) return;

      const trabDoc = await getDoc(doc(db, 'trabajadores', trabajadorId));
      if (trabDoc.exists()) {
        const trabData = { id: trabDoc.id, ...trabDoc.data() } as Trabajador;
        setTrabajador(trabData);
        setFactoresRiesgo(prev => ({ ...prev, puestoArea: trabData.puestoTrabajo }));
      }

      const medicoDoc = await getDoc(doc(db, 'usuarios', user.uid));
      if (medicoDoc.exists()) setMedicoData(medicoDoc.data() as Usuario);

      if (editEvalId) {
        // MODO EDICIÓN
        try {
          const evalDoc = await getDoc(doc(db, 'evaluaciones', editEvalId));
          if (evalDoc.exists()) {
            const ev = evalDoc.data();
            setMotivoConsulta(ev.motivoConsulta || '');
            if (ev.antecedentesClinicosQ !== undefined) setAntecedentesClinicosQ(ev.antecedentesClinicosQ);
            if (ev.antecedentesClinicosLista) setAntecedentesClinicosLista(ev.antecedentesClinicosLista);
            if (ev.antecedentesQuirurgicosQ !== undefined) setAntecedentesQuirurgicosQ(ev.antecedentesQuirurgicosQ);
            if (ev.antecedentesQuirurgicosLista) setAntecedentesQuirurgicosLista(ev.antecedentesQuirurgicosLista);
            if (ev.alergiasTiene !== undefined) setAlergiasTiene(ev.alergiasTiene);
            if (ev.alergias) setAlergias(ev.alergias);
            if (ev.antecedentesGineco) setAntecedentesGineco({ ...emptyAntecedentesGineco(), ...ev.antecedentesGineco });
            if (ev.antecedentesReproductivos) setAntecedentesReproductivos({ ...emptyAntecedentesReproductivos(), ...ev.antecedentesReproductivos });
            if (ev.habitosToxicos) setHabitosToxicos(ev.habitosToxicos);
            if (ev.estiloVida) setEstiloVida(ev.estiloVida);
            if (ev.medicacionesHabituales) setMedicacionesHabituales(ev.medicacionesHabituales);
            setEdadInicioLaboral(ev.edadInicioLaboral || '');
            if (ev.antecedentesEmpleos) setAntecedentesEmpleos(ev.antecedentesEmpleos);
            if (ev.accidentesTrabajo) setAccidenteTrabajo(ev.accidentesTrabajo);
            if (ev.enfermedadesProfesionales) setEnfermedadProfesional(ev.enfermedadesProfesionales);
            if (ev.antecedentesFamiliares) setAntecedentesFamiliares(ev.antecedentesFamiliares);
            if (ev.factoresRiesgo) setFactoresRiesgo(ev.factoresRiesgo);
            setActividadesExtraLaborales(ev.actividadesExtraLaborales || '');
            setEnfermedadActual(ev.enfermedadActual || '');
            if (ev.revisionSistemasSeleccionados) setRevisionSistemasSeleccionados(ev.revisionSistemasSeleccionados);
            if (ev.revisionSistemasDescripciones) setRevisionSistemasDescripciones(ev.revisionSistemasDescripciones);
            if (ev.signosVitales) setSignosVitales(ev.signosVitales);
            if (ev.examenFisicoHallazgos) {
              setExamenFisicoHallazgos(ev.examenFisicoHallazgos);
              const checkedSet = new Set<string>();
              ev.examenFisicoHallazgos.forEach((h: any) => {
                const num = h.codigo.match(/^\d+/)?.[0];
                const cod = h.codigo.replace(/^\d+/, '');
                if (num && cod) checkedSet.add(`${num}-${cod}`);
              });
              setExamenFisicoSeleccionados(checkedSet);
            }
            if (ev.examenesComplementarios) setExamenesComplementarios(ev.examenesComplementarios);
            if (ev.diagnosticos) setDiagnosticos(ev.diagnosticos);
            setAptitudMedica(ev.aptitudMedica || 'apto');
            setAptitudObservacion(ev.aptitudObservacion || '');
            setAptitudLimitaciones(ev.aptitudLimitaciones || '');
            if (ev.recomendaciones) setRecomendaciones(Array.isArray(ev.recomendaciones) ? ev.recomendaciones : []);
            setRecomendacionesOtras(ev.recomendacionesOtras || '');
          }
        } catch (err) {
          console.error('Error al cargar la evaluación para editar:', err);
        }
      } else {
        // MODO CREACIÓN: precargar antecedentes de la última evaluación (si existe)
        try {
          const evalQuery = query(
            collection(db, 'evaluaciones'),
            where('trabajadorId', '==', trabajadorId),
            orderBy('fecha', 'desc'),
            limit(1),
          );
          const evalSnap = await getDocs(evalQuery);
          if (!evalSnap.empty) {
            const ult = evalSnap.docs[0].data();
            if (ult.antecedentesClinicosQ !== undefined) setAntecedentesClinicosQ(ult.antecedentesClinicosQ);
            if (ult.antecedentesClinicosLista) setAntecedentesClinicosLista(ult.antecedentesClinicosLista);
            if (ult.antecedentesQuirurgicosQ !== undefined) setAntecedentesQuirurgicosQ(ult.antecedentesQuirurgicosQ);
            if (ult.antecedentesQuirurgicosLista) setAntecedentesQuirurgicosLista(ult.antecedentesQuirurgicosLista);
            if (ult.alergiasTiene !== undefined) setAlergiasTiene(ult.alergiasTiene);
            if (ult.alergias) setAlergias(ult.alergias);
            if (ult.antecedentesGineco) setAntecedentesGineco({ ...emptyAntecedentesGineco(), ...ult.antecedentesGineco });
            if (ult.antecedentesReproductivos) setAntecedentesReproductivos({ ...emptyAntecedentesReproductivos(), ...ult.antecedentesReproductivos });
            if (ult.antecedentesFamiliares) setAntecedentesFamiliares(ult.antecedentesFamiliares);
            if (ult.habitosToxicos) setHabitosToxicos(ult.habitosToxicos);
            if (ult.estiloVida) setEstiloVida(ult.estiloVida);
            if (ult.medicacionesHabituales) setMedicacionesHabituales(ult.medicacionesHabituales);
            if (ult.edadInicioLaboral) setEdadInicioLaboral(ult.edadInicioLaboral);
            if (ult.antecedentesEmpleos) setAntecedentesEmpleos(ult.antecedentesEmpleos);
            if (ult.signosVitales?.talla) setSignosVitales(prev => ({ ...prev, talla: ult.signosVitales.talla }));
          }
        } catch (err) {
          console.error('Error al precargar antecedentes:', err);
        }

        // Auto-cargar exámenes complementarios del último año
        try {
          const examenesSnap = await getDocs(query(collection(db, 'examenes'), where('trabajadorId', '==', trabajadorId)));
          if (!examenesSnap.empty) {
            const unAnioAtras = new Date();
            unAnioAtras.setFullYear(unAnioAtras.getFullYear() - 1);
            const examenesDelAnio: ExamenComplementario[] = [];
            examenesSnap.forEach(docSnap => {
              const data = docSnap.data();
              const fechaExamen = data.fecha?.seconds ? new Date(data.fecha.seconds * 1000) : new Date(data.fecha);
              if (fechaExamen >= unAnioAtras) {
                const interpretacion = data.estado === 'patologico'
                  ? `Patológico - Obs: ${data.observacion || ''}`
                  : (data.observacion || 'Normal');
                examenesDelAnio.push({
                  nombre: data.nombreExamen || '',
                  fecha: fechaExamen.toISOString().split('T')[0],
                  resultado: data.resultado ? `${data.resultado} [${interpretacion}]` : interpretacion,
                });
              }
            });
            examenesDelAnio.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
            if (examenesDelAnio.length > 0) setExamenesComplementarios(examenesDelAnio);
          }
        } catch (err) {
          console.error('Error al auto-cargar exámenes históricos:', err);
        }
      }
    };
    cargarDatos();
  }, [trabajadorId, user, editEvalId]);

  // ===== HANDLERS =====

  const toggleExamenFisico = (key: string, numero: number, codigo: string, region: string, subregion: string) => {
    const newSet = new Set(examenFisicoSeleccionados);
    if (newSet.has(key)) {
      newSet.delete(key);
      setExamenFisicoHallazgos(prev => prev.filter(h => h.codigo !== `${numero}${codigo}`));
    } else {
      newSet.add(key);
      setExamenFisicoHallazgos(prev => [...prev, { codigo: `${numero}${codigo}`, region, subregion, descripcion: '' }]);
    }
    setExamenFisicoSeleccionados(newSet);
  };

  const updateHallazgoDescripcion = (codigo: string, descripcion: string) => {
    setExamenFisicoHallazgos(prev => prev.map(h => h.codigo === codigo ? { ...h, descripcion } : h));
  };

  const updateClinico = (idx: number, field: keyof AntecedenteClinico, value: any) => {
    setAntecedentesClinicosLista(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u; });
  };
  const updateQuirurgico = (idx: number, field: keyof AntecedenteQuirurgico, value: any) => {
    setAntecedentesQuirurgicosLista(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u; });
  };
  const updateAlergia = (idx: number, field: keyof Alergia, value: any) => {
    setAlergias(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u; });
  };
  const updateHabito = (index: number, field: keyof HabitoToxico, value: any) => {
    setHabitosToxicos(prev => { const u = [...prev]; u[index] = { ...u[index], [field]: value }; return u; });
  };
  const updateEmpleo = (idx: number, field: keyof AntecedenteEmpleo, value: any) => {
    setAntecedentesEmpleos(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u; });
  };
  const toggleRiesgoEmpleo = (idx: number, riesgo: string) => {
    setAntecedentesEmpleos(prev => {
      const u = [...prev];
      const arr = u[idx].riesgos || [];
      u[idx] = { ...u[idx], riesgos: arr.includes(riesgo) ? arr.filter(r => r !== riesgo) : [...arr, riesgo] };
      return u;
    });
  };
  const updateGineco = (patch: Partial<AntecedentesGineco>) => setAntecedentesGineco(prev => ({ ...prev, ...patch }));
  const updateGinecoExamen = (key: 'papanicolaou' | 'colposcopia' | 'ecoMamario' | 'mamografia', patch: Partial<ExamenTamizaje>) => {
    setAntecedentesGineco(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };
  const updateRepro = (patch: Partial<AntecedentesReproductivos>) => setAntecedentesReproductivos(prev => ({ ...prev, ...patch }));
  const updateReproExamen = (key: 'antigenoProstatico' | 'ecoProstatico', patch: Partial<ExamenTamizaje>) => {
    setAntecedentesReproductivos(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const toggleRiesgo = (categoria: keyof Pick<FactorRiesgoPuesto, 'fisicos' | 'mecanicos' | 'quimicos' | 'biologicos' | 'ergonomicos' | 'psicosociales'>, valor: string) => {
    setFactoresRiesgo(prev => {
      const arr = prev[categoria];
      return { ...prev, [categoria]: arr.includes(valor) ? arr.filter(v => v !== valor) : [...arr, valor] };
    });
  };

  // Modal de importación de exámenes (mismo flujo que la periódica)
  const abrirModalExamenes = async () => {
    setMostrarModalExamenes(true);
    setCargandoExamenesHist(true);
    try {
      const q = query(collection(db, 'examenes'), where('trabajadorId', '==', trabajadorId), orderBy('fecha', 'desc'));
      const snap = await getDocs(q);
      const docs: any[] = [];
      snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
      setExamenesDisponibles(docs);
    } catch (error) {
      console.error('Error al cargar historial de exámenes:', error);
    } finally {
      setCargandoExamenesHist(false);
    }
  };

  const inyectarExamenes = () => {
    const seleccionados = examenesDisponibles.filter(ex => examenesSeleccionadosModal.includes(ex.id));
    const nuevos = seleccionados.map(data => {
      const fechaExamen = data.fecha?.seconds ? new Date(data.fecha.seconds * 1000) : new Date(data.fecha);
      const interpretacion = data.estado === 'patologico'
        ? `Patológico - Obs: ${data.observacion || ''}`
        : (data.observacion || 'Normal');
      return {
        nombre: data.nombreExamen || '',
        fecha: fechaExamen.toISOString().split('T')[0],
        resultado: data.resultado ? `${data.resultado} [${interpretacion}]` : interpretacion,
      };
    });
    setExamenesComplementarios(prev => {
      const limpios = prev.filter(e => e.nombre.trim() !== '' || e.resultado.trim() !== '');
      return [...limpios, ...nuevos];
    });
    setMostrarModalExamenes(false);
    setExamenesSeleccionadosModal([]);
  };

  // ===== GUARDAR =====
  const handleGuardar = async () => {
    if (!trabajadorId || !user || !trabajador) return;

    const errores: string[] = [];
    if (!motivoConsulta.trim()) errores.push('Motivo de consulta es obligatorio (Sección B).');
    if (!signosVitales.presionSistolica || !signosVitales.presionDiastolica || !signosVitales.frecuenciaCardiaca || !signosVitales.peso || !signosVitales.talla)
      errores.push('Completa los signos vitales mínimos: PA, FC, Peso y Talla (Sección J).');
    const dxValidos = diagnosticos.filter(d => d.descripcion.trim() !== '');
    if (dxValidos.length === 0) errores.push('Agrega al menos un diagnóstico (Sección M).');
    if (errores.length > 0) { errores.forEach(e => toast.warning(e)); return; }

    setGuardando(true);
    try {
      const hoy = new Date();
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      const dia = String(hoy.getDate()).padStart(2, '0');
      const numeroArchivo = `${DATOS_EMPRESA.prefijoArchivo || 'HCO'}-${hoy.getFullYear()}${mes}${dia}`;

      const evaluacionData: any = {
        trabajadorId,
        tipoEvaluacion: 'preocupacional',
        medicoId: user.uid,
        medicoNombre: medicoData?.nombreCompleto || '',
        medicoCedula: medicoData?.cedula || '',
        motivoConsulta,
        antecedentesClinicosQ,
        antecedentesClinicosLista,
        antecedentesQuirurgicosQ,
        antecedentesQuirurgicosLista,
        alergiasTiene,
        alergias,
        habitosToxicos,
        estiloVida,
        medicacionesHabituales,
        edadInicioLaboral,
        antecedentesEmpleos: antecedentesEmpleos.filter(e => e.empresa.trim() || e.puesto.trim() || e.actividades.trim()),
        accidentesTrabajo: accidenteTrabajo,
        enfermedadesProfesionales: enfermedadProfesional,
        antecedentesFamiliares,
        factoresRiesgo,
        actividadesExtraLaborales,
        enfermedadActual,
        revisionSistemasSeleccionados,
        revisionSistemasDescripciones,
        signosVitales,
        examenFisicoHallazgos,
        examenesComplementarios: examenesComplementarios.filter(e => e.nombre.trim() !== ''),
        diagnosticos: dxValidos,
        aptitudMedica,
        aptitudObservacion,
        aptitudLimitaciones,
        recomendaciones,
        recomendacionesOtras,
      };
      // Antecedentes gineco-obstétricos / reproductivos según sexo
      if (trabajador.sexo === 'F') evaluacionData.antecedentesGineco = antecedentesGineco;
      else evaluacionData.antecedentesReproductivos = antecedentesReproductivos;

      if (editEvalId) {
        await updateDoc(doc(db, 'evaluaciones', editEvalId), { ...evaluacionData, updatedAt: hoy, updatedBy: user.uid });
        await registrarAuditoria('editar', 'evaluacion', editEvalId, `Editó la evaluación preocupacional de ${trabajador.primerApellido} ${trabajador.primerNombre}`);
        toast.success('Evaluación preocupacional actualizada con éxito');
      } else {
        evaluacionData.fecha = hoy;
        evaluacionData.numeroHistoriaClinica = trabajador.cedula;
        evaluacionData.numeroArchivo = numeroArchivo;
        evaluacionData.createdAt = hoy;
        evaluacionData.createdBy = user.uid;

        const docRef = await addDoc(collection(db, 'evaluaciones'), evaluacionData);
        await updateDoc(doc(db, 'trabajadores', trabajadorId), {
          evaluaciones: arrayUnion(docRef.id),
          ultimaEvaluacionPreocupacional: hoy,
          updatedAt: hoy,
          updatedBy: user.uid,
        });
        await registrarAuditoria('crear', 'evaluacion', docRef.id, `Evaluación preocupacional de ${trabajador.primerApellido} ${trabajador.primerNombre}`);
        toast.success('Evaluación preocupacional guardada exitosamente');
      }
      navigate(`/trabajador/${trabajadorId}`);
    } catch (error) {
      console.error('Error al guardar:', error);
      toast.error('Hubo un error al procesar la evaluación.');
    } finally {
      setGuardando(false);
    }
  };

  const handleSignosChange = useCallback((data: SignosVitales) => setSignosVitales(data), []);

  if (!trabajador) {
    return <div className="min-h-screen p-8 text-center text-slate-500">Cargando datos del trabajador...</div>;
  }

  const totalRiesgos = factoresRiesgo.fisicos.length + factoresRiesgo.mecanicos.length +
    factoresRiesgo.quimicos.length + factoresRiesgo.biologicos.length +
    factoresRiesgo.ergonomicos.length + factoresRiesgo.psicosociales.length;

  const inputXs = INPUT_XS;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ===== ENCABEZADO ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-slate-800 leading-tight">
                HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN PREOCUPACIONAL - INICIO
              </h1>
              <p className="text-slate-500 text-xs md:text-sm mt-1">SO-RE-41 | {DATOS_EMPRESA.institucion} | RUC: {DATOS_EMPRESA.ruc}</p>
            </div>
            <button onClick={() => navigate(`/trabajador/${trabajadorId}`)} className="self-start md:self-auto text-slate-500 hover:text-slate-800 text-sm font-medium bg-slate-100 px-4 py-2 rounded-lg">
              Cancelar
            </button>
          </div>
        </div>

        {/* ===== A. DATOS DEL ESTABLECIMIENTO Y USUARIO ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">A. DATOS DEL ESTABLECIMIENTO - EMPRESA Y USUARIO</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
            <div><span className="font-semibold text-slate-600">Institución:</span> <span className="text-slate-800">{DATOS_EMPRESA.institucion}</span></div>
            <div><span className="font-semibold text-slate-600">RUC:</span> <span className="text-slate-800">{DATOS_EMPRESA.ruc}</span></div>
            <div><span className="font-semibold text-slate-600">CIU:</span> <span className="text-slate-800">{DATOS_EMPRESA.ciu}</span></div>
            <div><span className="font-semibold text-slate-600">Establecimiento:</span> <span className="text-slate-800">{DATOS_EMPRESA.establecimiento}</span></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-blue-50 p-3 rounded-lg">
            <div><span className="font-semibold text-slate-600">Primer Apellido:</span> <span className="text-slate-800">{trabajador.primerApellido}</span></div>
            <div><span className="font-semibold text-slate-600">Segundo Apellido:</span> <span className="text-slate-800">{trabajador.segundoApellido}</span></div>
            <div><span className="font-semibold text-slate-600">Primer Nombre:</span> <span className="text-slate-800">{trabajador.primerNombre}</span></div>
            <div><span className="font-semibold text-slate-600">Segundo Nombre:</span> <span className="text-slate-800">{trabajador.segundoNombre}</span></div>
            <div><span className="font-semibold text-slate-600">Cédula:</span> <span className="text-slate-800">{trabajador.cedula}</span></div>
            <div><span className="font-semibold text-slate-600">Sexo:</span> <span className="text-slate-800">{trabajador.sexo === 'M' ? 'Masculino' : 'Femenino'}</span></div>
            <div className="md:col-span-2"><span className="font-semibold text-slate-600">Puesto de Trabajo:</span> <span className="text-slate-800">{trabajador.puestoTrabajo}</span></div>
          </div>
        </div>

        {/* ===== B. MOTIVO DE CONSULTA ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">B. MOTIVO DE CONSULTA <span className="text-red-500">*</span></h2>
          <input type="text" className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm ${!motivoConsulta.trim() ? 'border-red-300 bg-red-50' : 'border-slate-300'}`} value={motivoConsulta} onChange={(e) => setMotivoConsulta(e.target.value)} />
          {!motivoConsulta.trim() && <p className="text-xs text-red-500 mt-1">Campo obligatorio</p>}
        </div>

        {/* ===== C. ANTECEDENTES PERSONALES ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 space-y-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">C. ANTECEDENTES PERSONALES</h2>

          {/* --- Antecedentes Clínicos --- */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <label className="text-xs font-bold text-slate-700 uppercase">Antecedentes Clínicos</label>
              <div className="flex gap-1.5">
                {([true, false] as const).map(val => (
                  <button key={String(val)} type="button"
                    onClick={() => {
                      setAntecedentesClinicosQ(val);
                      if (val && antecedentesClinicosLista.length === 0) setAntecedentesClinicosLista([emptyAntecedenteClinico()]);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${antecedentesClinicosQ === val ? (val ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-600 text-white border-slate-600') : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}
                  >{val ? 'Sí' : 'No'}</button>
                ))}
              </div>
            </div>
            {antecedentesClinicosQ === true && (
              <div className="space-y-4">
                {antecedentesClinicosLista.map((ac, idx) => (
                  <div key={idx} className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-blue-800">Antecedente clínico #{idx + 1}</span>
                      {antecedentesClinicosLista.length > 1 && (
                        <button type="button" onClick={() => setAntecedentesClinicosLista(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">¿Qué enfermedad/condición padece?</label>
                        <input type="text" value={ac.enfermedad} onChange={(e) => updateClinico(idx, 'enfermedad', e.target.value)} className={inputXs} placeholder="Diagnóstico o condición..." />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">¿Desde hace cuánto la padece?</label>
                        <input type="text" value={ac.desdeCuando} onChange={(e) => updateClinico(idx, 'desdeCuando', e.target.value)} className={inputXs} placeholder="Ej: 5 años, desde 2018..." />
                      </div>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2 cursor-pointer">
                        <input type="checkbox" checked={ac.tomaMedicacion} onChange={(e) => updateClinico(idx, 'tomaMedicacion', e.target.checked)} />
                        ¿Toma medicación?
                      </label>
                      {ac.tomaMedicacion && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 ml-5">
                          <input type="text" value={ac.medicacionNombre} onChange={(e) => updateClinico(idx, 'medicacionNombre', e.target.value)} className={inputXs} placeholder="Medicamento" />
                          <input type="text" value={ac.medicacionDosis} onChange={(e) => updateClinico(idx, 'medicacionDosis', e.target.value)} className={inputXs} placeholder="Dosis" />
                          <input type="text" value={ac.medicacionFrecuencia} onChange={(e) => updateClinico(idx, 'medicacionFrecuencia', e.target.value)} className={inputXs} placeholder="Frecuencia" />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2 cursor-pointer">
                        <input type="checkbox" checked={ac.seguimientoEspecialista} onChange={(e) => updateClinico(idx, 'seguimientoEspecialista', e.target.checked)} />
                        ¿Seguimiento por médico particular o especialista?
                      </label>
                      {ac.seguimientoEspecialista && (
                        <input type="text" value={ac.especialista} onChange={(e) => updateClinico(idx, 'especialista', e.target.value)} className={inputXs + ' ml-5'} style={{ width: 'calc(100% - 1.25rem)' }} placeholder="Especialidad o nombre del especialista..." />
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">¿Complicaciones u hospitalizaciones recientes?</label>
                      <input type="text" value={ac.complicaciones} onChange={(e) => updateClinico(idx, 'complicaciones', e.target.value)} className={inputXs} placeholder="Ninguna / Describir..." />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setAntecedentesClinicosLista(prev => [...prev, emptyAntecedenteClinico()])} className="text-blue-600 text-xs font-medium hover:underline">+ Agregar otro antecedente clínico</button>
              </div>
            )}
          </div>

          {/* --- Antecedentes Quirúrgicos --- */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <label className="text-xs font-bold text-slate-700 uppercase">Antecedentes Quirúrgicos</label>
              <div className="flex gap-1.5">
                {([true, false] as const).map(val => (
                  <button key={String(val)} type="button"
                    onClick={() => {
                      setAntecedentesQuirurgicosQ(val);
                      if (val && antecedentesQuirurgicosLista.length === 0) setAntecedentesQuirurgicosLista([emptyAntecedenteQuirurgico()]);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${antecedentesQuirurgicosQ === val ? (val ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-600 text-white border-slate-600') : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}
                  >{val ? 'Sí' : 'No'}</button>
                ))}
              </div>
            </div>
            {antecedentesQuirurgicosQ === true && (
              <div className="space-y-4">
                {antecedentesQuirurgicosLista.map((aq, idx) => (
                  <div key={idx} className="bg-purple-50 p-4 rounded-lg border border-purple-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-purple-800">Antecedente quirúrgico #{idx + 1}</span>
                      {antecedentesQuirurgicosLista.length > 1 && (
                        <button type="button" onClick={() => setAntecedentesQuirurgicosLista(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">¿Qué procedimiento fue realizado?</label>
                        <input type="text" value={aq.procedimiento} onChange={(e) => updateQuirurgico(idx, 'procedimiento', e.target.value)} className={inputXs} placeholder="Nombre del procedimiento..." />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">¿Fecha aproximada del procedimiento?</label>
                        <input type="text" value={aq.fechaAproximada} onChange={(e) => updateQuirurgico(idx, 'fechaAproximada', e.target.value)} className={inputXs} placeholder="Ej: 2019, hace 3 años..." />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">¿Hubo complicaciones asociadas con el procedimiento o la recuperación?</label>
                      <input type="text" value={aq.complicaciones} onChange={(e) => updateQuirurgico(idx, 'complicaciones', e.target.value)} className={inputXs} placeholder="Ninguna / Describir complicaciones..." />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2 cursor-pointer">
                        <input type="checkbox" checked={aq.recuperacionCompleta} onChange={(e) => updateQuirurgico(idx, 'recuperacionCompleta', e.target.checked)} />
                        ¿Tuvo una recuperación completa?
                      </label>
                      {!aq.recuperacionCompleta && (
                        <input type="text" value={aq.secuelas} onChange={(e) => updateQuirurgico(idx, 'secuelas', e.target.value)} className={inputXs + ' ml-5'} style={{ width: 'calc(100% - 1.25rem)' }} placeholder="Describir secuelas posteriores..." />
                      )}
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setAntecedentesQuirurgicosLista(prev => [...prev, emptyAntecedenteQuirurgico()])} className="text-purple-600 text-xs font-medium hover:underline">+ Agregar otro antecedente quirúrgico</button>
              </div>
            )}
          </div>

          {/* --- Alergias --- */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <label className="text-xs font-bold text-slate-700 uppercase">Alergias</label>
              <div className="flex gap-1.5">
                {([true, false] as const).map(val => (
                  <button key={String(val)} type="button"
                    onClick={() => {
                      setAlergiasTiene(val);
                      if (val && alergias.length === 0) setAlergias([emptyAlergia()]);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${alergiasTiene === val ? (val ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-600 text-white border-slate-600') : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}
                  >{val ? 'Sí' : 'No'}</button>
                ))}
              </div>
            </div>
            {alergiasTiene === true && (
              <div className="space-y-4">
                {alergias.map((al, idx) => (
                  <div key={idx} className="bg-amber-50 p-4 rounded-lg border border-amber-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-amber-800">Alergia #{idx + 1}</span>
                      {alergias.length > 1 && (
                        <button type="button" onClick={() => setAlergias(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">¿Conoce el alérgeno específico?</label>
                        <input type="text" value={al.alergeno} onChange={(e) => updateAlergia(idx, 'alergeno', e.target.value)} className={inputXs} placeholder="Polen, penicilina, mariscos..." />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">Gravedad/intensidad de la reacción</label>
                        <input type="text" value={al.intensidadReaccion} onChange={(e) => updateAlergia(idx, 'intensidadReaccion', e.target.value)} className={inputXs} placeholder="Leve, moderada, severa, anafilaxia..." />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Síntomas al exponerse</label>
                      <input type="text" value={al.sintomas} onChange={(e) => updateAlergia(idx, 'sintomas', e.target.value)} className={inputXs} placeholder="Urticaria, disnea, edema, rinitis..." />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">¿Tratamiento indicado o de uso habitual al momento de la reacción?</label>
                      <input type="text" value={al.tratamientoHabitual} onChange={(e) => updateAlergia(idx, 'tratamientoHabitual', e.target.value)} className={inputXs} placeholder="Ninguno / Antihistamínico, adrenalina..." />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setAlergias(prev => [...prev, emptyAlergia()])} className="text-amber-600 text-xs font-medium hover:underline">+ Agregar otra alergia</button>
              </div>
            )}
          </div>

          {/* --- Antecedentes gineco-obstétricos (solo sexo femenino) --- */}
          {trabajador.sexo === 'F' && (
            <div className="border border-pink-200 rounded-lg overflow-hidden">
              <div className="bg-pink-50 px-4 py-2 text-xs font-bold text-pink-800 uppercase">Antecedentes gineco-obstétricos</div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><label className="text-xs text-slate-600 mb-1 block">Menarquía (edad)</label><input type="text" value={antecedentesGineco.menarquia} onChange={e => updateGineco({ menarquia: e.target.value })} className={inputXs} /></div>
                  <div><label className="text-xs text-slate-600 mb-1 block">Ciclos</label><input type="text" value={antecedentesGineco.ciclos} onChange={e => updateGineco({ ciclos: e.target.value })} className={inputXs} placeholder="Regulares / irregulares" /></div>
                  <div className="col-span-2"><label className="text-xs text-slate-600 mb-1 block">Fecha de última menstruación</label><input type="date" value={antecedentesGineco.fum} onChange={e => updateGineco({ fum: e.target.value })} className={inputXs} /></div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
                  {([['gestas', 'Gestas'], ['partos', 'Partos'], ['cesareas', 'Cesáreas'], ['abortos', 'Abortos'], ['hijosVivos', 'Hijos vivos'], ['hijosMuertos', 'Hijos muertos']] as const).map(([k, label]) => (
                    <div key={k}><label className="text-xs text-slate-600 mb-1 block">{label}</label><input type="number" min={0} value={(antecedentesGineco as any)[k]} onChange={e => updateGineco({ [k]: e.target.value } as any)} className={inputXs} /></div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="flex items-center gap-2"><span className="text-xs font-semibold text-slate-700">Vida sexual activa:</span><SiNo value={antecedentesGineco.vidaSexualActiva} onChange={v => updateGineco({ vidaSexualActiva: v })} /></div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-700">Método de planificación familiar:</span>
                    <SiNo value={antecedentesGineco.planificacionFamiliar} onChange={v => updateGineco({ planificacionFamiliar: v })} />
                    {antecedentesGineco.planificacionFamiliar === true && (
                      <input type="text" value={antecedentesGineco.planificacionTipo} onChange={e => updateGineco({ planificacionTipo: e.target.value })} className={inputXs + ' w-48'} placeholder="Tipo (DIU, oral, implante...)" />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">Exámenes realizados</span>
                  <FilaTamizaje label="Papanicolaou" ex={antecedentesGineco.papanicolaou} onChange={p => updateGinecoExamen('papanicolaou', p)} />
                  <FilaTamizaje label="Colposcopia" ex={antecedentesGineco.colposcopia} onChange={p => updateGinecoExamen('colposcopia', p)} />
                  <FilaTamizaje label="Eco mamario" ex={antecedentesGineco.ecoMamario} onChange={p => updateGinecoExamen('ecoMamario', p)} />
                  <FilaTamizaje label="Mamografía" ex={antecedentesGineco.mamografia} onChange={p => updateGinecoExamen('mamografia', p)} />
                </div>
              </div>
            </div>
          )}

          {/* --- Antecedentes reproductivos masculinos (solo sexo masculino) --- */}
          {trabajador.sexo === 'M' && (
            <div className="border border-cyan-200 rounded-lg overflow-hidden">
              <div className="bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-800 uppercase">Antecedentes reproductivos masculinos</div>
              <div className="p-4 space-y-3">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">Exámenes realizados</span>
                  <FilaTamizaje label="Antígeno prostático" ex={antecedentesReproductivos.antigenoProstatico} onChange={p => updateReproExamen('antigenoProstatico', p)} />
                  <FilaTamizaje label="Eco prostático" ex={antecedentesReproductivos.ecoProstatico} onChange={p => updateReproExamen('ecoProstatico', p)} />
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-700">Método de planificación familiar:</span>
                    <SiNo value={antecedentesReproductivos.planificacionFamiliar} onChange={v => updateRepro({ planificacionFamiliar: v })} />
                    {antecedentesReproductivos.planificacionFamiliar === true && (
                      <input type="text" value={antecedentesReproductivos.planificacionTipo} onChange={e => updateRepro({ planificacionTipo: e.target.value })} className={inputXs + ' w-48'} placeholder="Tipo (vasectomía, condón...)" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div><label className="text-xs text-slate-600 mb-1 block">Hijos vivos</label><input type="number" min={0} value={antecedentesReproductivos.hijosVivos} onChange={e => updateRepro({ hijosVivos: e.target.value })} className={inputXs + ' w-20'} /></div>
                    <div><label className="text-xs text-slate-600 mb-1 block">Hijos muertos</label><input type="number" min={0} value={antecedentesReproductivos.hijosMuertos} onChange={e => updateRepro({ hijosMuertos: e.target.value })} className={inputXs + ' w-20'} /></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- Hábitos tóxicos --- */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-3">HÁBITOS TÓXICOS</label>
            <div className="space-y-3">
              {habitosToxicos.map((habito, idx) => (
                <div key={habito.tipo} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-center text-sm bg-slate-50 p-3 rounded-lg">
                  <span className="font-semibold capitalize col-span-2 md:col-span-1 text-sm">{habito.tipo}</span>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={habito.consume} onChange={(e) => updateHabito(idx, 'consume', e.target.checked)} /><span className="text-xs">Consume</span></label>
                  <input type="text" placeholder="Tiempo (meses)" value={habito.tiempoConsumo} onChange={(e) => updateHabito(idx, 'tiempoConsumo', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <input type="text" placeholder="Cantidad" value={habito.cantidad} onChange={(e) => updateHabito(idx, 'cantidad', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <label className="flex items-center gap-1"><input type="checkbox" checked={habito.exConsumidor} onChange={(e) => updateHabito(idx, 'exConsumidor', e.target.checked)} /><span className="text-xs">Ex consumidor</span></label>
                  <input type="text" placeholder="Abstinencia (meses)" value={habito.tiempoAbstinencia} onChange={(e) => updateHabito(idx, 'tiempoAbstinencia', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                </div>
              ))}
            </div>
          </div>

          {/* --- Estilo de vida --- */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-3">ESTILO DE VIDA</label>
            <div className="flex items-center gap-3 mb-3">
              <label className="flex items-center gap-2"><input type="checkbox" checked={estiloVida.actividadFisica} onChange={(e) => setEstiloVida(prev => ({ ...prev, actividadFisica: e.target.checked }))} /><span className="text-xs font-medium">Actividad Física</span></label>
              <input type="text" placeholder="¿Cuál?" value={estiloVida.tipoActividad} onChange={(e) => setEstiloVida(prev => ({ ...prev, tipoActividad: e.target.value }))} className="flex-1 px-2 py-1 border rounded text-xs" />
              <input type="text" placeholder="Tiempo/Cantidad" value={estiloVida.tiempoCantidad} onChange={(e) => setEstiloVida(prev => ({ ...prev, tiempoCantidad: e.target.value }))} className="flex-1 px-2 py-1 border rounded text-xs" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-700">Medicación Habitual</span>
                {antecedentesClinicosLista.some(ac => ac.tomaMedicacion && ac.medicacionNombre) && (
                  <button type="button"
                    onClick={() => {
                      const meds = antecedentesClinicosLista
                        .filter(ac => ac.tomaMedicacion && ac.medicacionNombre)
                        .map(ac => ({ nombre: ac.medicacionNombre, dosis: ac.medicacionDosis, frecuencia: ac.medicacionFrecuencia, horario: '' }));
                      setMedicacionesHabituales(meds);
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium border border-blue-300 rounded px-2 py-0.5 bg-blue-50"
                  >↑ Auto-llenar desde Antecedentes Clínicos</button>
                )}
              </div>
              {medicacionesHabituales.length === 0 ? (
                <p className="text-xs text-slate-400 italic mb-2">Sin medicaciones registradas.</p>
              ) : (
                <div className="space-y-1.5 mb-2">
                  {medicacionesHabituales.map((m, idx) => (
                    <div key={idx} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
                      <input type="text" placeholder="Medicamento" value={m.nombre} onChange={(e) => { const u = [...medicacionesHabituales]; u[idx] = { ...u[idx], nombre: e.target.value }; setMedicacionesHabituales(u); }} className="px-2 py-1 border rounded text-xs" />
                      <input type="text" placeholder="Dosis" value={m.dosis} onChange={(e) => { const u = [...medicacionesHabituales]; u[idx] = { ...u[idx], dosis: e.target.value }; setMedicacionesHabituales(u); }} className="px-2 py-1 border rounded text-xs" />
                      <input type="text" placeholder="Frecuencia" value={m.frecuencia} onChange={(e) => { const u = [...medicacionesHabituales]; u[idx] = { ...u[idx], frecuencia: e.target.value }; setMedicacionesHabituales(u); }} className="px-2 py-1 border rounded text-xs" />
                      <div className="flex gap-1">
                        <input type="text" placeholder="Horario (ej: AM)" value={m.horario} onChange={(e) => { const u = [...medicacionesHabituales]; u[idx] = { ...u[idx], horario: e.target.value }; setMedicacionesHabituales(u); }} className="flex-1 px-2 py-1 border rounded text-xs" />
                        <button type="button" onClick={() => setMedicacionesHabituales(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setMedicacionesHabituales(prev => [...prev, { nombre: '', dosis: '', frecuencia: '', horario: '' }])} className="text-blue-600 text-xs font-medium hover:underline">+ Agregar medicación</button>
            </div>
          </div>
        </div>

        {/* ===== D. ANTECEDENTES DE TRABAJO ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-800 border-b pb-2">D. ANTECEDENTES DE TRABAJO</h2>

          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">EDAD A LA QUE INICIÓ SU ACTIVIDAD LABORAL:</label>
            <input type="number" min={0} value={edadInicioLaboral} onChange={e => setEdadInicioLaboral(e.target.value)} className="w-24 px-3 py-1.5 border rounded-lg text-sm" placeholder="Años" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase">Antecedentes de empleos anteriores</label>
              <button type="button" onClick={() => setAntecedentesEmpleos(prev => [...prev, emptyAntecedenteEmpleo()])} className="text-blue-600 text-xs font-bold hover:underline">+ Agregar empleo anterior</button>
            </div>
            {antecedentesEmpleos.length === 0 && <p className="text-xs text-slate-400 italic">Sin empleos anteriores registrados (primer empleo).</p>}
            <div className="space-y-3">
              {antecedentesEmpleos.map((emp, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-700">Empleo #{idx + 1}</span>
                    <button type="button" onClick={() => setAntecedentesEmpleos(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input type="text" placeholder="Empresa" value={emp.empresa} onChange={e => updateEmpleo(idx, 'empresa', e.target.value)} className={inputXs} />
                    <input type="text" placeholder="Puesto de trabajo" value={emp.puesto} onChange={e => updateEmpleo(idx, 'puesto', e.target.value)} className={inputXs} />
                    <input type="text" placeholder="Actividades que desempeñaba" value={emp.actividades} onChange={e => updateEmpleo(idx, 'actividades', e.target.value)} className={inputXs} />
                    <input type="number" min={0} placeholder="Tiempo (meses)" value={emp.tiempoMeses} onChange={e => updateEmpleo(idx, 'tiempoMeses', e.target.value)} className={inputXs} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500">RIESGOS:</span>
                    {CATEGORIAS_RIESGO_EMPLEO.map(r => (
                      <label key={r} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border cursor-pointer transition-colors ${emp.riesgos?.includes(r) ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'bg-white text-slate-600 border-slate-300'}`}>
                        <input type="checkbox" className="hidden" checked={emp.riesgos?.includes(r) ?? false} onChange={() => toggleRiesgoEmpleo(idx, r)} />
                        {r}
                      </label>
                    ))}
                  </div>
                  <input type="text" placeholder="Observaciones" value={emp.observaciones} onChange={e => updateEmpleo(idx, 'observaciones', e.target.value)} className={inputXs} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">ACCIDENTES DE TRABAJO (DESCRIPCIÓN)</label>
            <textarea className="w-full p-2 border rounded-lg text-sm mb-2" rows={2} placeholder="Describir si existieron..." value={accidenteTrabajo.descripcion} onChange={(e) => setAccidenteTrabajo(prev => ({ ...prev, descripcion: e.target.value }))} />
            <div className="flex flex-wrap gap-3 items-center text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" checked={accidenteTrabajo.calificado} onChange={(e) => setAccidenteTrabajo(prev => ({ ...prev, calificado: e.target.checked }))} />Calificado por el IESS</label>
              <input type="text" placeholder="Especificar" value={accidenteTrabajo.especificacion} onChange={(e) => setAccidenteTrabajo(prev => ({ ...prev, especificacion: e.target.value }))} className="px-2 py-1 border rounded flex-1" />
              <input type="text" placeholder="Observaciones" value={accidenteTrabajo.observaciones} onChange={(e) => setAccidenteTrabajo(prev => ({ ...prev, observaciones: e.target.value }))} className="px-2 py-1 border rounded flex-1" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">ENFERMEDADES PROFESIONALES</label>
            <textarea className="w-full p-2 border rounded-lg text-sm mb-2" rows={2} placeholder="Describir si existieron..." value={enfermedadProfesional.descripcion} onChange={(e) => setEnfermedadProfesional(prev => ({ ...prev, descripcion: e.target.value }))} />
            <div className="flex flex-wrap gap-3 items-center text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" checked={enfermedadProfesional.calificada} onChange={(e) => setEnfermedadProfesional(prev => ({ ...prev, calificada: e.target.checked }))} />Calificada por el IESS</label>
              <input type="text" placeholder="Especificar" value={enfermedadProfesional.especificacion} onChange={(e) => setEnfermedadProfesional(prev => ({ ...prev, especificacion: e.target.value }))} className="px-2 py-1 border rounded flex-1" />
              <input type="text" placeholder="Observaciones" value={enfermedadProfesional.observaciones} onChange={(e) => setEnfermedadProfesional(prev => ({ ...prev, observaciones: e.target.value }))} className="px-2 py-1 border rounded flex-1" />
            </div>
          </div>
        </div>

        {/* ===== E. ANTECEDENTES FAMILIARES ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-1 border-b pb-2">E. ANTECEDENTES FAMILIARES (Detallar parentesco)</h2>
          <p className="text-xs text-slate-500 mb-4">Seleccione los grupos de enfermedades presentes en familiares. Puede agregar múltiples familiares por grupo.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
            {TIPOS_ANTECEDENTES_FAMILIARES.map((tipo) => {
              const count = antecedentesFamiliares.filter(a => a.tipo === tipo.nombre).length;
              return (
                <label key={tipo.numero} className={`flex items-center gap-2 text-xs p-2 rounded cursor-pointer transition-colors ${count > 0 ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 hover:bg-slate-100'}`}>
                  <input type="checkbox" checked={count > 0} onChange={(e) => {
                    if (e.target.checked) setAntecedentesFamiliares(prev => [...prev, { tipo: tipo.nombre, descripcion: '', parentesco: '' }]);
                    else setAntecedentesFamiliares(prev => prev.filter(a => a.tipo !== tipo.nombre));
                  }} />
                  <span className={count > 0 ? 'font-semibold text-blue-800' : ''}>{tipo.numero}. {tipo.nombre}</span>
                  {count > 0 && <span className="ml-auto bg-blue-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{count}</span>}
                </label>
              );
            })}
          </div>
          {TIPOS_ANTECEDENTES_FAMILIARES.map(tipo => {
            const tipoEntries = antecedentesFamiliares.map((af, idx) => ({ af, idx })).filter(({ af }) => af.tipo === tipo.nombre);
            if (tipoEntries.length === 0) return null;
            return (
              <div key={tipo.nombre} className="mb-4 bg-blue-50 rounded-lg border border-blue-200 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-blue-100">
                  <span className="text-xs font-bold text-blue-900">{tipo.nombre}</span>
                  <button type="button" onClick={() => setAntecedentesFamiliares(prev => [...prev, { tipo: tipo.nombre, descripcion: '', parentesco: '' }])} className="text-blue-700 hover:text-blue-900 text-xs font-semibold">+ Agregar familiar</button>
                </div>
                <div className="p-3 space-y-2">
                  {tipoEntries.map(({ af, idx }) => (
                    <div key={idx} className="flex gap-2 items-center text-xs">
                      <input type="text" placeholder="Parentesco (ej: Madre, Padre, Hermano)" value={af.parentesco}
                        onChange={(e) => { const u = [...antecedentesFamiliares]; u[idx] = { ...u[idx], parentesco: e.target.value }; setAntecedentesFamiliares(u); }}
                        className="px-2 py-1.5 border rounded-lg w-44 bg-white text-xs" />
                      <input type="text" placeholder="Enfermedad o descripción (ej: Diabetes tipo II)" value={af.descripcion}
                        onChange={(e) => { const u = [...antecedentesFamiliares]; u[idx] = { ...u[idx], descripcion: e.target.value }; setAntecedentesFamiliares(u); }}
                        className="px-2 py-1.5 border rounded-lg flex-1 bg-white text-xs" />
                      <button type="button" onClick={() => setAntecedentesFamiliares(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs font-bold px-1">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ===== F. FACTORES DE RIESGO DEL PUESTO ACTUAL ===== */}
        <SeccionE
          titulo="F. FACTORES DE RIESGOS DEL PUESTO DE TRABAJO ACTUAL"
          factoresRiesgo={factoresRiesgo}
          setFactoresRiesgo={setFactoresRiesgo}
          toggleRiesgo={toggleRiesgo}
          totalRiesgos={totalRiesgos}
          puestoPlaceholder={trabajador.puestoTrabajo}
          RIESGOS_FISICOS={RIESGOS_FISICOS}
          RIESGOS_MECANICOS={RIESGOS_MECANICOS}
          RIESGOS_QUIMICOS={RIESGOS_QUIMICOS}
          RIESGOS_BIOLOGICOS={RIESGOS_BIOLOGICOS}
          RIESGOS_ERGONOMICOS={RIESGOS_ERGONOMICOS}
          RIESGOS_PSICOSOCIALES={RIESGOS_PSICOSOCIALES}
        />

        {/* ===== G. ACTIVIDADES EXTRA LABORALES ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">G. ACTIVIDADES EXTRA LABORALES</h2>
          <textarea className="w-full p-3 border border-slate-300 rounded-lg text-sm" rows={2} value={actividadesExtraLaborales} onChange={(e) => setActividadesExtraLaborales(e.target.value)} placeholder="Deportes, otros trabajos, pasatiempos relevantes..." />
        </div>

        {/* ===== H. ENFERMEDAD ACTUAL ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">H. ENFERMEDAD ACTUAL</h2>
          <textarea className="w-full p-3 border border-slate-300 rounded-lg text-sm" rows={3} value={enfermedadActual} onChange={(e) => setEnfermedadActual(e.target.value)} placeholder="Descripción de la enfermedad actual..." />
        </div>

        {/* ===== I. REVISIÓN DE ÓRGANOS Y SISTEMAS ===== */}
        <SeccionG
          titulo="I. REVISIÓN ACTUAL DE ÓRGANOS Y SISTEMAS"
          SISTEMAS={SISTEMAS}
          seleccionados={revisionSistemasSeleccionados}
          descripciones={revisionSistemasDescripciones}
          onToggle={(nombre, checked) => {
            if (checked) setRevisionSistemasSeleccionados(prev => [...prev, nombre]);
            else setRevisionSistemasSeleccionados(prev => prev.filter(n => n !== nombre));
          }}
          onDescripcion={(nombre, valor) => setRevisionSistemasDescripciones(prev => ({ ...prev, [nombre]: valor }))}
        />

        {/* ===== J. CONSTANTES VITALES ===== */}
        <SignosVitalesForm onDataChange={handleSignosChange} initialData={signosVitales} />
        {(!signosVitales.presionSistolica || !signosVitales.presionDiastolica || !signosVitales.frecuenciaCardiaca || !signosVitales.peso || !signosVitales.talla) && (
          <p className="text-xs text-red-500 mt-1 px-1">⚠ PA, FC, Peso y Talla son obligatorios</p>
        )}

        {/* ===== K. EXAMEN FÍSICO REGIONAL ===== */}
        <SeccionI
          titulo="K. EXAMEN FÍSICO REGIONAL"
          REGIONES={REGIONES_EXAMEN_FISICO}
          seleccionados={examenFisicoSeleccionados}
          hallazgos={examenFisicoHallazgos}
          onToggle={toggleExamenFisico}
          onHallazgo={updateHallazgoDescripcion}
        />

        {/* ===== L. EXÁMENES COMPLEMENTARIOS ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <div className="flex justify-between items-center mb-3 border-b pb-2">
            <h2 className="text-sm font-bold text-slate-800">L. RESULTADOS DE EXÁMENES GENERALES Y ESPECÍFICOS</h2>
            <button type="button" onClick={abrirModalExamenes} className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
              📦 Importar Historial
            </button>
          </div>
          {examenesComplementarios.map((ex, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input type="text" placeholder="Examen" value={ex.nombre} onChange={(e) => { const u = [...examenesComplementarios]; u[idx] = { ...u[idx], nombre: e.target.value }; setExamenesComplementarios(u); }} className="w-1/3 px-2 py-1 border rounded text-sm" />
              <input type="date" value={ex.fecha} onChange={(e) => { const u = [...examenesComplementarios]; u[idx] = { ...u[idx], fecha: e.target.value }; setExamenesComplementarios(u); }} className="w-1/6 px-2 py-1 border rounded text-sm" />
              <input type="text" placeholder="Resultado" value={ex.resultado} onChange={(e) => { const u = [...examenesComplementarios]; u[idx] = { ...u[idx], resultado: e.target.value }; setExamenesComplementarios(u); }} className="flex-1 px-2 py-1 border rounded text-sm" />
              <button type="button" onClick={() => setExamenesComplementarios(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 font-bold px-2">×</button>
            </div>
          ))}
          <button type="button" onClick={() => setExamenesComplementarios(prev => [...prev, { nombre: '', fecha: '', resultado: '' }])} className="text-blue-600 text-xs font-medium mt-2 hover:underline">+ Agregar fila vacía</button>
        </div>

        {/* ===== M. DIAGNÓSTICOS ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">M. DIAGNÓSTICO <span className="text-red-500">*</span></h2>
          {diagnosticos.map((dx, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
              <div className="md:col-span-3">
                <BuscadorCIE10
                  valorActual={dx.descripcion ? `${dx.cie} - ${dx.descripcion}` : ''}
                  onSeleccionar={(codigo, descripcion) => {
                    const u = [...diagnosticos];
                    u[idx] = { ...u[idx], cie: codigo, descripcion };
                    setDiagnosticos(u);
                  }}
                />
              </div>
              <select value={dx.tipo} onChange={(e) => { const u = [...diagnosticos]; u[idx] = { ...u[idx], tipo: e.target.value as any }; setDiagnosticos(u); }} className="px-2 py-1 border rounded text-sm bg-white">
                <option value="presuntivo">Presuntivo</option>
                <option value="definitivo">Definitivo</option>
              </select>
            </div>
          ))}
          <button type="button" onClick={() => setDiagnosticos(prev => [...prev, { descripcion: '', cie: '', tipo: 'definitivo' }])} className="text-blue-600 text-xs font-medium mt-2 hover:underline">+ Agregar diagnóstico</button>
          {diagnosticos.filter(d => d.descripcion.trim() !== '').length === 0 && (
            <p className="text-xs text-red-500 mt-2">⚠ Se requiere al menos un diagnóstico</p>
          )}
        </div>

        {/* ===== N. APTITUD MÉDICA ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">N. APTITUD MÉDICA PARA EL TRABAJO</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { value: 'apto', label: 'APTO' },
              { value: 'aptoObservacion', label: 'APTO EN OBSERVACIÓN' },
              { value: 'aptoLimitaciones', label: 'APTO CON LIMITACIONES' },
              { value: 'noApto', label: 'NO APTO' },
            ].map((op) => (
              <label key={op.value} className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer text-xs font-semibold transition-colors ${aptitudMedica === op.value ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="aptitud" value={op.value} checked={aptitudMedica === op.value} onChange={(e) => setAptitudMedica(e.target.value as any)} className="hidden" />
                <span>{op.label}</span>
              </label>
            ))}
          </div>
          {aptitudMedica === 'aptoObservacion' && (
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Observación:</label><textarea className="w-full p-2 border rounded-lg text-sm" rows={2} value={aptitudObservacion} onChange={(e) => setAptitudObservacion(e.target.value)} /></div>
          )}
          {aptitudMedica === 'aptoLimitaciones' && (
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Limitaciones:</label><textarea className="w-full p-2 border rounded-lg text-sm" rows={2} value={aptitudLimitaciones} onChange={(e) => setAptitudLimitaciones(e.target.value)} /></div>
          )}
        </div>

        {/* ===== O. RECOMENDACIONES ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">O. RECOMENDACIONES Y/O TRATAMIENTO</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            {OPCIONES_RECOMENDACIONES.map((op) => (
              <label key={op} className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded cursor-pointer hover:bg-slate-100">
                <input type="checkbox" checked={recomendaciones.includes(op)} onChange={(e) => {
                  if (e.target.checked) setRecomendaciones(prev => [...prev, op]);
                  else setRecomendaciones(prev => prev.filter(r => r !== op));
                }} />
                <span>{op}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Otras recomendaciones:</label>
            <textarea className="w-full p-2 border rounded-lg text-sm" rows={2} value={recomendacionesOtras} onChange={(e) => setRecomendacionesOtras(e.target.value)} placeholder="Recomendaciones adicionales específicas..." />
          </div>
          {recomendaciones.length > 0 && (
            <div className="mt-3 bg-blue-50 p-3 rounded-lg text-sm text-blue-900">
              <span className="font-semibold">Vista previa: </span>{recomendaciones.join(', ')}{recomendacionesOtras ? `, ${recomendacionesOtras}` : ''}
            </div>
          )}
        </div>

        {/* ===== DECLARACIÓN Y FIRMA ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <p className="text-xs text-slate-600 italic mb-4">CERTIFICO QUE LO ANTERIORMENTE EXPRESADO EN RELACIÓN A MI ESTADO DE SALUD ES VERDAD. SE ME HA INFORMADO LAS MEDIDAS PREVENTIVAS A TOMAR PARA DISMINUIR O MITIGAR LOS RIESGOS RELACIONADOS CON MI ACTIVIDAD LABORAL.</p>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="text-xs font-bold text-slate-700 mb-2">P. DATOS DEL PROFESIONAL</h4>
              <p><span className="font-semibold">Nombre:</span> {medicoData?.nombreCompleto || 'Cargando...'}</p>
              <p><span className="font-semibold">Código:</span> {medicoData?.cedula || 'Cargando...'}</p>
              <p><span className="font-semibold">Fecha:</span> {new Date().toLocaleDateString('es-EC')}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="text-xs font-bold text-slate-700 mb-2">Q. FIRMA DEL USUARIO</h4>
              <p className="text-slate-500 text-xs italic">Firma del trabajador al momento de la consulta presencial</p>
            </div>
          </div>
        </div>

        {/* ===== BOTÓN GUARDAR ===== */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pb-8">
          <button onClick={() => navigate(`/trabajador/${trabajadorId}`)} className="sm:hidden text-center text-slate-500 hover:text-slate-800 text-sm font-medium bg-slate-100 px-4 py-3 rounded-lg">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando} className="w-full sm:w-auto bg-blue-600 text-white font-semibold py-3 px-10 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-70 shadow-md text-sm">
            {guardando ? 'Guardando...' : editEvalId ? 'Guardar Cambios' : 'Guardar Evaluación Preocupacional'}
          </button>
        </div>

        {/* ===== MODAL DE IMPORTACIÓN DE EXÁMENES ===== */}
        {mostrarModalExamenes && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-bold text-slate-800">Importar Exámenes del Trabajador</h3>
                  <p className="text-xs text-slate-500">Seleccione los exámenes que desea incluir en esta evaluación.</p>
                </div>
                <button onClick={() => setMostrarModalExamenes(false)} className="text-slate-400 hover:text-red-500 font-bold text-2xl leading-none">&times;</button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 bg-slate-100">
                {cargandoExamenesHist ? (
                  <p className="text-center text-sm text-slate-500 py-8 font-semibold animate-pulse">Buscando en el archivo histórico...</p>
                ) : examenesDisponibles.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-8">No hay exámenes complementarios previos registrados para este trabajador.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {examenesDisponibles.map(ex => {
                      const fechaEx = ex.fecha?.seconds ? new Date(ex.fecha.seconds * 1000).toLocaleDateString('es-EC') : ex.fecha;
                      const isSelected = examenesSeleccionadosModal.includes(ex.id);
                      return (
                        <label key={ex.id} className={`flex items-center gap-4 p-3 border rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white hover:bg-blue-50/50 border-slate-200'}`}>
                          <input
                            type="checkbox"
                            className="w-5 h-5 text-blue-600 rounded border-slate-300"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setExamenesSeleccionadosModal(prev => [...prev, ex.id]);
                              else setExamenesSeleccionadosModal(prev => prev.filter(id => id !== ex.id));
                            }}
                          />
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-sm text-slate-800">{ex.nombreExamen}</span>
                              <span className="text-xs font-semibold text-slate-500">{fechaEx}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${ex.estado === 'patologico' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {ex.estado === 'patologico' ? 'Patológico' : 'Normal'}
                              </span>
                              <span className="text-xs text-slate-600 line-clamp-1">{ex.resultado || 'Sin valor numérico'} {ex.observacion ? `— Obs: ${ex.observacion}` : ''}</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-white">
                <button onClick={() => setMostrarModalExamenes(false)} className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
                <button onClick={inyectarExamenes} disabled={examenesSeleccionadosModal.length === 0} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  ⬇️ Inyectar {examenesSeleccionadosModal.length > 0 ? `(${examenesSeleccionadosModal.length})` : ''} a la Ficha
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
