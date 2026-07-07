import { describe, it, expect } from 'vitest';
import { estadisticasErgo } from './estadisticas';
import type { EvaluacionErgonomica } from '../../types/ergonomia';

const ev = (trabajadorId: string, puntaje: number, nivel: string, tone: any, detalle: Record<string, number> = {}): EvaluacionErgonomica => ({
  trabajadorId, apellidos: 'X', nombres: 'Y', cedula: '1', puesto: 'P', area: 'A',
  metodo: 'ROSA', fecha: new Date('2026-07-01'), tarea: '', entradas: {}, fotos: [],
  observaciones: '', recomendaciones: '', medicoId: 'm', medicoNombre: 'Dr',
  createdAt: new Date(),
  resultado: { metodo: 'ROSA', puntajeFinal: puntaje, nivel, accion: '', tone, detalle },
} as EvaluacionErgonomica);

describe('estadisticasErgo', () => {
  it('devuelve ceros para lista vacía', () => {
    const s = estadisticasErgo([]);
    expect(s.n).toBe(0);
    expect(s.porNivel).toEqual([]);
  });

  it('calcula promedio, mínimo, máximo y trabajadores únicos', () => {
    const s = estadisticasErgo([
      ev('t1', 2, 'Insignificante', 'success'),
      ev('t1', 6, 'Alto', 'danger'),
      ev('t2', 4, 'Bajo — mejorable', 'warning'),
    ]);
    expect(s.n).toBe(3);
    expect(s.trabajadoresUnicos).toBe(2);
    expect(s.promedio).toBe(4);
    expect(s.minimo).toBe(2);
    expect(s.maximo).toBe(6);
  });

  it('distribución por nivel con porcentajes y riesgo (danger)', () => {
    const s = estadisticasErgo([
      ev('t1', 6, 'Alto', 'danger'),
      ev('t2', 6, 'Alto', 'danger'),
      ev('t3', 2, 'Insignificante', 'success'),
      ev('t4', 3, 'Bajo — mejorable', 'warning'),
    ]);
    expect(s.enRiesgo).toBe(2);
    expect(s.pctEnRiesgo).toBe(50);
    expect(s.porNivel[0].nivel).toBe('Alto'); // severidad primero
    expect(s.porNivel[0].pct).toBe(50);
  });

  it('promedia los puntajes intermedios', () => {
    const s = estadisticasErgo([
      ev('t1', 4, 'Bajo — mejorable', 'warning', { silla: 4, perifericos: 2 }),
      ev('t2', 6, 'Alto', 'danger', { silla: 6, perifericos: 4 }),
    ]);
    expect(s.promedioDetalle.find((d) => d.key === 'silla')?.promedio).toBe(5);
    expect(s.promedioDetalle.find((d) => d.key === 'perifericos')?.promedio).toBe(3);
  });
});
