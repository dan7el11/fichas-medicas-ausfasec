import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Trabajador, EvaluacionMedica } from '../../types';
import ExamenesPanel from '../examenes/ExamenesPanel';
import { OrdenDetalleModal } from '../examenes/ExamenModales';
import { useToast } from '../Toast';
import { useAuth } from '../../contexts/AuthContext';
import { LOGO_EMPRESA } from '../../assets/logoEmpresa';
import { getOrdenes, eliminarOrden } from '../../services/examenesPlan';
import { estadoPermiso, duracionPermiso, fmtFecha as fmtPF, toDate, actualizarPermiso, eliminarPermiso } from '../../services/permisos';
import { TIPOS_PERMISO } from '../../types/permiso';
import type { TipoPermiso } from '../../types/permiso';
import type { OrdenExamen } from '../../types/examenPlan';
import type { PermisoMedico } from '../../types/permiso';

// ============================================================================
// CONSTANTES
// ============================================================================
const TIPOS_ANTECEDENTES_FAMILIARES = [
  'Enfermedad Cardio-Vascular', 'Enfermedad Metabólica', 'Enfermedad Neurológica',
  'Enfermedad Oncológica', 'Enfermedad Infecciosa', 'Enfermedad Hereditaria / Congénita',
  'Discapacidades', 'Otros'
];

const SISTEMAS = [
  'PIEL - ANEXOS', 'ÓRGANOS DE LOS SENTIDOS', 'RESPIRATORIO', 'CARDIO-VASCULAR',
  'DIGESTIVO', 'GENITO - URINARIO', 'MÚSCULO ESQUELÉTICO', 'ENDOCRINO', 'HEMO LINFÁTICO', 'NERVIOSO'
];

const FISICO_ROWS = [
  [
    { type: 'reg', rs: 3, txt: '1. PIEL' }, { type: 'sub', txt: 'a. Cicatrices' }, { type: 'chk', code: '1a' },
    { type: 'reg', rs: 3, txt: '3. OÍDO' }, { type: 'sub', txt: 'a. C. aud ext' }, { type: 'chk', code: '3a' },
    { type: 'reg', rs: 4, txt: '5. NARIZ' }, { type: 'sub', txt: 'a. Tabique' }, { type: 'chk', code: '5a' },
    { type: 'reg', rs: 2, txt: '8. TÓRAX' }, { type: 'sub', txt: 'a. Pulmones' }, { type: 'chk', code: '8a' },
    { type: 'reg', rs: 2, txt: '11. PELVIS' }, { type: 'sub', txt: 'a. Pelvis' }, { type: 'chk', code: '11a' }
  ],
  [
    { type: 'sub', txt: 'b. Tatuajes' }, { type: 'chk', code: '1b' },
    { type: 'sub', txt: 'b. Pabellón' }, { type: 'chk', code: '3b' },
    { type: 'sub', txt: 'b. Cornetes' }, { type: 'chk', code: '5b' },
    { type: 'sub', txt: 'b. Parrilla costal' }, { type: 'chk', code: '8b' },
    { type: 'sub', txt: 'b. Genitales' }, { type: 'chk', code: '11b' }
  ],
  [
    { type: 'sub', txt: 'c. Piel faneras' }, { type: 'chk', code: '1c' },
    { type: 'sub', txt: 'c. Tímpanos' }, { type: 'chk', code: '3c' },
    { type: 'sub', txt: 'c. Mucosas' }, { type: 'chk', code: '5c' },
    { type: 'reg', rs: 2, txt: '9. ABDOMEN' }, { type: 'sub', txt: 'a. Vísceras' }, { type: 'chk', code: '9a' },
    { type: 'reg', rs: 3, txt: '12. EXTREM.' }, { type: 'sub', txt: 'a. Vascular' }, { type: 'chk', code: '12a' }
  ],
  [
    { type: 'reg', rs: 5, txt: '2. OJOS' }, { type: 'sub', txt: 'a. Párpados' }, { type: 'chk', code: '2a' },
    { type: 'reg', rs: 5, txt: '4. OROFAR.' }, { type: 'sub', txt: 'a. Labios' }, { type: 'chk', code: '4a' },
    { type: 'sub', txt: 'd. Senos paran.' }, { type: 'chk', code: '5d' },
    { type: 'sub', txt: 'b. Pared abdom.' }, { type: 'chk', code: '9b' },
    { type: 'sub', txt: 'b. Miembros sup.' }, { type: 'chk', code: '12b' }
  ],
  [
    { type: 'sub', txt: 'b. Conjuntivas' }, { type: 'chk', code: '2b' },
    { type: 'sub', txt: 'b. Lengua' }, { type: 'chk', code: '4b' },
    { type: 'reg', rs: 2, txt: '6. CUELLO' }, { type: 'sub', txt: 'a. Tiroides/mas' }, { type: 'chk', code: '6a' },
    { type: 'reg', rs: 3, txt: '10. COLUMNA' }, { type: 'sub', txt: 'a. Flexibilidad' }, { type: 'chk', code: '10a' },
    { type: 'sub', txt: 'c. Miembros inf.' }, { type: 'chk', code: '12c' }
  ],
  [
    { type: 'sub', txt: 'c. Pupilas' }, { type: 'chk', code: '2c' },
    { type: 'sub', txt: 'c. Faringe' }, { type: 'chk', code: '4c' },
    { type: 'sub', txt: 'b. Movilidad' }, { type: 'chk', code: '6b' },
    { type: 'sub', txt: 'b. Desviación' }, { type: 'chk', code: '10b' },
    { type: 'reg', rs: 4, txt: '13. NEUROLÓG.' }, { type: 'sub', txt: 'a. Fuerza' }, { type: 'chk', code: '13a' }
  ],
  [
    { type: 'sub', txt: 'd. Córnea' }, { type: 'chk', code: '2d' },
    { type: 'sub', txt: 'd. Amígdalas' }, { type: 'chk', code: '4d' },
    { type: 'reg', rs: 2, txt: '7. TÓRAX (Cor)' }, { type: 'sub', txt: 'a. Mamas' }, { type: 'chk', code: '7a' },
    { type: 'sub', txt: 'c. Dolor' }, { type: 'chk', code: '10c' },
    { type: 'sub', txt: 'b. Sensibilidad' }, { type: 'chk', code: '13b' }
  ],
  [
    { type: 'sub', txt: 'e. Motilidad' }, { type: 'chk', code: '2e' },
    { type: 'sub', txt: 'e. Dentadura' }, { type: 'chk', code: '4e' },
    { type: 'sub', txt: 'b. Corazón' }, { type: 'chk', code: '7b' },
    { type: 'empty', cs: 3 },
    { type: 'sub', txt: 'c. Marcha' }, { type: 'chk', code: '13c' }
  ],
  [
    { type: 'instr', cs: 12, txt: 'SI EXISTE EVIDENCIA DE PATOLOGÍA MARCAR CON "X" Y DESCRIBIR EN LA SIGUIENTE SECCIÓN COLOCANDO EL NUMERAL' },
    { type: 'sub', txt: 'd. Reflejos' }, { type: 'chk', code: '13d' }
  ]
];

// ============================================================================
// HELPERS
// ============================================================================
const fmtF = (fecha: any): string => {
  if (!fecha) return '-';
  if (fecha.seconds) return new Date(fecha.seconds * 1000).toLocaleDateString('es-EC');
  if (fecha instanceof Date) return fecha.toLocaleDateString('es-EC');
  return String(fecha);
};

const fmtFH = (fecha: any): string => {
  if (!fecha) return '-';
  const d = fecha.seconds ? new Date(fecha.seconds * 1000) : fecha instanceof Date ? fecha : null;
  return d ? d.toLocaleString('es-EC') : String(fecha);
};

const fmtHora = (fecha: any): string => {
  if (!fecha) return '-';
  const d = fecha.seconds ? new Date(fecha.seconds * 1000) : fecha instanceof Date ? fecha : null;
  return d ? d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '-';
};

// ============================================================================
// COMPONENT
// ============================================================================
interface Props {
  trabajadorId: string;
}

export default function FichaTrabajador({ trabajadorId }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [trabajador, setTrabajador] = useState<Trabajador | null>(null);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionMedica[]>([]);
  const [permisos, setPermisos] = useState<PermisoMedico[]>([]);
  const [atenciones, setAtenciones] = useState<any[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenExamen[]>([]);
  const [totalPatologicos, setTotalPatologicos] = useState(0);
  const [cargando, setCargando] = useState(true);

  // Drawer evaluacion
  const [evDrawer, setEvDrawer] = useState<any>(null);
  const [busquedaEval, setBusquedaEval] = useState('');

  // Modal orden examen
  const [ordenDetalle, setOrdenDetalle] = useState<OrdenExamen | null>(null);

  // Subida certificado permiso
  const certInputRef = useRef<HTMLInputElement>(null);
  const [subiendoCert, setSubiendoCert] = useState<string | null>(null);

  // Editar / eliminar permiso
  const [editPermiso, setEditPermiso] = useState<PermisoMedico | null>(null);
  const [editPatch, setEditPatch] = useState<{ desde: string; dias: number; horas: number; motivo: string; tipo: TipoPermiso }>({ desde: '', dias: 1, horas: 3, motivo: '', tipo: 'reposo_interno' });
  const [guardandoPermiso, setGuardandoPermiso] = useState(false);

  // Dropdown nueva evaluación
  const [menuEvalOpen, setMenuEvalOpen] = useState(false);

  // Modal editar trabajador
  const [modalEditar, setModalEditar] = useState(false);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [datosEdicion, setDatosEdicion] = useState({
    primerNombre: '', segundoNombre: '', primerApellido: '', segundoApellido: '',
    cedula: '', sexo: 'M', puestoTrabajo: '',
    fechaNacimiento: '', telefono: '', departamento: '', correo: '', fechaIngreso: '',
  });

  // ----------------------------------------------------------------
  // CARGA DE DATOS
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!trabajadorId) return;
    setCargando(true);
    (async () => {
      try {
        const [workerSnap, evSnap, permisosSnap, atencionSnap, patSnap, ords] = await Promise.all([
          getDoc(doc(db, 'trabajadores', trabajadorId)),
          getDocs(query(collection(db, 'evaluaciones'), where('trabajadorId', '==', trabajadorId))),
          getDocs(query(collection(db, 'permisos'), where('trabajadorId', '==', trabajadorId))),
          getDocs(query(collection(db, 'atenciones'), where('trabajadorId', '==', trabajadorId))),
          getDocs(query(collection(db, 'examenes'), where('trabajadorId', '==', trabajadorId), where('estado', '==', 'patologico'))).catch(() => ({ size: 0 })),
          getOrdenes().catch(() => [] as OrdenExamen[]),
        ]);

        if (workerSnap.exists()) {
          setTrabajador({ id: workerSnap.id, ...workerSnap.data() } as Trabajador);
        }

        const evals: EvaluacionMedica[] = evSnap.docs.map(d => ({ id: d.id, ...d.data() } as EvaluacionMedica));
        evals.sort((a: any, b: any) => {
          const dA = a.fecha?.seconds ?? new Date(a.fecha).getTime() / 1000;
          const dB = b.fecha?.seconds ?? new Date(b.fecha).getTime() / 1000;
          return dB - dA;
        });
        setEvaluaciones(evals);

        const perms: PermisoMedico[] = permisosSnap.docs.map(d => ({ id: d.id, ...d.data() } as PermisoMedico));
        perms.sort((a, b) => toDate(b.desde).getTime() - toDate(a.desde).getTime());
        setPermisos(perms);

        const atens = atencionSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        atens.sort((a: any, b: any) => (b.fecha?.seconds ?? 0) - (a.fecha?.seconds ?? 0));
        setAtenciones(atens);

        setOrdenes((ords as OrdenExamen[]).filter(o => o.trabajadorId === trabajadorId));
        setTotalPatologicos((patSnap as any).size ?? 0);
      } catch (err) {
        console.error('Error al cargar FichaTrabajador:', err);
      } finally {
        setCargando(false);
      }
    })();
  }, [trabajadorId]);

  // ----------------------------------------------------------------
  // MODAL EDITAR
  // ----------------------------------------------------------------
  const abrirModalEditar = () => {
    if (!trabajador) return;
    setDatosEdicion({
      primerNombre: trabajador.primerNombre || '',
      segundoNombre: (trabajador as any).segundoNombre || '',
      primerApellido: trabajador.primerApellido || '',
      segundoApellido: (trabajador as any).segundoApellido || '',
      cedula: trabajador.cedula || '',
      sexo: trabajador.sexo || 'M',
      puestoTrabajo: trabajador.puestoTrabajo || '',
      fechaNacimiento: (trabajador as any).fechaNacimiento || '',
      telefono: (trabajador as any).telefono || '',
      departamento: (trabajador as any).departamento || '',
      correo: (trabajador as any).correo || '',
      fechaIngreso: (trabajador as any).fechaIngreso || '',
    });
    setModalEditar(true);
  };

  const guardarEdicion = async () => {
    if (!datosEdicion.primerNombre.trim() || !datosEdicion.primerApellido.trim() || !datosEdicion.puestoTrabajo.trim()) {
      toast.warning('Nombre, apellido y puesto de trabajo son obligatorios.');
      return;
    }
    setGuardandoEdicion(true);
    try {
      await updateDoc(doc(db, 'trabajadores', trabajadorId), { ...datosEdicion, updatedAt: new Date(), updatedBy: user?.uid || '' });
      setTrabajador(prev => prev ? { ...prev, ...datosEdicion } as any : prev);
      setModalEditar(false);
      toast.success('Datos del trabajador actualizados.');
    } catch {
      toast.error('No se pudo guardar. Intenta nuevamente.');
    } finally {
      setGuardandoEdicion(false);
    }
  };

  // ----------------------------------------------------------------
  // SUBIR CERTIFICADO PERMISO
  // ----------------------------------------------------------------
  const subirCertificado = async (permisoId: string, file: File) => {
    setSubiendoCert(permisoId);
    try {
      const path = `permisos/${permisoId}/${file.name}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      await updateDoc(doc(db, 'permisos', permisoId), { certAdjunto: true, certNombreArchivo: file.name, certUrl: url });
      setPermisos(prev => prev.map(p => p.id === permisoId ? { ...p, certAdjunto: true, certNombreArchivo: file.name, certUrl: url } as any : p));
      toast.success('Certificado adjuntado y permiso justificado.');
    } catch {
      toast.error('No se pudo subir el certificado.');
    } finally {
      setSubiendoCert(null);
    }
  };

  // ----------------------------------------------------------------
  // ELIMINAR ORDEN EXAMEN
  // ----------------------------------------------------------------
  const eliminarOrdenExamen = async (id: string) => {
    if (!window.confirm('¿Eliminar este examen programado?')) return;
    try {
      await eliminarOrden(id);
      setOrdenes(prev => prev.filter(o => o.id !== id));
      toast.success('Examen eliminado.');
    } catch {
      toast.error('No se pudo eliminar.');
    }
  };

  // ----------------------------------------------------------------
  // EDITAR / ELIMINAR PERMISO
  // ----------------------------------------------------------------
  const abrirEditPermiso = (p: PermisoMedico) => {
    setEditPatch({
      tipo: p.tipo,
      desde: toDate(p.desde).toISOString().slice(0, 10),
      dias: p.dias || 1,
      horas: p.horas || 3,
      motivo: p.motivo || '',
    });
    setEditPermiso(p);
  };

  const guardarEditPermiso = async () => {
    if (!editPermiso?.id) return;
    setGuardandoPermiso(true);
    try {
      const meta = TIPOS_PERMISO[editPatch.tipo];
      const dDesde = new Date(editPatch.desde + 'T08:00:00');
      const dHasta = new Date(dDesde);
      if (editPatch.tipo !== 'cita' && editPatch.dias > 1) dHasta.setDate(dHasta.getDate() + editPatch.dias - 1);
      const { Timestamp } = await import('firebase/firestore');
      const patch: Partial<PermisoMedico> = {
        tipo: editPatch.tipo,
        desde: Timestamp.fromDate(dDesde),
        hasta: Timestamp.fromDate(dHasta),
        dias: editPatch.tipo === 'cita' ? 0 : editPatch.dias,
        horas: editPatch.tipo === 'cita' ? editPatch.horas : 0,
        motivo: editPatch.motivo,
        certAdjunto: !meta.requiereCert ? true : editPermiso.certAdjunto,
      };
      await actualizarPermiso(editPermiso.id, patch);
      setPermisos(prev => prev.map(p => p.id === editPermiso.id ? { ...p, ...patch } as PermisoMedico : p));
      setEditPermiso(null);
      toast.success('Permiso actualizado.');
    } catch {
      toast.error('No se pudo actualizar.');
    } finally {
      setGuardandoPermiso(false);
    }
  };

  const handleEliminarPermiso = async (id: string) => {
    if (!window.confirm('¿Eliminar este permiso? Esta acción no se puede deshacer.')) return;
    try {
      await eliminarPermiso(id);
      setPermisos(prev => prev.filter(p => p.id !== id));
      toast.success('Permiso eliminado.');
    } catch {
      toast.error('No se pudo eliminar.');
    }
  };

  // ----------------------------------------------------------------
  // HELPERS PDF
  // ----------------------------------------------------------------
  const hasFisico = (ev: any, code: string) => ev.examenFisicoHallazgos?.some((h: any) => h.codigo === code);

  // ----------------------------------------------------------------
  // PDF SO-RE-38
  // ----------------------------------------------------------------
  const generarPDF = (evParam?: any) => {
    const ev: any = evParam || evDrawer;
    if (!ev || !trabajador) return;

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

    const checkPage = (needed: number) => {
      if (y + needed > 285) { pdf.addPage(); y = 7; }
    };

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

    // PÁGINA 1
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, halign: 'center', fontSize: 8 }, columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 33 } },
      body: [
        [{ content: '', rowSpan: 3, styles: { fontStyle: 'bold', fontSize: 11, valign: 'middle' } }, { content: 'HISTORIA CLÍNICA OCUPACIONAL:\nEVALUACIÓN PERIÓDICA', rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, valign: 'middle' } }, { content: 'Código:   SO-RE-38', styles: { fontSize: 7, halign: 'left' } }],
        [{ content: 'Revisión:  1', styles: { fontSize: 7, halign: 'left' } }],
        [{ content: 'MACROPROCESO: PLANIFICACIÓN, SEGURIDAD Y AMBIENTE', styles: { fontSize: 6, fontStyle: 'bold' } }, { content: 'Página:    1 de 2', styles: { fontSize: 7, halign: 'left' } }]
      ],
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    secHeader('A. DATOS DEL ESTABLECIMIENTO - EMPRESA Y USUARIO');
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: baseStyles, headStyles,
      head: [['INSTITUCIÓN DEL SISTEMA', 'RUC', 'CIU', 'ESTABLECIMIENTO DE SALUD', 'N° HISTORIA CLÍNICA', 'N° ARCHIVO']],
      body: [['CEM AUSTROGAS', '190070301001', '4661', 'MEDICINA OCUPACIONAL', ev.numeroHistoriaClinica || trabajador.cedula, ev.numeroArchivo || '-']],
    });
    y = (pdf as any).lastAutoTable.finalY;
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: baseStyles, headStyles,
      head: [['PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'SEXO', 'PUESTO DE TRABAJO (CIUO)']],
      body: [[trabajador.primerApellido, (trabajador as any).segundoApellido || '-', trabajador.primerNombre, (trabajador as any).segundoNombre || '-', trabajador.sexo, trabajador.puestoTrabajo]],
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    secHeader('B. MOTIVO DE CONSULTA');
    textoLibre((ev.motivoConsulta || 'ACTUALIZACIÓN DE FICHA OCUPACIONAL').toUpperCase(), 6);
    y += 1;

    secHeader('C. ANTECEDENTES PERSONALES');
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(204, 255, 204); pdf.setDrawColor(0); pdf.rect(M, y, CW, 4, 'FD');
    pdf.text('ANTECEDENTES CLÍNICOS Y QUIRÚRGICOS', M + 1.5, y + 3); y += 4;

    if (ev.antecedentesClinicosQ === true && ev.antecedentesClinicosLista?.length > 0) {
      const lineasClin = ev.antecedentesClinicosLista.map((ac: any) => {
        let linea = `Antecedentes Clínicos: ${ac.enfermedad || '?'}`;
        if (ac.desdeCuando) linea += ` (desde ${ac.desdeCuando})`;
        if (ac.tomaMedicacion && ac.medicacionNombre) linea += ` — Medicación: ${ac.medicacionNombre}${ac.medicacionDosis ? ' ' + ac.medicacionDosis : ''}${ac.medicacionFrecuencia ? ' ' + ac.medicacionFrecuencia : ''}`;
        if (ac.complicaciones) linea += ` — Comp: ${ac.complicaciones}`;
        return linea;
      }).join('\n');
      const lineasQ = ev.antecedentesQuirurgicosQ === true && ev.antecedentesQuirurgicosLista?.length > 0
        ? '\nAntecedentes quirúrgicos: ' + ev.antecedentesQuirurgicosLista.map((aq: any) => `${aq.procedimiento || '?'} (${aq.fechaAproximada || '?'})${aq.secuelas ? ', secuelas: ' + aq.secuelas : ''}`).join('; ')
        : '';
      const lineasAl = ev.alergiasTiene === true && ev.alergias?.length > 0
        ? '\nAlergias: ' + ev.alergias.map((al: any) => `${al.alergeno || '?'} — ${al.intensidadReaccion || '?'}`).join('; ')
        : '';
      textoLibre((lineasClin + lineasQ + lineasAl) || 'Sin antecedentes relevantes.', 5);
    } else if (ev.antecedentesClinicosQ === false) {
      const lineasQ = ev.antecedentesQuirurgicosQ === true && ev.antecedentesQuirurgicosLista?.length > 0
        ? 'Antecedentes quirúrgicos: ' + ev.antecedentesQuirurgicosLista.map((aq: any) => `${aq.procedimiento || '?'} (${aq.fechaAproximada || '?'})`).join('; ')
        : '';
      const lineasAl = ev.alergiasTiene === true && ev.alergias?.length > 0
        ? '\nAlergias: ' + ev.alergias.map((al: any) => `${al.alergeno || '?'} — ${al.intensidadReaccion || '?'}`).join('; ')
        : '';
      textoLibre(('Sin antecedentes clínicos. ' + lineasQ + lineasAl) || 'Sin antecedentes relevantes reportados.', 5);
    } else {
      textoLibre(ev.antecedentesClinicosQuirurgicos || 'Sin antecedentes relevantes reportados.', 5);
    }

    if (ev.habitosToxicos && ev.habitosToxicos.length > 0) {
      checkPage(20);
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 },
        head: [['CONSUMOS NOCIVOS', 'SI', 'NO', 'TIEMPO CONSUMO', 'CANTIDAD', 'EX CONSUMIDOR', 'TIEMPO ABSTINENCIA']],
        body: ev.habitosToxicos.map((h: any) => [h.tipo.toUpperCase(), h.consume ? 'X' : '', h.consume ? '' : 'X', h.tiempoConsumo || '-', h.cantidad || '-', h.exConsumidor ? 'X' : '', h.tiempoAbstinencia || '-']),
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 5: { halign: 'center' } },
      });
      y = (pdf as any).lastAutoTable.finalY;
    }

    if (ev.estiloVida) {
      const tieneMedicacion = (ev.medicacionesHabituales?.length > 0) || !!ev.estiloVida.medicacionHabitual;
      const medTexto = ev.medicacionesHabituales?.length > 0
        ? ev.medicacionesHabituales.map((m: any) => `${m.nombre}${m.dosis ? ' ' + m.dosis : ''}${m.frecuencia ? ' ' + m.frecuencia : ''}${m.horario ? ' (' + m.horario + ')' : ''}`).join('; ')
        : ev.estiloVida.medicacionHabitual || '-';
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 },
        head: [['ESTILO DE VIDA', 'SI', 'NO', '¿CUÁL?', 'TIEMPO / CANTIDAD']],
        body: [
          ['ACTIVIDAD FÍSICA', ev.estiloVida.actividadFisica ? 'X' : '', ev.estiloVida.actividadFisica ? '' : 'X', ev.estiloVida.tipoActividad || '-', ev.estiloVida.tiempoCantidad || '-'],
          ['MEDICACIÓN HABITUAL', tieneMedicacion ? 'X' : '', tieneMedicacion ? '' : 'X', medTexto, '-']
        ],
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
      });
      y = (pdf as any).lastAutoTable.finalY;
    }
    y += 1;

    autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fillColor: colorSecundario }, head: [['Incidentes']], body: [[ev.incidentes || 'NINGUNO']] });
    y = (pdf as any).lastAutoTable.finalY;

    const descAccidente = ev.accidentesTrabajo?.descripcion || 'NINGUNO';
    const califAccidente = ev.accidentesTrabajo?.descripcion ? (ev.accidentesTrabajo.calificado ? 'SÍ' : 'NO') : '-';
    autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fillColor: colorSecundario }, head: [['Accidentes de trabajo', 'CALIFICADO IESS', 'ESPECIFICACIÓN', 'OBSERVACIONES']], body: [[descAccidente, califAccidente, ev.accidentesTrabajo?.especificacion || '-', ev.accidentesTrabajo?.observaciones || '-']], columnStyles: { 1: { halign: 'center' } } });
    y = (pdf as any).lastAutoTable.finalY;

    const descEnfermedad = ev.enfermedadesProfesionales?.descripcion || 'El trabajador/a no ha sufrido o reportado enfermedades profesionales hasta el momento.';
    const califEnfermedad = ev.enfermedadesProfesionales?.descripcion ? (ev.enfermedadesProfesionales.calificada ? 'SÍ' : 'NO') : '-';
    autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fillColor: colorSecundario }, head: [['Enfermedad Profesional', 'CALIFICADA IESS', 'ESPECIFICACIÓN', 'OBSERVACIONES']], body: [[descEnfermedad, califEnfermedad, ev.enfermedadesProfesionales?.especificacion || '-', ev.enfermedadesProfesionales?.observaciones || '-']], columnStyles: { 1: { halign: 'center' } } });
    y = (pdf as any).lastAutoTable.finalY + 2;

    checkPage(30);
    secHeader('D. ANTECEDENTES FAMILIARES');
    const dBody: any[][] = [];
    for (let r = 0; r < 2; r++) {
      const row: any[] = [];
      for (let c = 0; c < 4; c++) {
        const idx = r * 4 + c;
        const tipo = TIPOS_ANTECEDENTES_FAMILIARES[idx];
        const hasIt = ev.antecedentesFamiliares?.find((a: any) => a.tipo === tipo);
        row.push({ content: `${idx + 1}. ${tipo}`, styles: { fillColor: colorTerciario } });
        row.push({ content: hasIt ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', fillColor: '#ffffff' } });
      }
      dBody.push(row);
    }
    autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 5.5, cellPadding: 1 }, body: dBody, columnStyles: { 1: { cellWidth: 4 }, 3: { cellWidth: 4 }, 5: { cellWidth: 4 }, 7: { cellWidth: 4 } } });
    y = (pdf as any).lastAutoTable.finalY;

    if (ev.antecedentesFamiliares && ev.antecedentesFamiliares.length > 0) {
      const famPorTipo: Record<string, string[]> = {};
      ev.antecedentesFamiliares.forEach((af: any) => { if (!famPorTipo[af.tipo]) famPorTipo[af.tipo] = []; famPorTipo[af.tipo].push(`${af.parentesco || '?'}${af.descripcion ? ' con ' + af.descripcion : ''}`); });
      textoLibre(Object.entries(famPorTipo).map(([tipo, entries]) => `${tipo}: ${entries.join(', ')}`).join('\n'), 5); y += 1;
    } else { textoLibre('No se refieren antecedentes familiares de importancia.', 5); y += 1; }

    if (ev.factoresRiesgo) {
      checkPage(25); secHeader('E. FACTORES DE RIESGOS DEL PUESTO DE TRABAJO');
      const fr = ev.factoresRiesgo;
      autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 }, head: [['PUESTO DE TRABAJO / ÁREA', 'ACTIVIDADES', 'TIEMPO DE TRABAJO (MESES)']], body: [[fr.puestoArea || trabajador.puestoTrabajo, fr.actividades || '-', fr.tiempoTrabajoMeses || '-']] });
      y = (pdf as any).lastAutoTable.finalY;
      const categorias = [
        { nombre: 'FÍSICO', items: fr.fisicos || [] }, { nombre: 'MECÁNICO', items: fr.mecanicos || [] },
        { nombre: 'QUÍMICO', items: fr.quimicos || [] }, { nombre: 'BIOLÓGICO', items: fr.biologicos || [] },
        { nombre: 'ERGONÓMICO', items: fr.ergonomicos || [] }, { nombre: 'PSICOSOCIAL', items: fr.psicosociales || [] },
      ].filter(c => c.items.length > 0);
      if (categorias.length > 0) { autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6 }, headStyles: { ...headStyles, fontSize: 5.5 }, head: [['CATEGORÍA', 'FACTORES DE RIESGO IDENTIFICADOS']], body: categorias.map(c => [c.nombre, c.items.join(', ')]), columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold' } } }); y = (pdf as any).lastAutoTable.finalY; }
      autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6 }, headStyles: { ...headStyles, fontSize: 5.5 }, head: [['MEDIDAS PREVENTIVAS / RECOMENDACIONES']], body: [[fr.medidasPreventivas || (Array.isArray(fr.recomendaciones) ? fr.recomendaciones.join('; ') : fr.recomendaciones) || 'Ninguna descrita']] });
      y = (pdf as any).lastAutoTable.finalY; y += 2;
    }

    // PÁGINA 2
    pdf.addPage(); y = 7;
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, halign: 'center', fontSize: 8 }, columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 33 } },
      body: [
        [{ content: '', rowSpan: 3, styles: { fontStyle: 'bold', fontSize: 11, valign: 'middle' } }, { content: 'HISTORIA CLÍNICA OCUPACIONAL:\nEVALUACIÓN PERIÓDICA', rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, valign: 'middle' } }, { content: 'Código:   SO-RE-38', styles: { fontSize: 7, halign: 'left' } }],
        [{ content: 'Revisión:  1', styles: { fontSize: 7, halign: 'left' } }],
        [{ content: 'PROCESO: GESTIÓN DE SEGURIDAD INDUSTRIAL Y MEDICINA OCUPACIONAL', styles: { fontSize: 6, fontStyle: 'bold' } }, { content: 'Página:    2 de 2', styles: { fontSize: 7, halign: 'left' } }]
      ],
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    secHeader('F. ENFERMEDAD ACTUAL');
    textoLibre(ev.enfermedadActual || 'PACIENTE ASINTOMÁTICO AL MOMENTO DE LA VALORACIÓN.', 8); y += 1;

    secHeader('G. REVISIÓN DE ÓRGANOS Y SISTEMAS');
    const gBody: any[][] = [];
    for (let r = 0; r < 2; r++) {
      const row: any[] = [];
      for (let c = 0; c < 5; c++) {
        const idx = r * 5 + c;
        const sysName = SISTEMAS[idx];
        const isChecked = ev.revisionSistemasSeleccionados?.includes(sysName);
        row.push({ content: `${idx + 1}. ${sysName}`, styles: { fillColor: colorTerciario } });
        row.push({ content: isChecked ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', fillColor: '#ffffff' } });
      }
      gBody.push(row);
    }
    autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 5.5, cellPadding: 1 }, body: gBody, columnStyles: { 1: { cellWidth: 4 }, 3: { cellWidth: 4 }, 5: { cellWidth: 4 }, 7: { cellWidth: 4 }, 9: { cellWidth: 4 } } });
    y = (pdf as any).lastAutoTable.finalY;

    if (ev.revisionSistemasSeleccionados && ev.revisionSistemasSeleccionados.length > 0) {
      let textContent: string;
      if (ev.revisionSistemasDescripciones) {
        textContent = ev.revisionSistemasSeleccionados.map((s: string) => { const num = SISTEMAS.indexOf(s) + 1; return `${num}. ${s}: ${ev.revisionSistemasDescripciones[s] || '-'}`; }).join('\n');
      } else {
        const nums = ev.revisionSistemasSeleccionados.map((s: string) => SISTEMAS.indexOf(s) + 1).sort((a: number, b: number) => a - b);
        const descripciones = (ev.revisionSistemasDescripcion || '').split('\n').filter((l: string) => l.trim() !== '');
        const lineas: string[] = [];
        nums.forEach((num: number, index: number) => { lineas.push(`${num}. ${(descripciones[index] || '').replace(/^\d+[\.\-\)]?\s*/, '')}`); });
        if (descripciones.length > nums.length) lineas.push(...descripciones.slice(nums.length));
        textContent = lineas.join('\n');
      }
      textoLibre(textContent, 8);
    } else { textoLibre('Paciente no refiere síntomas adicionales.', 5); }
    y += 1;

    checkPage(60);
    secHeader('I. EXAMEN FÍSICO REGIONAL');
    const pdfFisicoRows = FISICO_ROWS.map(row => row.map((cell: any) => {
      if (cell.type === 'reg') return { content: '', textToRotate: cell.txt, rowSpan: cell.rs, styles: { fillColor: colorTerciario, halign: 'center', valign: 'middle' } };
      if (cell.type === 'sub') return { content: cell.txt, styles: { fillColor: '#ffffff' } };
      if (cell.type === 'chk') return { content: hasFisico(ev, cell.code as string) ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', fillColor: '#ffffff' } };
      if (cell.type === 'empty') return { content: '', rowSpan: cell.rs || 1, colSpan: cell.cs || 1, styles: { fillColor: '#ffffff', lineWidth: 0 } };
      if (cell.type === 'instr') return { content: cell.txt, colSpan: cell.cs, styles: { fillColor: '#f8f8f8', textColor: negro, halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 5.5 } };
      return { content: '' };
    }));
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 5.5, cellPadding: 0.8 }, bodyStyles: { minCellHeight: 6.5 },
      headStyles: { fillColor: colorTerciario, textColor: negro, fontSize: 6 },
      columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 23 }, 2: { cellWidth: 4, halign: 'center' }, 3: { cellWidth: 9 }, 4: { cellWidth: 23 }, 5: { cellWidth: 4, halign: 'center' }, 6: { cellWidth: 9 }, 7: { cellWidth: 23 }, 8: { cellWidth: 4, halign: 'center' }, 9: { cellWidth: 9 }, 10: { cellWidth: 23 }, 11: { cellWidth: 4, halign: 'center' }, 12: { cellWidth: 9 }, 13: { cellWidth: 23 }, 14: { cellWidth: 4, halign: 'center' } },
      head: [[{ content: 'REGIONES', colSpan: 15, styles: { halign: 'left', fillColor: colorTerciario } }]],
      body: pdfFisicoRows as any,
      didDrawCell: function(data) {
        const raw = data.cell.raw as any;
        if (data.section === 'body' && raw && raw.textToRotate) {
          pdf.setTextColor(0); pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold');
          const str = String(raw.textToRotate);
          const realHeight = 6.5 * (raw.rowSpan || 1);
          const textWidth = pdf.getTextWidth(str);
          const centroX = data.cell.x + (data.cell.width / 2);
          const centroY = data.cell.y + (realHeight / 2);
          if (textWidth > realHeight - 2) {
            const lineas = pdf.splitTextToSize(str, realHeight - 2);
            pdf.text(lineas[0], centroX + 1.5, centroY + (pdf.getTextWidth(lineas[0]) / 2), { angle: 90 });
            if (lineas[1]) pdf.text(lineas[1], centroX - 0.5, centroY + (pdf.getTextWidth(lineas[1]) / 2), { angle: 90 });
          } else {
            pdf.text(str, centroX + 0.8, centroY + (textWidth / 2), { angle: 90 });
          }
        }
      }
    });
    y = (pdf as any).lastAutoTable.finalY;

    if (ev.examenFisicoHallazgos && ev.examenFisicoHallazgos.length > 0) {
      textoLibre(`Observaciones:\n${ev.examenFisicoHallazgos.map((h: any) => `${h.codigo}. ${h.region || ''}, ${h.subregion || ''}: ${h.descripcion || '-'}`).join('\n')}`, 6); y += 1;
    } else { textoLibre('Sin hallazgos patológicos al examen físico regional.', 5); y += 1; }

    if (ev.examenesComplementarios && ev.examenesComplementarios.length > 0) {
      checkPage(15); secHeader('J. RESULTADOS DE EXÁMENES GENERALES Y ESPECÍFICOS');
      autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 }, head: [['EXAMEN', 'FECHA\naaaa / mm / dd', 'RESULTADO']], body: ev.examenesComplementarios.map((ex: any) => [ex.nombre, ex.fecha, ex.resultado]) });
      y = (pdf as any).lastAutoTable.finalY + 1;
    }

    checkPage(20); secHeader('K. DIAGNÓSTICO                    PRE= PRESUNTIVO          DEF= DEFINITIVO');
    if (ev.diagnosticos && ev.diagnosticos.length > 0) {
      autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5, halign: 'center' }, headStyles: { ...headStyles, fontSize: 6, halign: 'center' }, head: [['N°', 'DESCRIPCIÓN', 'CIE', 'PRE', 'DEF']], body: ev.diagnosticos.map((dx: any, i: number) => [`${i + 1}`, { content: dx.descripcion, styles: { halign: 'left' } }, dx.cie || '-', dx.tipo === 'presuntivo' ? 'X' : '', dx.tipo === 'definitivo' ? 'X' : '']), columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 10 }, 4: { cellWidth: 10 } } });
      y = (pdf as any).lastAutoTable.finalY + 1;
    } else { textoLibre('PACIENTE SANO.', 5); y += 1; }

    checkPage(20); secHeader('L. APTITUD MÉDICA PARA EL TRABAJO');
    autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, halign: 'center', fontSize: 7 }, headStyles: { ...headStyles, halign: 'center', fontSize: 6.5 }, head: [['APTO', 'APTO EN OBSERVACIÓN', 'APTO CON LIMITACIONES', 'NO APTO']], body: [[(!ev.aptitudMedica || ev.aptitudMedica === 'apto') ? 'X' : '', ev.aptitudMedica === 'aptoObservacion' ? 'X' : '', ev.aptitudMedica === 'aptoLimitaciones' ? 'X' : '', ev.aptitudMedica === 'noApto' ? 'X' : '']] });
    y = (pdf as any).lastAutoTable.finalY;
    autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5, halign: 'left' }, body: [[`Observación:  ${ev.aptitudObservacion || '-'}`], [`Limitación:   ${ev.aptitudLimitaciones || '-'}`]] });
    y = (pdf as any).lastAutoTable.finalY + 1;

    secHeader('M. RECOMENDACIONES Y/O TRATAMIENTO');
    textoLibre((Array.isArray(ev.recomendaciones) ? ev.recomendaciones.join('; ') + (ev.recomendacionesOtras ? `; ${ev.recomendacionesOtras}` : '') : ev.recomendaciones || 'Ninguna particular al momento.'), 8); y += 2;

    checkPage(15);
    pdf.setFillColor(248, 248, 248); pdf.setDrawColor(0);
    const certText = 'CERTIFICO QUE LO ANTERIORMENTE EXPRESADO EN RELACIÓN A MI ESTADO DE SALUD ES VERDAD. SE ME HA INFORMADO LAS MEDIDAS PREVENTIVAS A TOMAR PARA DISMINUIR O MITIGAR LOS RIESGOS RELACIONADOS CON MI ACTIVIDAD LABORAL.';
    const certLines = pdf.splitTextToSize(certText, CW - 3); const certH = certLines.length * 3 + 3;
    pdf.rect(M, y, CW, certH, 'FD'); pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.text(certLines, M + 1.5, y + 3); y += certH + 3;

    checkPage(25); secHeader('N. DATOS DEL PROFESIONAL                                                                             O. FIRMA DEL USUARIO');
    autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5, halign: 'center' }, headStyles: { ...headStyles, fontSize: 6, halign: 'center' }, head: [['FECHA\naaaa-mm-dd', 'HORA', 'NOMBRES Y APELLIDOS', 'CÓDIGO', 'FIRMA Y SELLO', 'FIRMA DEL USUARIO']], body: [[fmtF(ev.fecha), fmtHora(ev.fecha), (ev.medicoNombre || 'MÉDICO OCUPACIONAL').toUpperCase(), ev.medicoCedula || '-', '', '']], bodyStyles: { minCellHeight: 18, valign: 'bottom', halign: 'center' } });
    pdf.save(`SO-RE-38_${trabajador.primerApellido}_${trabajador.primerNombre}_${fmtF(ev.fecha)}.pdf`);
  };

  // ----------------------------------------------------------------
  // PDF SO-RE-40 (RETIRO)
  // ----------------------------------------------------------------
  const generarPDFRetiro = (evParam?: any) => {
    const ev: any = evParam || evDrawer;
    if (!ev || !trabajador) return;

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

    const secHeaderR = (texto: string, bgColor = colorPrimario) => {
      pdf.setFillColor(bgColor); pdf.setDrawColor(0);
      pdf.rect(M, y, CW, 5, 'FD');
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
      pdf.text(texto, M + 1.5, y + 3.5);
      y += 5;
    };

    const textoLibreR = (texto: string, minH = 6) => {
      pdf.setDrawColor(0); pdf.setFontSize(7); pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(texto || '-', CW - 3);
      const h = Math.max(minH, lines.length * 3 + 2);
      pdf.rect(M, y, CW, h, 'S');
      pdf.text(lines, M + 1.5, y + 3);
      y += h;
    };

    const paginaHeader = (pagina: string) => {
      const tableStartY = y;
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, halign: 'center', fontSize: 8 }, columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 33 } }, body: [[{ content: '', rowSpan: 3, styles: { fontSize: 11, valign: 'middle' } }, { content: 'HISTORIA CLÍNICA:\nEVALUACIÓN MÉDICA DE RETIRO', rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, valign: 'middle' } }, { content: 'Código:   SO-RE-40', styles: { fontSize: 7, halign: 'left' } }], [{ content: 'Revisión:  1', styles: { fontSize: 7, halign: 'left' } }], [{ content: 'MACROPROCESO:  PLANIFICACIÓN, SEGURIDAD Y AMBIENTE', styles: { fontSize: 6, fontStyle: 'bold' } }, { content: pagina, styles: { fontSize: 7, halign: 'left' } }]] });
      pdf.addImage(LOGO_EMPRESA, 'PNG', M + 1, tableStartY + 1, 40, 12);
      y += 2;
    };

    const siNoCalificadoR = (calificado: boolean | null, especificacion: string, observaciones: string) => {
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6 }, headStyles: head, body: [[{ content: 'FUE CALIFICADO POR EL INSTITUTO DE SEGURIDAD SOCIAL CORRESPONDIENTE:', styles: { fontStyle: 'bold', cellWidth: 75 } }, { content: 'SI', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 7 } }, { content: calificado === true ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 7 } }, { content: 'ESPECIFICAR:', styles: { fontStyle: 'bold', cellWidth: 22 } }, { content: especificacion || '', styles: { cellWidth: 30 } }, { content: 'NO', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 7 } }, { content: calificado === false ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 7 } }]] });
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6 }, body: [[{ content: 'Observaciones:', styles: { fontStyle: 'bold', cellWidth: 25 } }, { content: observaciones || 'Ninguno' }]] });
      pdf.setDrawColor(0); pdf.rect(M, y, CW, 6, 'S'); y += 6;
    };

    paginaHeader('Página:    1 de 2');

    secHeaderR('A. DATOS DEL ESTABLECIMIENTO - EMPRESA Y USUARIO');
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head, head: [['INSTITUCIÓN DEL SISTEMA O NOMBRE DE LA EMPRESA', 'RUC', 'CIIU', 'ESTABLECIMIENTO DE SALUD', 'N° HISTORIA CLÍNICA', 'N° ARCHIVO']], body: [['CEM AUSTROGAS', '190070301001', '4661', 'MEDICINA OCUPACIONAL', ev.numeroHistoriaClinica || trabajador.cedula, ev.numeroArchivo || '-']] });
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head, head: [['PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'SEXO', 'FECHA DE INICIO DE LABORES', 'FECHA DE SALIDA', 'TIEMPO\n(meses)', 'PUESTO DE TRABAJO (CIUO)']], body: [[trabajador.primerApellido, (trabajador as any).segundoApellido || '-', trabajador.primerNombre, (trabajador as any).segundoNombre || '-', trabajador.sexo, (trabajador as any).fechaIngreso || '-', ev.fechaSalida || '-', ev.tiempoMeses || '-', trabajador.puestoTrabajo]] });
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head, head: [['ACTIVIDADES', 'FACTORES DE RIESGO']], body: [[ev.actividadesTexto || '-', ev.factoresRiesgoTexto || '-']], bodyStyles: { minCellHeight: 10 } });
    y += 2;

    secHeaderR('B. ANTECEDENTES PERSONALES');
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(204, 255, 204); pdf.setDrawColor(0);
    pdf.rect(M, y, CW, 4, 'FD');
    pdf.text('ANTECEDENTES CLÍNICOS Y QUIRÚRGICOS', M + 1.5, y + 3);
    y += 4;

    if (ev.antecedentesClinicosQ === true && ev.antecedentesClinicosLista?.length > 0) {
      const lClin = ev.antecedentesClinicosLista.map((ac: any) => { let l = `Antecedentes Clínicos: ${ac.enfermedad || '?'}`; if (ac.desdeCuando) l += ` (desde ${ac.desdeCuando})`; if (ac.tomaMedicacion && ac.medicacionNombre) l += ` — Medicación: ${ac.medicacionNombre}${ac.medicacionDosis ? ' ' + ac.medicacionDosis : ''}`; if (ac.complicaciones) l += ` — Comp: ${ac.complicaciones}`; return l; }).join('\n');
      const lQ = ev.antecedentesQuirurgicosQ === true && ev.antecedentesQuirurgicosLista?.length > 0 ? '\nAntecedentes quirúrgicos: ' + ev.antecedentesQuirurgicosLista.map((aq: any) => `${aq.procedimiento || '?'} (${aq.fechaAproximada || '?'})${aq.secuelas ? ', secuelas: ' + aq.secuelas : ''}`).join('; ') : '\nAntecedentes quirúrgicos: Ninguno';
      const lAl = ev.alergiasTiene === true && ev.alergias?.length > 0 ? '\nAlergias: ' + ev.alergias.map((al: any) => `${al.alergeno || '?'} — ${al.intensidadReaccion || '?'}`).join('; ') : '\nAlergias: Ninguna';
      textoLibreR(lClin + lQ + lAl, 8);
    } else if (ev.antecedentesClinicosQ === false) {
      const lQ = ev.antecedentesQuirurgicosQ === true && ev.antecedentesQuirurgicosLista?.length > 0 ? 'Antecedentes quirúrgicos: ' + ev.antecedentesQuirurgicosLista.map((aq: any) => `${aq.procedimiento || '?'} (${aq.fechaAproximada || '?'})`).join('; ') : 'Antecedentes quirúrgicos: Ninguno';
      const lAl = ev.alergiasTiene === true && ev.alergias?.length > 0 ? '\nAlergias: ' + ev.alergias.map((al: any) => `${al.alergeno || '?'} — ${al.intensidadReaccion || '?'}`).join('; ') : '\nAlergias: Ninguna';
      textoLibreR('Sin antecedentes clínicos.\n' + lQ + lAl, 8);
    } else {
      textoLibreR(ev.antecedentesClinicosQuirurgicos || 'Sin antecedentes personales relevantes reportados.', 8);
    }
    y += 1;

    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(204, 255, 204); pdf.setDrawColor(0); pdf.rect(M, y, CW, 4, 'FD');
    pdf.text('ACCIDENTES DE TRABAJO', M + 1.5, y + 3); y += 4;
    const tieneAcc = ev.tieneAccidente === true;
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5 }, body: [[{ content: '¿TUVO ACCIDENTE DE TRABAJO?', styles: { fontStyle: 'bold', cellWidth: 90 } }, { content: 'SI', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 12 } }, { content: tieneAcc ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 12 } }, { content: 'NO', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 12 } }, { content: !tieneAcc ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold' } }]] });
    if (tieneAcc) {
      textoLibreR(ev.accidentesTrabajo?.descripcion || '-', 8);
      siNoCalificadoR(ev.accidentesTrabajo?.calificado ?? null, ev.accidentesTrabajo?.especificacion || '', ev.accidentesTrabajo?.observaciones || 'Ninguno');
    } else {
      textoLibreR('NINGUNO', 5);
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6 }, body: [[{ content: 'Observaciones:', styles: { fontStyle: 'bold', cellWidth: 25 } }, { content: 'Ninguno' }]] });
      pdf.setDrawColor(0); pdf.rect(M, y, CW, 6, 'S'); y += 6;
    }
    y += 1;

    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(204, 255, 204); pdf.setDrawColor(0); pdf.rect(M, y, CW, 4, 'FD');
    pdf.text('ENFERMEDADES PROFESIONALES', M + 1.5, y + 3); y += 4;
    const tieneEnf = ev.tieneEnfermedad === true;
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5 }, body: [[{ content: '¿TUVO ENFERMEDAD PROFESIONAL?', styles: { fontStyle: 'bold', cellWidth: 90 } }, { content: 'SI', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 12 } }, { content: tieneEnf ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 12 } }, { content: 'NO', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 12 } }, { content: !tieneEnf ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold' } }]] });
    if (tieneEnf) {
      textoLibreR(ev.enfermedadesProfesionales?.descripcion || '-', 8);
      siNoCalificadoR(ev.enfermedadesProfesionales?.calificada ?? null, ev.enfermedadesProfesionales?.especificacion || '', ev.enfermedadesProfesionales?.observaciones || 'Ninguno');
    } else {
      textoLibreR('NINGUNA', 5);
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6 }, body: [[{ content: 'Observaciones:', styles: { fontStyle: 'bold', cellWidth: 25 } }, { content: 'Ninguno' }]] });
      pdf.setDrawColor(0); pdf.rect(M, y, CW, 6, 'S'); y += 6;
    }
    y += 2;

    secHeaderR('C. CONSTANTES VITALES Y ANTROPOMETRÍA');
    const sv = ev.signosVitales || {};
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head, head: [['PRESIÓN ARTERIAL\n(mmHg)', 'TEMPERATURA\n(°C)', 'FRECUENCIA CARDIACA\n(l/min)', 'SATURACIÓN DE\nOXÍGENO (%)', 'FRECUENCIA\nRESPIRATORIA (fr/min)', 'PESO\n(Kg)', 'TALLA\n(cm)', 'ÍNDICE DE MASA\nCORPORAL (kg/m²)', 'PERÍMETRO\nABDOMINAL (cm)']], body: [[`${sv.presionSistolica || '-'}/${sv.presionDiastolica || '-'}`, sv.temperatura || '-', sv.frecuenciaCardiaca || '-', sv.saturacion || '-', sv.frecuenciaRespiratoria || '-', sv.peso || '-', sv.talla || '-', sv.imc ? Number(sv.imc).toFixed(1) : '-', sv.perimetroAbdominal || '-']], columnStyles: { 0: { halign: 'center' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' }, 7: { halign: 'center' }, 8: { halign: 'center' } } });
    y += 2;

    secHeaderR('D. EXAMEN FÍSICO REGIONAL');
    const pdfFisicoRowsR = FISICO_ROWS.map(row => row.map((cell: any) => {
      if (cell.type === 'reg') return { content: '', textToRotate: cell.txt, rowSpan: cell.rs, styles: { fillColor: colorTerciario, halign: 'center', valign: 'middle' } };
      if (cell.type === 'sub') return { content: cell.txt, styles: { fillColor: '#ffffff' } };
      if (cell.type === 'chk') return { content: hasFisico(ev, cell.code) ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', fillColor: '#ffffff' } };
      if (cell.type === 'empty') return { content: '', rowSpan: cell.rs || 1, colSpan: cell.cs || 1, styles: { fillColor: '#ffffff', lineWidth: 0 } };
      if (cell.type === 'instr') return { content: cell.txt, colSpan: cell.cs, styles: { fillColor: '#f8f8f8', textColor: negro, halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 5.5 } };
      return { content: '' };
    }));
    AT({
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 5.5, cellPadding: 0.8 }, bodyStyles: { minCellHeight: 6.5 },
      headStyles: { fillColor: colorTerciario, textColor: negro, fontSize: 6 },
      columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 23 }, 2: { cellWidth: 4, halign: 'center' }, 3: { cellWidth: 9 }, 4: { cellWidth: 23 }, 5: { cellWidth: 4, halign: 'center' }, 6: { cellWidth: 9 }, 7: { cellWidth: 23 }, 8: { cellWidth: 4, halign: 'center' }, 9: { cellWidth: 9 }, 10: { cellWidth: 23 }, 11: { cellWidth: 4, halign: 'center' }, 12: { cellWidth: 9 }, 13: { cellWidth: 23 }, 14: { cellWidth: 4, halign: 'center' } },
      head: [[{ content: 'REGIONES', colSpan: 15, styles: { halign: 'left', fillColor: colorTerciario } }]],
      body: pdfFisicoRowsR as any,
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
          } else { pdf.text(str, cx + 0.8, cy + textWidth / 2, { angle: 90 }); }
        }
      },
    });
    const hallazgos = ev.examenFisicoHallazgos || [];
    if (hallazgos.length > 0) { textoLibreR('Observaciones:\n' + hallazgos.map((h: any) => `${h.codigo}. ${h.region}, ${h.subregion}: ${h.descripcion || '-'}`).join('\n'), 6); }
    else { textoLibreR('Observaciones: Sin hallazgos patológicos al examen físico regional.', 5); }

    const pageH1 = pdf.internal.pageSize.getHeight() - 10;
    while (y < pageH1 - 5) { pdf.setDrawColor(0); pdf.rect(M, y, CW, 6, 'S'); y += 6; }

    pdf.addPage(); y = 7;
    paginaHeader('Página:    2 de 2');

    secHeaderR('E. RESULTADOS DE EXÁMENES GENERALES Y ESPECÍFICOS DE ACUERDO AL RIESGO Y PUESTO DE TRABAJO (IMAGEN, LABORATORIO Y OTROS)');
    const examsValidos = (ev.examenesComplementarios || []).filter((e: any) => e.nombre?.trim());
    if (examsValidos.length > 0) { AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5 }, headStyles: { ...head, fontSize: 6 }, head: [['EXAMEN', 'FECHA\naaaa / mm / dd', 'RESULTADO']], body: examsValidos.map((e: any) => [e.nombre, e.fecha || '-', e.resultado || '-']) }); }
    else { textoLibreR('Sin exámenes complementarios registrados.', 8); }
    pdf.setDrawColor(0); pdf.rect(M, y, CW, 6, 'S');
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.text('Observaciones:', M + 1.5, y + 3.5); y += 7;

    const dxValidos = (ev.diagnosticos || []).filter((d: any) => d.descripcion?.trim());
    secHeaderR('F. DIAGNÓSTICO                    PRE= PRESUNTIVO          DEF= DEFINITIVO');
    if (dxValidos.length > 0) {
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5, halign: 'center' }, headStyles: { ...head, fontSize: 6, halign: 'center' }, head: [['N°', 'DESCRIPCIÓN', 'CIE', 'PRE', 'DEF']], body: dxValidos.map((dx: any, i: number) => [`${i + 1}`, { content: dx.descripcion, styles: { halign: 'left' } }, dx.cie || '-', dx.tipo === 'presuntivo' ? 'X' : '', dx.tipo === 'definitivo' ? 'X' : '']), columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 10 }, 4: { cellWidth: 10 } } });
    } else {
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5, halign: 'center' }, headStyles: { ...head, fontSize: 6, halign: 'center' }, head: [['N°', 'DESCRIPCIÓN', 'CIE', 'PRE', 'DEF']], body: [[1, 'Sin diagnósticos registrados', '-', '', ''], [2, '', '', '', ''], [3, '', '', '', '']], columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 10 }, 4: { cellWidth: 10 } }, bodyStyles: { minCellHeight: 7 } });
    }
    y += 1;

    secHeaderR('G. EVALUACIÓN MÉDICA DE RETIRO');
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5 }, headStyles: head, body: [[{ content: 'SE REALIZÓ LA EVALUACIÓN', styles: { fontStyle: 'bold', cellWidth: 90 } }, { content: 'SI', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 12 } }, { content: ev.evaluacionRealizada ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 12 } }, { content: 'NO', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 12 } }, { content: !ev.evaluacionRealizada ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold' } }]] });
    pdf.setDrawColor(0); pdf.rect(M, y, CW, 5, 'S'); pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.text('Observaciones:', M + 1.5, y + 3.5); y += 5;
    const obsLines = pdf.splitTextToSize(ev.observacionesRetiro || '-', CW - 3);
    const obsH = Math.max(8, obsLines.length * 3 + 2);
    pdf.setFont('helvetica', 'normal'); pdf.rect(M, y, CW, obsH, 'S'); pdf.text(obsLines, M + 1.5, y + 3); y += obsH + 2;

    secHeaderR('H. RECOMENDACIONES Y/O TRATAMIENTO');
    const recArr = Array.isArray(ev.recomendaciones) ? ev.recomendaciones : [];
    textoLibreR(recArr.join('; ') + (ev.recomendacionesOtras ? `; ${ev.recomendacionesOtras}` : '') || 'Ninguna particular al momento.', 10); y += 2;

    pdf.setFillColor(248, 248, 248); pdf.setDrawColor(0);
    const certTextR = 'CERTIFICO QUE LO ANTERIORMENTE EXPRESADO EN RELACIÓN A MI ESTADO DE SALUD ES VERDAD. SE ME HA INFORMADO MI ESTADO ACTUAL DE SALUD Y LAS RECOMENDACIONES PERTINENTES.';
    const certLinesR = pdf.splitTextToSize(certTextR, CW - 3);
    const certHR = certLinesR.length * 3 + 3;
    pdf.rect(M, y, CW, certHR, 'FD'); pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.text(certLinesR, M + 1.5, y + 3); y += certHR + 3;

    secHeaderR('I. DATOS DEL PROFESIONAL                                                                             J. FIRMA DEL USUARIO');
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5, halign: 'center' }, headStyles: { ...head, fontSize: 6, halign: 'center' }, head: [['FECHA\naaaa-mm-dd', 'HORA', 'NOMBRES Y APELLIDOS', 'CÓDIGO', 'FIRMA Y SELLO', 'FIRMA DEL USUARIO']], body: [[fmtF(ev.fecha), fmtHora(ev.fecha), (ev.medicoNombre || 'MÉDICO OCUPACIONAL').toUpperCase(), ev.medicoCedula || '-', '', '']], bodyStyles: { minCellHeight: 20, valign: 'bottom', halign: 'center' } });

    pdf.save(`SO-RE-40_RETIRO_${trabajador.primerApellido}_${trabajador.primerNombre}_${fmtF(ev.fecha)}.pdf`);
  };

  // ----------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------
  if (cargando) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-20 bg-slate-200 rounded-xl" />
        <div className="h-64 bg-slate-200 rounded-xl" />
        <div className="h-48 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  if (!trabajador) {
    return <div className="p-8 text-center text-red-500 font-bold">Trabajador no encontrado</div>;
  }

  const nombreCompleto = `${trabajador.primerApellido} ${(trabajador as any).segundoApellido || ''} ${trabajador.primerNombre} ${(trabajador as any).segundoNombre || ''}`.trim();

  // Filter evaluations by search
  const q = busquedaEval.trim().toLowerCase();
  const evsFiltradas = q
    ? evaluaciones.filter(item => {
        const fecha = fmtF(item.fecha).toLowerCase();
        const motivo = ((item as any).motivoConsulta || '').toLowerCase();
        const aptitud = (item.aptitudMedica || '').toLowerCase();
        const dxTexto = Array.isArray((item as any).diagnosticos) ? (item as any).diagnosticos.map((d: any) => d.descripcion || '').join(' ').toLowerCase() : '';
        const medico = ((item as any).medicoNombre || '').toLowerCase();
        return fecha.includes(q) || motivo.includes(q) || aptitud.includes(q) || dxTexto.includes(q) || medico.includes(q);
      })
    : evaluaciones;

  const aptitudColor = (aptitud: string) => {
    if (aptitud === 'apto') return 'bg-green-100 text-green-800';
    if (aptitud === 'aptoObservacion') return 'bg-amber-100 text-amber-800';
    if (aptitud === 'aptoLimitaciones') return 'bg-orange-100 text-orange-800';
    if (aptitud === 'noApto') return 'bg-red-100 text-red-800';
    return 'bg-slate-100 text-slate-500';
  };

  const aptitudLabel = (aptitud: string) => {
    if (aptitud === 'apto') return 'APTO';
    if (aptitud === 'aptoObservacion') return 'EN OBSERVACIÓN';
    if (aptitud === 'aptoLimitaciones') return 'CON LIMITACIONES';
    if (aptitud === 'noApto') return 'NO APTO';
    return 'Sin aptitud';
  };

  return (
    <div className="p-5 space-y-5 max-w-4xl mx-auto">

      {/* ── HEADER ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{nombreCompleto}</h1>
          <p className="text-slate-500 text-sm mt-0.5">CI: {trabajador.cedula} · {trabajador.puestoTrabajo}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={abrirModalEditar} className="px-3 py-1.5 bg-amber-100 text-amber-800 font-semibold rounded-lg hover:bg-amber-200 text-sm">
            ✏️ Editar datos
          </button>
          <div className="relative">
            <button onClick={() => setMenuEvalOpen(o => !o)} className="px-3 py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm text-sm flex items-center gap-1">
              + Nueva Evaluación <span className="text-blue-200 text-xs">▾</span>
            </button>
            {menuEvalOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuEvalOpen(false)} />
                <div className="absolute right-0 mt-1 z-40 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden min-w-[190px]">
                  <button onClick={() => { setMenuEvalOpen(false); navigate(`/evaluar/${trabajadorId}`); }} className="w-full text-left px-4 py-3 text-sm font-semibold hover:bg-blue-50 flex items-center gap-2 border-b border-slate-100">
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">PERIÓDICA</span> SO-RE-38
                  </button>
                  <button onClick={() => { setMenuEvalOpen(false); navigate(`/evaluar-retiro/${trabajadorId}`); }} className="w-full text-left px-4 py-3 text-sm font-semibold hover:bg-orange-50 flex items-center gap-2">
                    <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">RETIRO</span> SO-RE-40
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 1: EVALUACIONES ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-blue-600 text-lg">📋</span>
            <span className="font-bold text-slate-800 text-sm">Evaluaciones</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">{evaluaciones.length}</span>
          </div>
        </div>
        <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50">
          <input
            type="text"
            placeholder="Buscar por fecha, motivo, diagnóstico o aptitud..."
            value={busquedaEval}
            onChange={e => setBusquedaEval(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
          {evsFiltradas.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              {q ? `No se encontraron evaluaciones para "${busquedaEval}"` : 'Sin evaluaciones registradas.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {evsFiltradas.map(item => {
                const dxCount = Array.isArray((item as any).diagnosticos) ? (item as any).diagnosticos.length : 0;
                return (
                  <button key={item.id} onClick={() => setEvDrawer(item)} className="w-full text-left px-5 py-3.5 hover:bg-blue-50 transition-colors flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[50px]">
                        <p className="text-base font-bold text-slate-800">{fmtF(item.fecha).split('/')[0]}</p>
                        <p className="text-[10px] text-slate-500">{fmtF(item.fecha).split('/').slice(1).join('/')}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">
                          {(item as any).tipo === 'RETIRO' ? 'Evaluación de retiro' : ((item as any).motivoConsulta || 'Evaluación periódica')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {dxCount > 0 ? `${dxCount} diagnóstico${dxCount > 1 ? 's' : ''}` : 'Sin diagnósticos'}
                          {(item as any).medicoNombre ? ` · Dr. ${(item as any).medicoNombre}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(item as any).tipo === 'RETIRO'
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">RETIRO</span>
                        : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">PERIÓDICA</span>
                      }
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${aptitudColor(item.aptitudMedica)}`}>{aptitudLabel(item.aptitudMedica)}</span>
                      <span className="text-slate-300 group-hover:text-blue-400 text-lg">›</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SECCIÓN 2: EXÁMENES ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <span className="text-purple-600 text-lg">🔬</span>
          <span className="font-bold text-slate-800 text-sm">Exámenes Complementarios</span>
          {totalPatologicos > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold animate-pulse">{totalPatologicos} ⚠</span>
          )}
        </div>
        <div className="p-5">
          <ExamenesPanel
            trabajadorId={trabajadorId}
            trabajadorNombre={nombreCompleto}
            evaluaciones={evaluaciones}
          />
        </div>
      </div>

      {/* ── SECCIÓN 3: PERMISOS MÉDICOS ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 text-lg">🏥</span>
            <span className="font-bold text-slate-800 text-sm">Permisos médicos</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">{permisos.length}</span>
          </div>
          <button onClick={() => navigate(`/permisos`)} className="text-xs px-2.5 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold">
            + Nuevo permiso
          </button>
        </div>
        <input type="file" accept="application/pdf,image/*" ref={certInputRef} className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            const pid = certInputRef.current?.dataset.permisoId;
            if (file && pid) subirCertificado(pid, file);
            e.target.value = '';
          }}
        />
        <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
          {permisos.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Sin permisos registrados.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {permisos.map((p) => {
                const meta = TIPOS_PERMISO[p.tipo];
                const estado = estadoPermiso(p);
                const dur = duracionPermiso(p);
                const estadoColors: Record<string, string> = {
                  justificado: 'bg-green-100 text-green-700',
                  activo: 'bg-blue-100 text-blue-700',
                  pendiente: 'bg-amber-100 text-amber-700',
                  vencido: 'bg-red-100 text-red-700',
                };
                return (
                  <div key={p.id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${meta.color}18`, color: meta.color }}>{meta.label}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estadoColors[estado] ?? 'bg-slate-100 text-slate-600'}`}>{estado.charAt(0).toUpperCase() + estado.slice(1)}</span>
                        <span className="text-[11px] text-slate-500">{dur}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{p.motivo || '—'}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{fmtPF(p.desde)}{p.hasta && p.hasta !== p.desde ? ` → ${fmtPF(p.hasta)}` : ''}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {p.certAdjunto ? (
                        p.certUrl ? (
                          <a href={p.certUrl} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] px-2.5 py-1 bg-green-100 text-green-700 rounded-lg font-semibold hover:bg-green-200 inline-flex items-center gap-1">
                            ✓ Ver PDF
                          </a>
                        ) : (
                          <span className="text-[11px] px-2.5 py-1 bg-green-100 text-green-700 rounded-lg font-semibold inline-flex items-center gap-1">✓ Certificado</span>
                        )
                      ) : meta.requiereCert ? (
                        <button
                          disabled={subiendoCert === p.id}
                          onClick={() => {
                            if (certInputRef.current) {
                              certInputRef.current.dataset.permisoId = p.id!;
                              certInputRef.current.click();
                            }
                          }}
                          className="text-[11px] px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg font-semibold hover:bg-amber-200 disabled:opacity-50">
                          {subiendoCert === p.id ? 'Subiendo…' : '⬆ Subir PDF'}
                        </button>
                      ) : null}
                      <button
                        onClick={() => abrirEditPermiso(p)}
                        className="text-[11px] px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-semibold hover:bg-slate-200"
                        title="Editar permiso"
                      >✏️</button>
                      <button
                        onClick={() => handleEliminarPermiso(p.id!)}
                        className="text-[11px] px-2 py-1 bg-red-50 text-red-500 rounded-lg font-semibold hover:bg-red-100"
                        title="Eliminar permiso"
                      >✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SECCIÓN 4: EXÁMENES PROGRAMADOS ── */}
      {(() => {
        const now = new Date();
        const pasados = ordenes.filter(o => toDate(o.fechaProgramada) < now).sort((a, b) => toDate(b.fechaProgramada).getTime() - toDate(a.fechaProgramada).getTime());
        const futuros = ordenes.filter(o => toDate(o.fechaProgramada) >= now).sort((a, b) => toDate(a.fechaProgramada).getTime() - toDate(b.fechaProgramada).getTime());
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
              <span className="text-cyan-600 text-lg">📅</span>
              <span className="font-bold text-slate-800 text-sm">Exámenes programados</span>
              {futuros.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-bold">{futuros.length} próximos</span>}
              {pasados.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">{pasados.length} realizados</span>}
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
              {ordenes.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Sin exámenes programados.</div>
              ) : (
                <div>
                  {futuros.length > 0 && (
                    <>
                      <div className="px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-cyan-700 bg-cyan-50 border-b border-cyan-100">
                        Próximos
                      </div>
                      {futuros.map(o => (
                        <div key={o.id} className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-700">{o.tipoEvaluacion} · {o.examenes.length} examen{o.examenes.length !== 1 ? 'es' : ''}</p>
                            <p className="text-xs text-slate-400 mt-0.5">📅 {fmtPF(o.fechaProgramada)} · {o.examenes.filter(e => e.realizado).length}/{o.examenes.length} realizados</p>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => setOrdenDetalle(o)} className="text-[11px] px-2.5 py-1 bg-cyan-100 text-cyan-700 rounded-lg font-semibold hover:bg-cyan-200">Ver / Editar</button>
                            <button onClick={() => eliminarOrdenExamen(o.id!)} className="text-[11px] px-2.5 py-1 bg-red-100 text-red-600 rounded-lg font-semibold hover:bg-red-200">✕</button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {pasados.length > 0 && (
                    <>
                      <div className="px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-100">
                        Historial
                      </div>
                      {pasados.map(o => (
                        <div key={o.id} className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2 opacity-80">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-600">{o.tipoEvaluacion} · {o.examenes.length} examen{o.examenes.length !== 1 ? 'es' : ''}</p>
                            <p className="text-xs text-slate-400 mt-0.5">📅 {fmtPF(o.fechaProgramada)} · {o.examenes.filter(e => e.realizado).length}/{o.examenes.length} realizados</p>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => setOrdenDetalle(o)} className="text-[11px] px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-semibold hover:bg-slate-200">Ver</button>
                            <button onClick={() => eliminarOrdenExamen(o.id!)} className="text-[11px] px-2.5 py-1 bg-red-100 text-red-600 rounded-lg font-semibold hover:bg-red-200">✕</button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── SECCIÓN 5: CONSULTAS MÉDICAS ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <span className="text-green-600 text-lg">🩺</span>
          <span className="font-bold text-slate-800 text-sm">Consultas médicas</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">{atenciones.length}</span>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 250 }}>
          {atenciones.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Sin consultas registradas.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {atenciones.map((a: any) => (
                <div key={a.id} className="px-5 py-3">
                  <p className="text-sm font-semibold text-slate-700">{a.motivoConsulta || 'Consulta'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {fmtF(a.fecha)}
                    {a.medicoNombre ? ` · Dr. ${a.medicoNombre}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL ORDEN EXAMEN ── */}
      {ordenDetalle && (
        <OrdenDetalleModal
          orden={ordenDetalle}
          onClose={() => setOrdenDetalle(null)}
          onSaved={() => {
            setOrdenDetalle(null);
            getOrdenes().then(ords => setOrdenes((ords as OrdenExamen[]).filter(o => o.trabajadorId === trabajadorId)));
          }}
          onDeleted={() => {
            setOrdenDetalle(null);
            getOrdenes().then(ords => setOrdenes((ords as OrdenExamen[]).filter(o => o.trabajadorId === trabajadorId)));
          }}
        />
      )}

      {/* ── MODAL EDITAR PERMISO ── */}
      {editPermiso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-base font-bold text-slate-800">Editar permiso médico</h2>
              <button onClick={() => setEditPermiso(null)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de permiso</label>
                <select
                  value={editPatch.tipo}
                  onChange={e => setEditPatch(prev => ({ ...prev, tipo: e.target.value as TipoPermiso }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {Object.entries(TIPOS_PERMISO).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de inicio</label>
                <input
                  type="date"
                  value={editPatch.desde}
                  onChange={e => setEditPatch(prev => ({ ...prev, desde: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {editPatch.tipo === 'cita' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Duración (horas)</label>
                  <input
                    type="number" min={1} max={8}
                    value={editPatch.horas}
                    onChange={e => setEditPatch(prev => ({ ...prev, horas: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Días de reposo</label>
                  <input
                    type="number" min={1} max={365}
                    value={editPatch.dias}
                    onChange={e => setEditPatch(prev => ({ ...prev, dias: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo / diagnóstico</label>
                <input
                  type="text"
                  value={editPatch.motivo}
                  onChange={e => setEditPatch(prev => ({ ...prev, motivo: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setEditPermiso(null)} className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">Cancelar</button>
              <button onClick={guardarEditPermiso} disabled={guardandoPermiso} className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {guardandoPermiso ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DRAWER EVALUACIÓN ── */}
      {evDrawer && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setEvDrawer(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50 shrink-0">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">{(evDrawer as any).tipo === 'RETIRO' ? 'Evaluación de Retiro SO-RE-40' : 'Historia Clínica SO-RE-38'}</p>
                <p className="text-base font-bold text-slate-800">{fmtFH((evDrawer as any).fecha)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => (evDrawer as any).tipo === 'RETIRO' ? navigate(`/evaluar-retiro/${trabajadorId}?editId=${(evDrawer as any).id}`) : navigate(`/evaluar/${trabajadorId}?editId=${(evDrawer as any).id}`)}
                  className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600"
                >✏️ Editar</button>
                <button
                  onClick={() => (evDrawer as any).tipo === 'RETIRO' ? generarPDFRetiro(evDrawer) : generarPDF(evDrawer)}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700"
                >📄 PDF</button>
                <button onClick={() => setEvDrawer(null)} className="ml-2 text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {(() => {
                const ev: any = evDrawer;
                return (
                  <>
                    <DrawerSec title="A. DATOS DEL ESTABLECIMIENTO Y USUARIO">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <KV k="Institución" v="CEM AUSTROGAS" /><KV k="RUC" v="190070301001" />
                        <KV k="Nombres" v={`${trabajador.primerNombre} ${(trabajador as any).segundoNombre || ''}`} />
                        <KV k="Apellidos" v={`${trabajador.primerApellido} ${(trabajador as any).segundoApellido || ''}`} />
                        <KV k="Cédula" v={trabajador.cedula} /><KV k="Sexo" v={trabajador.sexo} /><KV k="Puesto" v={trabajador.puestoTrabajo} />
                      </div>
                    </DrawerSec>
                    <DrawerSec title="B. MOTIVO DE CONSULTA">
                      <p className="text-xs uppercase">{ev.motivoConsulta || 'ACTUALIZACIÓN DE FICHA OCUPACIONAL'}</p>
                    </DrawerSec>
                    {ev.antecedentesClinicosQ !== undefined && (
                      <DrawerSec title="C. ANTECEDENTES">
                        <p className="text-xs">
                          {ev.antecedentesClinicosQ === true
                            ? ev.antecedentesClinicosLista?.map((ac: any, i: number) => <span key={i} className="block">{ac.enfermedad}{ac.desdeCuando ? ` (desde ${ac.desdeCuando})` : ''}</span>)
                            : 'Sin antecedentes clínicos.'}
                        </p>
                      </DrawerSec>
                    )}
                    {ev.signosVitales && (
                      <DrawerSec title="SIGNOS VITALES">
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                          <KV k="PA" v={`${ev.signosVitales.presionSistolica || '-'}/${ev.signosVitales.presionDiastolica || '-'}`} />
                          <KV k="FC" v={ev.signosVitales.frecuenciaCardiaca || '-'} />
                          <KV k="Sat O₂" v={ev.signosVitales.saturacion || '-'} />
                          <KV k="Peso" v={ev.signosVitales.peso || '-'} />
                          <KV k="IMC" v={String(ev.signosVitales.imc || '-')} />
                        </div>
                      </DrawerSec>
                    )}
                    {ev.diagnosticos?.length > 0 && (
                      <DrawerSec title="K. DIAGNÓSTICO">
                        <div className="space-y-1">
                          {ev.diagnosticos.map((dx: any, i: number) => (
                            <div key={i} className="text-xs flex gap-2">
                              <span className="font-semibold text-slate-500">{i + 1}.</span>
                              <span>{dx.descripcion}</span>
                              {dx.cie && <span className="text-slate-400">({dx.cie})</span>}
                              <span className={`px-1 rounded text-[10px] font-bold ${dx.tipo === 'presuntivo' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{dx.tipo === 'presuntivo' ? 'PRE' : 'DEF'}</span>
                            </div>
                          ))}
                        </div>
                      </DrawerSec>
                    )}
                    <DrawerSec title="L. APTITUD MÉDICA">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${aptitudColor(ev.aptitudMedica)}`}>{aptitudLabel(ev.aptitudMedica)}</span>
                      {ev.aptitudObservacion && <p className="text-xs text-slate-500 mt-1">Obs: {ev.aptitudObservacion}</p>}
                      {ev.aptitudLimitaciones && <p className="text-xs text-slate-500 mt-0.5">Lim: {ev.aptitudLimitaciones}</p>}
                    </DrawerSec>
                    {ev.recomendaciones?.length > 0 && (
                      <DrawerSec title="M. RECOMENDACIONES">
                        <ul className="list-disc list-inside space-y-0.5">
                          {(Array.isArray(ev.recomendaciones) ? ev.recomendaciones : [ev.recomendaciones]).map((r: string, i: number) => (
                            <li key={i} className="text-xs">{r}</li>
                          ))}
                        </ul>
                      </DrawerSec>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* ── MODAL EDITAR TRABAJADOR ── */}
      {modalEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-slate-800">Editar datos del trabajador</h2>
              <button onClick={() => setModalEditar(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Primer Nombre', key: 'primerNombre', required: true },
                  { label: 'Segundo Nombre', key: 'segundoNombre' },
                  { label: 'Primer Apellido', key: 'primerApellido', required: true },
                  { label: 'Segundo Apellido', key: 'segundoApellido' },
                  { label: 'Cédula', key: 'cedula', required: true },
                  { label: 'Teléfono', key: 'telefono' },
                  { label: 'Correo electrónico', key: 'correo' },
                  { label: 'Departamento / Área', key: 'departamento' },
                  { label: 'Fecha de nacimiento', key: 'fechaNacimiento', type: 'date' },
                  { label: 'Fecha de ingreso', key: 'fechaIngreso', type: 'date' },
                ].map(({ label, key, required, type }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {label} {required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type={type || 'text'}
                      value={(datosEdicion as any)[key]}
                      onChange={e => setDatosEdicion(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Puesto de trabajo <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={datosEdicion.puestoTrabajo}
                    onChange={e => setDatosEdicion(prev => ({ ...prev, puestoTrabajo: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sexo</label>
                  <select
                    value={datosEdicion.sexo}
                    onChange={e => setDatosEdicion(prev => ({ ...prev, sexo: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setModalEditar(false)} className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">Cancelar</button>
              <button onClick={guardarEdicion} disabled={guardandoEdicion} className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DrawerSec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-bold text-slate-800 bg-[#ccffcc] px-3 py-1.5 border border-slate-300 rounded-t">{title}</h3>
      <div className="border border-slate-300 border-t-0 rounded-b p-3 bg-white">{children}</div>
    </section>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="font-semibold block text-slate-500 text-[10px] uppercase">{k}</span>
      {v}
    </div>
  );
}
