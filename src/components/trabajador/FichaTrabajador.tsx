import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { registrarAuditoria } from '../../services/auditoria';
import { getEvaluacionesErgoDeTrabajador } from '../../services/ergonomia';
import type { EvaluacionErgonomica } from '../../types/ergonomia';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Trabajador, EvaluacionMedica } from '../../types';
import ExamenesPanel from '../examenes/ExamenesPanel';
import { OrdenDetalleModal } from '../examenes/ExamenModales';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { useEmpresa } from '../../contexts/EmpresaContext';
import { LOGO_EMPRESA } from '../../assets/logoEmpresa';
import { cargarLogoParaPdf } from '../../utils/logoPdf';
import { getOrdenes, eliminarOrden } from '../../services/examenesPlan';
import { estadoPermiso, duracionPermiso, fmtFecha as fmtPF, toDate, actualizarPermiso, eliminarPermiso } from '../../services/permisos';
import { TIPOS_PERMISO } from '../../types/permiso';
import type { TipoPermiso } from '../../types/permiso';
import type { OrdenExamen } from '../../types/examenPlan';
import type { PermisoMedico } from '../../types/permiso';
import SeguimientoSignos from './SeguimientoSignos';
import FichaLayout from './FichaLayout';
import CertificadoAptitudModal from './CertificadoAptitud';
import { dibujarFactoresRiesgoPdf } from './factoresRiesgoPdf';

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
  const confirm = useConfirm();
  const { user, displayName } = useAuth();
  const { empresa } = useEmpresa();
  // Logo para los PDF: el configurado por la empresa, con respaldo al embebido.
  const [logoPdf, setLogoPdf] = useState<{ data: string; format: string }>({ data: LOGO_EMPRESA, format: 'PNG' });
  useEffect(() => {
    let cancelado = false;
    if (empresa.logoUrl) {
      cargarLogoParaPdf(empresa.logoUrl).then((r) => { if (!cancelado && r) setLogoPdf(r); });
    } else {
      setLogoPdf({ data: LOGO_EMPRESA, format: 'PNG' });
    }
    return () => { cancelado = true; };
  }, [empresa.logoUrl]);

  const [trabajador, setTrabajador] = useState<Trabajador | null>(null);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionMedica[]>([]);
  const [permisos, setPermisos] = useState<PermisoMedico[]>([]);
  const [atenciones, setAtenciones] = useState<any[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenExamen[]>([]);
  const [totalPatologicos, setTotalPatologicos] = useState(0);
  const [evalsErgo, setEvalsErgo] = useState<EvaluacionErgonomica[]>([]);
  const [cargando, setCargando] = useState(true);

  // Drawer evaluacion
  const [evDrawer, setEvDrawer] = useState<any>(null);
  const [busquedaEval, setBusquedaEval] = useState('');

  // Certificado de aptitud (SO-RE-20): evaluación a la que se anexa
  const [certEval, setCertEval] = useState<any>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Modal orden examen
  const [ordenDetalle, setOrdenDetalle] = useState<OrdenExamen | null>(null);

  // Subida certificado permiso
  const certInputRef = useRef<HTMLInputElement>(null);
  const [subiendoCert, setSubiendoCert] = useState<string | null>(null);

  // Editar / eliminar permiso
  const [editPermiso, setEditPermiso] = useState<PermisoMedico | null>(null);
  const [editPatch, setEditPatch] = useState<{ desde: string; dias: number; horas: number; motivo: string; tipo: TipoPermiso }>({ desde: '', dias: 1, horas: 3, motivo: '', tipo: 'reposo_interno' });
  const [guardandoPermiso, setGuardandoPermiso] = useState(false);
  const [pdfVisor, setPdfVisor] = useState<{ url: string; nombre: string } | null>(null);

  const [pendingCertId, setPendingCertId] = useState<string | null>(null);

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
    let cancelled = false;
    setCargando(true);
    (async () => {
      try {
        const [workerSnap, evSnap, permisosSnap, atencionSnap, patSnap, ords, ergos] = await Promise.all([
          getDoc(doc(db, 'trabajadores', trabajadorId)),
          getDocs(query(collection(db, 'evaluaciones'), where('trabajadorId', '==', trabajadorId))),
          getDocs(query(collection(db, 'permisos'), where('trabajadorId', '==', trabajadorId))),
          getDocs(query(collection(db, 'atenciones'), where('trabajadorId', '==', trabajadorId))),
          getDocs(query(collection(db, 'examenes'), where('trabajadorId', '==', trabajadorId), where('estado', '==', 'patologico'))).catch(() => ({ size: 0 })),
          getOrdenes().catch(() => [] as OrdenExamen[]),
          getEvaluacionesErgoDeTrabajador(trabajadorId).catch(() => []),
        ]);

        if (cancelled) return;
        setEvalsErgo(ergos);

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
        if (!cancelled) console.error('Error al cargar FichaTrabajador:', err);
      } finally {
        if (!cancelled) setCargando(false);
      }
    })();
    return () => { cancelled = true; };
  }, [trabajadorId]);

  // Al volver de guardar una evaluación con ?certificado=<id>, abrir el
  // certificado de aptitud autocompletado para esa evaluación.
  useEffect(() => {
    const certId = searchParams.get('certificado');
    if (!certId || evaluaciones.length === 0) return;
    const ev = evaluaciones.find(e => e.id === certId);
    if (ev) setCertEval(ev);
    // Limpiar el parámetro para que no se reabra al refrescar
    const next = new URLSearchParams(searchParams);
    next.delete('certificado');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluaciones]);

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
      await registrarAuditoria('editar', 'trabajador', trabajadorId, `Editó la ficha de ${datosEdicion.primerApellido} ${datosEdicion.primerNombre}`);
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
    if (!(await confirm({ message: '¿Eliminar este examen programado?', danger: true }))) return;
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
    if (!(await confirm({ message: '¿Eliminar este permiso? Esta acción no se puede deshacer.', danger: true }))) return;
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
      pdf.addImage(logoPdf.data, logoPdf.format, 8, 8, 40, 15);
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
      body: [[empresa.institucion, empresa.ruc, empresa.ciu, empresa.establecimiento, ev.numeroHistoriaClinica || trabajador.cedula, ev.numeroArchivo || '-']],
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
      checkPage(15); secHeader('E. FACTORES DE RIESGOS DEL PUESTO DE TRABAJO');
      // Matriz oficial: una columna por factor (rótulo rotado) con X en lo
      // marcado. Solo 2 filas numeradas y compactas para que ambos recuadros
      // entren en la misma página y el PDF completo quede en 2 páginas.
      y = dibujarFactoresRiesgoPdf(pdf, ev.factoresRiesgo, { M, CW, y, puestoDefault: trabajador.puestoTrabajo, filas: 2, altoFila: 5 });
      y += 2;
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
      pdf.addImage(logoPdf.data, logoPdf.format, M + 1, tableStartY + 1, 40, 12);
      y += 2;
    };

    const siNoCalificadoR = (calificado: boolean | null, especificacion: string, observaciones: string) => {
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6 }, headStyles: head, body: [[{ content: 'FUE CALIFICADO POR EL INSTITUTO DE SEGURIDAD SOCIAL CORRESPONDIENTE:', styles: { fontStyle: 'bold', cellWidth: 75 } }, { content: 'SI', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 7 } }, { content: calificado === true ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 7 } }, { content: 'ESPECIFICAR:', styles: { fontStyle: 'bold', cellWidth: 22 } }, { content: especificacion || '', styles: { cellWidth: 30 } }, { content: 'NO', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 7 } }, { content: calificado === false ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 7 } }]] });
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6 }, body: [[{ content: 'Observaciones:', styles: { fontStyle: 'bold', cellWidth: 25 } }, { content: observaciones || 'Ninguno' }]] });
      pdf.setDrawColor(0); pdf.rect(M, y, CW, 6, 'S'); y += 6;
    };

    paginaHeader('Página:    1 de 2');

    secHeaderR('A. DATOS DEL ESTABLECIMIENTO - EMPRESA Y USUARIO');
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head, head: [['INSTITUCIÓN DEL SISTEMA O NOMBRE DE LA EMPRESA', 'RUC', 'CIIU', 'ESTABLECIMIENTO DE SALUD', 'N° HISTORIA CLÍNICA', 'N° ARCHIVO']], body: [[empresa.institucion, empresa.ruc, empresa.ciu, empresa.establecimiento, ev.numeroHistoriaClinica || trabajador.cedula, ev.numeroArchivo || '-']] });
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
  // PDF SO-RE-41 (PREOCUPACIONAL) — sigue la hoja oficial de 3 páginas
  // ----------------------------------------------------------------
  const generarPDFPreocupacional = (evParam?: any) => {
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

    const checkPage = (needed: number) => {
      if (y + needed > 285) { pdf.addPage(); y = 7; }
    };

    const secHeaderP = (texto: string, bgColor = colorPrimario) => {
      checkPage(10);
      pdf.setFillColor(bgColor); pdf.setDrawColor(0);
      pdf.rect(M, y, CW, 5, 'FD');
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
      pdf.text(texto, M + 1.5, y + 3.5);
      y += 5;
    };

    const subHeaderP = (texto: string) => {
      checkPage(8);
      pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
      pdf.setFillColor(204, 255, 204); pdf.setDrawColor(0); pdf.rect(M, y, CW, 4, 'FD');
      pdf.text(texto, M + 1.5, y + 3); y += 4;
    };

    const textoLibreP = (texto: string, minH = 6) => {
      pdf.setDrawColor(0); pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(0);
      const lines = pdf.splitTextToSize(texto || '-', CW - 3);
      const h = Math.max(minH, lines.length * 3 + 2);
      checkPage(h + 2);
      pdf.rect(M, y, CW, h, 'S');
      pdf.text(lines, M + 1.5, y + 3);
      y += h;
    };

    const paginaHeaderP = (pagina: string) => {
      const tableStartY = y;
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, halign: 'center', fontSize: 8 }, columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 33 } }, body: [
        [{ content: '', rowSpan: 3, styles: { fontSize: 11, valign: 'middle' } }, { content: 'HISTORIA CLÍNICA OCUPACIONAL:\nEVALUACIÓN PREOCUPACIONAL - INICIO', rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, valign: 'middle' } }, { content: 'Código:   SO-RE-41', styles: { fontSize: 7, halign: 'left' } }],
        [{ content: 'Revisión:  1', styles: { fontSize: 7, halign: 'left' } }],
        [{ content: 'MACROPROCESO:  PLANIFICACIÓN, SEGURIDAD Y AMBIENTE', styles: { fontSize: 6, fontStyle: 'bold' } }, { content: pagina, styles: { fontSize: 7, halign: 'left' } }],
      ] });
      pdf.addImage(logoPdf.data, logoPdf.format, M + 1, tableStartY + 1, 40, 12);
      y += 2;
    };

    const siNoCalificadoP = (calificado: boolean | null, especificacion: string, observaciones: string) => {
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6 }, body: [[{ content: 'FUE CALIFICADO POR EL INSTITUTO DE SEGURIDAD SOCIAL CORRESPONDIENTE:', styles: { fontStyle: 'bold', cellWidth: 75 } }, { content: 'SI', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 7 } }, { content: calificado === true ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 7 } }, { content: 'ESPECIFICAR:', styles: { fontStyle: 'bold', cellWidth: 22 } }, { content: especificacion || '', styles: { cellWidth: 30 } }, { content: 'NO', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 7 } }, { content: calificado === false ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 7 } }]] });
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6 }, body: [[{ content: 'Observaciones:', styles: { fontStyle: 'bold', cellWidth: 25 } }, { content: observaciones || 'Ninguno' }]] });
    };

    // Fila de examen de tamizaje: SI / NO / tiempo / resultado
    const filaTamizaje = (nombre: string, ex: any) => ([
      nombre,
      ex?.realizado === true ? 'X' : '',
      ex?.realizado === false ? 'X' : '',
      ex?.tiempoAnios || '-',
      ex?.resultado || '-',
    ]);

    // ══════════ PÁGINA 1 ══════════
    paginaHeaderP('Página:    1 de 3');

    secHeaderP('A. DATOS DEL ESTABLECIMIENTO - EMPRESA Y USUARIO');
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head, head: [['INSTITUCIÓN DEL SISTEMA O NOMBRE DE LA EMPRESA', 'RUC', 'CIIU', 'ESTABLECIMIENTO DE SALUD', 'N° HISTORIA CLÍNICA', 'N° ARCHIVO']], body: [[empresa.institucion, empresa.ruc, empresa.ciu, empresa.establecimiento, ev.numeroHistoriaClinica || trabajador.cedula, ev.numeroArchivo || '-']] });
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head, head: [['PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'SEXO', 'FECHA DE INGRESO', 'PUESTO DE TRABAJO (CIUO)', 'ÁREA DE TRABAJO']], body: [[trabajador.primerApellido, (trabajador as any).segundoApellido || '-', trabajador.primerNombre, (trabajador as any).segundoNombre || '-', trabajador.sexo, (trabajador as any).fechaIngreso || '-', trabajador.puestoTrabajo, (trabajador as any).departamento || '-']] });
    if (ev.datosPersonales) {
      const dp = ev.datosPersonales;
      const disc = dp.discapacidad === true
        ? `SI${dp.discapacidadTipo ? ` · ${dp.discapacidadTipo}` : ''}${dp.discapacidadPorcentaje ? ` · ${dp.discapacidadPorcentaje}%` : ''}`
        : dp.discapacidad === false ? 'NO' : '-';
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head, head: [['RELIGIÓN', 'GRUPO SANGUÍNEO', 'LATERALIDAD', 'ORIENTACIÓN SEXUAL', 'IDENTIDAD DE GÉNERO', 'DISCAPACIDAD']], body: [[dp.religion || '-', dp.grupoSanguineo || '-', dp.lateralidad || '-', dp.orientacionSexual || '-', dp.identidadGenero || '-', disc]] });
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head, head: [['RAZA', 'ESTADO CIVIL', 'GRADO DE INSTRUCCIÓN', 'PROFESIÓN', 'ACTIVIDADES RELEVANTES AL PUESTO ACTUAL']], body: [[dp.raza || '-', dp.estadoCivil || '-', dp.gradoInstruccion || '-', dp.profesion || '-', dp.actividadesRelevantes || '-']] });
    }
    y += 2;

    secHeaderP('B. MOTIVO DE CONSULTA');
    textoLibreP((ev.motivoConsulta || 'EVALUACIÓN MÉDICA PREOCUPACIONAL DE INGRESO').toUpperCase(), 6);
    y += 1;

    secHeaderP('C. ANTECEDENTES PERSONALES');
    subHeaderP('ANTECEDENTES CLÍNICOS Y QUIRÚRGICOS');
    {
      const partes: string[] = [];
      if (ev.antecedentesClinicosQ === true && ev.antecedentesClinicosLista?.length > 0) {
        partes.push(ev.antecedentesClinicosLista.map((ac: any) => {
          let l = `Antecedentes Clínicos: ${ac.enfermedad || '?'}`;
          if (ac.desdeCuando) l += ` (desde ${ac.desdeCuando})`;
          if (ac.tomaMedicacion && ac.medicacionNombre) l += ` — Medicación: ${ac.medicacionNombre}${ac.medicacionDosis ? ' ' + ac.medicacionDosis : ''}${ac.medicacionFrecuencia ? ' ' + ac.medicacionFrecuencia : ''}`;
          if (ac.complicaciones) l += ` — Comp: ${ac.complicaciones}`;
          return l;
        }).join('\n'));
      } else if (ev.antecedentesClinicosQ === false) partes.push('Sin antecedentes clínicos.');
      if (ev.antecedentesQuirurgicosQ === true && ev.antecedentesQuirurgicosLista?.length > 0) {
        partes.push('Antecedentes quirúrgicos: ' + ev.antecedentesQuirurgicosLista.map((aq: any) => `${aq.procedimiento || '?'} (${aq.fechaAproximada || '?'})${aq.secuelas ? ', secuelas: ' + aq.secuelas : ''}`).join('; '));
      } else if (ev.antecedentesQuirurgicosQ === false) partes.push('Antecedentes quirúrgicos: Ninguno');
      if (ev.alergiasTiene === true && ev.alergias?.length > 0) {
        partes.push('Alergias: ' + ev.alergias.map((al: any) => `${al.alergeno || '?'} — ${al.intensidadReaccion || '?'}`).join('; '));
      } else if (ev.alergiasTiene === false) partes.push('Alergias: Ninguna');
      textoLibreP(partes.join('\n') || 'Sin antecedentes relevantes reportados.', 8);
    }
    y += 1;

    // Antecedentes gineco-obstétricos (sexo femenino)
    if (ev.antecedentesGineco) {
      const g = ev.antecedentesGineco;
      checkPage(30);
      subHeaderP('ANTECEDENTES GINECO OBSTÉTRICOS');
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6, halign: 'center' }, headStyles: { ...head, fontSize: 5.5, halign: 'center' }, head: [['MENARQUÍA', 'CICLOS', 'F. ÚLTIMA MENSTRUACIÓN', 'GESTAS', 'PARTOS', 'CESÁREAS', 'ABORTOS', 'HIJOS VIVOS', 'HIJOS MUERTOS', 'VIDA SEXUAL ACTIVA', 'PLANIFICACIÓN FAMILIAR']], body: [[g.menarquia || '-', g.ciclos || '-', g.fum || '-', g.gestas || '-', g.partos || '-', g.cesareas || '-', g.abortos || '-', g.hijosVivos || '-', g.hijosMuertos || '-', g.vidaSexualActiva === true ? 'SI' : g.vidaSexualActiva === false ? 'NO' : '-', g.planificacionFamiliar === true ? `SI${g.planificacionTipo ? ': ' + g.planificacionTipo : ''}` : g.planificacionFamiliar === false ? 'NO' : '-']] });
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6 }, headStyles: { ...head, fontSize: 5.5 }, head: [['EXÁMENES REALIZADOS', 'SI', 'NO', 'TIEMPO (años)', 'RESULTADO']], body: [
        filaTamizaje('PAPANICOLAOU', g.papanicolaou),
        filaTamizaje('COLPOSCOPIA', g.colposcopia),
        filaTamizaje('ECO MAMARIO', g.ecoMamario),
        filaTamizaje('MAMOGRAFÍA', g.mamografia),
      ], columnStyles: { 1: { halign: 'center', cellWidth: 8 }, 2: { halign: 'center', cellWidth: 8 }, 3: { halign: 'center', cellWidth: 22 } } });
      y += 1;
    }

    // Antecedentes reproductivos masculinos
    if (ev.antecedentesReproductivos) {
      const r = ev.antecedentesReproductivos;
      checkPage(24);
      subHeaderP('ANTECEDENTES REPRODUCTIVOS MASCULINOS');
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6 }, headStyles: { ...head, fontSize: 5.5 }, head: [['EXÁMENES REALIZADOS', 'SI', 'NO', 'TIEMPO (años)', 'RESULTADO']], body: [
        filaTamizaje('ANTÍGENO PROSTÁTICO', r.antigenoProstatico),
        filaTamizaje('ECO PROSTÁTICO', r.ecoProstatico),
      ], columnStyles: { 1: { halign: 'center', cellWidth: 8 }, 2: { halign: 'center', cellWidth: 8 }, 3: { halign: 'center', cellWidth: 22 } } });
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6, halign: 'center' }, headStyles: { ...head, fontSize: 5.5, halign: 'center' }, head: [['MÉTODO DE PLANIFICACIÓN FAMILIAR', 'TIPO', 'HIJOS VIVOS', 'HIJOS MUERTOS']], body: [[r.planificacionFamiliar === true ? 'SI' : r.planificacionFamiliar === false ? 'NO' : '-', r.planificacionTipo || '-', r.hijosVivos || '-', r.hijosMuertos || '-']] });
      y += 1;
    }

    // Hábitos tóxicos + estilo de vida
    if (ev.habitosToxicos?.length > 0) {
      checkPage(20);
      subHeaderP('HÁBITOS TÓXICOS Y ESTILO DE VIDA');
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5 }, headStyles: { ...head, fontSize: 6 },
        head: [['CONSUMOS NOCIVOS', 'SI', 'NO', 'TIEMPO CONSUMO (meses)', 'CANTIDAD', 'EX CONSUMIDOR', 'TIEMPO ABSTINENCIA (meses)']],
        body: ev.habitosToxicos.map((h: any) => [h.tipo.toUpperCase(), h.consume ? 'X' : '', h.consume ? '' : 'X', h.tiempoConsumo || '-', h.cantidad || '-', h.exConsumidor ? 'X' : '', h.tiempoAbstinencia || '-']),
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 5: { halign: 'center' } } });
    }
    if (ev.estiloVida) {
      const tieneMedicacion = (ev.medicacionesHabituales?.length > 0) || !!ev.estiloVida.medicacionHabitual;
      const medTexto = ev.medicacionesHabituales?.length > 0
        ? ev.medicacionesHabituales.map((m: any) => `${m.nombre}${m.dosis ? ' ' + m.dosis : ''}${m.frecuencia ? ' ' + m.frecuencia : ''}`).join('; ')
        : ev.estiloVida.medicacionHabitual || '-';
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5 }, headStyles: { ...head, fontSize: 6 },
        head: [['ESTILO DE VIDA', 'SI', 'NO', '¿CUÁL?', 'TIEMPO / CANTIDAD']],
        body: [
          ['ACTIVIDAD FÍSICA', ev.estiloVida.actividadFisica ? 'X' : '', ev.estiloVida.actividadFisica ? '' : 'X', ev.estiloVida.tipoActividad || '-', ev.estiloVida.tiempoCantidad || '-'],
          ['MEDICACIÓN HABITUAL', tieneMedicacion ? 'X' : '', tieneMedicacion ? '' : 'X', medTexto, '-'],
        ],
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } } });
    }
    y += 2;

    checkPage(40);
    secHeaderP('D. ANTECEDENTES DE TRABAJO');
    subHeaderP('ANTECEDENTES DE EMPLEOS ANTERIORES');
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5 }, body: [[{ content: 'EDAD A LA QUE INICIÓ SU ACTIVIDAD LABORAL:', styles: { fontStyle: 'bold', cellWidth: 90 } }, { content: ev.edadInicioLaboral ? `${ev.edadInicioLaboral} años` : '-' }]] });
    if (ev.antecedentesEmpleos?.length > 0) {
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6 }, headStyles: { ...head, fontSize: 5.5 },
        head: [['EMPRESA', 'PUESTO DE TRABAJO', 'ACTIVIDADES QUE DESEMPEÑABA', 'TIEMPO (meses)', 'RIESGOS', 'OBSERVACIONES']],
        body: ev.antecedentesEmpleos.map((e: any) => [e.empresa || '-', e.puesto || '-', e.actividades || '-', e.tiempoMeses || '-', (e.riesgos || []).join(', ') || '-', e.observaciones || '-']),
        columnStyles: { 3: { halign: 'center', cellWidth: 14 } } });
    } else {
      textoLibreP('Sin empleos anteriores registrados (primer empleo).', 5);
    }
    y += 1;

    checkPage(28);
    subHeaderP('ACCIDENTES DE TRABAJO (DESCRIPCIÓN)');
    textoLibreP(ev.accidentesTrabajo?.descripcion || 'NINGUNO', 6);
    siNoCalificadoP(ev.accidentesTrabajo?.descripcion ? (ev.accidentesTrabajo?.calificado ?? null) : null, ev.accidentesTrabajo?.especificacion || '', ev.accidentesTrabajo?.observaciones || 'Ninguno');
    y += 1;

    checkPage(28);
    subHeaderP('ENFERMEDADES PROFESIONALES');
    textoLibreP(ev.enfermedadesProfesionales?.descripcion || 'NINGUNA', 6);
    siNoCalificadoP(ev.enfermedadesProfesionales?.descripcion ? (ev.enfermedadesProfesionales?.calificada ?? null) : null, ev.enfermedadesProfesionales?.especificacion || '', ev.enfermedadesProfesionales?.observaciones || 'Ninguno');

    // ══════════ PÁGINA 2 ══════════
    pdf.addPage(); y = 7;
    paginaHeaderP('Página:    2 de 3');

    secHeaderP('E. ANTECEDENTES FAMILIARES (DETALLAR EL PARENTESCO)');
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
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 5.5, cellPadding: 1 }, body: dBody, columnStyles: { 1: { cellWidth: 4 }, 3: { cellWidth: 4 }, 5: { cellWidth: 4 }, 7: { cellWidth: 4 } } });
    if (ev.antecedentesFamiliares && ev.antecedentesFamiliares.length > 0) {
      const famPorTipo: Record<string, string[]> = {};
      ev.antecedentesFamiliares.forEach((af: any) => { if (!famPorTipo[af.tipo]) famPorTipo[af.tipo] = []; famPorTipo[af.tipo].push(`${af.parentesco || '?'}${af.descripcion ? ' con ' + af.descripcion : ''}`); });
      textoLibreP(Object.entries(famPorTipo).map(([tipo, entries]) => `${tipo}: ${entries.join(', ')}`).join('\n'), 5);
    } else {
      textoLibreP('No se refieren antecedentes familiares de importancia.', 5);
    }
    y += 2;

    if (ev.factoresRiesgo) {
      secHeaderP('F. FACTORES DE RIESGOS DEL PUESTO DE TRABAJO ACTUAL');
      // Matriz oficial: una columna por factor (rótulo rotado) con X en lo
      // marcado. En este formato la matriz se alarga (encabezado más alto y
      // 3 filas compactas) para que la página quede completa, sin espacio
      // muerto al final.
      y = dibujarFactoresRiesgoPdf(pdf, ev.factoresRiesgo, { M, CW, y, puestoDefault: trabajador.puestoTrabajo, filas: 3, altoEncabezado: 48, altoFila: 5 });
      y += 2;
    }

    secHeaderP('G. ACTIVIDADES EXTRA LABORALES');
    textoLibreP(ev.actividadesExtraLaborales || 'Ninguna relevante reportada.', 6);
    y += 1;

    secHeaderP('H. ENFERMEDAD ACTUAL');
    textoLibreP(ev.enfermedadActual || 'PACIENTE ASINTOMÁTICO AL MOMENTO DE LA VALORACIÓN.', 8);
    y += 1;

    secHeaderP('I. REVISIÓN ACTUAL DE ÓRGANOS Y SISTEMAS');
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
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 5.5, cellPadding: 1 }, body: gBody, columnStyles: { 1: { cellWidth: 4 }, 3: { cellWidth: 4 }, 5: { cellWidth: 4 }, 7: { cellWidth: 4 }, 9: { cellWidth: 4 } } });
    if (ev.revisionSistemasSeleccionados && ev.revisionSistemasSeleccionados.length > 0) {
      const textContent = ev.revisionSistemasSeleccionados.map((s: string) => {
        const nm = SISTEMAS.indexOf(s) + 1;
        return `${nm}. ${s}: ${ev.revisionSistemasDescripciones?.[s] || '-'}`;
      }).join('\n');
      textoLibreP(textContent, 8);
    } else {
      textoLibreP('Paciente no refiere síntomas adicionales.', 5);
    }
    y += 2;

    checkPage(20);
    secHeaderP('J. CONSTANTES VITALES Y ANTROPOMETRÍA');
    const sv = ev.signosVitales || {};
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head, head: [['PRESIÓN ARTERIAL\n(mmHg)', 'TEMPERATURA\n(°C)', 'FRECUENCIA CARDIACA\n(Lat/min)', 'SATURACIÓN DE\nOXÍGENO (O2%)', 'FRECUENCIA\nRESPIRATORIA (fr/min)', 'PESO\n(Kg)', 'TALLA\n(cm)', 'ÍNDICE DE MASA\nCORPORAL (kg/m²)', 'PERÍMETRO\nABDOMINAL (cm)']], body: [[`${sv.presionSistolica || '-'}/${sv.presionDiastolica || '-'}`, sv.temperatura || '-', sv.frecuenciaCardiaca || '-', sv.saturacion || '-', sv.frecuenciaRespiratoria || '-', sv.peso || '-', sv.talla || '-', sv.imc ? Number(sv.imc).toFixed(1) : '-', sv.perimetroAbdominal || '-']], bodyStyles: { halign: 'center' } });

    // ══════════ PÁGINA 3 ══════════
    pdf.addPage(); y = 7;
    paginaHeaderP('Página:    3 de 3');

    secHeaderP('K. EXAMEN FÍSICO REGIONAL');
    const pdfFisicoRowsP = FISICO_ROWS.map(row => row.map((cell: any) => {
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
      body: pdfFisicoRowsP as any,
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
    const hallazgosP = ev.examenFisicoHallazgos || [];
    if (hallazgosP.length > 0) {
      textoLibreP('Observaciones:\n' + hallazgosP.map((h: any) => `${h.codigo}. ${h.region || ''}, ${h.subregion || ''}: ${h.descripcion || '-'}`).join('\n'), 6);
    } else {
      textoLibreP('Observaciones: Sin hallazgos patológicos al examen físico regional.', 5);
    }
    y += 1;

    secHeaderP('L. RESULTADOS DE EXÁMENES GENERALES Y ESPECÍFICOS DE ACUERDO AL RIESGO Y PUESTO DE TRABAJO');
    const examsValidosP = (ev.examenesComplementarios || []).filter((e: any) => e.nombre?.trim());
    if (examsValidosP.length > 0) {
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5 }, headStyles: { ...head, fontSize: 6 }, head: [['EXAMEN', 'FECHA\naaaa / mm / dd', 'RESULTADOS']], body: examsValidosP.map((e: any) => [e.nombre, e.fecha || '-', e.resultado || '-']) });
    } else {
      textoLibreP('Sin exámenes complementarios registrados.', 6);
    }
    y += 1;

    checkPage(20);
    secHeaderP('M. DIAGNÓSTICO                    PRE= PRESUNTIVO          DEF= DEFINITIVO');
    const dxValidosP = (ev.diagnosticos || []).filter((d: any) => d.descripcion?.trim());
    if (dxValidosP.length > 0) {
      AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5, halign: 'center' }, headStyles: { ...head, fontSize: 6, halign: 'center' }, head: [['N°', 'DESCRIPCIÓN', 'CIE', 'PRE', 'DEF']], body: dxValidosP.map((dx: any, i: number) => [`${i + 1}`, { content: dx.descripcion, styles: { halign: 'left' } }, dx.cie || '-', dx.tipo === 'presuntivo' ? 'X' : '', dx.tipo === 'definitivo' ? 'X' : '']), columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 10 }, 4: { cellWidth: 10 } } });
    } else {
      textoLibreP('PACIENTE SANO.', 5);
    }
    y += 1;

    checkPage(20);
    secHeaderP('N. APTITUD MÉDICA PARA EL TRABAJO');
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, halign: 'center', fontSize: 7 }, headStyles: { ...head, halign: 'center', fontSize: 6.5 }, head: [['APTO', 'APTO EN OBSERVACIÓN', 'APTO CON LIMITACIONES', 'NO APTO']], body: [[(!ev.aptitudMedica || ev.aptitudMedica === 'apto') ? 'X' : '', ev.aptitudMedica === 'aptoObservacion' ? 'X' : '', ev.aptitudMedica === 'aptoLimitaciones' ? 'X' : '', ev.aptitudMedica === 'noApto' ? 'X' : '']] });
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5, halign: 'left' }, body: [[`Observación:  ${ev.aptitudObservacion || '-'}`], [`Limitación:   ${ev.aptitudLimitaciones || '-'}`]] });
    y += 1;

    secHeaderP('O. RECOMENDACIONES Y/O TRATAMIENTO');
    textoLibreP((Array.isArray(ev.recomendaciones) ? ev.recomendaciones.join('; ') + (ev.recomendacionesOtras ? `; ${ev.recomendacionesOtras}` : '') : ev.recomendaciones || 'Ninguna particular al momento.'), 8);
    y += 2;

    checkPage(15);
    pdf.setFillColor(248, 248, 248); pdf.setDrawColor(0);
    const certTextP = 'CERTIFICO QUE LO ANTERIORMENTE EXPRESADO EN RELACIÓN A MI ESTADO DE SALUD ES VERDAD. SE ME HA INFORMADO LAS MEDIDAS PREVENTIVAS A TOMAR PARA DISMINUIR O MITIGAR LOS RIESGOS RELACIONADOS CON MI ACTIVIDAD LABORAL.';
    const certLinesP = pdf.splitTextToSize(certTextP, CW - 3);
    const certHP = certLinesP.length * 3 + 3;
    pdf.rect(M, y, CW, certHP, 'FD'); pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.text(certLinesP, M + 1.5, y + 3); y += certHP + 3;

    checkPage(25);
    secHeaderP('P. DATOS DEL PROFESIONAL                                                                             Q. FIRMA DEL USUARIO');
    AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5, halign: 'center' }, headStyles: { ...head, fontSize: 6, halign: 'center' }, head: [['FECHA\naaaa-mm-dd', 'HORA', 'NOMBRES Y APELLIDOS', 'CÓDIGO', 'FIRMA Y SELLO', 'FIRMA DEL USUARIO']], body: [[fmtF(ev.fecha), fmtHora(ev.fecha), (ev.medicoNombre || 'MÉDICO OCUPACIONAL').toUpperCase(), ev.medicoCedula || '-', '', '']], bodyStyles: { minCellHeight: 18, valign: 'bottom', halign: 'center' } });

    pdf.save(`SO-RE-41_PREOCUPACIONAL_${trabajador.primerApellido}_${trabajador.primerNombre}_${fmtF(ev.fecha)}.pdf`);
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
    <>
      <FichaLayout
        trabajador={trabajador}
        nombreCompleto={nombreCompleto}
        evaluaciones={evaluaciones}
        permisos={permisos}
        atenciones={atenciones}
        ordenes={ordenes}
        totalPatologicos={totalPatologicos}
        examenesPanel={
          <ExamenesPanel
            trabajadorId={trabajadorId}
            trabajadorNombre={nombreCompleto}
            evaluaciones={evaluaciones}
          />
        }
        busquedaEval={busquedaEval}
        setBusquedaEval={setBusquedaEval}
        onBack={() => navigate(-1)}
        onOpenEval={setEvDrawer}
        onEditarDatos={abrirModalEditar}
        onNuevaPeriodica={() => navigate(`/evaluar/${trabajadorId}`)}
        onNuevaRetiro={() => navigate(`/evaluar-retiro/${trabajadorId}`)}
        onNuevaPreocupacional={() => navigate(`/evaluar-preocupacional/${trabajadorId}`)}
        onNuevoPermiso={() => navigate('/permisos')}
        onEditPermiso={abrirEditPermiso}
        onDeletePermiso={handleEliminarPermiso}
        onPedirCert={(p) => { setPendingCertId(p.id!); certInputRef.current?.click(); }}
        subiendoCert={subiendoCert}
        onVerOrden={setOrdenDetalle}
        onDeleteOrden={eliminarOrdenExamen}
        onVerPdf={(url, nombre) => setPdfVisor({ url, nombre })}
        ergonomia={
          <div className="max-w-[1100px] mx-auto px-6 pb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] font-bold text-slate-800">Evaluaciones ergonómicas</span>
                <span className="text-[11px] text-slate-400">{evalsErgo.length}</span>
                <button
                  onClick={() => navigate('/ergonomia')}
                  className="ml-auto text-[12px] font-semibold bg-transparent border-none cursor-pointer p-0"
                  style={{ color: '#0d9488' }}
                >
                  Abrir módulo de Ergonomía →
                </button>
              </div>
              {evalsErgo.length === 0 ? (
                <p className="m-0 text-[12px] text-slate-400">Sin evaluaciones ergonómicas registradas para este trabajador.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {evalsErgo.slice(0, 5).map((ev) => {
                    const tone = ev.resultado.tone === 'danger' ? { fg: '#a01f2a', bg: '#fce8eb' }
                      : ev.resultado.tone === 'warning' ? { fg: '#8a4a0a', bg: '#fff4e3' } : { fg: '#0a6b3b', bg: '#e6f6ee' };
                    return (
                      <div key={ev.id} className="flex items-center gap-2.5 py-1.5 border-b border-slate-50 last:border-0 text-[12.5px]">
                        <span className="font-bold" style={{ color: '#0d9488' }}>{ev.metodo}</span>
                        <span className="text-slate-500">{fmtF(ev.fecha)}</span>
                        <span className="text-slate-400 truncate flex-1">{ev.tarea || '—'}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold whitespace-nowrap" style={{ color: tone.fg, background: tone.bg }}>
                          {ev.resultado.puntajeFinal} · {ev.resultado.nivel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* hidden file input for cert upload */}
      <input
        ref={certInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && pendingCertId) subirCertificado(pendingCertId, file);
          setPendingCertId(null);
          e.target.value = '';
        }}
      />



      {/* ── MODAL ORDEN EXAMEN ── */}
      {ordenDetalle && (
        <OrdenDetalleModal
          orden={ordenDetalle}
          trabajadorId={trabajadorId}
          medicoId={user?.uid ?? ''}
          medicoNombre={displayName}
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
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  {(evDrawer as any).tipo === 'RETIRO' ? 'Evaluación de Retiro SO-RE-40'
                    : String((evDrawer as any).tipoEvaluacion || '').includes('preocupacional') ? 'Evaluación Preocupacional SO-RE-41'
                    : 'Historia Clínica SO-RE-38'}
                </p>
                <p className="text-base font-bold text-slate-800">{fmtFH((evDrawer as any).fecha)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const ev: any = evDrawer;
                    if (ev.tipo === 'RETIRO') navigate(`/evaluar-retiro/${trabajadorId}?editId=${ev.id}`);
                    else if (String(ev.tipoEvaluacion || '').includes('preocupacional')) navigate(`/evaluar-preocupacional/${trabajadorId}?editId=${ev.id}`);
                    else navigate(`/evaluar/${trabajadorId}?editId=${ev.id}`);
                  }}
                  className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600"
                >✏️ Editar</button>
                <button
                  onClick={() => {
                    const ev: any = evDrawer;
                    if (ev.tipo === 'RETIRO') generarPDFRetiro(ev);
                    else if (String(ev.tipoEvaluacion || '').includes('preocupacional')) generarPDFPreocupacional(ev);
                    else generarPDF(ev);
                  }}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700"
                >📄 PDF</button>
                <button
                  onClick={() => { setCertEval(evDrawer); setEvDrawer(null); }}
                  title="Certificado de Aptitud Médico Laboral (SO-RE-20)"
                  className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700"
                >📜 Certificado{(evDrawer as any).certificadoAptitud ? ' ✓' : ''}</button>
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
                        <KV k="Institución" v={empresa.institucion} /><KV k="RUC" v={empresa.ruc} />
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
      {/* ── CERTIFICADO DE APTITUD (SO-RE-20) ── */}
      {certEval && trabajador && (
        <CertificadoAptitudModal
          evaluacion={certEval}
          trabajador={trabajador}
          empresa={empresa}
          logoPdf={logoPdf}
          onClose={() => setCertEval(null)}
          onGuardado={(cert) => {
            setEvaluaciones(prev => prev.map(e => e.id === certEval.id ? { ...e, certificadoAptitud: cert } : e));
            toast.success('Certificado de aptitud guardado y descargado.');
          }}
        />
      )}

      {/* ── VISOR PDF FLOTANTE ── */}
      {pdfVisor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setPdfVisor(null)}>
          <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-4xl" style={{ height: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
              <span className="text-sm font-semibold text-slate-700 truncate">{pdfVisor.nombre}</span>
              <div className="flex items-center gap-2 shrink-0">
                <a href={pdfVisor.url} download={pdfVisor.nombre} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200">
                  ⬇ Descargar
                </a>
                <button onClick={() => setPdfVisor(null)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
              </div>
            </div>
            <iframe src={pdfVisor.url} className="flex-1 w-full rounded-b-xl" title={pdfVisor.nombre} />
          </div>
        </div>
      )}
    </>
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
