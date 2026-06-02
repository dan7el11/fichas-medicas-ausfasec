import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, updateDoc, arrayUnion, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { useEmpresa } from '../hooks/useEmpresa';
import SignosVitalesForm from '../components/SignosVitalesForm';
import BuscadorCIE10 from '../components/BuscadorCIE10';
import { SeccionI } from '../components/evaluacion/SeccionesEvaluacion';
import { LOGO_EMPRESA } from '../assets/logoEmpresa';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  Trabajador, SignosVitales, AccidenteTrabajo, EnfermedadProfesional,
  ExamenFisicoHallazgo, ExamenComplementario, Diagnostico, Usuario,
  AntecedenteClinico, AntecedenteQuirurgico, Alergia,
} from '../types';

// ── Catálogos compartidos ─────────────────────────────────────────────────────

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
    { type: 'instr', cs: 12, txt: 'SI EXISTE EVIDENCIA DE PATOLOGÍA MARCAR CON "X" Y DESCRIBIR EN LA SIGUIENTE SECCIÓN COLOCANDO EL NUMERAL' },
    { type: 'sub', txt: 'd. Reflejos' }, { type: 'chk', code: '13d' },
  ],
];

const OPCIONES_RECOMENDACIONES = [
  'Dieta balanceada', 'Dieta baja en grasas', 'Dieta baja en sal', 'Actividad física diaria',
  'Ergonomía laboral', 'Pausas activas frecuentes', 'Higiene postural', 'Uso de EPP',
  'Control médico periódico', 'Hidratación adecuada', 'Descanso adecuado',
  'Evitar sobreesfuerzos', 'Protección auditiva', 'Protección visual',
];

// ── Helpers de estado vacío ───────────────────────────────────────────────────

const emptyClinico = (): AntecedenteClinico => ({
  enfermedad: '', desdeCuando: '', tomaMedicacion: false,
  medicacionNombre: '', medicacionDosis: '', medicacionFrecuencia: '',
  seguimientoEspecialista: false, especialista: '', complicaciones: '',
});
const emptyQuirurgico = (): AntecedenteQuirurgico => ({
  procedimiento: '', fechaAproximada: '', complicaciones: '', recuperacionCompleta: true, secuelas: '',
});
const emptyAlergia = (): Alergia => ({
  alergeno: '', intensidadReaccion: '', sintomas: '', tratamientoHabitual: '', seguimientoEspecialista: false, especialista: '',
});
const emptyAccidente = (): AccidenteTrabajo => ({
  descripcion: '', calificado: false, especificacion: '', fechaAnio: '', fechaMes: '', fechaDia: '', observaciones: '',
});
const emptyEnfermedad = (): EnfermedadProfesional => ({
  descripcion: '', calificada: false, especificacion: '', fechaAnio: '', fechaMes: '', fechaDia: '', observaciones: '',
});

// ── Componente principal ──────────────────────────────────────────────────────

export default function NuevaEvaluacionRetiro() {
  const { trabajadorId } = useParams<{ trabajadorId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { empresa: DATOS_EMPRESA } = useEmpresa();

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

  // B. Antecedentes clínicos
  const [antecedentesClinicosQ, setAntecedentesClinicosQ] = useState<boolean | null>(null);
  const [antecedentesClinicosLista, setAntecedentesClinicosLista] = useState<AntecedenteClinico[]>([emptyClinico()]);
  const [antecedentesQuirurgicosQ, setAntecedentesQuirurgicosQ] = useState<boolean | null>(null);
  const [antecedentesQuirurgicosLista, setAntecedentesQuirurgicosLista] = useState<AntecedenteQuirurgico[]>([emptyQuirurgico()]);
  const [alergiasTiene, setAlergiasTiene] = useState<boolean | null>(null);
  const [alergias, setAlergias] = useState<Alergia[]>([emptyAlergia()]);
  const [accidenteTrabajo, setAccidenteTrabajo] = useState<AccidenteTrabajo>(emptyAccidente());
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
    const cargar = async () => {
      const trabDoc = await getDoc(doc(db, 'trabajadores', trabajadorId));
      if (trabDoc.exists()) setTrabajador({ id: trabDoc.id, ...trabDoc.data() } as Trabajador);

      const medicoDoc = await getDoc(doc(db, 'usuarios', user.uid));
      if (medicoDoc.exists()) setMedicoData(medicoDoc.data() as Usuario);

      // Pre-cargar antecedentes de la última evaluación
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
        if (u.accidentesTrabajo) setAccidenteTrabajo(u.accidentesTrabajo);
        if (u.enfermedadesProfesionales) setEnfermedadProfesional(u.enfermedadesProfesionales);
        if (u.signosVitales?.talla) setSignosVitales(prev => ({ ...prev, talla: u.signosVitales.talla }));
        if (u.factoresRiesgo?.actividades) setActividadesTexto(u.factoresRiesgo.actividades);
      }
    };
    cargar();
  }, [trabajadorId, user]);

  // ── Handlers examen físico ────────────────────────────────────────────────

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

  const updateHallazgo = (codigo: string, descripcion: string) => {
    setExamenFisicoHallazgos(prev => prev.map(h => h.codigo === codigo ? { ...h, descripcion } : h));
  };

  const handleSignosChange = useCallback((sv: SignosVitales) => setSignosVitales(sv), []);

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
        medicoNombre: medicoData?.nombreCompleto || user.email || '',
        medicoCedula: medicoData?.cedula || '',
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
        accidentesTrabajo: accidenteTrabajo,
        enfermedadesProfesionales: enfermedadProfesional,
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
      const ref = await addDoc(collection(db, 'evaluaciones'), payload);
      await updateDoc(doc(db, 'trabajadores', trabajadorId), {
        evaluaciones: arrayUnion(ref.id),
        ultimaEvaluacion: new Date(),
        updatedAt: new Date(),
        updatedBy: user.uid,
      });
      toast.success('Evaluación de retiro guardada correctamente.');
      navigate(`/trabajador/${trabajadorId}`);
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

    const baseStyles = { lineColor: negro, lineWidth: 0.25, fontSize: 6.5, cellPadding: 1.2, textColor: negro };
    const headStyles = { fillColor: colorSecundario, textColor: negro, fontStyle: 'bold' as const, fontSize: 6.5, lineColor: negro, lineWidth: 0.25, cellPadding: 1.2 };

    const checkPage = (needed: number) => { if (y + needed > 285) { pdf.addPage(); y = 7; } };

    const secHeader = (texto: string, bgColor = colorPrimario) => {
      checkPage(10);
      pdf.addImage(LOGO_EMPRESA, 'PNG', 8, 8, 40, 15);
      pdf.setFillColor(bgColor); pdf.setDrawColor(0);
      pdf.rect(M, y, CW, 5, 'FD');
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
      pdf.text(texto, M + 1.5, y + 3.5);
      y += 5;
    };

    const textoLibre = (texto: string, minH = 8) => {
      pdf.setDrawColor(0); pdf.setFontSize(7); pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(texto || '-', CW - 3);
      const h = Math.max(minH, lines.length * 3 + 2);
      checkPage(h + 2);
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
      if (!d) return '-';
      const dt = d instanceof Date ? d : d.seconds ? new Date(d.seconds * 1000) : null;
      return dt ? dt.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '-';
    };
    const now = new Date();

    // ── PÁGINA 1 ────────────────────────────────────────────────────────────

    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { ...baseStyles, halign: 'center', fontSize: 8 },
      columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 33 } },
      body: [
        [{ content: '', rowSpan: 3, styles: { fontStyle: 'bold', fontSize: 11, valign: 'middle' } }, { content: 'HISTORIA CLÍNICA OCUPACIONAL:\nEVALUACIÓN DE RETIRO', rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, valign: 'middle' } }, { content: 'Código:   SO-RE-40', styles: { fontSize: 7, halign: 'left' } }],
        [{ content: 'Revisión:  1', styles: { fontSize: 7, halign: 'left' } }],
        [{ content: 'MACROPROCESO: PLANIFICACIÓN, SEGURIDAD Y AMBIENTE', styles: { fontSize: 6, fontStyle: 'bold' } }, { content: 'Página:    1 de 2', styles: { fontSize: 7, halign: 'left' } }],
      ],
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    secHeader('A. DATOS DEL ESTABLECIMIENTO - EMPRESA Y USUARIO');
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: baseStyles, headStyles,
      head: [['INSTITUCIÓN DEL SISTEMA', 'RUC', 'CIIU', 'ESTABLECIMIENTO DE SALUD', 'N° HISTORIA CLÍNICA', 'N° ARCHIVO']],
      body: [[DATOS_EMPRESA.institucion, DATOS_EMPRESA.ruc, DATOS_EMPRESA.ciu, DATOS_EMPRESA.establecimiento, numeroHistoriaClinica || trabajador.cedula, numeroArchivo || '-']],
    });
    y = (pdf as any).lastAutoTable.finalY;
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: baseStyles, headStyles,
      head: [['PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'SEXO', 'FECHA INICIO LABORES', 'FECHA SALIDA', 'TIEMPO (meses)', 'PUESTO DE TRABAJO (CIUO)']],
      body: [[
        trabajador.primerApellido, trabajador.segundoApellido || '-',
        trabajador.primerNombre, trabajador.segundoNombre || '-',
        trabajador.sexo,
        (trabajador as any).fechaIngreso || '-',
        fechaSalida || '-',
        tiempoMeses || '-',
        trabajador.puestoTrabajo,
      ]],
    });
    y = (pdf as any).lastAutoTable.finalY;
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: baseStyles, headStyles,
      head: [['ACTIVIDADES', 'FACTORES DE RIESGO']],
      body: [[actividadesTexto || '-', factoresRiesgoTexto || '-']],
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    // B. Antecedentes
    secHeader('B. ANTECEDENTES PERSONALES');
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(204, 255, 204); pdf.setDrawColor(0); pdf.rect(M, y, CW, 4, 'FD');
    pdf.text('ANTECEDENTES CLÍNICOS Y QUIRÚRGICOS', M + 1.5, y + 3); y += 4;

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
        : '';
      const lAl = alergiasTiene && alergias.length > 0
        ? '\nAlergias: ' + alergias.map(al => `${al.alergeno || '?'} — ${al.intensidadReaccion || '?'}`).join('; ')
        : '';
      textoLibre((lClin + lQ + lAl) || 'Sin antecedentes relevantes.', 5);
    } else if (antecedentesClinicosQ === false) {
      const lQ = antecedentesQuirurgicosQ && antecedentesQuirurgicosLista.length > 0
        ? 'Antecedentes quirúrgicos: ' + antecedentesQuirurgicosLista.map(aq => `${aq.procedimiento || '?'} (${aq.fechaAproximada || '?'})`).join('; ')
        : '';
      const lAl = alergiasTiene && alergias.length > 0
        ? '\nAlergias: ' + alergias.map(al => `${al.alergeno || '?'} — ${al.intensidadReaccion || '?'}`).join('; ')
        : '';
      textoLibre(('Sin antecedentes clínicos. ' + lQ + lAl).trim() || 'Sin antecedentes relevantes.', 5);
    } else {
      textoLibre('Sin antecedentes relevantes reportados.', 5);
    }

    // Accidentes
    const descAcc = accidenteTrabajo.descripcion || 'NINGUNO';
    const califAcc = accidenteTrabajo.descripcion ? (accidenteTrabajo.calificado ? 'SÍ' : 'NO') : '-';
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fillColor: colorSecundario },
      head: [['Accidentes de trabajo', 'CALIFICADO IESS', 'ESPECIFICACIÓN', 'OBSERVACIONES']],
      body: [[descAcc, califAcc, accidenteTrabajo.especificacion || '-', accidenteTrabajo.observaciones || '-']],
      columnStyles: { 1: { halign: 'center' } },
    });
    y = (pdf as any).lastAutoTable.finalY;

    // Enfermedades profesionales
    const descEnf = enfermedadProfesional.descripcion || 'El trabajador/a no ha sufrido o reportado enfermedades profesionales hasta el momento.';
    const califEnf = enfermedadProfesional.descripcion ? (enfermedadProfesional.calificada ? 'SÍ' : 'NO') : '-';
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fillColor: colorSecundario },
      head: [['Enfermedad Profesional', 'CALIFICADA IESS', 'ESPECIFICACIÓN', 'OBSERVACIONES']],
      body: [[descEnf, califEnf, enfermedadProfesional.especificacion || '-', enfermedadProfesional.observaciones || '-']],
      columnStyles: { 1: { halign: 'center' } },
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    // C. Constantes vitales
    checkPage(20);
    secHeader('C. CONSTANTES VITALES Y ANTROPOMETRÍA');
    const sv = signosVitales;
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: baseStyles, headStyles,
      head: [['PA (mmHg)', 'TEMP (°C)', 'FC (l/min)', 'SAT O₂ (%)', 'FR (fr/min)', 'PESO (Kg)', 'TALLA (cm)', 'IMC (kg/m²)', 'PERÍMETRO ABD (cm)']],
      body: [[
        `${sv.presionSistolica || '-'}/${sv.presionDiastolica || '-'}`,
        sv.temperatura || '-', sv.frecuenciaCardiaca || '-', sv.saturacion || '-',
        sv.frecuenciaRespiratoria || '-', sv.peso || '-', sv.talla || '-',
        sv.imc ? sv.imc.toFixed(1) : '-', sv.perimetroAbdominal || '-',
      ]],
      columnStyles: { 0: { halign: 'center' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' }, 7: { halign: 'center' }, 8: { halign: 'center' } },
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    // D. Examen físico
    checkPage(60);
    secHeader('D. EXAMEN FÍSICO REGIONAL');
    const hasFisico = (code: string) => examenFisicoHallazgos.some(h => h.codigo === code);
    const pdfFisicoRows = FISICO_ROWS.map(row =>
      row.map(cell => {
        if (cell.type === 'reg') return { content: '', textToRotate: cell.txt, rowSpan: cell.rs, styles: { fillColor: colorTerciario, halign: 'center', valign: 'middle' } };
        if (cell.type === 'sub') return { content: cell.txt, styles: { fillColor: '#ffffff' } };
        if (cell.type === 'chk') return { content: hasFisico(cell.code as string) ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', fillColor: '#ffffff' } };
        if (cell.type === 'empty') return { content: '', rowSpan: cell.rs || 1, colSpan: cell.cs || 1, styles: { fillColor: '#ffffff', lineWidth: 0 } };
        if (cell.type === 'instr') return { content: cell.txt, colSpan: cell.cs, styles: { fillColor: '#f8f8f8', textColor: negro, halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 5.5 } };
        return { content: '' };
      })
    );
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { ...baseStyles, fontSize: 5.5, cellPadding: 0.8 },
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
      didDrawCell: (data) => {
        const raw = data.cell.raw as any;
        if (data.section === 'body' && raw?.textToRotate) {
          pdf.setTextColor(0); pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold');
          const str = String(raw.textToRotate);
          const realHeight = 6.5 * (raw.rowSpan || 1);
          const textWidth = pdf.getTextWidth(str);
          const centroX = data.cell.x + data.cell.width / 2;
          const centroY = data.cell.y + realHeight / 2;
          if (textWidth > realHeight - 2) {
            const lineas = pdf.splitTextToSize(str, realHeight - 2);
            pdf.text(lineas[0], centroX + 1.5, centroY + pdf.getTextWidth(lineas[0]) / 2, { angle: 90 });
            if (lineas[1]) pdf.text(lineas[1], centroX - 0.5, centroY + pdf.getTextWidth(lineas[1]) / 2, { angle: 90 });
          } else {
            pdf.text(str, centroX + 0.8, centroY + textWidth / 2, { angle: 90 });
          }
        }
      },
    });
    y = (pdf as any).lastAutoTable.finalY;

    if (examenFisicoHallazgos.length > 0) {
      textoLibre('Observaciones:\n' + examenFisicoHallazgos.map(h => `${h.codigo}. ${h.region}, ${h.subregion}: ${h.descripcion || '-'}`).join('\n'), 6);
    } else {
      textoLibre('Sin hallazgos patológicos al examen físico regional.', 5);
    }
    y += 1;

    // ── PÁGINA 2 ────────────────────────────────────────────────────────────

    pdf.addPage(); y = 7;
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { ...baseStyles, halign: 'center', fontSize: 8 },
      columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 33 } },
      body: [
        [{ content: '', rowSpan: 3, styles: { fontStyle: 'bold', fontSize: 11, valign: 'middle' } }, { content: 'HISTORIA CLÍNICA OCUPACIONAL:\nEVALUACIÓN DE RETIRO', rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, valign: 'middle' } }, { content: 'Código:   SO-RE-40', styles: { fontSize: 7, halign: 'left' } }],
        [{ content: 'Revisión:  1', styles: { fontSize: 7, halign: 'left' } }],
        [{ content: 'PROCESO: GESTIÓN DE SEGURIDAD INDUSTRIAL Y MEDICINA OCUPACIONAL', styles: { fontSize: 6, fontStyle: 'bold' } }, { content: 'Página:    2 de 2', styles: { fontSize: 7, halign: 'left' } }],
      ],
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    // E. Exámenes
    const examsValidos = examenesComplementarios.filter(e => e.nombre.trim());
    if (examsValidos.length > 0) {
      checkPage(15); secHeader('E. RESULTADOS DE EXÁMENES GENERALES Y ESPECÍFICOS DE ACUERDO AL RIESGO Y PUESTO DE TRABAJO');
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 },
        head: [['EXAMEN', 'FECHA\naaaa / mm / dd', 'RESULTADO']],
        body: examsValidos.map(e => [e.nombre, e.fecha, e.resultado]),
      });
      y = (pdf as any).lastAutoTable.finalY + 1;
    }

    // F. Diagnóstico
    const dxValidos = diagnosticos.filter(d => d.descripcion.trim());
    checkPage(20); secHeader('F. DIAGNÓSTICO                    PRE= PRESUNTIVO          DEF= DEFINITIVO');
    if (dxValidos.length > 0) {
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5, halign: 'center' }, headStyles: { ...headStyles, fontSize: 6, halign: 'center' },
        head: [['N°', 'DESCRIPCIÓN', 'CIE', 'PRE', 'DEF']],
        body: dxValidos.map((dx, i) => [`${i + 1}`, { content: dx.descripcion, styles: { halign: 'left' } }, dx.cie || '-', dx.tipo === 'presuntivo' ? 'X' : '', dx.tipo === 'definitivo' ? 'X' : '']),
        columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 10 }, 4: { cellWidth: 10 } },
      });
      y = (pdf as any).lastAutoTable.finalY + 1;
    } else {
      textoLibre('TRABAJADOR SANO.', 5); y += 1;
    }

    // G. Evaluación médica de retiro
    checkPage(20); secHeader('G. EVALUACIÓN MÉDICA DE RETIRO');
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, halign: 'center', fontSize: 7 }, headStyles: { ...headStyles, halign: 'center' },
      head: [['SE REALIZÓ LA EVALUACIÓN', 'SI', 'NO']],
      body: [[{ content: 'Evaluación médica ocupacional de retiro', styles: { halign: 'left' } }, evaluacionRealizada ? 'X' : '', !evaluacionRealizada ? 'X' : '']],
      columnStyles: { 1: { cellWidth: 12 }, 2: { cellWidth: 12 } },
    });
    y = (pdf as any).lastAutoTable.finalY;
    textoLibre(`Observaciones: ${observacionesRetiro || '-'}`, 7); y += 1;

    // H. Recomendaciones
    secHeader('H. RECOMENDACIONES Y/O TRATAMIENTO');
    const recTexto = recomendaciones.join('; ') + (recomendacionesOtras ? `; ${recomendacionesOtras}` : '') || 'Ninguna particular al momento.';
    textoLibre(recTexto, 8); y += 2;

    // Certificado legal
    checkPage(15);
    pdf.setFillColor(248, 248, 248); pdf.setDrawColor(0);
    const certText = 'CERTIFICO QUE LO ANTERIORMENTE EXPRESADO EN RELACIÓN A MI ESTADO DE SALUD ES VERDAD. SE ME HA INFORMADO MI ESTADO ACTUAL DE SALUD Y LAS RECOMENDACIONES PERTINENTES.';
    const certLines = pdf.splitTextToSize(certText, CW - 3);
    const certH = certLines.length * 3 + 3;
    pdf.rect(M, y, CW, certH, 'FD'); pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.text(certLines, M + 1.5, y + 3); y += certH + 3;

    // I. Datos del profesional / J. Firma
    checkPage(25); secHeader('I. DATOS DEL PROFESIONAL                                                                             J. FIRMA DEL USUARIO');
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5, halign: 'center' }, headStyles: { ...headStyles, fontSize: 6, halign: 'center' },
      head: [['FECHA\naaaa-mm-dd', 'HORA', 'NOMBRES Y APELLIDOS', 'CÓDIGO', 'FIRMA Y SELLO', 'FIRMA DEL USUARIO']],
      body: [[fmtF(now), fmtHora(now), (medicoData?.nombreCompleto || 'MÉDICO OCUPACIONAL').toUpperCase(), medicoData?.cedula || '-', '', '']],
      bodyStyles: { minCellHeight: 18, valign: 'bottom', halign: 'center' },
    });

    pdf.save(`SO-RE-40_RETIRO_${trabajador.primerApellido}_${trabajador.primerNombre}_${fmtF(now)}.pdf`);
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  if (!trabajador) return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Cargando...</div>;

  const inpCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400';
  const sectionCard = 'bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6';

  const updateClinico = (idx: number, field: keyof AntecedenteClinico, val: any) =>
    setAntecedentesClinicosLista(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: val }; return u; });
  const updateQuirurgico = (idx: number, field: keyof AntecedenteQuirurgico, val: any) =>
    setAntecedentesQuirurgicosLista(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: val }; return u; });
  const updateAlerg = (idx: number, field: keyof Alergia, val: any) =>
    setAlergias(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: val }; return u; });

  return (
    <div className="min-h-screen bg-orange-50 py-6 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Cabecera */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">SO-RE-40</span>
              <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">RETIRO</span>
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
              {guardando ? 'Guardando...' : 'Guardar Evaluación de Retiro'}
            </button>
          </div>
        </div>

        {/* A. Datos complementarios */}
        <div className={sectionCard}>
          <h2 className="text-sm font-bold text-slate-800 mb-1 border-b pb-2">A. DATOS DEL ESTABLECIMIENTO - EMPRESA Y USUARIO</h2>
          <p className="text-xs text-slate-500 mb-4">Los datos del trabajador se toman del registro existente. Complete los datos específicos de retiro.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">N° HISTORIA CLÍNICA</label>
              <input type="text" value={numeroHistoriaClinica} onChange={e => setNumeroHistoriaClinica(e.target.value)} placeholder={trabajador.cedula} className={inpCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">N° ARCHIVO</label>
              <input type="text" value={numeroArchivo} onChange={e => setNumeroArchivo(e.target.value)} placeholder="Opcional" className={inpCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">FECHA DE INICIO LABORES</label>
              <input type="text" value={(trabajador as any).fechaIngreso || ''} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">FECHA DE SALIDA <span className="text-red-500">*</span></label>
              <input type="date" value={fechaSalida} onChange={e => setFechaSalida(e.target.value)} className={inpCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">TIEMPO EN EL PUESTO (MESES)</label>
              <input type="number" value={tiempoMeses} onChange={e => setTiempoMeses(e.target.value)} placeholder="Ej: 36" className={inpCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PUESTO DE TRABAJO</label>
              <input type="text" value={trabajador.puestoTrabajo} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ACTIVIDADES REALIZADAS</label>
              <textarea value={actividadesTexto} onChange={e => setActividadesTexto(e.target.value)} rows={2} placeholder="Descripción de las actividades realizadas en el puesto..." className={inpCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">FACTORES DE RIESGO</label>
              <textarea value={factoresRiesgoTexto} onChange={e => setFactoresRiesgoTexto(e.target.value)} rows={2} placeholder="Factores de riesgo a los que estuvo expuesto..." className={inpCls} />
            </div>
          </div>
        </div>

        {/* B. Antecedentes personales */}
        <div className={sectionCard}>
          <h2 className="text-sm font-bold text-slate-800 mb-1 border-b pb-2">B. ANTECEDENTES PERSONALES</h2>

          {/* Antecedentes clínicos */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-700 mb-2 bg-green-50 px-2 py-1 rounded">ANTECEDENTES CLÍNICOS</p>
            <div className="flex gap-4 mb-3">
              {[{ v: true, label: 'SÍ tiene antecedentes' }, { v: false, label: 'NO tiene antecedentes' }].map(({ v, label }) => (
                <label key={String(v)} className={`flex items-center gap-2 text-xs cursor-pointer px-3 py-1.5 rounded-lg border transition-colors ${antecedentesClinicosQ === v ? 'bg-blue-50 border-blue-300 font-semibold text-blue-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" checked={antecedentesClinicosQ === v} onChange={() => setAntecedentesClinicosQ(v)} className="hidden" />
                  {antecedentesClinicosQ === v ? '●' : '○'} {label}
                </label>
              ))}
            </div>
            {antecedentesClinicosQ === true && antecedentesClinicosLista.map((ac, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-3 mb-2 bg-blue-50/30 space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <input placeholder="Enfermedad" value={ac.enfermedad} onChange={e => updateClinico(i, 'enfermedad', e.target.value)} className="px-2 py-1 border rounded text-xs col-span-2 md:col-span-1" />
                  <input placeholder="Desde cuándo" value={ac.desdeCuando} onChange={e => updateClinico(i, 'desdeCuando', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <input placeholder="Complicaciones" value={ac.complicaciones} onChange={e => updateClinico(i, 'complicaciones', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={ac.tomaMedicacion} onChange={e => updateClinico(i, 'tomaMedicacion', e.target.checked)} />
                  Toma medicación
                </label>
                {ac.tomaMedicacion && (
                  <div className="grid grid-cols-3 gap-2">
                    <input placeholder="Medicamento" value={ac.medicacionNombre} onChange={e => updateClinico(i, 'medicacionNombre', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                    <input placeholder="Dosis" value={ac.medicacionDosis} onChange={e => updateClinico(i, 'medicacionDosis', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                    <input placeholder="Frecuencia" value={ac.medicacionFrecuencia} onChange={e => updateClinico(i, 'medicacionFrecuencia', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  </div>
                )}
                <div className="flex justify-between items-center">
                  {antecedentesClinicosLista.length > 1 && (
                    <button type="button" onClick={() => setAntecedentesClinicosLista(p => p.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:underline">Eliminar</button>
                  )}
                </div>
              </div>
            ))}
            {antecedentesClinicosQ === true && (
              <button type="button" onClick={() => setAntecedentesClinicosLista(p => [...p, emptyClinico()])} className="text-xs text-blue-600 hover:underline mt-1">+ Agregar antecedente clínico</button>
            )}
          </div>

          {/* Antecedentes quirúrgicos */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-700 mb-2 bg-green-50 px-2 py-1 rounded">ANTECEDENTES QUIRÚRGICOS</p>
            <div className="flex gap-4 mb-3">
              {[{ v: true, label: 'SÍ tiene cirugías' }, { v: false, label: 'NO tiene cirugías' }].map(({ v, label }) => (
                <label key={String(v)} className={`flex items-center gap-2 text-xs cursor-pointer px-3 py-1.5 rounded-lg border transition-colors ${antecedentesQuirurgicosQ === v ? 'bg-blue-50 border-blue-300 font-semibold text-blue-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" checked={antecedentesQuirurgicosQ === v} onChange={() => setAntecedentesQuirurgicosQ(v)} className="hidden" />
                  {antecedentesQuirurgicosQ === v ? '●' : '○'} {label}
                </label>
              ))}
            </div>
            {antecedentesQuirurgicosQ === true && antecedentesQuirurgicosLista.map((aq, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-3 mb-2 bg-purple-50/30 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Procedimiento quirúrgico" value={aq.procedimiento} onChange={e => updateQuirurgico(i, 'procedimiento', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <input placeholder="Fecha aproximada" value={aq.fechaAproximada} onChange={e => updateQuirurgico(i, 'fechaAproximada', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <input placeholder="Complicaciones" value={aq.complicaciones} onChange={e => updateQuirurgico(i, 'complicaciones', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <input placeholder="Secuelas" value={aq.secuelas} onChange={e => updateQuirurgico(i, 'secuelas', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                </div>
                {antecedentesQuirurgicosLista.length > 1 && (
                  <button type="button" onClick={() => setAntecedentesQuirurgicosLista(p => p.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:underline">Eliminar</button>
                )}
              </div>
            ))}
            {antecedentesQuirurgicosQ === true && (
              <button type="button" onClick={() => setAntecedentesQuirurgicosLista(p => [...p, emptyQuirurgico()])} className="text-xs text-blue-600 hover:underline mt-1">+ Agregar cirugía</button>
            )}
          </div>

          {/* Alergias */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-700 mb-2 bg-green-50 px-2 py-1 rounded">ALERGIAS</p>
            <div className="flex gap-4 mb-3">
              {[{ v: true, label: 'SÍ tiene alergias' }, { v: false, label: 'NO tiene alergias' }].map(({ v, label }) => (
                <label key={String(v)} className={`flex items-center gap-2 text-xs cursor-pointer px-3 py-1.5 rounded-lg border transition-colors ${alergiasTiene === v ? 'bg-blue-50 border-blue-300 font-semibold text-blue-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" checked={alergiasTiene === v} onChange={() => setAlergiasTiene(v)} className="hidden" />
                  {alergiasTiene === v ? '●' : '○'} {label}
                </label>
              ))}
            </div>
            {alergiasTiene === true && alergias.map((al, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-3 mb-2 bg-red-50/30 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Alergeno" value={al.alergeno} onChange={e => updateAlerg(i, 'alergeno', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <input placeholder="Intensidad de reacción" value={al.intensidadReaccion} onChange={e => updateAlerg(i, 'intensidadReaccion', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <input placeholder="Síntomas" value={al.sintomas} onChange={e => updateAlerg(i, 'sintomas', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <input placeholder="Tratamiento habitual" value={al.tratamientoHabitual} onChange={e => updateAlerg(i, 'tratamientoHabitual', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                </div>
                {alergias.length > 1 && (
                  <button type="button" onClick={() => setAlergias(p => p.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:underline">Eliminar</button>
                )}
              </div>
            ))}
            {alergiasTiene === true && (
              <button type="button" onClick={() => setAlergias(p => [...p, emptyAlergia()])} className="text-xs text-blue-600 hover:underline mt-1">+ Agregar alergia</button>
            )}
          </div>

          {/* Accidentes de trabajo */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-700 mb-2 bg-green-50 px-2 py-1 rounded">ACCIDENTES DE TRABAJO</p>
            <textarea value={accidenteTrabajo.descripcion} onChange={e => setAccidenteTrabajo(p => ({ ...p, descripcion: e.target.value }))} rows={2} placeholder="Descripción del accidente de trabajo (dejar en blanco si no hubo)..." className={inpCls + ' mb-2'} />
            {accidenteTrabajo.descripcion && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={accidenteTrabajo.calificado} onChange={e => setAccidenteTrabajo(p => ({ ...p, calificado: e.target.checked }))} />
                  Calificado por IESS
                </label>
                <input placeholder="Especificar" value={accidenteTrabajo.especificacion} onChange={e => setAccidenteTrabajo(p => ({ ...p, especificacion: e.target.value }))} className="px-2 py-1 border rounded text-xs" />
                <input placeholder="Observaciones" value={accidenteTrabajo.observaciones} onChange={e => setAccidenteTrabajo(p => ({ ...p, observaciones: e.target.value }))} className="px-2 py-1 border rounded text-xs" />
              </div>
            )}
          </div>

          {/* Enfermedades profesionales */}
          <div>
            <p className="text-xs font-bold text-slate-700 mb-2 bg-green-50 px-2 py-1 rounded">ENFERMEDADES PROFESIONALES</p>
            <textarea value={enfermedadProfesional.descripcion} onChange={e => setEnfermedadProfesional(p => ({ ...p, descripcion: e.target.value }))} rows={2} placeholder="Descripción de la enfermedad profesional (dejar en blanco si no hubo)..." className={inpCls + ' mb-2'} />
            {enfermedadProfesional.descripcion && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={enfermedadProfesional.calificada} onChange={e => setEnfermedadProfesional(p => ({ ...p, calificada: e.target.checked }))} />
                  Calificada por IESS
                </label>
                <input placeholder="Especificar" value={enfermedadProfesional.especificacion} onChange={e => setEnfermedadProfesional(p => ({ ...p, especificacion: e.target.value }))} className="px-2 py-1 border rounded text-xs" />
                <input placeholder="Observaciones" value={enfermedadProfesional.observaciones} onChange={e => setEnfermedadProfesional(p => ({ ...p, observaciones: e.target.value }))} className="px-2 py-1 border rounded text-xs" />
              </div>
            )}
          </div>
        </div>

        {/* C. Signos vitales */}
        <SignosVitalesForm onDataChange={handleSignosChange} initialData={signosVitales} />
        {(!signosVitales.presionSistolica || !signosVitales.presionDiastolica || !signosVitales.frecuenciaCardiaca || !signosVitales.peso || !signosVitales.talla) && (
          <p className="text-xs text-red-500 px-1">⚠ PA, FC, Peso y Talla son obligatorios</p>
        )}

        {/* D. Examen físico regional */}
        <SeccionI
          REGIONES={REGIONES_EXAMEN_FISICO}
          seleccionados={examenFisicoSeleccionados}
          hallazgos={examenFisicoHallazgos}
          onToggle={toggleExamenFisico}
          onHallazgo={updateHallazgo}
        />

        {/* E. Exámenes complementarios */}
        <div className={sectionCard}>
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">E. RESULTADOS DE EXÁMENES GENERALES Y ESPECÍFICOS</h2>
          {examenesComplementarios.map((ex, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input type="text" placeholder="Examen" value={ex.nombre} onChange={e => { const u = [...examenesComplementarios]; u[idx] = { ...u[idx], nombre: e.target.value }; setExamenesComplementarios(u); }} className="w-1/3 px-2 py-1 border rounded text-sm" />
              <input type="date" value={ex.fecha} onChange={e => { const u = [...examenesComplementarios]; u[idx] = { ...u[idx], fecha: e.target.value }; setExamenesComplementarios(u); }} className="w-1/4 px-2 py-1 border rounded text-sm" />
              <input type="text" placeholder="Resultado" value={ex.resultado} onChange={e => { const u = [...examenesComplementarios]; u[idx] = { ...u[idx], resultado: e.target.value }; setExamenesComplementarios(u); }} className="flex-1 px-2 py-1 border rounded text-sm" />
              {examenesComplementarios.length > 1 && (
                <button type="button" onClick={() => setExamenesComplementarios(p => p.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 font-bold px-1">✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setExamenesComplementarios(p => [...p, { nombre: '', fecha: '', resultado: '' }])} className="text-xs text-blue-600 hover:underline mt-1">+ Agregar examen</button>
        </div>

        {/* F. Diagnósticos */}
        <div className={sectionCard}>
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
              {diagnosticos.length > 1 && (
                <button type="button" onClick={() => setDiagnosticos(p => p.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 font-bold px-1">✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setDiagnosticos(p => [...p, { descripcion: '', cie: '', tipo: 'definitivo' }])} className="text-xs text-blue-600 hover:underline mt-1">+ Agregar diagnóstico</button>
        </div>

        {/* G. Evaluación médica de retiro */}
        <div className={sectionCard}>
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">G. EVALUACIÓN MÉDICA DE RETIRO</h2>
          <div className="flex gap-4 mb-4">
            <p className="text-sm text-slate-700 font-medium">¿Se realizó la evaluación?</p>
            {[{ v: true, label: 'SÍ' }, { v: false, label: 'NO' }].map(({ v, label }) => (
              <label key={String(v)} className={`flex items-center gap-2 text-sm cursor-pointer px-4 py-2 rounded-lg border-2 transition-colors font-bold ${evaluacionRealizada === v ? 'bg-orange-50 border-orange-400 text-orange-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <input type="radio" checked={evaluacionRealizada === v} onChange={() => setEvaluacionRealizada(v)} className="hidden" />
                {label}
              </label>
            ))}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">OBSERVACIONES</label>
            <textarea value={observacionesRetiro} onChange={e => setObservacionesRetiro(e.target.value)} rows={3} placeholder="Observaciones de la evaluación médica de retiro..." className={inpCls} />
          </div>
        </div>

        {/* H. Recomendaciones */}
        <div className={sectionCard}>
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">H. RECOMENDACIONES Y/O TRATAMIENTO</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 mb-3">
            {OPCIONES_RECOMENDACIONES.map(op => (
              <label key={op} className={`flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded transition-colors ${recomendaciones.includes(op) ? 'bg-orange-50 font-semibold text-orange-800' : 'hover:bg-slate-50'}`}>
                <input type="checkbox" checked={recomendaciones.includes(op)} onChange={() => setRecomendaciones(prev => prev.includes(op) ? prev.filter(r => r !== op) : [...prev, op])} />
                {op}
              </label>
            ))}
          </div>
          <textarea value={recomendacionesOtras} onChange={e => setRecomendacionesOtras(e.target.value)} rows={2} placeholder="Otras recomendaciones o tratamiento específico..." className={inpCls} />
        </div>

        {/* Botón final */}
        <div className="flex justify-end pb-6">
          <button onClick={guardar} disabled={guardando} className="w-full md:w-auto px-8 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 disabled:opacity-50 text-sm shadow-md">
            {guardando ? 'Guardando evaluación...' : 'Guardar Evaluación de Retiro'}
          </button>
        </div>

      </div>
    </div>
  );
}
