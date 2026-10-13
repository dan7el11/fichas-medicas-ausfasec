import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

/**
 * El PDF y el Excel de una evaluación tienen que ser el mismo documento.
 *
 * El Excel no tiene maqueta propia: repite la secuencia de dibujo del botón del
 * PDF (`generarPDFOcupacional`) y traslada lo dibujado a la hoja. Esa secuencia
 * está escrita dos veces, así que aquí se monta la ficha real, se pulsan los
 * dos botones y se compara, operación por operación, lo que dibuja cada uno.
 * Si alguien cambia el PDF y no el Excel (o al revés), esta prueba falla.
 */

const { instancias } = vi.hoisted(() => ({ instancias: [] as any[] }));

// Cada documento jsPDF que se cree queda registrado desde el constructor.
vi.mock('jspdf', async (importOriginal) => {
  const real: any = await importOriginal();
  const Base = real.jsPDF ?? real.default;
  const { grabarDibujo } = await import('../../utils/grabadorPdf');
  class Registrado extends Base {
    constructor(...args: any[]) {
      super(...args);
      grabarDibujo(this as any);
      instancias.push(this);
    }
  }
  return { ...real, default: Registrado, jsPDF: Registrado };
});

// ── Firestore y Storage ──────────────────────────────────────────────────────
const { evaluacion, trabajadorGuardado } = vi.hoisted(() => ({
  evaluacion: {
    id: 'ev1', formato: 'ocupacional-unificado', tipoEvaluacion: 'retiro',
    fecha: { seconds: 1760000000, nanoseconds: 0 },
    motivoConsulta: 'Evaluación de retiro',
    datosPersonales: { grupoSanguineo: 'O +', lateralidad: 'DERECHO', fechaNacimiento: '1982-06-15' },
    signosVitales: { presionSistolica: '120', presionDiastolica: '80', talla: '172' },
    examenFisicoHallazgos: [{ codigo: '8b', region: 'Tórax', subregion: 'Corazón', descripcion: 'soplo' }],
    factoresRiesgo: { puestoArea: 'GERENTE COMERCIAL', actividadesJornada: ['Planificar', 'Supervisar'], riesgoActividades: { Ruido: [0, 1] } },
    antecedentesEmpleos: [{ empresa: 'AUSTROGAS', actividades: 'Planificar; Supervisar', tiempoMeses: '78', esActual: true }],
    diagnosticos: [{ cie: 'I10', descripcion: 'Hipertensión esencial', tipo: 'definitivo' }],
    aptitudMedica: 'aptoObservacion', recomendaciones: ['Dieta baja en sal'],
    retiroEvaluacionRealizada: true,
  },
  trabajadorGuardado: {
    id: 't1', primerNombre: 'José', primerApellido: 'Jiménez',
    cedula: '1204208001', sexo: 'M', puestoTrabajo: 'GERENTE COMERCIAL', fechaNacimiento: '1982-06-15',
  },
}));

vi.mock('firebase/firestore', () => {
  // Sólo la colección de evaluaciones trae datos; las demás, vacías.
  const porColeccion = (nombre: string) => (nombre === 'evaluaciones' ? [{ id: 'ev1', data: () => evaluacion }] : []);
  return {
    doc: vi.fn(() => ({})),
    getDoc: vi.fn(async () => ({ exists: () => true, id: 't1', data: () => trabajadorGuardado })),
    updateDoc: vi.fn(async () => undefined),
    setDoc: vi.fn(async () => undefined),
    collection: vi.fn((_db: any, nombre: string) => ({ _nombre: nombre })),
    query: vi.fn((ref: any) => ref),
    where: vi.fn(() => ({})),
    orderBy: vi.fn(() => ({})),
    limit: vi.fn(() => ({})),
    getDocs: vi.fn(async (ref: any) => {
      const docs = porColeccion(ref?._nombre ?? '');
      return { docs, forEach: (f: any) => docs.forEach(f), size: docs.length, empty: !docs.length };
    }),
    Timestamp: { now: () => ({ seconds: 0 }) },
    serverTimestamp: vi.fn(() => ({})),
    addDoc: vi.fn(async () => ({ id: 'x' })),
    deleteDoc: vi.fn(async () => undefined),
  };
});
vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({})), uploadBytes: vi.fn(async () => ({})),
  getDownloadURL: vi.fn(async () => 'https://ejemplo/doc.pdf'), getBlob: vi.fn(async () => new Blob()),
}));
vi.mock('../../services/firebase', () => ({ db: {}, storage: {}, auth: {} }));
vi.mock('../../services/auditoria', () => ({ registrarAuditoria: vi.fn(async () => undefined) }));
vi.mock('../../services/ergonomia', () => ({ getEvaluacionesErgoDeTrabajador: vi.fn(async () => []) }));
vi.mock('../../services/examenesPlan', () => ({ getOrdenes: vi.fn(async () => []), eliminarOrden: vi.fn(async () => undefined) }));
vi.mock('../../services/permisos', () => ({
  estadoPermiso: () => 'vigente', duracionPermiso: () => 1, fmtFecha: () => '2026-01-01',
  toDate: (f: any) => (f?.seconds ? new Date(f.seconds * 1000) : null),
  actualizarPermiso: vi.fn(), eliminarPermiso: vi.fn(),
}));
vi.mock('../../services/cambioCargo', () => ({ cambiarCargo: vi.fn() }));

// ── Contextos y navegación ───────────────────────────────────────────────────
const { avisos } = vi.hoisted(() => ({ avisos: [] as string[] }));
vi.mock('../Toast', () => ({
  useToast: () => ({
    success: (m: string) => avisos.push('ok: ' + m),
    error: (m: string) => avisos.push('ERROR: ' + m),
    warning: (m: string) => avisos.push('aviso: ' + m),
    info: (m: string) => avisos.push('info: ' + m),
  }),
}));
vi.mock('../ConfirmDialog', () => ({ useConfirm: () => vi.fn(async () => true) }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'medico@ejemplo.com' }, nombreProfesional: 'Dra. Ruiz' }),
}));
vi.mock('../../contexts/EmpresaContext', () => ({
  useEmpresa: () => ({ empresa: { institucion: 'AUSTROGAS', ruc: '190070301001', ciu: '4661', establecimiento: 'MEDICINA OCUPACIONAL' } }),
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));
vi.mock('../examenes/ExamenesPanel', () => ({ default: () => null }));
vi.mock('../examenes/ExamenModales', () => ({ OrdenDetalleModal: () => null }));

import FichaTrabajador from './FichaTrabajador';

describe('PDF y Excel de una evaluación guardada', () => {
  beforeEach(() => {
    instancias.length = 0;
    avisos.length = 0;
    URL.createObjectURL = vi.fn(() => 'blob:prueba');
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  it('dibujan exactamente lo mismo', async () => {
    render(<FichaTrabajador trabajadorId="t1" />);
    await waitFor(() => expect(screen.queryAllByText(/Jiménez/).length).toBeGreaterThan(0), { timeout: 10_000 });

    await act(async () => { fireEvent.click(await screen.findByTitle('Descargar el PDF')); });
    await waitFor(() => expect(instancias).toHaveLength(1), { timeout: 10_000 });

    await act(async () => { fireEvent.click(await screen.findByTitle('Descargar la ficha en Excel editable')); });
    await waitFor(() => expect(avisos.some(a => a.startsWith('ok:') || a.startsWith('ERROR'))).toBe(true), { timeout: 30_000 });
    expect(avisos.filter(a => a.startsWith('ERROR'))).toEqual([]);
    expect(instancias).toHaveLength(2);

    const delPdf = instancias[0].__grabacion;
    const delExcel = instancias[1].__grabacion;
    expect(delPdf.paginas()).toEqual(delExcel.paginas());
    expect(delPdf.ops.length).toBeGreaterThan(500);
    expect(delExcel.ops).toEqual(delPdf.ops);
  }, 60_000);
});
