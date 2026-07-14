import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, updateDoc, arrayUnion, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { registrarAuditoria } from '../services/auditoria';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { useEmpresa } from '../hooks/useEmpresa';
import SignosVitalesForm from '../components/SignosVitalesForm';
import BuscadorCIE10 from '../components/BuscadorCIE10';
import { nombreProfesionalDe, codigoProfesionalDe } from '../utils/medicalHelpers';
import { SeccionI } from '../components/evaluacion/SeccionesEvaluacion';
import { LOGO_EMPRESA } from '../assets/logoEmpresa';
import { cargarLogoParaPdf } from '../utils/logoPdf';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  Trabajador, SignosVitales, AccidenteTrabajo, EnfermedadProfesional,
  ExamenFisicoHallazgo, ExamenComplementario, Diagnostico, Usuario,
  AntecedenteClinico, AntecedenteQuirurgico, Alergia,
} from '../types';

// ── Catálogos ─────────────────────────────────────────────────────────────────

const REGIONES_EXAMEN_FISICO = [
  { numero: 1, region: 'Piel', subregiones: [{ codigo: 'a', nombre: 'Cicatrices' }, { codigo: 'b', nombre: 'Tatuajes' }, { codigo: 'c', nombre: 'Piel y faneras' }] },
  { numero: 2, region: 'Ojos', subregiones: [{ codigo: 'a', nombre: 'Párpados' }, { codigo: 'b', nombre: 'Conjuntivas' }, { codigo: 'c', nombre: 'Pupilas' }, { codigo: 'd', nombre: 'Córnea' }, { codigo: 'e', nombre: 'Motilidad' }] },
  { numero: 3, region: 'Oído', subregiones: [{ codigo: 'a', nombre: 'C. auditivo externo' }, { codigo: 'b', nombre: 'Pabellón' }, { codigo: 'c', nombre: 'Tímpanos' }] },
  { numero: 4, region: 'Oro faringe', subregiones: [{ codigo: 'a', nombre: 'Labios' }, { codigo: 'b', nombre: 'Lengua' }, { codigo: 'c', nombre: 'Faringe' }, { codigo: 'd', nombre: 'Amígdalas' }, { codigo: 'e', nombre: 'Dentadura' }] },
  { numero: 5, region: 'Nariz', subregiones: [{ codigo: 'a', nombre: 'Tabique' }, { codigo: 'b', nombre: 'Cornetes' }, { codigo: 'c', nombre: 'Mucosas' }, { codigo: 'd', nombre: 'Senos paranasales' }] },
  { numero: 6, region: 'Cuello', subregiones: [{ codigo: 'a', nombre: 'Tiroides / masas' }, { codigo: 'b', nombre: 'Movilidad' }] },
  { numero: 7, region: 'Tórax (Corazón)', subregiones: [{ codigo: 'a', nombre: 'Mamas' }, { codigo: 'b', nombre: 'Corazón' }] },
  { numero: 8, region: 'Tórax (Pulmones)', subregiones: [{ codigo: 'a', nombre: 'Pulmones' }, { codigo: 'b', nombre: 'Parrilla costal' }] },
  { numero: 9, region: 'Abdomen', subregiones: [{ codigo: 'a', nombre: 'Vísceras' }, { codigo: 'b', nombre: 'Pared abdominal' }] },
  { numero: 10, region: 'Columna', subregiones: [{ codigo: 'a', nombre: 'Flexibilidad' }, { codigo: 'b', nombre: 'Desviación' }, { codigo: 'c', nombre: 'Dolor' }] },
  { numero: 11, region: 'Pelvis', subregiones: [{ codigo: 'a', nombre: 'Pelvis' }, { codigo: 'b', nombre: 'Genitales' }] },
  { numero: 12, region: 'Extremidades', subregiones: [{ codigo: 'a', nombre: 'Vascular' }, { codigo: 'b', nombre: 'Miembros superiores' }, { codigo: 'c', nombre: 'Miembros inferiores' }] },
  { numero: 13, region: 'Neurológico', subregiones: [{ codigo: 'a', nombre: 'Fuerza' }, { codigo: 'b', nombre: 'Sensibilidad' }, { codigo: 'c', nombre: 'Marcha' }, { codigo: 'd', nombre: 'Reflejos' }] },
];

const FISICO_ROWS = [
  [
    { type: 'reg', rs: 3, txt: '1. PIEL' }, { type: 'sub', txt: 'a. Cicatrices' }, { type: 'chk', code: '1a' },
    { type: 'reg', rs: 3, txt: '3. OÍDO' }, { type: 'sub', txt: 'a. C. aud ext' }, { type: 'chk', code: '3a' },
    { type: 'reg', rs: 4, txt: '5. NARIZ' }, { type: 'sub', txt: 'a. Tabique' }, { type: 'chk', code: '5a' },
    { type: 'reg', rs: 2, txt: '8. TÓRAX' }, { type: 'sub', txt: 'a. Pulmones' }, { type: 'chk', code: '8a' },
    { type: 'reg', rs: 2, txt: '11. PELVIS' }, { type: 'sub', txt: 'a. Pelvis' }, { type: 'chk', code: '11a' },
  ],
  [
    { type: 'sub', txt: 'b. Tatuajes' }, { type: 'chk', code: '1b' },
    { type: 'sub', txt: 'b. Pabellón' }, { type: 'chk', code: '3b' },
    { type: 'sub', txt: 'b. Cornetes' }, { type: 'chk', code: '5b' },
    { type: 'sub', txt: 'b. Parrilla costal' }, { type: 'chk', code: '8b' },
    { type: 'sub', txt: 'b. Genitales' }, { type: 'chk', code: '11b' },
  ],
  [
    { type: 'sub', txt: 'c. Piel faneras' }, { type: 'chk', code: '1c' },
    { type: 'sub', txt: 'c. Tímpanos' }, { type: 'chk', code: '3c' },
    { type: 'sub', txt: 'c. Mucosas' }, { type: 'chk', code: '5c' },
    { type: 'reg', rs: 2, txt: '9. ABDOMEN' }, { type: 'sub', txt: 'a. Vísceras' }, { type: 'chk', code: '9a' },
    { type: 'reg', rs: 3, txt: '12. EXTREM.' }, { type: 'sub', txt: 'a. Vascular' }, { type: 'chk', code: '12a' },
  ],
  [
    { type: 'reg', rs: 5, txt: '2. OJOS' }, { type: 'sub', txt: 'a. Párpados' }, { type: 'chk', code: '2a' },
    { type: 'reg', rs: 5, txt: '4. OROFAR.' }, { type: 'sub', txt: 'a. Labios' }, { type: 'chk', code: '4a' },
    { type: 'sub', txt: 'd. Senos paran.' }, { type: 'chk', code: '5d' },
    { type: 'sub', txt: 'b. Pared abdom.' }, { type: 'chk', code: '9b' },
    { type: 'sub', txt: 'b. Miembros sup.' }, { type: 'chk', code: '12b' },
  ],
  [
    { type: 'sub', txt: 'b. Conjuntivas' }, { type: 'chk', code: '2b' },
    { type: 'sub', txt: 'b. Lengua' }, { type: 'chk', code: '4b' },
    { type: 'reg', rs: 2, txt: '6. CUELLO' }, { type: 'sub', txt: 'a. Tiroides/mas' }, { type: 'chk', code: '6a' },
    { type: 'reg', rs: 3, txt: '10. COLUMNA' }, { type: 'sub', txt: 'a. Flexibilidad' }, { type: 'chk', code: '10a' },
    { type: 'sub', txt: 'c. Miembros inf.' }, { type: 'chk', code: '12c' },
  ],
  [
    { type: 'sub', txt: 'c. Pupilas' }, { type: 'chk', code: '2c' },
    { type: 'sub', txt: 'c. Faringe' }, { type: 'chk', code: '4c' },
    { type: 'sub', txt: 'b. Movilidad' }, { type: 'chk', code: '6b' },
    { type: 'sub', txt: 'b. Desviación' }, { type: 'chk', code: '10b' },
    { type: 'reg', rs: 4, txt: '13. NEUROLÓG.' }, { type: 'sub', txt: 'a. Fuerza' }, { type: 'chk', code: '13a' },
  ],
  [
    { type: 'sub', txt: 'd. Córnea' }, { type: 'chk', code: '2d' },
    { type: 'sub', txt: 'd. Amígdalas' }, { type: 'chk', code: '4d' },
    { type: 'reg', rs: 2, txt: '7. TÓRAX (Cor)' }, { type: 'sub', txt: 'a. Mamas' }, { type: 'chk', code: '7a' },
    { type: 'sub', txt: 'c. Dolor' }, { type: 'chk', code: '10c' },
    { type: 'sub', txt: 'b. Sensibilidad' }, { type: 'chk', code: '13b' },
  ],
  [
    { type: 'sub', txt: 'e. Motilidad' }, { type: 'chk', code: '2e' },
    { type: 'sub', txt: 'e. Dentadura' }, { type: 'chk', code: '4e' },
    { type: 'sub', txt: 'b. Corazón' }, { type: 'chk', code: '7b' },
    { type: 'empty', cs: 3 },
    { type: 'sub', txt: 'c. Marcha' }, { type: 'chk', code: '13c' },
  ],
  [
    { type: 'instr', cs: 12, txt: 'CON EVIDENCIA DE PATOLOGÍA MARCAR CON "X" Y DESCRIBIR EN LA SIGUIENTE SECCIÓN ANOTANDO EL NUMERAL' },
    { type: 'sub', txt: 'd. Reflejos' }, { type: 'chk', code: '13d' },
  ],
];

const OPCIONES_RECOMENDACIONES = [
  'Dieta balanceada', 'Dieta baja en grasas', 'Dieta baja en sal', 'Actividad física diaria',
  'Ergonomía laboral', 'Pausas activas frecuentes', 'Higiene postural', 'Uso de EPP',
  'Control médico periódico', 'Hidratación adecuada', 'Descanso adecuado',
  'Evitar sobreesfuerzos', 'Protección auditiva', 'Protección visual',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const emptyClinico = (): AntecedenteClinico => ({ enfermedad: '', desdeCuando: '', tomaMedicacion: false, medicacionNombre: '', medicacionDosis: '', medicacionFrecuencia: '', seguimientoEspecialista: false, especialista: '', complicaciones: '' });
const emptyQuirurgico = (): AntecedenteQuirurgico => ({ procedimiento: '', fechaAproximada: '', complicaciones: '', recuperacionCompleta: true, secuelas: '' });
const emptyAlergia = (): Alergia => ({ alergeno: '', intensidadReaccion: '', sintomas: '', tratamientoHabitual: '', seguimientoEspecialista: false, especialista: '' });
const emptyAccidente = (): AccidenteTrabajo => ({ descripcion: '', calificado: false, especificacion: '', fechaAnio: '', fechaMes: '', fechaDia: '', observaciones: '' });
const emptyEnfermedad = (): EnfermedadProfesional => ({ descripcion: '', calificada: false, especificacion: '', fechaAnio: '', fechaMes: '', fechaDia: '', observaciones: '' });

// ── Componente principal ──────────────────────────────────────────────────────

export default function NuevaEvaluacionRetiro() {
  const { trabajadorId } = useParams<{ trabajadorId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editEvalId = searchParams.get('editId');
  const { user } = useAuth();
  const toast = useToast();
  const { empresa: DATOS_EMPRESA } = useEmpresa();
  // Logo para los PDF: el configurado por la empresa, con respaldo al embebido.
  const [logoPdf, setLogoPdf] = useState<{ data: string; format: string }>({ data: LOGO_EMPRESA, format: 'PNG' });
  useEffect(() => {
    let cancelado = false;
    if (DATOS_EMPRESA.logoUrl) {
      cargarLogoParaPdf(DATOS_EMPRESA.logoUrl).then((r) => { if (!cancelado && r) setLogoPdf(r); });
    } else {
      setLogoPdf({ data: LOGO_EMPRESA, format: 'PNG' });
    }
    return () => { cancelado = true; };
  }, [DATOS_EMPRESA.logoUrl]);

  const [trabajador, setTrabajador] = useState<Trabajador | null>(null);
  const [medicoData, setMedicoData] = useState<Usuario | null>(null);
  const [guardando, setGuardando] = useState(false);

  // A.
  const [numeroHistoriaClinica, setNumeroHistoriaClinica] = useState('');
  const [numeroArchivo, setNumeroArchivo] = useState('');
  const [fechaSalida, setFechaSalida] = useState('');
  const [tiempoMeses, setTiempoMeses] = useState('');
  const [actividadesTexto, setActividadesTexto] = useState('');
  const [factoresRiesgoTexto, setFactoresRiesgoTexto] = useState('');

  // B. Antecedentes
  const [antecedentesClinicosQ, setAntecedentesClinicosQ] = useState<boolean | null>(null);
  const [antecedentesClinicosLista, setAntecedentesClinicosLista] = useState<AntecedenteClinico[]>([emptyClinico()]);
  const [antecedentesQuirurgicosQ, setAntecedentesQuirurgicosQ] = useState<boolean | null>(null);
  const [antecedentesQuirurgicosLista, setAntecedentesQuirurgicosLista] = useState<AntecedenteQuirurgico[]>([emptyQuirurgico()]);
  const [alergiasTiene, setAlergiasTiene] = useState<boolean | null>(null);
  const [alergias, setAlergias] = useState<Alergia[]>([emptyAlergia()]);
  // Accidentes: null=sin responder, true=sí, false=no
  const [tieneAccidente, setTieneAccidente] = useState<boolean | null>(null);
  const [accidenteTrabajo, setAccidenteTrabajo] = useState<AccidenteTrabajo>(emptyAccidente());
  const [tieneEnfermedad, setTieneEnfermedad] = useState<boolean | null>(null);
  const [enfermedadProfesional, setEnfermedadProfesional] = useState<EnfermedadProfesional>(emptyEnfermedad());

  // C. Signos vitales
  const [signosVitales, setSignosVitales] = useState<SignosVitales>({
    presionSistolica: '', presionDiastolica: '', temperatura: '',
    frecuenciaCardiaca: '', frecuenciaRespiratoria: '', saturacion: '',
    peso: '', talla: '', imc: 0, perimetroAbdominal: '',
  });

  // D. Examen físico
  const [examenFisicoSeleccionados, setExamenFisicoSeleccionados] = useState<Set<string>>(new Set());
  const [examenFisicoHallazgos, setExamenFisicoHallazgos] = useState<ExamenFisicoHallazgo[]>([]);

  // E. Exámenes complementarios
  const [examenesComplementarios, setExamenesComplementarios] = useState<ExamenComplementario[]>([{ nombre: '', fecha: '', resultado: '' }]);

  // F. Diagnósticos
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([{ descripcion: '', cie: '', tipo: 'definitivo' }]);

  // G. Evaluación de retiro
  const [evaluacionRealizada, setEvaluacionRealizada] = useState(true);
  const [observacionesRetiro, setObservacionesRetiro] = useState('');

  // H. Recomendaciones
  const [recomendaciones, setRecomendaciones] = useState<string[]>([]);
  const [recomendacionesOtras, setRecomendacionesOtras] = useState('');

  // ── Carga inicial ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!trabajadorId || !user) return;
    (async () => {
      const trabDoc = await getDoc(doc(db, 'trabajadores', trabajadorId));
      if (trabDoc.exists()) setTrabajador({ id: trabDoc.id, ...trabDoc.data() } as Trabajador);
      const medicoDoc = await getDoc(doc(db, 'usuarios', user.uid));
      if (medicoDoc.exists()) setMedicoData(medicoDoc.data() as Usuario);

      if (editEvalId) {
        // Modo edición: cargar la evaluación existente
        const evalDoc = await getDoc(doc(db, 'evaluaciones', editEvalId));
        if (evalDoc.exists()) {
          const u = evalDoc.data();
          if (u.numeroHistoriaClinica) setNumeroHistoriaClinica(u.numeroHistoriaClinica);
          if (u.numeroArchivo) setNumeroArchivo(u.numeroArchivo);
          if (u.fechaSalida) setFechaSalida(u.fechaSalida);
          if (u.tiempoMeses) setTiempoMeses(u.tiempoMeses);
          if (u.actividadesTexto) setActividadesTexto(u.actividadesTexto);
          if (u.factoresRiesgoTexto) setFactoresRiesgoTexto(u.factoresRiesgoTexto);
          if (u.antecedentesClinicosQ !== undefined) setAntecedentesClinicosQ(u.antecedentesClinicosQ);
          if (u.antecedentesClinicosLista?.length) setAntecedentesClinicosLista(u.antecedentesClinicosLista);
          if (u.antecedentesQuirurgicosQ !== undefined) setAntecedentesQuirurgicosQ(u.antecedentesQuirurgicosQ);
          if (u.antecedentesQuirurgicosLista?.length) setAntecedentesQuirurgicosLista(u.antecedentesQuirurgicosLista);
          if (u.alergiasTiene !== undefined) setAlergiasTiene(u.alergiasTiene);
          if (u.alergias?.length) setAlergias(u.alergias);
          if (u.tieneAccidente !== undefined) setTieneAccidente(u.tieneAccidente);
          if (u.accidentesTrabajo) setAccidenteTrabajo(u.accidentesTrabajo);
          if (u.tieneEnfermedad !== undefined) setTieneEnfermedad(u.tieneEnfermedad);
          if (u.enfermedadesProfesionales) setEnfermedadProfesional(u.enfermedadesProfesionales);
          if (u.signosVitales) setSignosVitales(u.signosVitales);
          if (u.examenFisicoHallazgos) {
            setExamenFisicoHallazgos(u.examenFisicoHallazgos);
            setExamenFisicoSeleccionados(new Set(u.examenFisicoHallazgos.map((h: any) => h.codigo)));
          }
          if (u.examenesComplementarios?.length) setExamenesComplementarios(u.examenesComplementarios);
          if (u.diagnosticos?.length) setDiagnosticos(u.diagnosticos);
          if (u.evaluacionRealizada !== undefined) setEvaluacionRealizada(u.evaluacionRealizada);
          if (u.observacionesRetiro) setObservacionesRetiro(u.observacionesRetiro);
          if (u.recomendaciones?.length) setRecomendaciones(u.recomendaciones);
          if (u.recomendacionesOtras) setRecomendacionesOtras(u.recomendacionesOtras);
        }
      } else {
        // Modo nuevo: pre-cargar antecedentes de la última evaluación
        const q = query(collection(db, 'evaluaciones'), where('trabajadorId', '==', trabajadorId), orderBy('fecha', 'desc'), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const u = snap.docs[0].data();
          if (u.antecedentesClinicosQ !== undefined) setAntecedentesClinicosQ(u.antecedentesClinicosQ);
          if (u.antecedentesClinicosLista) setAntecedentesClinicosLista(u.antecedentesClinicosLista);
          if (u.antecedentesQuirurgicosQ !== undefined) setAntecedentesQuirurgicosQ(u.antecedentesQuirurgicosQ);
          if (u.antecedentesQuirurgicosLista) setAntecedentesQuirurgicosLista(u.antecedentesQuirurgicosLista);
          if (u.alergiasTiene !== undefined) setAlergiasTiene(u.alergiasTiene);
          if (u.alergias) setAlergias(u.alergias);
          if (u.accidentesTrabajo?.descripcion) { setTieneAccidente(true); setAccidenteTrabajo(u.accidentesTrabajo); }
          if (u.enfermedadesProfesionales?.descripcion) { setTieneEnfermedad(true); setEnfermedadProfesional(u.enfermedadesProfesionales); }
          if (u.signosVitales?.talla) setSignosVitales(prev => ({ ...prev, talla: u.signosVitales.talla }));
          if (u.factoresRiesgo?.actividades) setActividadesTexto(u.factoresRiesgo.actividades);
        }
      }
    })();
  }, [trabajadorId, user, editEvalId]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleExamenFisico = useCallback((key: string, numero: number, codigo: string, region: string, subregion: string) => {
    setExamenFisicoSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setExamenFisicoHallazgos(h => h.filter(x => x.codigo !== `${numero}${codigo}`));
      } else {
        next.add(key);
        setExamenFisicoHallazgos(h => [...h, { codigo: `${numero}${codigo}`, region, subregion, descripcion: '' }]);
      }
      return next;
    });
  }, []);

  const updateHallazgo = (codigo: string, descripcion: string) =>
    setExamenFisicoHallazgos(prev => prev.map(h => h.codigo === codigo ? { ...h, descripcion } : h));

  const handleSignosChange = useCallback((sv: SignosVitales) => setSignosVitales(sv), []);

  const updateClinico = (idx: number, field: keyof AntecedenteClinico, val: any) =>
    setAntecedentesClinicosLista(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: val }; return u; });
  const updateQuirurgico = (idx: number, field: keyof AntecedenteQuirurgico, val: any) =>
    setAntecedentesQuirurgicosLista(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: val }; return u; });
  const updateAlerg = (idx: number, field: keyof Alergia, val: any) =>
    setAlergias(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: val }; return u; });

  // ── Guardar ───────────────────────────────────────────────────────────────

  const guardar = async () => {
    if (!trabajadorId || !trabajador || !user) return;
    const sv = signosVitales;
    if (!sv.presionSistolica || !sv.presionDiastolica || !sv.frecuenciaCardiaca || !sv.peso || !sv.talla) {
      toast.warning('PA, FC, Peso y Talla son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        tipo: 'RETIRO',
        trabajadorId,
        medicoId: user.uid,
        medicoNombre: nombreProfesionalDe(medicoData) || user.email || '',
        medicoCedula: codigoProfesionalDe(medicoData),
        fecha: new Date(),
        numeroHistoriaClinica: numeroHistoriaClinica || trabajador.cedula,
        numeroArchivo,
        fechaSalida,
        tiempoMeses,
        actividadesTexto,
        factoresRiesgoTexto,
        antecedentesClinicosQ,
        antecedentesClinicosLista: antecedentesClinicosQ ? antecedentesClinicosLista : [],
        antecedentesQuirurgicosQ,
        antecedentesQuirurgicosLista: antecedentesQuirurgicosQ ? antecedentesQuirurgicosLista : [],
        alergiasTiene,
        alergias: alergiasTiene ? alergias : [],
        tieneAccidente,
        accidentesTrabajo: tieneAccidente ? accidenteTrabajo : emptyAccidente(),
        tieneEnfermedad,
        enfermedadesProfesionales: tieneEnfermedad ? enfermedadProfesional : emptyEnfermedad(),
        signosVitales: sv,
        examenFisicoHallazgos,
        examenesComplementarios: examenesComplementarios.filter(e => e.nombre.trim()),
        diagnosticos: diagnosticos.filter(d => d.descripcion.trim()),
        evaluacionRealizada,
        observacionesRetiro,
        recomendaciones,
        recomendacionesOtras,
        createdAt: new Date(),
        createdBy: user.uid,
      };
      let idParaCertificado = editEvalId;
      if (editEvalId) {
        await updateDoc(doc(db, 'evaluaciones', editEvalId), { ...payload, updatedAt: new Date(), updatedBy: user.uid });
        await registrarAuditoria('editar', 'evaluacion', editEvalId, `Editó la evaluación de retiro de ${trabajador?.primerApellido ?? ''} ${trabajador?.primerNombre ?? ''}`.trim());
      } else {
        const ref = await addDoc(collection(db, 'evaluaciones'), payload);
        await updateDoc(doc(db, 'trabajadores', trabajadorId), {
          evaluaciones: arrayUnion(ref.id),
          ultimaEvaluacion: new Date(),
          updatedAt: new Date(),
          updatedBy: user.uid,
        });
        await registrarAuditoria('crear', 'evaluacion', ref.id, `Evaluación de retiro de ${trabajador?.primerApellido ?? ''} ${trabajador?.primerNombre ?? ''}`.trim());
        idParaCertificado = ref.id;
      }
      toast.success(editEvalId ? 'Evaluación actualizada correctamente.' : 'Evaluación de retiro guardada correctamente.');
      // Al terminar, en la ficha se ofrece llenar el Certificado de Aptitud
      // (SO-RE-20) autocompletado con los datos de esta evaluación.
      navigate(idParaCertificado ? `/trabajador/${trabajadorId}?certificado=${idParaCertificado}` : `/trabajador/${trabajadorId}`);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo guardar. Intenta nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  // ── PDF SO-RE-40 ──────────────────────────────────────────────────────────

  const generarPDF = () => {
    if (!trabajador) return;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = pdf.internal.pageSize.getWidth();
    const M = 7;
    const CW = W - M * 2;
    let y = 7;

    const colorPrimario = '#ccccff';
    const colorSecundario = '#ccffcc';
    const colorTerciario = '#ccffff';
    const negro: [number, number, number] = [0, 0, 0];

    const base = { lineColor: negro, lineWidth: 0.25, fontSize: 6.5, cellPadding: 1.2, textColor: negro };
    const head = { fillColor: colorSecundario, textColor: negro, fontStyle: 'bold' as const, fontSize: 6.5, lineColor: negro, lineWidth: 0.25, cellPadding: 1.2 };

    const AT = (opts: any) => { autoTable(pdf, opts); y = (pdf as any).lastAutoTable.finalY; };

    const secHeader = (texto: string, bgColor = colorPrimario) => {
      pdf.addImage(logoPdf.data, logoPdf.format, 8, 8, 40, 15);
      pdf.setFillColor(bgColor); pdf.setDrawColor(0);
      pdf.rect(M, y, CW, 5, 'FD');
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
      pdf.text(texto, M + 1.5, y + 3.5);
      y += 5;
    };

    const textoLibre = (texto: string, minH = 6) => {
      pdf.setDrawColor(0); pdf.setFontSize(7); pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(texto || '-', CW - 3);
      const h = Math.max(minH, lines.length * 3 + 2);
      pdf.rect(M, y, CW, h, 'S');
      pdf.text(lines, M + 1.5, y + 3);
      y += h;
    };

    const fmtF = (d: any): string => {
      if (!d) return '-';
      if (d instanceof Date) return d.toLocaleDateString('es-EC');
      if (d.seconds) return new Date(d.seconds * 1000).toLocaleDateString('es-EC');
      return String(d);
    };
    const fmtHora = (d: any): string => {
      const dt = d instanceof Date ? d : d?.seconds ? new Date(d.seconds * 1000) : null;
      return dt ? dt.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '-';
    };

    // Bloque de encabezado reutilizable (páginas 1 y 2)
    const paginaHeader = (pagina: string) => {
      const tableStartY = y;
      AT({
        startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { ...base, halign: 'center', fontSize: 8 },
        columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 33 } },
        body: [
          [{ content: '', rowSpan: 3, styles: { fontSize: 11, valign: 'middle' } },
           { content: 'HISTORIA CLÍNICA:\nEVALUACIÓN MÉDICA DE RETIRO', rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, valign: 'middle' } },
           { content: 'Código:   SO-RE-40', styles: { fontSize: 7, halign: 'left' } }],
          [{ content: 'Revisión:  1', styles: { fontSize: 7, halign: 'left' } }],
          [{ content: 'MACROPROCESO:  PLANIFICACIÓN, SEGURIDAD Y AMBIENTE', styles: { fontSize: 6, fontStyle: 'bold' } },
           { content: pagina, styles: { fontSize: 7, halign: 'left' } }],
        ],
      });
      // Logo dentro de la primera celda del encabezado
      pdf.addImage(logoPdf.data, logoPdf.format, M + 1, tableStartY + 1, 40, 12);
      y += 2;
    };

    // Función para caja SI/NO como en el formulario original
    const siNoCalificado = (calificado: boolean | null, especificacion: string, fechaDia: string, fechaMes: string, fechaAnio: string, observaciones: string) => {
      AT({
        startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { ...base, fontSize: 6 }, headStyles: head,
        body: [[
          { content: 'FUE CALIFICADO POR EL INSTITUTO DE SEGURIDAD SOCIAL CORRESPONDIENTE:', styles: { fontStyle: 'bold', cellWidth: 75 } },
          { content: 'SI', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 7 } },
          { content: calificado === true ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 7 } },
          { content: 'ESPECIFICAR:', styles: { fontStyle: 'bold', cellWidth: 22 } },
          { content: especificacion || '', styles: { cellWidth: 30 } },
          { content: 'NO', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 7 } },
          { content: calificado === false ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 7 } },
          { content: 'FECHA:', styles: { fontStyle: 'bold', cellWidth: 12 } },
          { content: fechaDia ? `${fechaDia}/${fechaMes}/${fechaAnio}` : '-', styles: {} },
        ]],
      });
      AT({
        startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { ...base, fontSize: 6 },
        body: [[
          { content: 'Observaciones:', styles: { fontStyle: 'bold', cellWidth: 25 } },
          { content: observaciones || 'Ninguno' },
        ]],
      });
      // 2 líneas en blanco para firma/espacio
      pdf.setDrawColor(0); pdf.rect(M, y, CW, 6, 'S'); y += 6;
    };

    const now = new Date();

    // ════════════════════════════════════════════════════════════
    // PÁGINA 1: A · B · C · D
    // ════════════════════════════════════════════════════════════
    paginaHeader('Página:    1 de 2');

    // A. Datos
    secHeader('A. DATOS DEL ESTABLECIMIENTO - EMPRESA Y USUARIO');
    AT({
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head,
      head: [['INSTITUCIÓN DEL SISTEMA O NOMBRE DE LA EMPRESA', 'RUC', 'CIIU', 'ESTABLECIMIENTO DE SALUD', 'N° HISTORIA CLÍNICA', 'N° ARCHIVO']],
      body: [[DATOS_EMPRESA.institucion, DATOS_EMPRESA.ruc, DATOS_EMPRESA.ciu, DATOS_EMPRESA.establecimiento, numeroHistoriaClinica || trabajador.cedula, numeroArchivo || '-']],
    });
    AT({
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head,
      head: [['PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'SEXO', 'FECHA DE INICIO DE LABORES', 'FECHA DE SALIDA', 'TIEMPO\n(meses)', 'PUESTO DE TRABAJO (CIUO)']],
      body: [[trabajador.primerApellido, trabajador.segundoApellido || '-', trabajador.primerNombre, trabajador.segundoNombre || '-', trabajador.sexo, (trabajador as any).fechaIngreso || '-', fechaSalida || '-', tiempoMeses || '-', trabajador.puestoTrabajo]],
    });
    AT({
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head,
      head: [['ACTIVIDADES', 'FACTORES DE RIESGO']],
      body: [[actividadesTexto || '-', factoresRiesgoTexto || '-']],
      bodyStyles: { minCellHeight: 10 },
    });
    y += 2;

    // B. Antecedentes personales
    secHeader('B. ANTECEDENTES PERSONALES');
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(204, 255, 204); pdf.setDrawColor(0);
    pdf.rect(M, y, CW, 4, 'FD');
    pdf.text('ANTECEDENTES CLÍNICOS Y QUIRÚRGICOS', M + 1.5, y + 3);
    y += 4;

    // Texto de antecedentes
    if (antecedentesClinicosQ === true && antecedentesClinicosLista.length > 0) {
      const lClin = antecedentesClinicosLista.map(ac => {
        let l = `Antecedentes Clínicos: ${ac.enfermedad || '?'}`;
        if (ac.desdeCuando) l += ` (desde ${ac.desdeCuando})`;
        if (ac.tomaMedicacion && ac.medicacionNombre) l += ` — Medicación: ${ac.medicacionNombre}${ac.medicacionDosis ? ' ' + ac.medicacionDosis : ''}`;
        if (ac.complicaciones) l += ` — Comp: ${ac.complicaciones}`;
        return l;
      }).join('\n');
      const lQ = antecedentesQuirurgicosQ && antecedentesQuirurgicosLista.length > 0
        ? '\nAntecedentes quirúrgicos: ' + antecedentesQuirurgicosLista.map(aq => `${aq.procedimiento || '?'} (${aq.fechaAproximada || '?'})${aq.secuelas ? ', secuelas: ' + aq.secuelas : ''}`).join('; ')
        : '\nAntecedentes quirúrgicos: Ninguno';
      const lAl = alergiasTiene === true && alergias.length > 0
        ? '\nAlergias: ' + alergias.map(al => `${al.alergeno || '?'} — ${al.intensidadReaccion || '?'}`).join('; ')
        : '\nAlergias: Ninguna';
      textoLibre(lClin + lQ + lAl, 8);
    } else if (antecedentesClinicosQ === false) {
      const lQ = antecedentesQuirurgicosQ && antecedentesQuirurgicosLista.length > 0
        ? 'Antecedentes quirúrgicos: ' + antecedentesQuirurgicosLista.map(aq => `${aq.procedimiento || '?'} (${aq.fechaAproximada || '?'})`).join('; ')
        : 'Antecedentes quirúrgicos: Ninguno';
      const lAl = alergiasTiene === true && alergias.length > 0
        ? '\nAlergias: ' + alergias.map(al => `${al.alergeno || '?'} — ${al.intensidadReaccion || '?'}`).join('; ')
        : '\nAlergias: Ninguna';
      textoLibre('Sin antecedentes clínicos.\n' + lQ + lAl, 8);
    } else {
      textoLibre('Sin antecedentes personales relevantes reportados.', 8);
    }
    y += 1;

    // Accidentes de trabajo
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(204, 255, 204); pdf.setDrawColor(0);
    pdf.rect(M, y, CW, 4, 'FD');
    pdf.text('ACCIDENTES DE TRABAJO', M + 1.5, y + 3);
    y += 4;
    // SI/NO — ¿tuvo accidente?
    AT({
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { ...base, fontSize: 6.5 },
      body: [[
        { content: '¿TUVO ACCIDENTE DE TRABAJO?', styles: { fontStyle: 'bold', cellWidth: 90 } },
        { content: 'SI', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 12 } },
        { content: tieneAccidente === true ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 12 } },
        { content: 'NO', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 12 } },
        { content: tieneAccidente !== true ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold' } },
      ]],
    });
    if (tieneAccidente === true) {
      textoLibre(accidenteTrabajo.descripcion || '-', 8);
      siNoCalificado(
        accidenteTrabajo.calificado,
        accidenteTrabajo.especificacion,
        accidenteTrabajo.fechaDia,
        accidenteTrabajo.fechaMes,
        accidenteTrabajo.fechaAnio,
        accidenteTrabajo.observaciones || 'Ninguno',
      );
    } else {
      textoLibre('NINGUNO', 5);
      AT({
        startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { ...base, fontSize: 6 },
        body: [[{ content: 'Observaciones:', styles: { fontStyle: 'bold', cellWidth: 25 } }, { content: 'Ninguno' }]],
      });
      pdf.setDrawColor(0); pdf.rect(M, y, CW, 6, 'S'); y += 6;
    }
    y += 1;

    // Enfermedades profesionales
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(204, 255, 204); pdf.setDrawColor(0);
    pdf.rect(M, y, CW, 4, 'FD');
    pdf.text('ENFERMEDADES PROFESIONALES', M + 1.5, y + 3);
    y += 4;
    // SI/NO — ¿tuvo enfermedad profesional?
    AT({
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { ...base, fontSize: 6.5 },
      body: [[
        { content: '¿TUVO ENFERMEDAD PROFESIONAL?', styles: { fontStyle: 'bold', cellWidth: 90 } },
        { content: 'SI', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 12 } },
        { content: tieneEnfermedad === true ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 12 } },
        { content: 'NO', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 12 } },
        { content: tieneEnfermedad !== true ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold' } },
      ]],
    });
    if (tieneEnfermedad === true) {
      textoLibre(enfermedadProfesional.descripcion || '-', 8);
      siNoCalificado(
        enfermedadProfesional.calificada,
        enfermedadProfesional.especificacion,
        enfermedadProfesional.fechaDia,
        enfermedadProfesional.fechaMes,
        enfermedadProfesional.fechaAnio,
        enfermedadProfesional.observaciones || 'Ninguno',
      );
    } else {
      textoLibre('NINGUNA', 5);
      AT({
        startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { ...base, fontSize: 6 },
        body: [[{ content: 'Observaciones:', styles: { fontStyle: 'bold', cellWidth: 25 } }, { content: 'Ninguno' }]],
      });
      pdf.setDrawColor(0); pdf.rect(M, y, CW, 6, 'S'); y += 6;
    }
    y += 2;

    // C. Constantes vitales
    secHeader('C. CONSTANTES VITALES Y ANTROPOMETRÍA');
    const sv = signosVitales;
    AT({
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head,
      head: [['PRESIÓN ARTERIAL\n(mmHg)', 'TEMPERATURA\n(°C)', 'FRECUENCIA CARDIACA\n(l/min)', 'SATURACIÓN DE\nOXÍGENO (%)', 'FRECUENCIA\nRESPIRATORIA (fr/min)', 'PESO\n(Kg)', 'TALLA\n(cm)', 'ÍNDICE DE MASA\nCORPORAL (kg/m²)', 'PERÍMETRO\nABDOMINAL (cm)']],
      body: [[`${sv.presionSistolica || '-'}/${sv.presionDiastolica || '-'}`, sv.temperatura || '-', sv.frecuenciaCardiaca || '-', sv.saturacion || '-', sv.frecuenciaRespiratoria || '-', sv.peso || '-', sv.talla || '-', sv.imc ? sv.imc.toFixed(1) : '-', sv.perimetroAbdominal || '-']],
      columnStyles: { 0: { halign: 'center' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' }, 7: { halign: 'center' }, 8: { halign: 'center' } },
    });
    y += 2;

    // D. Examen físico regional
    secHeader('D. EXAMEN FÍSICO REGIONAL');
    const hasFisico = (code: string) => examenFisicoHallazgos.some(h => h.codigo === code);
    const pdfFisicoRows = FISICO_ROWS.map(row => row.map(cell => {
      if (cell.type === 'reg') return { content: '', textToRotate: cell.txt, rowSpan: cell.rs, styles: { fillColor: colorTerciario, halign: 'center', valign: 'middle' } };
      if (cell.type === 'sub') return { content: cell.txt, styles: { fillColor: '#ffffff' } };
      if (cell.type === 'chk') return { content: hasFisico(cell.code as string) ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', fillColor: '#ffffff' } };
      if (cell.type === 'empty') return { content: '', rowSpan: cell.rs || 1, colSpan: cell.cs || 1, styles: { fillColor: '#ffffff', lineWidth: 0 } };
      if (cell.type === 'instr') return { content: cell.txt, colSpan: cell.cs, styles: { fillColor: '#f8f8f8', textColor: negro, halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 5.5 } };
      return { content: '' };
    }));
    AT({
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { ...base, fontSize: 5.5, cellPadding: 0.8 },
      bodyStyles: { minCellHeight: 6.5 },
      headStyles: { fillColor: colorTerciario, textColor: negro, fontSize: 6 },
      columnStyles: {
        0: { cellWidth: 9 }, 1: { cellWidth: 23 }, 2: { cellWidth: 4, halign: 'center' },
        3: { cellWidth: 9 }, 4: { cellWidth: 23 }, 5: { cellWidth: 4, halign: 'center' },
        6: { cellWidth: 9 }, 7: { cellWidth: 23 }, 8: { cellWidth: 4, halign: 'center' },
        9: { cellWidth: 9 }, 10: { cellWidth: 23 }, 11: { cellWidth: 4, halign: 'center' },
        12: { cellWidth: 9 }, 13: { cellWidth: 23 }, 14: { cellWidth: 4, halign: 'center' },
      },
      head: [[{ content: 'REGIONES', colSpan: 15, styles: { halign: 'left', fillColor: colorTerciario } }]],
      body: pdfFisicoRows as any,
      didDrawCell: (data: any) => {
        const raw = data.cell.raw as any;
        if (data.section === 'body' && raw?.textToRotate) {
          pdf.setTextColor(0); pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold');
          const str = String(raw.textToRotate);
          const realHeight = 6.5 * (raw.rowSpan || 1);
          const textWidth = pdf.getTextWidth(str);
          const cx = data.cell.x + data.cell.width / 2;
          const cy = data.cell.y + realHeight / 2;
          if (textWidth > realHeight - 2) {
            const lineas = pdf.splitTextToSize(str, realHeight - 2);
            pdf.text(lineas[0], cx + 1.5, cy + pdf.getTextWidth(lineas[0]) / 2, { angle: 90 });
            if (lineas[1]) pdf.text(lineas[1], cx - 0.5, cy + pdf.getTextWidth(lineas[1]) / 2, { angle: 90 });
          } else {
            pdf.text(str, cx + 0.8, cy + textWidth / 2, { angle: 90 });
          }
        }
      },
    });

    // Observaciones examen físico
    if (examenFisicoHallazgos.length > 0) {
      textoLibre('Observaciones:\n' + examenFisicoHallazgos.map(h => `${h.codigo}. ${h.region}, ${h.subregion}: ${h.descripcion || '-'}`).join('\n'), 6);
    } else {
      textoLibre('Observaciones: Sin hallazgos patológicos al examen físico regional.', 5);
    }

    // Rellenar espacio restante de página 1 con líneas en blanco
    const pageH1 = pdf.internal.pageSize.getHeight() - 10;
    while (y < pageH1 - 5) {
      pdf.setDrawColor(0);
      pdf.rect(M, y, CW, 6, 'S');
      y += 6;
    }

    // ════════════════════════════════════════════════════════════
    // PÁGINA 2: E · F · G · H · I · J
    // ════════════════════════════════════════════════════════════
    pdf.addPage(); y = 7;
    paginaHeader('Página:    2 de 2');

    // E. Exámenes
    const examsValidos = examenesComplementarios.filter(e => e.nombre.trim());
    secHeader('E. RESULTADOS DE EXÁMENES GENERALES Y ESPECÍFICOS DE ACUERDO AL RIESGO Y PUESTO DE TRABAJO (IMAGEN, LABORATORIO Y OTROS)');
    if (examsValidos.length > 0) {
      AT({
        startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5 }, headStyles: { ...head, fontSize: 6 },
        head: [['EXAMEN', 'FECHA\naaaa / mm / dd', 'RESULTADO']],
        body: examsValidos.map(e => [e.nombre, e.fecha || '-', e.resultado || '-']),
      });
    } else {
      textoLibre('Sin exámenes complementarios registrados.', 8);
    }
    // Observaciones exámenes
    pdf.setDrawColor(0);
    pdf.rect(M, y, CW, 6, 'S');
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.text('Observaciones:', M + 1.5, y + 3.5);
    y += 6 + 1;

    // F. Diagnóstico
    const dxValidos = diagnosticos.filter(d => d.descripcion.trim());
    secHeader('F. DIAGNÓSTICO                    PRE= PRESUNTIVO          DEF= DEFINITIVO');
    if (dxValidos.length > 0) {
      AT({
        startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5, halign: 'center' }, headStyles: { ...head, fontSize: 6, halign: 'center' },
        head: [['N°', 'DESCRIPCIÓN', 'CIE', 'PRE', 'DEF']],
        body: dxValidos.map((dx, i) => [`${i + 1}`, { content: dx.descripcion, styles: { halign: 'left' } }, dx.cie || '-', dx.tipo === 'presuntivo' ? 'X' : '', dx.tipo === 'definitivo' ? 'X' : '']),
        columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 10 }, 4: { cellWidth: 10 } },
      });
    } else {
      // 3 filas vacías para diagnósticos
      AT({
        startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5, halign: 'center' }, headStyles: { ...head, fontSize: 6, halign: 'center' },
        head: [['N°', 'DESCRIPCIÓN', 'CIE', 'PRE', 'DEF']],
        body: [[1, 'Descripción', '-', '', 'X'], [2, '', '', '', ''], [3, '', '', '', '']],
        columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 10 }, 4: { cellWidth: 10 } },
        bodyStyles: { minCellHeight: 7 },
      });
    }
    y += 1;

    // G. Evaluación médica de retiro
    secHeader('G. EVALUACIÓN MÉDICA DE RETIRO');
    AT({
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5 }, headStyles: head,
      body: [[
        { content: 'SE REALIZÓ LA EVALUACIÓN', styles: { fontStyle: 'bold', cellWidth: 90 } },
        { content: 'SI', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 12 } },
        { content: evaluacionRealizada ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 12 } },
        { content: 'NO', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 12 } },
        { content: !evaluacionRealizada ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold' } },
      ]],
    });
    // Observaciones retiro con 2 líneas de espacio
    pdf.setDrawColor(0);
    pdf.rect(M, y, CW, 5, 'S');
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.text('Observaciones:', M + 1.5, y + 3.5);
    y += 5;
    const obsLines = pdf.splitTextToSize(observacionesRetiro || '-', CW - 3);
    const obsH = Math.max(8, obsLines.length * 3 + 2);
    pdf.setFont('helvetica', 'normal');
    pdf.rect(M, y, CW, obsH, 'S');
    pdf.text(obsLines, M + 1.5, y + 3);
    y += obsH + 2;

    // H. Recomendaciones
    secHeader('H. RECOMENDACIONES Y/O TRATAMIENTO');
    const recTexto = recomendaciones.join('; ') + (recomendacionesOtras ? `; ${recomendacionesOtras}` : '') || 'Ninguna particular al momento.';
    textoLibre(recTexto, 10);
    y += 2;

    // Certificado legal
    pdf.setFillColor(248, 248, 248); pdf.setDrawColor(0);
    const certText = 'CERTIFICO QUE LO ANTERIORMENTE EXPRESADO EN RELACIÓN A MI ESTADO DE SALUD ES VERDAD. SE ME HA INFORMADO MI ESTADO ACTUAL DE SALUD Y LAS RECOMENDACIONES PERTINENTES.';
    const certLines = pdf.splitTextToSize(certText, CW - 3);
    const certH = certLines.length * 3 + 3;
    pdf.rect(M, y, CW, certH, 'FD');
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.text(certLines, M + 1.5, y + 3);
    y += certH + 3;

    // I. Datos del profesional / J. Firma del usuario
    secHeader('I. DATOS DEL PROFESIONAL                                                                             J. FIRMA DEL USUARIO');
    AT({
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5, halign: 'center' }, headStyles: { ...head, fontSize: 6, halign: 'center' },
      head: [['FECHA\naaaa-mm-dd', 'HORA', 'NOMBRES Y APELLIDOS', 'CÓDIGO', 'FIRMA Y SELLO', 'FIRMA DEL USUARIO']],
      body: [[fmtF(now), fmtHora(now), (nombreProfesionalDe(medicoData) || 'MÉDICO OCUPACIONAL').toUpperCase(), codigoProfesionalDe(medicoData) || '-', '', '']],
      bodyStyles: { minCellHeight: 20, valign: 'bottom', halign: 'center' },
    });

    pdf.save(`SO-RE-40_RETIRO_${trabajador.primerApellido}_${trabajador.primerNombre}_${fmtF(now)}.pdf`);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!trabajador) return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Cargando...</div>;

  const inp = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400';
  const card = 'bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6';

  // Helper de radio SI/NO reutilizable
  const SiNo = ({ label, value, onChange, nullLabel = 'Sin responder' }: { label: string; value: boolean | null; onChange: (v: boolean) => void; nullLabel?: string }) => (
    <div className="mb-3">
      <p className="text-xs font-bold text-slate-700 mb-2 bg-green-50 px-2 py-1 rounded">{label}</p>
      <div className="flex gap-3">
        {[{ v: true, l: 'SÍ' }, { v: false, l: 'NO' }].map(({ v, l }) => (
          <label key={String(v)} className={`flex items-center gap-2 text-xs font-bold cursor-pointer px-4 py-2 rounded-lg border-2 transition-colors ${value === v ? (v ? 'bg-red-50 border-red-400 text-red-800' : 'bg-slate-100 border-slate-400 text-slate-700') : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
            <input type="radio" checked={value === v} onChange={() => onChange(v)} className="hidden" />
            {l}
          </label>
        ))}
        {value === null && <span className="text-xs text-slate-400 self-center">{nullLabel}</span>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 py-6 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Cabecera */}
        <div className={card + ' flex flex-col md:flex-row justify-between items-start md:items-center gap-4'}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">SO-RE-40</span>
              <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">EVALUACIÓN DE RETIRO</span>
            </div>
            <h1 className="text-lg md:text-2xl font-bold text-slate-800">
              {trabajador.primerApellido} {trabajador.segundoApellido || ''} {trabajador.primerNombre} {trabajador.segundoNombre || ''}
            </h1>
            <p className="text-slate-500 text-sm">CI: {trabajador.cedula} · {trabajador.puestoTrabajo}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => navigate(`/trabajador/${trabajadorId}`)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 text-sm">Cancelar</button>
            <button onClick={generarPDF} className="px-4 py-2 bg-orange-100 text-orange-800 font-semibold rounded-lg hover:bg-orange-200 text-sm">🖨 Vista previa PDF</button>
            <button onClick={guardar} disabled={guardando} className="px-4 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm shadow-sm">
              {guardando ? 'Guardando...' : editEvalId ? 'Guardar Cambios' : 'Guardar Evaluación de Retiro'}
            </button>
          </div>
        </div>

        {/* ── A. Datos ── */}
        <div className={card}>
          <h2 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">A. DATOS DEL ESTABLECIMIENTO - EMPRESA Y USUARIO</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">N° HISTORIA CLÍNICA</label>
              <input type="text" value={numeroHistoriaClinica} onChange={e => setNumeroHistoriaClinica(e.target.value)} placeholder={trabajador.cedula} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">N° ARCHIVO</label>
              <input type="text" value={numeroArchivo} onChange={e => setNumeroArchivo(e.target.value)} placeholder="Opcional" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">FECHA DE SALIDA <span className="text-red-500">*</span></label>
              <input type="date" value={fechaSalida} onChange={e => setFechaSalida(e.target.value)} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">FECHA INICIO LABORES</label>
              <input type="text" value={(trabajador as any).fechaIngreso || 'No registrada'} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">TIEMPO EN PUESTO (MESES)</label>
              <input type="number" value={tiempoMeses} onChange={e => setTiempoMeses(e.target.value)} placeholder="Ej: 36" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PUESTO DE TRABAJO</label>
              <input type="text" value={trabajador.puestoTrabajo} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ACTIVIDADES REALIZADAS</label>
              <textarea value={actividadesTexto} onChange={e => setActividadesTexto(e.target.value)} rows={2} placeholder="Descripción de las actividades realizadas en el puesto..." className={inp} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">FACTORES DE RIESGO</label>
              <textarea value={factoresRiesgoTexto} onChange={e => setFactoresRiesgoTexto(e.target.value)} rows={2} placeholder="Factores de riesgo a los que estuvo expuesto..." className={inp} />
            </div>
          </div>
        </div>

        {/* ── B. Antecedentes ── */}
        <div className={card}>
          <h2 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">B. ANTECEDENTES PERSONALES</h2>

          {/* Clínicos */}
          <SiNo label="ANTECEDENTES CLÍNICOS" value={antecedentesClinicosQ} onChange={setAntecedentesClinicosQ} />
          {antecedentesClinicosQ === true && antecedentesClinicosLista.map((ac, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 mb-2 bg-blue-50/30 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <input placeholder="Enfermedad" value={ac.enfermedad} onChange={e => updateClinico(i, 'enfermedad', e.target.value)} className="px-2 py-1 border rounded text-xs col-span-2 md:col-span-1" />
                <input placeholder="Desde cuándo" value={ac.desdeCuando} onChange={e => updateClinico(i, 'desdeCuando', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                <input placeholder="Complicaciones" value={ac.complicaciones} onChange={e => updateClinico(i, 'complicaciones', e.target.value)} className="px-2 py-1 border rounded text-xs" />
              </div>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={ac.tomaMedicacion} onChange={e => updateClinico(i, 'tomaMedicacion', e.target.checked)} /> Toma medicación</label>
              {ac.tomaMedicacion && (
                <div className="grid grid-cols-3 gap-2">
                  <input placeholder="Medicamento" value={ac.medicacionNombre} onChange={e => updateClinico(i, 'medicacionNombre', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <input placeholder="Dosis" value={ac.medicacionDosis} onChange={e => updateClinico(i, 'medicacionDosis', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <input placeholder="Frecuencia" value={ac.medicacionFrecuencia} onChange={e => updateClinico(i, 'medicacionFrecuencia', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                </div>
              )}
              {antecedentesClinicosLista.length > 1 && <button type="button" onClick={() => setAntecedentesClinicosLista(p => p.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:underline">Eliminar</button>}
            </div>
          ))}
          {antecedentesClinicosQ === true && <button type="button" onClick={() => setAntecedentesClinicosLista(p => [...p, emptyClinico()])} className="text-xs text-blue-600 hover:underline mb-4">+ Agregar antecedente clínico</button>}

          {/* Quirúrgicos */}
          <SiNo label="ANTECEDENTES QUIRÚRGICOS" value={antecedentesQuirurgicosQ} onChange={setAntecedentesQuirurgicosQ} />
          {antecedentesQuirurgicosQ === true && antecedentesQuirurgicosLista.map((aq, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 mb-2 bg-purple-50/30 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Procedimiento" value={aq.procedimiento} onChange={e => updateQuirurgico(i, 'procedimiento', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                <input placeholder="Fecha aproximada" value={aq.fechaAproximada} onChange={e => updateQuirurgico(i, 'fechaAproximada', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                <input placeholder="Complicaciones" value={aq.complicaciones} onChange={e => updateQuirurgico(i, 'complicaciones', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                <input placeholder="Secuelas" value={aq.secuelas} onChange={e => updateQuirurgico(i, 'secuelas', e.target.value)} className="px-2 py-1 border rounded text-xs" />
              </div>
              {antecedentesQuirurgicosLista.length > 1 && <button type="button" onClick={() => setAntecedentesQuirurgicosLista(p => p.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:underline">Eliminar</button>}
            </div>
          ))}
          {antecedentesQuirurgicosQ === true && <button type="button" onClick={() => setAntecedentesQuirurgicosLista(p => [...p, emptyQuirurgico()])} className="text-xs text-blue-600 hover:underline mb-4">+ Agregar cirugía</button>}

          {/* Alergias */}
          <SiNo label="ALERGIAS" value={alergiasTiene} onChange={setAlergiasTiene} />
          {alergiasTiene === true && alergias.map((al, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 mb-2 bg-red-50/30 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Alergeno" value={al.alergeno} onChange={e => updateAlerg(i, 'alergeno', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                <input placeholder="Intensidad de reacción" value={al.intensidadReaccion} onChange={e => updateAlerg(i, 'intensidadReaccion', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                <input placeholder="Síntomas" value={al.sintomas} onChange={e => updateAlerg(i, 'sintomas', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                <input placeholder="Tratamiento habitual" value={al.tratamientoHabitual} onChange={e => updateAlerg(i, 'tratamientoHabitual', e.target.value)} className="px-2 py-1 border rounded text-xs" />
              </div>
              {alergias.length > 1 && <button type="button" onClick={() => setAlergias(p => p.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:underline">Eliminar</button>}
            </div>
          ))}
          {alergiasTiene === true && <button type="button" onClick={() => setAlergias(p => [...p, emptyAlergia()])} className="text-xs text-blue-600 hover:underline mb-4">+ Agregar alergia</button>}

          {/* Accidentes de trabajo */}
          <SiNo label="ACCIDENTES DE TRABAJO" value={tieneAccidente} onChange={setTieneAccidente} nullLabel="No se ha registrado respuesta" />
          {tieneAccidente === true && (
            <div className="border border-orange-200 rounded-lg p-3 mb-3 bg-orange-50/30 space-y-2">
              <textarea value={accidenteTrabajo.descripcion} onChange={e => setAccidenteTrabajo(p => ({ ...p, descripcion: e.target.value }))} rows={2} placeholder="Descripción del accidente de trabajo..." className="w-full px-2 py-1 border rounded text-xs" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={accidenteTrabajo.calificado} onChange={e => setAccidenteTrabajo(p => ({ ...p, calificado: e.target.checked }))} /> Calificado por IESS</label>
                <input placeholder="Especificar calificación" value={accidenteTrabajo.especificacion} onChange={e => setAccidenteTrabajo(p => ({ ...p, especificacion: e.target.value }))} className="px-2 py-1 border rounded text-xs" />
                <input type="date" value={accidenteTrabajo.fechaAnio ? `${accidenteTrabajo.fechaAnio}-${accidenteTrabajo.fechaMes}-${accidenteTrabajo.fechaDia}` : ''} onChange={e => { const [a, m, d] = e.target.value.split('-'); setAccidenteTrabajo(p => ({ ...p, fechaAnio: a, fechaMes: m, fechaDia: d })); }} className="px-2 py-1 border rounded text-xs" />
              </div>
              <textarea value={accidenteTrabajo.observaciones} onChange={e => setAccidenteTrabajo(p => ({ ...p, observaciones: e.target.value }))} rows={1} placeholder="Observaciones..." className="w-full px-2 py-1 border rounded text-xs" />
            </div>
          )}

          {/* Enfermedades profesionales */}
          <SiNo label="ENFERMEDADES PROFESIONALES" value={tieneEnfermedad} onChange={setTieneEnfermedad} nullLabel="No se ha registrado respuesta" />
          {tieneEnfermedad === true && (
            <div className="border border-yellow-200 rounded-lg p-3 mb-3 bg-yellow-50/30 space-y-2">
              <textarea value={enfermedadProfesional.descripcion} onChange={e => setEnfermedadProfesional(p => ({ ...p, descripcion: e.target.value }))} rows={2} placeholder="Descripción de la enfermedad profesional..." className="w-full px-2 py-1 border rounded text-xs" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={enfermedadProfesional.calificada} onChange={e => setEnfermedadProfesional(p => ({ ...p, calificada: e.target.checked }))} /> Calificada por IESS</label>
                <input placeholder="Especificar calificación" value={enfermedadProfesional.especificacion} onChange={e => setEnfermedadProfesional(p => ({ ...p, especificacion: e.target.value }))} className="px-2 py-1 border rounded text-xs" />
                <input type="date" value={enfermedadProfesional.fechaAnio ? `${enfermedadProfesional.fechaAnio}-${enfermedadProfesional.fechaMes}-${enfermedadProfesional.fechaDia}` : ''} onChange={e => { const [a, m, d] = e.target.value.split('-'); setEnfermedadProfesional(p => ({ ...p, fechaAnio: a, fechaMes: m, fechaDia: d })); }} className="px-2 py-1 border rounded text-xs" />
              </div>
              <textarea value={enfermedadProfesional.observaciones} onChange={e => setEnfermedadProfesional(p => ({ ...p, observaciones: e.target.value }))} rows={1} placeholder="Observaciones..." className="w-full px-2 py-1 border rounded text-xs" />
            </div>
          )}
        </div>

        {/* ── C. Signos vitales ── */}
        <SignosVitalesForm onDataChange={handleSignosChange} initialData={signosVitales} />
        {(!signosVitales.presionSistolica || !signosVitales.presionDiastolica || !signosVitales.frecuenciaCardiaca || !signosVitales.peso || !signosVitales.talla) && (
          <p className="text-xs text-red-500 px-1">⚠ PA, FC, Peso y Talla son obligatorios</p>
        )}

        {/* ── D. Examen físico regional ── */}
        <SeccionI
          REGIONES={REGIONES_EXAMEN_FISICO}
          seleccionados={examenFisicoSeleccionados}
          hallazgos={examenFisicoHallazgos}
          onToggle={toggleExamenFisico}
          onHallazgo={updateHallazgo}
        />

        {/* ── E. Exámenes complementarios ── */}
        <div className={card}>
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">E. RESULTADOS DE EXÁMENES GENERALES Y ESPECÍFICOS</h2>
          {examenesComplementarios.map((ex, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input type="text" placeholder="Examen" value={ex.nombre} onChange={e => { const u = [...examenesComplementarios]; u[idx] = { ...u[idx], nombre: e.target.value }; setExamenesComplementarios(u); }} className="w-1/3 px-2 py-1 border rounded text-sm" />
              <input type="date" value={ex.fecha} onChange={e => { const u = [...examenesComplementarios]; u[idx] = { ...u[idx], fecha: e.target.value }; setExamenesComplementarios(u); }} className="w-1/4 px-2 py-1 border rounded text-sm" />
              <input type="text" placeholder="Resultado" value={ex.resultado} onChange={e => { const u = [...examenesComplementarios]; u[idx] = { ...u[idx], resultado: e.target.value }; setExamenesComplementarios(u); }} className="flex-1 px-2 py-1 border rounded text-sm" />
              {examenesComplementarios.length > 1 && <button type="button" onClick={() => setExamenesComplementarios(p => p.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 font-bold px-1">✕</button>}
            </div>
          ))}
          <button type="button" onClick={() => setExamenesComplementarios(p => [...p, { nombre: '', fecha: '', resultado: '' }])} className="text-xs text-blue-600 hover:underline mt-1">+ Agregar examen</button>
        </div>

        {/* ── F. Diagnósticos ── */}
        <div className={card}>
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">F. DIAGNÓSTICO <span className="font-normal text-slate-500 text-xs">PRE= Presuntivo · DEF= Definitivo</span></h2>
          {diagnosticos.map((dx, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-center">
              <span className="text-xs text-slate-500 w-5 shrink-0">{idx + 1}.</span>
              <div className="flex-1">
                <BuscadorCIE10
                  valorActual={dx.descripcion ? `${dx.cie} - ${dx.descripcion}` : ''}
                  onSeleccionar={(codigo, descripcion) => { const u = [...diagnosticos]; u[idx] = { ...u[idx], cie: codigo, descripcion }; setDiagnosticos(u); }}
                />
              </div>
              <select value={dx.tipo} onChange={e => { const u = [...diagnosticos]; u[idx] = { ...u[idx], tipo: e.target.value as 'presuntivo' | 'definitivo' }; setDiagnosticos(u); }} className="px-2 py-1 border rounded text-xs bg-white">
                <option value="definitivo">DEF</option>
                <option value="presuntivo">PRE</option>
              </select>
              {diagnosticos.length > 1 && <button type="button" onClick={() => setDiagnosticos(p => p.filter((_, i) => i !== idx))} className="text-red-500 font-bold px-1">✕</button>}
            </div>
          ))}
          <button type="button" onClick={() => setDiagnosticos(p => [...p, { descripcion: '', cie: '', tipo: 'definitivo' }])} className="text-xs text-blue-600 hover:underline mt-1">+ Agregar diagnóstico</button>
        </div>

        {/* ── G. Evaluación médica de retiro ── */}
        <div className={card}>
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">G. EVALUACIÓN MÉDICA DE RETIRO</h2>
          <p className="text-xs text-slate-500 mb-3">¿Se realizó la evaluación médica de retiro?</p>
          <div className="flex gap-4 mb-4">
            {[{ v: true, label: 'SÍ se realizó' }, { v: false, label: 'NO se realizó' }].map(({ v, label }) => (
              <label key={String(v)} className={`flex items-center gap-2 text-sm font-bold cursor-pointer px-5 py-2.5 rounded-lg border-2 transition-colors ${evaluacionRealizada === v ? (v ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-400 text-red-800') : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
                <input type="radio" checked={evaluacionRealizada === v} onChange={() => setEvaluacionRealizada(v)} className="hidden" />
                {label}
              </label>
            ))}
          </div>
          <label className="block text-xs font-bold text-slate-700 mb-1">OBSERVACIONES</label>
          <textarea value={observacionesRetiro} onChange={e => setObservacionesRetiro(e.target.value)} rows={3} placeholder="Observaciones de la evaluación médica de retiro..." className={inp} />
        </div>

        {/* ── H. Recomendaciones ── */}
        <div className={card}>
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">H. RECOMENDACIONES Y/O TRATAMIENTO</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 mb-3">
            {OPCIONES_RECOMENDACIONES.map(op => (
              <label key={op} className={`flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded transition-colors ${recomendaciones.includes(op) ? 'bg-orange-50 font-semibold text-orange-800' : 'hover:bg-slate-50'}`}>
                <input type="checkbox" checked={recomendaciones.includes(op)} onChange={() => setRecomendaciones(prev => prev.includes(op) ? prev.filter(r => r !== op) : [...prev, op])} />
                {op}
              </label>
            ))}
          </div>
          <textarea value={recomendacionesOtras} onChange={e => setRecomendacionesOtras(e.target.value)} rows={2} placeholder="Otras recomendaciones o tratamiento específico..." className={inp} />
        </div>

        {/* Botón final */}
        <div className="flex justify-end pb-6">
          <button onClick={guardar} disabled={guardando} className="w-full md:w-auto px-8 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 disabled:opacity-50 text-sm shadow-md">
            {guardando ? 'Guardando evaluación...' : editEvalId ? 'Guardar Cambios' : 'Guardar Evaluación de Retiro'}
          </button>
        </div>
      </div>
    </div>
  );
}
