import { describe, it, expect } from 'vitest';
import { PERFILES_RIESGO_CARGO } from './perfilRiesgoCargo';
import { CARGOS, MAX_ACTIVIDADES, normalizarBusqueda } from './funcionesCargo';
import { MATRIZ_RIESGOS } from '../utils/catalogosEvaluacion';

const FACTORES = new Set(
  MATRIZ_RIESGOS.flatMap(c => c.subgrupos.flatMap(g => g.items)),
);

describe('perfil de riesgo por cargo (análisis auditado)', () => {
  it('cubre los 42 cargos del catálogo institucional', () => {
    expect(PERFILES_RIESGO_CARGO).toHaveLength(42);
    const enPerfil = new Set(PERFILES_RIESGO_CARGO.map(p => normalizarBusqueda(p.cargo)));
    const sinPerfil = CARGOS.filter(c => !enPerfil.has(normalizarBusqueda(c.cargo)));
    expect(sinPerfil.map(c => c.cargo)).toEqual([]);
  });

  it('cada cargo trae actividades, sin pasar del máximo de la matriz oficial', () => {
    PERFILES_RIESGO_CARGO.forEach(p => {
      expect(p.actividades.length).toBeGreaterThan(0);
      expect(p.actividades.length).toBeLessThanOrEqual(MAX_ACTIVIDADES);
      p.actividades.forEach(a => expect(a.trim()).not.toBe(''));
    });
  });

  it('todos los factores existen en la matriz de riesgos del formato', () => {
    const desconocidos = new Set<string>();
    PERFILES_RIESGO_CARGO.forEach(p => {
      Object.keys(p.riesgoActividades).forEach(f => { if (!FACTORES.has(f)) desconocidos.add(f); });
    });
    expect([...desconocidos]).toEqual([]);
  });

  it('los índices marcados apuntan a actividades que existen', () => {
    PERFILES_RIESGO_CARGO.forEach(p => {
      Object.entries(p.riesgoActividades).forEach(([factor, idxs]) => {
        expect(idxs.length, `${p.cargo} / ${factor}`).toBeGreaterThan(0);
        idxs.forEach(i => {
          expect(i, `${p.cargo} / ${factor}`).toBeGreaterThanOrEqual(0);
          expect(i, `${p.cargo} / ${factor}`).toBeLessThan(p.actividades.length);
        });
        // Sin repetidos y en orden.
        expect(idxs).toEqual([...new Set(idxs)].sort((a, b) => a - b));
      });
    });
  });

  it('ningún cargo queda sin factores marcados', () => {
    PERFILES_RIESGO_CARGO.forEach(p => {
      expect(Object.keys(p.riesgoActividades).length, p.cargo).toBeGreaterThan(0);
    });
  });

  it('incluye los factores propios de la operación con GLP', () => {
    const todos = new Set(PERFILES_RIESGO_CARGO.flatMap(p => Object.keys(p.riesgoActividades)));
    expect(todos.has('Incendio y explosión (atmósfera GLP)')).toBe(true);
    expect(todos.has('Manejo de recipientes a presión')).toBe(true);
    expect(FACTORES.has('Incendio y explosión (atmósfera GLP)')).toBe(true);
  });

  it('no repite cargos', () => {
    const ids = PERFILES_RIESGO_CARGO.map(p => normalizarBusqueda(p.cargo));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
