import { describe, it, expect } from 'vitest';
import {
  rangoPeriodo, desplazarPeriodo, calcularStats, tratamientoTexto, toDate,
} from './atenciones';
import type { AtencionMedica } from '../types/atencion';

describe('rangoPeriodo', () => {
  const ref = new Date(2026, 5, 15); // lunes 15 jun 2026 es lunes? 15/06/2026

  it('día: del 00:00 al día siguiente', () => {
    const { inicio, fin } = rangoPeriodo('dia', new Date(2026, 5, 15, 10, 30));
    expect(inicio.getDate()).toBe(15);
    expect(inicio.getHours()).toBe(0);
    expect(fin.getDate()).toBe(16);
  });

  it('mes: del 1 al 1 del mes siguiente', () => {
    const { inicio, fin } = rangoPeriodo('mes', ref);
    expect(inicio.getMonth()).toBe(5);
    expect(inicio.getDate()).toBe(1);
    expect(fin.getMonth()).toBe(6);
    expect(fin.getDate()).toBe(1);
  });

  it('semana: dura 7 días y empieza en lunes', () => {
    const { inicio, fin } = rangoPeriodo('semana', ref);
    expect(inicio.getDay()).toBe(1); // lunes
    expect((fin.getTime() - inicio.getTime()) / 86400000).toBe(7);
  });
});

describe('desplazarPeriodo', () => {
  it('avanza y retrocede un mes', () => {
    const base = new Date(2026, 5, 15);
    expect(desplazarPeriodo('mes', base, -1).getMonth()).toBe(4);
    expect(desplazarPeriodo('mes', base, 1).getMonth()).toBe(6);
  });
  it('avanza una semana (7 días)', () => {
    const base = new Date(2026, 5, 15);
    expect(desplazarPeriodo('semana', base, 1).getDate()).toBe(22);
  });
});

describe('calcularStats', () => {
  const at = (p: Partial<AtencionMedica>): AtencionMedica => ({
    estado: 'atendido', tipoAtencion: 'Primera', relacion: 'Común',
    medicacion: [], procedimientos: [], reposoDias: 0, ...p,
  } as unknown as AtencionMedica);

  it('cuenta atendidos, espera, primeras/subsecuentes y medicamentos', () => {
    const s = calcularStats([
      at({ estado: 'atendido', tipoAtencion: 'Primera', relacion: 'Ocupacional', medicacion: [{ nombre: 'Paracetamol', cantidad: 2 }] }),
      at({ estado: 'atendido', tipoAtencion: 'Subsecuente' }),
      at({ estado: 'espera' }),
    ]);
    expect(s.total).toBe(2);
    expect(s.espera).toBe(1);
    expect(s.primeras).toBe(1);
    expect(s.subsec).toBe(1);
    expect(s.ocupacionales).toBe(1);
    expect(s.medicamentos).toBe(2);
  });
});

describe('tratamientoTexto', () => {
  it('combina medicación, procedimientos y reposo', () => {
    const a = { medicacion: [{ nombre: 'Ibuprofeno', cantidad: 1 }], procedimientos: ['Curación simple'], reposoDias: 2 } as unknown as AtencionMedica;
    const t = tratamientoTexto(a);
    expect(t).toContain('Ibuprofeno');
    expect(t).toContain('Curación simple');
    expect(t).toContain('Reposo 2 d');
  });
  it('devuelve guion cuando no hay nada', () => {
    expect(tratamientoTexto({ medicacion: [], procedimientos: [], reposoDias: 0 } as unknown as AtencionMedica)).toBe('—');
  });
});

describe('toDate', () => {
  it('convierte Timestamp tipo {seconds}', () => {
    expect(toDate({ seconds: 1704067200, nanoseconds: 0 }).getFullYear()).toBe(2024);
  });
  it('pasa Date directo y maneja nulo', () => {
    const d = new Date();
    expect(toDate(d)).toBe(d);
    expect(isNaN(toDate(null).getTime())).toBe(true);
  });
});
