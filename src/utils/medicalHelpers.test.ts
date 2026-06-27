import { describe, it, expect } from 'vitest';
import {
  parseDate, workerStatus, lastEval, daysUntil,
  matchTrabajador, tipoEvaluacionLabel, areaDeTrabajador, areasDeTrabajadores,
} from './medicalHelpers';
import type { EvaluacionMedica, Trabajador } from '../types';

// ── daysUntil ──────────────────────────────────────────────────────────────

describe('daysUntil', () => {
  it('retorna 0 para hoy', () => {
    const today = new Date();
    expect(daysUntil(today)).toBe(0);
  });

  it('retorna número negativo para fecha pasada', () => {
    const past = new Date();
    past.setDate(past.getDate() - 10);
    expect(daysUntil(past)).toBeLessThan(0);
  });

  it('retorna número positivo para fecha futura', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    expect(daysUntil(future)).toBeGreaterThan(0);
  });
});

// ── parseDate ──────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('pasa Date directamente', () => {
    const d = new Date('2024-01-15');
    expect(parseDate(d)).toBe(d);
  });

  it('convierte objeto con seconds (Firestore Timestamp raw)', () => {
    const result = parseDate({ seconds: 1704067200, nanoseconds: 0 });
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2024);
  });

  it('convierte string ISO', () => {
    const result = parseDate('2024-06-15');
    expect(result).toBeInstanceOf(Date);
  });

  it('retorna fecha válida para null', () => {
    expect(parseDate(null)).toBeInstanceOf(Date);
  });
});

// ── lastEval ───────────────────────────────────────────────────────────────

const makeEval = (fecha: string, aptitud = 'apto'): EvaluacionMedica => ({
  id: Math.random().toString(),
  trabajadorId: 't1',
  fecha: new Date(fecha) as any,
  aptitudMedica: aptitud,
} as unknown as EvaluacionMedica);

describe('lastEval', () => {
  it('retorna null para lista vacía', () => {
    expect(lastEval([])).toBeNull();
  });

  it('retorna la evaluación más reciente', () => {
    const evals = [makeEval('2023-01-01'), makeEval('2024-06-01'), makeEval('2022-12-31')];
    const result = lastEval(evals);
    expect(parseDate(result!.fecha).getFullYear()).toBe(2024);
  });
});

// ── workerStatus ───────────────────────────────────────────────────────────

describe('workerStatus', () => {
  it('retorna Sin evaluación para lista vacía', () => {
    const s = workerStatus([]);
    expect(s.label).toBe('Sin evaluación');
    expect(s.tone).toBe('muted');
  });

  it('retorna No apto si aptitudMedica es noApto', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const s = workerStatus([makeEval(future.toISOString(), 'noApto')]);
    expect(s.tone).toBe('danger');
  });

  it('retorna Vencida si la evaluación pasó hace más de un año', () => {
    const old = new Date();
    old.setFullYear(old.getFullYear() - 2);
    const s = workerStatus([makeEval(old.toISOString())]);
    expect(s.tone).toBe('danger');
  });

  it('retorna Por vencer si quedan ≤30 días', () => {
    const soon = new Date();
    soon.setFullYear(soon.getFullYear() - 1);
    soon.setDate(soon.getDate() + 20);
    const s = workerStatus([makeEval(soon.toISOString())]);
    expect(s.tone).toBe('warning');
    expect(s.dias).toBeLessThanOrEqual(30);
  });

  it('retorna Apto vigente para evaluación reciente', () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 3);
    const s = workerStatus([makeEval(recent.toISOString())]);
    expect(s.tone).toBe('success');
  });
});

// ── matchTrabajador ──────────────────────────────────────────────────────────

const trab = (p: Partial<Trabajador>): Trabajador => ({
  primerApellido: '', segundoApellido: '', primerNombre: '', segundoNombre: '',
  cedula: '', sexo: 'M', puestoTrabajo: '', departamento: '', evaluaciones: [],
  createdAt: new Date(), updatedAt: new Date(), ...p,
} as Trabajador);

describe('matchTrabajador', () => {
  const w = trab({ primerApellido: 'Pérez', primerNombre: 'María', cedula: '1712345678', puestoTrabajo: 'Soldador', departamento: 'Mantenimiento' });

  it('encuentra sin importar tildes ni mayúsculas', () => {
    expect(matchTrabajador(w, 'perez')).toBe(true);
    expect(matchTrabajador(w, 'MARÍA')).toBe(true);
  });
  it('acepta varios términos en cualquier orden', () => {
    expect(matchTrabajador(w, 'maria perez')).toBe(true);
    expect(matchTrabajador(w, 'perez maria')).toBe(true);
  });
  it('busca por cédula, puesto y área', () => {
    expect(matchTrabajador(w, '171234')).toBe(true);
    expect(matchTrabajador(w, 'soldador')).toBe(true);
    expect(matchTrabajador(w, 'mantenimiento')).toBe(true);
  });
  it('devuelve false si algún término no aparece', () => {
    expect(matchTrabajador(w, 'maria lopez')).toBe(false);
  });
  it('query vacío coincide con todos', () => {
    expect(matchTrabajador(w, '')).toBe(true);
  });
});

// ── tipoEvaluacionLabel ──────────────────────────────────────────────────────

describe('tipoEvaluacionLabel', () => {
  it('reconoce los distintos formatos guardados', () => {
    expect(tipoEvaluacionLabel({ tipo: 'RETIRO' } as any)).toBe('Retiro');
    expect(tipoEvaluacionLabel({ tipoEvaluacion: 'preocupacional' } as any)).toBe('Pre-ocupacional');
    expect(tipoEvaluacionLabel({ tipo: 'REINTEGRO' } as any)).toBe('Reintegro');
  });
  it('por defecto es Periódica', () => {
    expect(tipoEvaluacionLabel({} as any)).toBe('Periódica');
  });
});

// ── áreas ────────────────────────────────────────────────────────────────────

describe('areaDeTrabajador / areasDeTrabajadores', () => {
  it('usa el departamento ingresado en la ficha', () => {
    expect(areaDeTrabajador(trab({ departamento: 'Planificación' }))).toBe('Planificación');
  });
  it('agrupa como «Sin área» cuando no hay dato', () => {
    expect(areaDeTrabajador(trab({ departamento: '' }))).toBe('Sin área');
  });
  it('lista áreas únicas y deja «Sin área» al final', () => {
    const areas = areasDeTrabajadores([
      trab({ departamento: 'TTHH' }),
      trab({ departamento: 'Planificación' }),
      trab({ departamento: '' }),
      trab({ departamento: 'TTHH' }),
    ]);
    expect(areas).toEqual(['Planificación', 'TTHH', 'Sin área']);
  });
});
