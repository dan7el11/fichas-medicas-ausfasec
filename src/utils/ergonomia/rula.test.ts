import { describe, it, expect } from 'vitest';
import { calcularRULA, type EntradasRULA } from './rula';

const base: EntradasRULA = {
  brazo: 1, antebrazo: 1, muneca: 1, giroMuneca: 1, usoMuscularA: 0, cargaA: 0,
  cuello: 1, tronco: 1, piernas: 1, usoMuscularB: 0, cargaB: 0,
};

describe('calcularRULA', () => {
  it('postura totalmente neutra da puntaje 1 (aceptable)', () => {
    const r = calcularRULA(base);
    expect(r.puntajeFinal).toBe(1);
    expect(r.tone).toBe('success');
  });

  it('caso intermedio conocido da 7 (alto)', () => {
    const r = calcularRULA({
      ...base, brazo: 3, antebrazo: 2, muneca: 3, giroMuneca: 1, usoMuscularA: 1, cargaA: 1,
      cuello: 2, tronco: 3, piernas: 1, usoMuscularB: 1, cargaB: 1,
    });
    expect(r.detalle.puntajeA).toBe(6);
    expect(r.detalle.puntajeB).toBe(6);
    expect(r.puntajeFinal).toBe(7);
    expect(r.tone).toBe('danger');
  });

  it('valores máximos no exceden 7 (tablas acotadas)', () => {
    const r = calcularRULA({
      brazo: 6, antebrazo: 3, muneca: 4, giroMuneca: 2, usoMuscularA: 1, cargaA: 3,
      cuello: 6, tronco: 6, piernas: 2, usoMuscularB: 1, cargaB: 3,
    });
    expect(r.puntajeFinal).toBe(7);
  });

  it('clasifica los niveles por umbral', () => {
    // puntaje 3-4 → investigar (warning)
    const r = calcularRULA({ ...base, brazo: 3, cuello: 3 });
    expect(r.puntajeFinal).toBeGreaterThanOrEqual(3);
    expect(['warning', 'danger']).toContain(r.tone);
  });
});
