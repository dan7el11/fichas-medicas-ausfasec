import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';

/**
 * Fecha y eliminación de evaluaciones desde la ficha del trabajador, sobre el
 * componente real. Las operaciones de Firestore se prueban aparte
 * (services/evaluaciones.test.ts); aquí, que la ficha las use bien y se
 * actualice en el acto.
 */

const { evaluaciones, servicio, confirmar } = vi.hoisted(() => ({
  evaluaciones: [] as any[],
  servicio: {
    cambiarFecha: [] as any[],
    eliminadas: [] as string[],
    corregidas: [] as string[],
  },
  confirmar: { respuesta: true, mensajes: [] as string[] },
}));

vi.mock('../../services/evaluaciones', async (importOriginal) => {
  const real: any = await importOriginal();
  const { fechaDeAtencion } = await import('../../utils/fechaEvaluacion');
  return {
    ...real,
    cambiarFechaEvaluacion: vi.fn(async (ev: any, dia: string) => {
      servicio.cambiarFecha.push({ id: ev.id, dia });
      return fechaDeAtencion(dia, ev.fecha);
    }),
    eliminarEvaluacion: vi.fn(async (id: string) => { servicio.eliminadas.push(id); }),
    corregirFechasGuardadas: vi.fn(async (evs: any[]) => { evs.forEach(e => servicio.corregidas.push(e.id)); return new Map(); }),
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(async () => ({
    exists: () => true, id: 't1',
    data: () => ({ id: 't1', primerNombre: 'José', primerApellido: 'Jiménez', cedula: '1204208001', sexo: 'M', puestoTrabajo: 'GERENTE COMERCIAL' }),
  })),
  updateDoc: vi.fn(async () => undefined), setDoc: vi.fn(async () => undefined),
  collection: vi.fn((_db: any, nombre: string) => ({ _nombre: nombre })),
  query: vi.fn((ref: any) => ref), where: vi.fn(() => ({})), orderBy: vi.fn(() => ({})), limit: vi.fn(() => ({})),
  getDocs: vi.fn(async (ref: any) => {
    const docs = ref?._nombre === 'evaluaciones' ? evaluaciones.map(e => ({ id: e.id, data: () => e })) : [];
    return { docs, forEach: (f: any) => docs.forEach(f), size: docs.length, empty: !docs.length };
  }),
  Timestamp: { now: () => ({ seconds: 0 }) }, serverTimestamp: vi.fn(() => ({})),
  addDoc: vi.fn(async () => ({ id: 'x' })), deleteDoc: vi.fn(async () => undefined),
  arrayRemove: vi.fn(), arrayUnion: vi.fn(),
}));
vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({})), uploadBytes: vi.fn(async () => ({})),
  getDownloadURL: vi.fn(async () => ''), getBlob: vi.fn(async () => new Blob()),
}));
vi.mock('../../services/firebase', () => ({ db: {}, storage: {}, auth: {} }));
vi.mock('../../services/auditoria', () => ({ registrarAuditoria: vi.fn(async () => undefined), registrarEliminacionConCopia: vi.fn() }));
vi.mock('../../services/ergonomia', () => ({ getEvaluacionesErgoDeTrabajador: vi.fn(async () => []) }));
vi.mock('../../services/examenesPlan', () => ({ getOrdenes: vi.fn(async () => []), eliminarOrden: vi.fn(async () => undefined) }));
vi.mock('../../services/permisos', () => ({
  estadoPermiso: () => 'vigente', duracionPermiso: () => 1, fmtFecha: () => '2026-01-01',
  toDate: (f: any) => (f?.seconds ? new Date(f.seconds * 1000) : null),
  actualizarPermiso: vi.fn(), eliminarPermiso: vi.fn(),
}));
vi.mock('../../services/cambioCargo', () => ({ cambiarCargo: vi.fn() }));
vi.mock('../Toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }) }));
vi.mock('../ConfirmDialog', () => ({
  useConfirm: () => async (o: any) => { confirmar.mensajes.push(o.message ?? o); return confirmar.respuesta; },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' }, nombreProfesional: 'Dra. Ruiz' }) }));
vi.mock('../../contexts/EmpresaContext', () => ({ useEmpresa: () => ({ empresa: { institucion: 'AUSTROGAS' } }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useSearchParams: () => [new URLSearchParams(), vi.fn()] }));
vi.mock('../examenes/ExamenesPanel', () => ({ default: () => null }));
vi.mock('../examenes/ExamenModales', () => ({ OrdenDetalleModal: () => null }));

import FichaTrabajador from './FichaTrabajador';

const ts = (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 });

async function montar() {
  render(<FichaTrabajador trabajadorId="t1" />);
  await waitFor(() => expect(screen.getAllByTitle('Ver el detalle').length).toBeGreaterThan(0), { timeout: 10_000 });
}

/** Fila de la lista que muestra el día y el mes dados. */
const filaDel = (dia: string, mes: RegExp) =>
  screen.getAllByTitle('Ver el detalle').find(b => within(b).queryByText(dia) && mes.test(b.textContent ?? ''));

beforeEach(() => {
  evaluaciones.length = 0;
  servicio.cambiarFecha.length = 0;
  servicio.eliminadas.length = 0;
  servicio.corregidas.length = 0;
  confirmar.respuesta = true;
  confirmar.mensajes.length = 0;
});

describe('fecha de las evaluaciones en la ficha', () => {
  it('muestra la fecha de atención elegida, no la de creación, y la corrige', async () => {
    // Creada el 9 de octubre; en el formulario se le puso el 2 de octubre.
    evaluaciones.push({
      id: 'ev1', trabajadorId: 't1', formato: 'ocupacional-unificado', tipoEvaluacion: 'periodica',
      fecha: ts(new Date(2025, 9, 9, 8, 53)), fechaAtencion: '2025-10-02', aptitudMedica: 'apto',
    });
    await montar();
    expect(filaDel('02', /oct/i)).toBeTruthy();
    expect(filaDel('09', /oct/i)).toBeFalsy();
    expect(servicio.corregidas).toEqual(['ev1']);
  }, 30_000);

  it('se cambia desde el detalle, también en los formatos antiguos', async () => {
    evaluaciones.push({ id: 'ev2', trabajadorId: 't1', tipo: 'PERIODICA', fecha: ts(new Date(2024, 2, 3, 9, 0)), aptitudMedica: 'apto' });
    await montar();
    await act(async () => { fireEvent.click(filaDel('03', /mar/i)!); });
    await act(async () => { fireEvent.click(await screen.findByText('Cambiar fecha')); });
    const campo = document.querySelector('input[type="date"][max]') as HTMLInputElement;
    expect(campo.value).toBe('2024-03-03');
    await act(async () => { fireEvent.change(campo, { target: { value: '2024-02-28' } }); });
    await act(async () => { fireEvent.click(screen.getByText('Guardar')); });
    expect(servicio.cambiarFecha).toEqual([{ id: 'ev2', dia: '2024-02-28' }]);
    // La lista se actualiza sin recargar.
    await waitFor(() => expect(filaDel('28', /feb/i)).toBeTruthy());
  }, 30_000);

  it('no deja poner una fecha futura', async () => {
    evaluaciones.push({ id: 'ev2', trabajadorId: 't1', tipo: 'PERIODICA', fecha: ts(new Date(2024, 2, 3, 9, 0)) });
    await montar();
    await act(async () => { fireEvent.click(filaDel('03', /mar/i)!); });
    await act(async () => { fireEvent.click(await screen.findByText('Cambiar fecha')); });
    const campo = document.querySelector('input[type="date"][max]') as HTMLInputElement;
    await act(async () => { fireEvent.change(campo, { target: { value: '2999-01-01' } }); });
    await act(async () => { fireEvent.click(screen.getByText('Guardar')); });
    expect(servicio.cambiarFecha).toEqual([]);
  }, 30_000);
});

describe('eliminar evaluaciones desde la ficha', () => {
  beforeEach(() => {
    evaluaciones.push(
      { id: 'ev1', trabajadorId: 't1', tipo: 'PERIODICA', fecha: ts(new Date(2025, 9, 9, 8, 0)), aptitudMedica: 'apto' },
      { id: 'ev2', trabajadorId: 't1', tipo: 'PERIODICA', fecha: ts(new Date(2024, 2, 3, 9, 0)), aptitudMedica: 'apto' },
    );
  });

  it('desde la fila, tras confirmar, y desaparece de la lista', async () => {
    await montar();
    const botones = screen.getAllByTitle('Eliminar la evaluación');
    expect(botones).toHaveLength(2);
    await act(async () => { fireEvent.click(botones[0]); });   // la más reciente primero
    expect(confirmar.mensajes[0]).toMatch(/copia en la bitácora/);
    expect(servicio.eliminadas).toEqual(['ev1']);
    await waitFor(() => expect(screen.getAllByTitle('Eliminar la evaluación')).toHaveLength(1));
  }, 30_000);

  it('no elimina si se cancela', async () => {
    confirmar.respuesta = false;
    await montar();
    await act(async () => { fireEvent.click(screen.getAllByTitle('Eliminar la evaluación')[0]); });
    expect(servicio.eliminadas).toEqual([]);
    expect(screen.getAllByTitle('Eliminar la evaluación')).toHaveLength(2);
  }, 30_000);

  it('desde el detalle, que se cierra al eliminar', async () => {
    await montar();
    await act(async () => { fireEvent.click(filaDel('03', /mar/i)!); });
    await act(async () => { fireEvent.click(await screen.findByTitle('Eliminar esta evaluación')); });
    expect(servicio.eliminadas).toEqual(['ev2']);
    await waitFor(() => expect(screen.queryByTitle('Eliminar esta evaluación')).toBeNull());
  }, 30_000);
});
