import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Firestore en memoria: lo justo para ver qué se escribe, qué se borra y en
 * qué orden.
 */
const { almacen, ordenOps, fallarCopia } = vi.hoisted(() => ({
  almacen: new Map<string, any>(),
  ordenOps: [] as string[],
  fallarCopia: { activo: false },
}));

vi.mock('./firebase', () => ({ db: {}, auth: { currentUser: { uid: 'u1', email: 'medico@ejemplo.com' } } }));
vi.mock('firebase/firestore', () => {
  const ruta = (ref: any) => ref.ruta as string;
  let n = 0;
  return {
    doc: (_db: any, col: string, id: string) => ({ ruta: `${col}/${id}` }),
    collection: (_db: any, col: string) => ({ col }),
    query: (ref: any, ...filtros: any[]) => ({ ...ref, filtros }),
    where: (campo: string, _op: string, valor: any) => ({ campo, valor }),
    getDoc: async (ref: any) => ({ exists: () => almacen.has(ruta(ref)), data: () => almacen.get(ruta(ref)) }),
    setDoc: async (ref: any, datos: any) => { ordenOps.push(`set ${ruta(ref)}`); almacen.set(ruta(ref), datos); },
    updateDoc: async (ref: any, cambios: any) => {
      ordenOps.push(`update ${ruta(ref)}`);
      const previo = almacen.get(ruta(ref)) ?? {};
      const fusion = { ...previo };
      Object.entries(cambios).forEach(([k, v]: [string, any]) => {
        if (v?.__quitar) fusion[k] = (previo[k] ?? []).filter((x: any) => !v.__quitar.includes(x));
        else if (v?.__unir) fusion[k] = [...new Set([...(previo[k] ?? []), ...v.__unir])];
        else fusion[k] = v;
      });
      almacen.set(ruta(ref), fusion);
    },
    deleteDoc: async (ref: any) => { ordenOps.push(`delete ${ruta(ref)}`); almacen.delete(ruta(ref)); },
    addDoc: async (ref: any, datos: any) => {
      if (ref.col === 'auditoria' && datos.copia && fallarCopia.activo) throw new Error('sin conexión');
      const id = `a${n++}`;
      ordenOps.push(`add ${ref.col}${datos.copia ? ' (con copia)' : ''}`);
      almacen.set(`${ref.col}/${id}`, datos);
      return { id };
    },
    getDocs: async (q: any) => {
      const docs = [...almacen.entries()]
        .filter(([k, v]) => k.startsWith(`${q.col}/`) && (q.filtros ?? []).every((f: any) => v[f.campo] === f.valor))
        .map(([k, v]) => ({ id: k.split('/')[1], data: () => v, ref: { ruta: k } }));
      return { docs };
    },
    arrayRemove: (...v: any[]) => ({ __quitar: v }),
    arrayUnion: (...v: any[]) => ({ __unir: v }),
    Timestamp: { now: () => ({ seconds: 1, nanoseconds: 0 }) },
    orderBy: () => ({}), limit: () => ({}),
  };
});

import { eliminarEvaluacion, restaurarEvaluacion, cambiarFechaEvaluacion, corregirFechasGuardadas } from './evaluaciones';
import { aDia } from '../utils/fechaEvaluacion';

const ts = (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 });
const auditoria = () => [...almacen.entries()].filter(([k]) => k.startsWith('auditoria/')).map(([, v]) => v);

const evaluacion = {
  trabajadorId: 't1', formato: 'ocupacional-unificado', tipoEvaluacion: 'periodica',
  fecha: ts(new Date(2025, 9, 9, 8, 53)), fechaAtencion: '2025-10-09',
  diagnosticos: [{ cie: 'I10' }], certificadoAptitud: { aptitud: 'apto' },
};

beforeEach(() => {
  almacen.clear();
  ordenOps.length = 0;
  fallarCopia.activo = false;
  almacen.set('evaluaciones/ev1', structuredClone(evaluacion));
  almacen.set('trabajadores/t1', { primerApellido: 'Jiménez', evaluaciones: ['ev0', 'ev1'] });
  almacen.set('examenes/x1', { trabajadorId: 't1', evaluacionId: 'ev1', nombre: 'Biometría' });
  almacen.set('examenes/x2', { trabajadorId: 't1', evaluacionId: 'ev0', nombre: 'Glucosa' });
});

describe('eliminar una evaluación', () => {
  it('guarda la copia en la bitácora antes de borrar', async () => {
    await eliminarEvaluacion('ev1', 'Jiménez José');
    const copia = ordenOps.indexOf('add auditoria (con copia)');
    const borrado = ordenOps.indexOf('delete evaluaciones/ev1');
    expect(copia).toBeGreaterThanOrEqual(0);
    expect(borrado).toBeGreaterThan(copia);
    expect(almacen.has('evaluaciones/ev1')).toBe(false);
  });

  it('la copia es exactamente lo que había guardado', async () => {
    await eliminarEvaluacion('ev1');
    const entrada = auditoria().find(a => a.accion === 'eliminar');
    expect(entrada.copia).toEqual(evaluacion);
    expect(entrada.entidad).toBe('evaluacion');
    expect(entrada.entidadId).toBe('ev1');
  });

  it('si no se puede guardar la copia, no borra nada', async () => {
    fallarCopia.activo = true;
    await expect(eliminarEvaluacion('ev1')).rejects.toThrow();
    expect(almacen.has('evaluaciones/ev1')).toBe(true);
    expect(ordenOps.some(o => o.startsWith('delete'))).toBe(false);
  });

  it('la quita de la lista del trabajador y desvincula sus exámenes', async () => {
    await eliminarEvaluacion('ev1');
    expect(almacen.get('trabajadores/t1').evaluaciones).toEqual(['ev0']);
    expect(almacen.get('examenes/x1').evaluacionId).toBe('');
    expect(almacen.get('examenes/x2').evaluacionId).toBe('ev0');   // la de otra evaluación, intacta
    expect(almacen.has('examenes/x1')).toBe(true);                 // el examen no se borra
  });

  it('avisa si ya no existe', async () => {
    await expect(eliminarEvaluacion('no-existe')).rejects.toThrow('ya no existe');
  });
});

describe('restaurar una evaluación eliminada', () => {
  it('la vuelve a crear con el mismo id y los mismos datos', async () => {
    await eliminarEvaluacion('ev1');
    const entrada = auditoria().find(a => a.accion === 'eliminar');
    await restaurarEvaluacion({ id: 'a0', ...entrada });
    expect(almacen.get('evaluaciones/ev1')).toEqual(evaluacion);
    expect(almacen.get('trabajadores/t1').evaluaciones).toContain('ev1');
    expect(auditoria().some(a => a.accion === 'crear' && a.descripcion.startsWith('Restauró'))).toBe(true);
  });

  it('no la pisa si ya existe', async () => {
    await eliminarEvaluacion('ev1');
    const entrada = auditoria().find(a => a.accion === 'eliminar');
    await restaurarEvaluacion({ id: 'a0', ...entrada });
    await expect(restaurarEvaluacion({ id: 'a0', ...entrada })).rejects.toThrow('ya fue restaurada');
  });

  it('rechaza entradas sin copia', async () => {
    await expect(restaurarEvaluacion({
      fecha: null, usuarioId: '', usuarioEmail: '', accion: 'eliminar', entidad: 'trabajador', entidadId: 't1', descripcion: '',
    })).rejects.toThrow();
  });
});

describe('cambiar la fecha', () => {
  it('cambia la fecha y la de atención en el formato ocupacional, conservando la hora', async () => {
    const nueva = await cambiarFechaEvaluacion({ id: 'ev1', ...evaluacion }, '2025-10-02');
    const guardada = almacen.get('evaluaciones/ev1');
    expect(aDia(guardada.fecha)).toBe('2025-10-02');
    expect(guardada.fechaAtencion).toBe('2025-10-02');
    expect([nueva.getHours(), nueva.getMinutes()]).toEqual([8, 53]);
    expect(auditoria().some(a => a.accion === 'editar' && a.descripcion.includes('2025-10-09 → 2025-10-02'))).toBe(true);
  });

  it('en los formatos antiguos cambia sólo la fecha', async () => {
    almacen.set('evaluaciones/ev2', { trabajadorId: 't1', tipo: 'PERIODICA', fecha: ts(new Date(2024, 2, 3, 9, 0)) });
    await cambiarFechaEvaluacion({ id: 'ev2', ...almacen.get('evaluaciones/ev2') }, '2024-02-28');
    const guardada = almacen.get('evaluaciones/ev2');
    expect(aDia(guardada.fecha)).toBe('2024-02-28');
    expect(guardada.fechaAtencion).toBeUndefined();
  });
});

describe('corregir las fechas guardadas antes del arreglo', () => {
  it('alinea la fecha con la de atención y lo deja en la bitácora', async () => {
    almacen.set('evaluaciones/ev3', { trabajadorId: 't1', formato: 'ocupacional-unificado', fechaAtencion: '2025-09-30', fecha: ts(new Date(2025, 9, 9, 8, 53)) });
    const r = await corregirFechasGuardadas([
      { id: 'ev1', ...evaluacion },                      // ya coincide
      { id: 'ev3', ...almacen.get('evaluaciones/ev3') }, // creada el 9, atendida el 30/9
    ]);
    expect([...r.keys()]).toEqual(['ev3']);
    expect(aDia(almacen.get('evaluaciones/ev3').fecha)).toBe('2025-09-30');
    expect(ordenOps.filter(o => o === 'update evaluaciones/ev1')).toEqual([]);
  });
});
