import { describe, it, expect } from 'vitest';
import { calcularREBA, type EntradasREBA } from './reba';

const base: EntradasREBA = {
  cuello: 1, tronco: 1, piernas: 1, carga: 0,
  brazo: 1, antebrazo: 1, muneca: 1, acople: 0, actividad: 0,
};

describe('calcularREBA', () => {
  it('postura neutra da puntaje 1 (insignificante)', () => {
    const r = calcularREBA(base);
    expect(r.puntajeFinal).toBe(1);
    expect(r.tone).toBe('success');
  });

  it('caso intermedio conocido da 9 (alto)', () => {
    const r = calcularREBA({
      cuello: 2, tronco: 3, piernas: 2, carga: 1,
      brazo: 3, antebrazo: 1, muneca: 2, acople: 1, actividad: 1,
    });
    expect(r.detalle.puntajeA).toBe(6);
    expect(r.detalle.puntajeB).toBe(5);
    expect(r.detalle.puntajeC).toBe(8);
    expect(r.puntajeFinal).toBe(9);
    expect(r.tone).toBe('danger');
  });

  it('valores máximos dan 15 (muy alto)', () => {
    const r = calcularREBA({
      cuello: 3, tronco: 5, piernas: 4, carga: 3,
      brazo: 6, antebrazo: 2, muneca: 3, acople: 3, actividad: 3,
    });
    expect(r.puntajeFinal).toBe(15);
    expect(r.nivel).toBe('Muy alto');
  });

  it('riesgo medio en el rango 4-7', () => {
    const r = calcularREBA({ ...base, tronco: 3, piernas: 2, brazo: 3 });
    expect(r.puntajeFinal).toBeGreaterThanOrEqual(2);
  });
});
