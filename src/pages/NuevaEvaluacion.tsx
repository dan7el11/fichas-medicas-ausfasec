import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, updateDoc, arrayUnion, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import SignosVitalesForm from '../components/SignosVitalesForm';
import CheckboxSelector from '../components/CheckboxSelector';
import type { Trabajador, SignosVitales, HabitoToxico, EstiloVida, AccidenteTrabajo, EnfermedadProfesional, AntecedenteFamiliar, ExamenFisicoHallazgo, ExamenComplementario, Diagnostico, Usuario } from '../types';

// Datos fijos de la empresa (Sección A)
const DATOS_EMPRESA = {
  institucion: 'CEM AUSTROGAS',
  ruc: '190070301001',
  ciu: '4661',
  establecimiento: 'MEDICINA OCUPACIONAL'
};

// Opciones de recomendaciones predefinidas (Sección M)
const OPCIONES_RECOMENDACIONES = [
  'Dieta balanceada',
  'Dieta baja en grasas',
  'Dieta baja en sal',
  'Actividad física diaria',
  'Ergonomía laboral',
  'Pausas activas frecuentes',
  'Higiene postural',
  'Uso de EPP',
  'Control médico periódico',
  'Hidratación adecuada',
  'Descanso adecuado',
  'Evitar sobreesfuerzos',
  'Protección auditiva',
  'Protección visual'
];

// Sistemas para revisión (Sección G)
const SISTEMAS = [
  { numero: 1, nombre: 'PIEL - ANEXOS' },
  { numero: 2, nombre: 'ÓRGANOS DE LOS SENTIDOS' },
  { numero: 3, nombre: 'RESPIRATORIO' },
  { numero: 4, nombre: 'CARDIO-VASCULAR' },
  { numero: 5, nombre: 'DIGESTIVO' },
  { numero: 6, nombre: 'GENITO - URINARIO' },
  { numero: 7, nombre: 'MÚSCULO ESQUELÉTICO' },
  { numero: 8, nombre: 'ENDOCRINO' },
  { numero: 9, nombre: 'HEMO LINFÁTICO' },
  { numero: 10, nombre: 'NERVIOSO' }
];

// Regiones del examen físico (Sección I)
const REGIONES_EXAMEN_FISICO = [
  { numero: 1, region: 'Piel', subregiones: [
    { codigo: 'a', nombre: 'Cicatrices' },
    { codigo: 'b', nombre: 'Tatuajes' },
    { codigo: 'c', nombre: 'Piel y faneras' }
  ]},
  { numero: 2, region: 'Ojos', subregiones: [
    { codigo: 'a', nombre: 'Párpados' },
    { codigo: 'b', nombre: 'Conjuntivas' },
    { codigo: 'c', nombre: 'Pupilas' },
    { codigo: 'd', nombre: 'Córnea' },
    { codigo: 'e', nombre: 'Motilidad' }
  ]},
  { numero: 3, region: 'Oído', subregiones: [
    { codigo: 'a', nombre: 'C. auditivo externo' },
    { codigo: 'b', nombre: 'Pabellón' },
    { codigo: 'c', nombre: 'Tímpanos' }
  ]},
  { numero: 4, region: 'Oro faringe', subregiones: [
    { codigo: 'a', nombre: 'Labios' },
    { codigo: 'b', nombre: 'Lengua' },
    { codigo: 'c', nombre: 'Faringe' },
    { codigo: 'd', nombre: 'Amígdalas' },
    { codigo: 'e', nombre: 'Dentadura' }
  ]},
  { numero: 5, region: 'Nariz', subregiones: [
    { codigo: 'a', nombre: 'Tabique' },
    { codigo: 'b', nombre: 'Cornetes' },
    { codigo: 'c', nombre: 'Mucosas' },
    { codigo: 'd', nombre: 'Senos paranasales' }
  ]},
  { numero: 6, region: 'Cuello', subregiones: [
    { codigo: 'a', nombre: 'Tiroides / masas' },
    { codigo: 'b', nombre: 'Movilidad' }
  ]},
  { numero: 7, region: 'Tórax (Corazón)', subregiones: [
    { codigo: 'a', nombre: 'Mamas' },
    { codigo: 'b', nombre: 'Corazón' }
  ]},
  { numero: 8, region: 'Tórax (Pulmones)', subregiones: [
    { codigo: 'a', nombre: 'Pulmones' },
    { codigo: 'b', nombre: 'Parrilla costal' }
  ]},
  { numero: 9, region: 'Abdomen', subregiones: [
    { codigo: 'a', nombre: 'Vísceras' },
    { codigo: 'b', nombre: 'Pared abdominal' }
  ]},
  { numero: 10, region: 'Columna', subregiones: [
    { codigo: 'a', nombre: 'Flexibilidad' },
    { codigo: 'b', nombre: 'Desviación' },
    { codigo: 'c', nombre: 'Dolor' }
  ]},
  { numero: 11, region: 'Pelvis', subregiones: [
    { codigo: 'a', nombre: 'Pelvis' },
    { codigo: 'b', nombre: 'Genitales' }
  ]},
  { numero: 12, region: 'Extremidades', subregiones: [
    { codigo: 'a', nombre: 'Vascular' },
    { codigo: 'b', nombre: 'Miembros superiores' },
    { codigo: 'c', nombre: 'Miembros inferiores' }
  ]},
  { numero: 13, region: 'Neurológico', subregiones: [
    { codigo: 'a', nombre: 'Fuerza' },
    { codigo: 'b', nombre: 'Sensibilidad' },
    { codigo: 'c', nombre: 'Marcha' },
    { codigo: 'd', nombre: 'Reflejos' }
  ]}
];

// Tipos de antecedentes familiares (Sección D)
const TIPOS_ANTECEDENTES_FAMILIARES = [
  { numero: 1, nombre: 'Enfermedad Cardio-Vascular' },
  { numero: 2, nombre: 'Enfermedad Metabólica' },
  { numero: 3, nombre: 'Enfermedad Neurológica' },
  { numero: 4, nombre: 'Enfermedad Oncológica' },
  { numero: 5, nombre: 'Enfermedad Infecciosa' },
  { numero: 6, nombre: 'Enfermedad Hereditaria / Congénita' },
  { numero: 7, nombre: 'Discapacidades' },
  { numero: 8, nombre: 'Otros' }
];

export default function NuevaEvaluacion() {
  const { trabajadorId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [trabajador, setTrabajador] = useState<Trabajador | null>(null);
  const [medicoData, setMedicoData] = useState<Usuario | null>(null);
  const [guardando, setGuardando] = useState(false);

  // ===== ESTADOS DEL FORMULARIO =====

  // B. Motivo de consulta
  const [motivoConsulta, setMotivoConsulta] = useState('ACTUALIZACIÓN DE FICHA OCUPACIONAL');

  // C. Antecedentes personales
  const [antecedentesClinicosQuirurgicos, setAntecedentesClinicosQuirurgicos] = useState('');
  const [habitosToxicos, setHabitosToxicos] = useState<HabitoToxico[]>([
    { tipo: 'tabaco', consume: false, tiempoConsumo: '', cantidad: '', exConsumidor: false, tiempoAbstinencia: '' },
    { tipo: 'alcohol', consume: false, tiempoConsumo: '', cantidad: '', exConsumidor: false, tiempoAbstinencia: '' },
    { tipo: 'drogas', consume: false, tiempoConsumo: '', cantidad: '', exConsumidor: false, tiempoAbstinencia: '' }
  ]);
  const [estiloVida, setEstiloVida] = useState<EstiloVida>({
    actividadFisica: false, tipoActividad: '', tiempoCantidad: '',
    medicacionHabitual: '', medicacionCantidad: ''
  });
  const [incidentes, setIncidentes] = useState('NINGUNO');
  const [accidenteTrabajo, setAccidenteTrabajo] = useState<AccidenteTrabajo>({
    descripcion: '', calificado: false, especificacion: '',
    fechaAnio: '', fechaMes: '', fechaDia: '', observaciones: ''
  });
  const [enfermedadProfesional, setEnfermedadProfesional] = useState<EnfermedadProfesional>({
    descripcion: '', calificada: false, especificacion: '',
    fechaAnio: '', fechaMes: '', fechaDia: '', observaciones: ''
  });

  // D. Antecedentes familiares
  const [antecedentesFamiliares, setAntecedentesFamiliares] = useState<AntecedenteFamiliar[]>([]);

  // F. Enfermedad actual
  const [enfermedadActual, setEnfermedadActual] = useState('');

  // G. Revisión de órganos y sistemas
  const [revisionSistemasSeleccionados, setRevisionSistemasSeleccionados] = useState<string[]>([]);
  const [revisionSistemasDescripcion, setRevisionSistemasDescripcion] = useState('');

  // H. Signos vitales
  const [signosVitales, setSignosVitales] = useState<SignosVitales>({
    presionSistolica: '', presionDiastolica: '', temperatura: '',
    frecuenciaCardiaca: '', frecuenciaRespiratoria: '', saturacion: '',
    peso: '', talla: '', imc: 0, perimetroAbdominal: ''
  });

  // I. Examen físico
  const [examenFisicoSeleccionados, setExamenFisicoSeleccionados] = useState<Set<string>>(new Set());
  const [examenFisicoHallazgos, setExamenFisicoHallazgos] = useState<ExamenFisicoHallazgo[]>([]);

  // J. Exámenes complementarios
  const [examenesComplementarios, setExamenesComplementarios] = useState<ExamenComplementario[]>([
    { nombre: '', fecha: '', resultado: '' }
  ]);

  // K. Diagnósticos
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([
    { descripcion: '', cie: '', tipo: 'definitivo' }
  ]);

  // L. Aptitud médica
  const [aptitudMedica, setAptitudMedica] = useState<'apto' | 'aptoObservacion' | 'aptoLimitaciones' | 'noApto'>('apto');
  const [aptitudObservacion, setAptitudObservacion] = useState('');
  const [aptitudLimitaciones, setAptitudLimitaciones] = useState('');

  // M. Recomendaciones
  const [recomendaciones, setRecomendaciones] = useState<string[]>([]);
  const [recomendacionesOtras, setRecomendacionesOtras] = useState('');

  // ===== CARGA DE DATOS =====

  useEffect(() => {
    const cargarDatos = async () => {
      if (!trabajadorId || !user) return;

      // 1. Cargar datos del trabajador
      const trabDoc = await getDoc(doc(db, 'trabajadores', trabajadorId));
      if (trabDoc.exists()) {
        setTrabajador({ id: trabDoc.id, ...trabDoc.data() } as Trabajador);
      }

      // 2. Cargar datos del médico
      const medicoDoc = await getDoc(doc(db, 'usuarios', user.uid));
      if (medicoDoc.exists()) {
        setMedicoData(medicoDoc.data() as Usuario);
      }

      // 3. Cargar datos de la última evaluación para pre-llenar antecedentes
      const evalQuery = query(
        collection(db, 'evaluaciones'),
        where('trabajadorId', '==', trabajadorId),
        orderBy('fecha', 'desc'),
        limit(1)
      );
      const evalSnap = await getDocs(evalQuery);
      
      if (!evalSnap.empty) {
        const ultimaEval = evalSnap.docs[0].data();
        
        // Pre-cargar antecedentes acumulativos
        if (ultimaEval.antecedentesClinicosQuirurgicos) {
          setAntecedentesClinicosQuirurgicos(ultimaEval.antecedentesClinicosQuirurgicos);
        }
        if (ultimaEval.antecedentesFamiliares) {
          setAntecedentesFamiliares(ultimaEval.antecedentesFamiliares);
        }
        if (ultimaEval.habitosToxicos) {
          setHabitosToxicos(ultimaEval.habitosToxicos);
        }
        if (ultimaEval.estiloVida) {
          setEstiloVida(ultimaEval.estiloVida);
        }
        if (ultimaEval.incidentes) {
          setIncidentes(ultimaEval.incidentes);
        }
        // Pre-cargar talla de la evaluación anterior
        if (ultimaEval.signosVitales?.talla) {
          setSignosVitales(prev => ({ ...prev, talla: ultimaEval.signosVitales.talla }));
        }
      }
    };

    cargarDatos();
  }, [trabajadorId, user]);

  // ===== MANEJO DE EXAMEN FÍSICO =====

  const toggleExamenFisico = (key: string, numero: number, codigo: string, region: string, subregion: string) => {
    const newSet = new Set(examenFisicoSeleccionados);
    
    if (newSet.has(key)) {
      newSet.delete(key);
      setExamenFisicoHallazgos(prev => prev.filter(h => h.codigo !== `${numero}${codigo}`));
    } else {
      newSet.add(key);
      setExamenFisicoHallazgos(prev => [
        ...prev,
        { codigo: `${numero}${codigo}`, region, subregion, descripcion: '' }
      ]);
    }
    
    setExamenFisicoSeleccionados(newSet);
  };

  const updateHallazgoDescripcion = (codigo: string, descripcion: string) => {
    setExamenFisicoHallazgos(prev =>
      prev.map(h => h.codigo === codigo ? { ...h, descripcion } : h)
    );
  };

  // ===== MANEJO DE HÁBITOS TÓXICOS =====

  const updateHabito = (index: number, field: keyof HabitoToxico, value: any) => {
    setHabitosToxicos(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // ===== GUARDAR EVALUACIÓN =====

  const handleGuardar = async () => {
    if (!trabajadorId || !user || !trabajador) return;
    setGuardando(true);

    try {
      const hoy = new Date();
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      const dia = String(hoy.getDate()).padStart(2, '0');
      const numeroArchivo = `AUSTROGAS-${hoy.getFullYear()}${mes}${dia}`;

      const evaluacion = {
        trabajadorId,
        medicoId: user.uid,
        medicoNombre: medicoData?.nombreCompleto || '',
        medicoCedula: medicoData?.cedula || '',
        fecha: hoy,
        numeroHistoriaClinica: trabajador.cedula,
        numeroArchivo,

        motivoConsulta,
        antecedentesClinicosQuirurgicos,
        habitosToxicos,
        estiloVida,
        incidentes,
        accidentesTrabajo: accidenteTrabajo,
        enfermedadesProfesionales: enfermedadProfesional,
        antecedentesFamiliares,
        enfermedadActual,
        revisionSistemasSeleccionados,
        revisionSistemasDescripcion,
        signosVitales,
        examenFisicoHallazgos,
        examenesComplementarios: examenesComplementarios.filter(e => e.nombre.trim() !== ''),
        diagnosticos: diagnosticos.filter(d => d.descripcion.trim() !== ''),
        aptitudMedica,
        aptitudObservacion,
        aptitudLimitaciones,
        recomendaciones,
        recomendacionesOtras,
        createdAt: hoy
      };

      const evalRef = await addDoc(collection(db, 'evaluaciones'), evaluacion);

      await updateDoc(doc(db, 'trabajadores', trabajadorId), {
        evaluaciones: arrayUnion(evalRef.id),
        updatedAt: hoy
      });

      alert('Evaluación guardada exitosamente');
      navigate('/');
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Hubo un error al guardar la evaluación.');
    } finally {
      setGuardando(false);
    }
  };

  // ===== CALLBACK PARA SIGNOS VITALES =====
  const handleSignosChange = useCallback((data: SignosVitales) => {
    setSignosVitales(data);
  }, []);

  if (!trabajador) {
    return <div className="min-h-screen p-8 text-center text-slate-500">Cargando datos del trabajador...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ===== ENCABEZADO ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN PERIÓDICA
              </h1>
              <p className="text-slate-500 text-sm mt-1">SO-RE-38 | {DATOS_EMPRESA.institucion} | RUC: {DATOS_EMPRESA.ruc}</p>
            </div>
            <button onClick={() => navigate('/')} className="text-slate-500 hover:text-slate-800 text-sm font-medium bg-slate-100 px-4 py-2 rounded-lg">
              Cancelar
            </button>
          </div>
        </div>

        {/* ===== A. DATOS DEL ESTABLECIMIENTO Y USUARIO ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">B. MOTIVO DE CONSULTA</h2>
          <input
            type="text"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={motivoConsulta}
            onChange={(e) => setMotivoConsulta(e.target.value)}
          />
        </div>

        {/* ===== C. ANTECEDENTES PERSONALES ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">C. ANTECEDENTES PERSONALES</h2>

          {/* Antecedentes clínicos y quirúrgicos */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ANTECEDENTES CLÍNICOS Y QUIRÚRGICOS</label>
            <textarea
              className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              rows={3}
              value={antecedentesClinicosQuirurgicos}
              onChange={(e) => setAntecedentesClinicosQuirurgicos(e.target.value)}
              placeholder="Los datos de evaluaciones previas se cargan automáticamente. Agregue nuevos si corresponde..."
            />
          </div>

          {/* Hábitos tóxicos */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-3">HÁBITOS TÓXICOS</label>
            <div className="space-y-3">
              {habitosToxicos.map((habito, idx) => (
                <div key={habito.tipo} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-center text-sm bg-slate-50 p-3 rounded-lg">
                  <span className="font-semibold capitalize col-span-2 md:col-span-1">{habito.tipo}</span>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={habito.consume} onChange={(e) => updateHabito(idx, 'consume', e.target.checked)} />
                    <span className="text-xs">Consume</span>
                  </label>
                  <input type="text" placeholder="Tiempo (meses)" value={habito.tiempoConsumo} onChange={(e) => updateHabito(idx, 'tiempoConsumo', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <input type="text" placeholder="Cantidad" value={habito.cantidad} onChange={(e) => updateHabito(idx, 'cantidad', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={habito.exConsumidor} onChange={(e) => updateHabito(idx, 'exConsumidor', e.target.checked)} />
                    <span className="text-xs">Ex consumidor</span>
                  </label>
                  <input type="text" placeholder="Abstinencia (meses)" value={habito.tiempoAbstinencia} onChange={(e) => updateHabito(idx, 'tiempoAbstinencia', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                </div>
              ))}
            </div>
          </div>

          {/* Estilo de vida */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-3">ESTILO DE VIDA</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={estiloVida.actividadFisica} onChange={(e) => setEstiloVida(prev => ({ ...prev, actividadFisica: e.target.checked }))} />
                  <span className="text-xs font-medium">Actividad Física</span>
                </label>
                <input type="text" placeholder="¿Cuál?" value={estiloVida.tipoActividad} onChange={(e) => setEstiloVida(prev => ({ ...prev, tipoActividad: e.target.value }))} className="flex-1 px-2 py-1 border rounded text-xs" />
                <input type="text" placeholder="Tiempo/Cantidad" value={estiloVida.tiempoCantidad} onChange={(e) => setEstiloVida(prev => ({ ...prev, tiempoCantidad: e.target.value }))} className="flex-1 px-2 py-1 border rounded text-xs" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium whitespace-nowrap">Medicación Habitual:</span>
                <input type="text" placeholder="Nombre" value={estiloVida.medicacionHabitual} onChange={(e) => setEstiloVida(prev => ({ ...prev, medicacionHabitual: e.target.value }))} className="flex-1 px-2 py-1 border rounded text-xs" />
                <input type="text" placeholder="Cantidad" value={estiloVida.medicacionCantidad} onChange={(e) => setEstiloVida(prev => ({ ...prev, medicacionCantidad: e.target.value }))} className="flex-1 px-2 py-1 border rounded text-xs" />
              </div>
            </div>
          </div>

          {/* Incidentes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">INCIDENTES</label>
            <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" value={incidentes} onChange={(e) => setIncidentes(e.target.value)} />
          </div>

          {/* Accidentes de trabajo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">ACCIDENTES DE TRABAJO</label>
            <textarea className="w-full p-2 border rounded-lg text-sm mb-2" rows={2} placeholder="Descripción..." value={accidenteTrabajo.descripcion} onChange={(e) => setAccidenteTrabajo(prev => ({ ...prev, descripcion: e.target.value }))} />
            <div className="flex flex-wrap gap-3 items-center text-xs">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={accidenteTrabajo.calificado} onChange={(e) => setAccidenteTrabajo(prev => ({ ...prev, calificado: e.target.checked }))} />
                Calificado por IESS
              </label>
              <input type="text" placeholder="Especificar" value={accidenteTrabajo.especificacion} onChange={(e) => setAccidenteTrabajo(prev => ({ ...prev, especificacion: e.target.value }))} className="px-2 py-1 border rounded flex-1" />
              <input type="text" placeholder="Observaciones" value={accidenteTrabajo.observaciones} onChange={(e) => setAccidenteTrabajo(prev => ({ ...prev, observaciones: e.target.value }))} className="px-2 py-1 border rounded flex-1" />
            </div>
          </div>

          {/* Enfermedades profesionales */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">ENFERMEDADES PROFESIONALES</label>
            <textarea className="w-full p-2 border rounded-lg text-sm mb-2" rows={2} placeholder="Descripción..." value={enfermedadProfesional.descripcion} onChange={(e) => setEnfermedadProfesional(prev => ({ ...prev, descripcion: e.target.value }))} />
            <div className="flex flex-wrap gap-3 items-center text-xs">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={enfermedadProfesional.calificada} onChange={(e) => setEnfermedadProfesional(prev => ({ ...prev, calificada: e.target.checked }))} />
                Calificada por IESS
              </label>
              <input type="text" placeholder="Especificar" value={enfermedadProfesional.especificacion} onChange={(e) => setEnfermedadProfesional(prev => ({ ...prev, especificacion: e.target.value }))} className="px-2 py-1 border rounded flex-1" />
              <input type="text" placeholder="Observaciones" value={enfermedadProfesional.observaciones} onChange={(e) => setEnfermedadProfesional(prev => ({ ...prev, observaciones: e.target.value }))} className="px-2 py-1 border rounded flex-1" />
            </div>
          </div>
        </div>

        {/* ===== D. ANTECEDENTES FAMILIARES ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">D. ANTECEDENTES FAMILIARES (Detallar parentesco)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {TIPOS_ANTECEDENTES_FAMILIARES.map((tipo) => {
              const existente = antecedentesFamiliares.find(a => a.tipo === tipo.nombre);
              return (
                <label key={tipo.numero} className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded cursor-pointer hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={!!existente}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAntecedentesFamiliares(prev => [...prev, { tipo: tipo.nombre, descripcion: '', parentesco: '' }]);
                      } else {
                        setAntecedentesFamiliares(prev => prev.filter(a => a.tipo !== tipo.nombre));
                      }
                    }}
                  />
                  <span>{tipo.numero}. {tipo.nombre}</span>
                </label>
              );
            })}
          </div>
          {antecedentesFamiliares.length > 0 && (
            <div className="space-y-2">
              {antecedentesFamiliares.map((af, idx) => (
                <div key={idx} className="flex gap-2 items-center text-xs bg-blue-50 p-2 rounded">
                  <span className="font-semibold whitespace-nowrap">{af.tipo}:</span>
                  <input type="text" placeholder="Parentesco" value={af.parentesco} onChange={(e) => {
                    const updated = [...antecedentesFamiliares];
                    updated[idx] = { ...updated[idx], parentesco: e.target.value };
                    setAntecedentesFamiliares(updated);
                  }} className="px-2 py-1 border rounded flex-1" />
                  <input type="text" placeholder="Descripción" value={af.descripcion} onChange={(e) => {
                    const updated = [...antecedentesFamiliares];
                    updated[idx] = { ...updated[idx], descripcion: e.target.value };
                    setAntecedentesFamiliares(updated);
                  }} className="px-2 py-1 border rounded flex-1" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== F. ENFERMEDAD ACTUAL ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">F. ENFERMEDAD ACTUAL</h2>
          <textarea
            className="w-full p-3 border border-slate-300 rounded-lg text-sm"
            rows={3}
            value={enfermedadActual}
            onChange={(e) => setEnfermedadActual(e.target.value)}
            placeholder="Descripción de la enfermedad actual..."
          />
        </div>

        {/* ===== G. REVISIÓN DE ÓRGANOS Y SISTEMAS ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-1 border-b pb-2">G. REVISIÓN DE ÓRGANOS Y SISTEMAS</h2>
          <p className="text-xs text-slate-500 mb-3">En caso de existir patología, marcar con "X" y describir abajo</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            {SISTEMAS.map((s) => (
              <label key={s.numero} className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded cursor-pointer hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={revisionSistemasSeleccionados.includes(s.nombre)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setRevisionSistemasSeleccionados(prev => [...prev, s.nombre]);
                    } else {
                      setRevisionSistemasSeleccionados(prev => prev.filter(n => n !== s.nombre));
                    }
                  }}
                />
                <span>{s.numero}. {s.nombre}</span>
              </label>
            ))}
          </div>
          {revisionSistemasSeleccionados.length > 0 ? (
            <textarea
              className="w-full p-3 border border-slate-300 rounded-lg text-sm"
              rows={3}
              value={revisionSistemasDescripcion}
              onChange={(e) => setRevisionSistemasDescripcion(e.target.value)}
              placeholder="Describa los hallazgos por numeral..."
            />
          ) : (
            <div className="bg-green-50 text-green-800 p-3 rounded-lg text-sm">
              Paciente no refiere síntomas adicionales o relevantes al momento de la consulta
            </div>
          )}
        </div>

        {/* ===== H. SIGNOS VITALES ===== */}
        <SignosVitalesForm onDataChange={handleSignosChange} initialData={signosVitales} />

        {/* ===== I. EXAMEN FÍSICO REGIONAL ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-1 border-b pb-2">I. EXAMEN FÍSICO REGIONAL</h2>
          <p className="text-xs text-slate-500 mb-3">Marcar si existe evidencia de patología y describir</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {REGIONES_EXAMEN_FISICO.map((region) => (
              <div key={region.numero} className="bg-slate-50 p-3 rounded-lg">
                <p className="text-xs font-bold text-slate-700 mb-2">{region.numero}. {region.region}</p>
                <div className="space-y-1">
                  {region.subregiones.map((sub) => {
                    const key = `${region.numero}-${sub.codigo}`;
                    return (
                      <label key={key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-100 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={examenFisicoSeleccionados.has(key)}
                          onChange={() => toggleExamenFisico(key, region.numero, sub.codigo, region.region, sub.nombre)}
                        />
                        <span>{sub.codigo}. {sub.nombre}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Hallazgos con auto-numeración */}
          {examenFisicoHallazgos.length > 0 ? (
            <div className="space-y-2 border-t pt-4">
              <h4 className="text-xs font-bold text-slate-700">Observaciones:</h4>
              {examenFisicoHallazgos.map((h) => (
                <div key={h.codigo} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-700 whitespace-nowrap">{h.codigo}:</span>
                  <input
                    type="text"
                    className="flex-1 px-3 py-1 border rounded text-sm"
                    placeholder={`Hallazgo en ${h.region} - ${h.subregion}`}
                    value={h.descripcion}
                    onChange={(e) => updateHallazgoDescripcion(h.codigo, e.target.value)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-green-50 text-green-800 p-3 rounded-lg text-sm">
              Sin signos relevantes al momento de la consulta
            </div>
          )}
        </div>

        {/* ===== J. EXÁMENES COMPLEMENTARIOS ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">J. RESULTADOS DE EXÁMENES</h2>
          {examenesComplementarios.map((ex, idx) => (
            <div key={idx} className="grid grid-cols-3 gap-2 mb-2">
              <input type="text" placeholder="Examen" value={ex.nombre} onChange={(e) => {
                const updated = [...examenesComplementarios];
                updated[idx] = { ...updated[idx], nombre: e.target.value };
                setExamenesComplementarios(updated);
              }} className="px-2 py-1 border rounded text-sm" />
              <input type="date" value={ex.fecha} onChange={(e) => {
                const updated = [...examenesComplementarios];
                updated[idx] = { ...updated[idx], fecha: e.target.value };
                setExamenesComplementarios(updated);
              }} className="px-2 py-1 border rounded text-sm" />
              <input type="text" placeholder="Resultado" value={ex.resultado} onChange={(e) => {
                const updated = [...examenesComplementarios];
                updated[idx] = { ...updated[idx], resultado: e.target.value };
                setExamenesComplementarios(updated);
              }} className="px-2 py-1 border rounded text-sm" />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setExamenesComplementarios(prev => [...prev, { nombre: '', fecha: '', resultado: '' }])}
            className="text-blue-600 text-xs font-medium mt-2 hover:underline"
          >
            + Agregar examen
          </button>
        </div>

        {/* ===== K. DIAGNÓSTICOS ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">K. DIAGNÓSTICO</h2>
          {diagnosticos.map((dx, idx) => (
            <div key={idx} className="grid grid-cols-3 gap-2 mb-2">
              <input type="text" placeholder="Descripción" value={dx.descripcion} onChange={(e) => {
                const updated = [...diagnosticos];
                updated[idx] = { ...updated[idx], descripcion: e.target.value };
                setDiagnosticos(updated);
              }} className="px-2 py-1 border rounded text-sm" />
              <input type="text" placeholder="CIE" value={dx.cie} onChange={(e) => {
                const updated = [...diagnosticos];
                updated[idx] = { ...updated[idx], cie: e.target.value };
                setDiagnosticos(updated);
              }} className="px-2 py-1 border rounded text-sm" />
              <select value={dx.tipo} onChange={(e) => {
                const updated = [...diagnosticos];
                updated[idx] = { ...updated[idx], tipo: e.target.value as 'presuntivo' | 'definitivo' };
                setDiagnosticos(updated);
              }} className="px-2 py-1 border rounded text-sm bg-white">
                <option value="presuntivo">Presuntivo</option>
                <option value="definitivo">Definitivo</option>
              </select>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDiagnosticos(prev => [...prev, { descripcion: '', cie: '', tipo: 'definitivo' }])}
            className="text-blue-600 text-xs font-medium mt-2 hover:underline"
          >
            + Agregar diagnóstico
          </button>
        </div>

        {/* ===== L. APTITUD MÉDICA ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">L. APTITUD MÉDICA PARA EL TRABAJO</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { value: 'apto', label: 'APTO' },
              { value: 'aptoObservacion', label: 'APTO EN OBSERVACIÓN' },
              { value: 'aptoLimitaciones', label: 'APTO CON LIMITACIONES' },
              { value: 'noApto', label: 'NO APTO' }
            ].map((op) => (
              <label key={op.value} className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer text-xs font-semibold transition-colors ${
                aptitudMedica === op.value ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
              }`}>
                <input type="radio" name="aptitud" value={op.value} checked={aptitudMedica === op.value} onChange={(e) => setAptitudMedica(e.target.value as any)} className="hidden" />
                <span>{op.label}</span>
              </label>
            ))}
          </div>
          {aptitudMedica === 'aptoObservacion' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Observación:</label>
              <textarea className="w-full p-2 border rounded-lg text-sm" rows={2} value={aptitudObservacion} onChange={(e) => setAptitudObservacion(e.target.value)} />
            </div>
          )}
          {aptitudMedica === 'aptoLimitaciones' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Limitaciones:</label>
              <textarea className="w-full p-2 border rounded-lg text-sm" rows={2} value={aptitudLimitaciones} onChange={(e) => setAptitudLimitaciones(e.target.value)} />
            </div>
          )}
        </div>

        {/* ===== M. RECOMENDACIONES ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">M. RECOMENDACIONES Y/O TRATAMIENTO</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            {OPCIONES_RECOMENDACIONES.map((op) => (
              <label key={op} className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded cursor-pointer hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={recomendaciones.includes(op)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setRecomendaciones(prev => [...prev, op]);
                    } else {
                      setRecomendaciones(prev => prev.filter(r => r !== op));
                    }
                  }}
                />
                <span>{op}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Otras recomendaciones:</label>
            <textarea
              className="w-full p-2 border rounded-lg text-sm"
              rows={2}
              value={recomendacionesOtras}
              onChange={(e) => setRecomendacionesOtras(e.target.value)}
              placeholder="Recomendaciones adicionales específicas..."
            />
          </div>
          {recomendaciones.length > 0 && (
            <div className="mt-3 bg-blue-50 p-3 rounded-lg text-sm text-blue-900">
              <span className="font-semibold">Vista previa: </span>
              {recomendaciones.join(', ')}{recomendacionesOtras ? `, ${recomendacionesOtras}` : ''}
            </div>
          )}
        </div>

        {/* ===== DECLARACIÓN Y FIRMA ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-xs text-slate-600 italic mb-4">
            CERTIFICO QUE LO ANTERIORMENTE EXPRESADO EN RELACIÓN A MI ESTADO DE SALUD ES VERDAD.
            SE ME HA INFORMADO LAS MEDIDAS PREVENTIVAS A TOMAR PARA DISMINUIR O MITIGAR LOS RIESGOS
            RELACIONADOS CON MI ACTIVIDAD LABORAL.
          </p>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="text-xs font-bold text-slate-700 mb-2">N. DATOS DEL PROFESIONAL</h4>
              <p><span className="font-semibold">Nombre:</span> {medicoData?.nombreCompleto || 'Cargando...'}</p>
              <p><span className="font-semibold">Código:</span> {medicoData?.cedula || 'Cargando...'}</p>
              <p><span className="font-semibold">Fecha:</span> {new Date().toLocaleDateString('es-EC')}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="text-xs font-bold text-slate-700 mb-2">O. FIRMA DEL USUARIO</h4>
              <p className="text-slate-500 text-xs italic">Firma del trabajador al momento de la consulta presencial</p>
            </div>
          </div>
        </div>

        {/* ===== BOTÓN GUARDAR ===== */}
        <div className="flex justify-end pb-8">
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="bg-blue-600 text-white font-semibold py-3 px-10 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-70 shadow-md text-sm"
          >
            {guardando ? 'Guardando evaluación...' : 'Guardar Evaluación Definitiva'}
          </button>
        </div>

      </div>
    </div>
  );
}
