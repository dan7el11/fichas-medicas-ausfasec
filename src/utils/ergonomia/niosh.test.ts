import { describe, it, expect } from 'vitest';
import { calcularNIOSH, type EntradasNIOSH } from './niosh';

const ideal: EntradasNIOSH = { pesoCarga: 23, H: 25, V: 75, D: 25, A: 0, frecuencia: 0.2, duracion: 1, agarre: 1 };

describe('calcularNIOSH', () => {
  it('condiciones ideales: RWL = 23 y LI = 1', () => {
    const r = calcularNIOSH(ideal);
    expect(r.detalle.RWL).toBeCloseTo(23, 1);
    expect(r.detalle.LI).toBeCloseTo(1, 2);
    expect(r.tone).toBe('success');
  });

  it('ejemplo con frecuencia 1/min y carga baja: LI ≈ 0.46', () => {
    const r = calcularNIOSH({ pesoCarga: 10, H: 25, V: 75, D: 25, A: 0, frecuencia: 1, duracion: 1, agarre: 1 });
    expect(r.detalle.FM).toBeCloseTo(0.94, 2);
    expect(r.detalle.RWL).toBeCloseTo(21.62, 1);
    expect(r.detalle.LI).toBeCloseTo(0.46, 1);
  });

  it('carga alta da riesgo alto (LI > 3)', () => {
    const r = calcularNIOSH({ ...ideal, pesoCarga: 100 });
    expect(r.detalle.LI).toBeGreaterThan(3);
    expect(r.tone).toBe('danger');
  });

  it('distancia horizontal excesiva anula el levantamiento (HM=0, RWL=0)', () => {
    const r = calcularNIOSH({ ...ideal, H: 70 });
    expect(r.detalle.HM).toBe(0);
    expect(r.detalle.RWL).toBe(0);
    expect(r.nivel).toBe('No recomendado');
  });

  it('los multiplicadores reducen el RWL', () => {
    const r = calcularNIOSH({ ...ideal, H: 50, A: 45 });
    expect(r.detalle.HM).toBeCloseTo(0.5, 2);
    expect(r.detalle.AM).toBeCloseTo(0.856, 2);
    expect(r.detalle.RWL).toBeLessThan(23);
  });
});
