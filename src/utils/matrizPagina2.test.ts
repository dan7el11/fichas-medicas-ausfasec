// La matriz de factores de riesgo tiene UNA sola página reservada en el
// formato (la 2, horizontal). Estas pruebas fijan las dos condiciones que la
// hacían desbordar: demasiadas filas y encabezados de actividad demasiado
// largos.
import { describe, it, expect } from 'vitest';
import { MATRIZ_RIESGOS, esFactorAnalizable } from './catalogosEvaluacion';
import { resumirActividades, LARGO_ACTIVIDAD_MATRIZ } from './resumenFuncion';
import { PERFILES_RIESGO_CARGO } from '../constants/perfilRiesgoCargo';
import { MAX_ACTIVIDADES } from '../constants/funcionesCargo';

/** Geometría de la página 2 (A4 horizontal, en mm). */
const ALTO_PAGINA = 210;
const MARGEN = 7;
const ALTO_CABECERA = 14;   // encabezado institucional compacto
const ALTO_SECCION = 5;     // franja «G. FACTORES DE RIESGO…»
const ALTO_PUESTO = 6;      // fila del puesto de trabajo
const ALTO_MEDIDAS = 12;    // fila final de medidas preventivas
const ALTO_FILA = 2.05;     // minCellHeight de cada factor
const ANCHO_COLUMNA_ACTIVIDAD = 30; // (283 - 17 - 13 - 42) / 7

const factoresAnalizables = MATRIZ_RIESGOS
  .flatMap(c => c.subgrupos.flatMap(g => g.items))
  .filter(esFactorAnalizable);

describe('esFactorAnalizable', () => {
  it('descarta las líneas «Otros» de cada categoría', () => {
    expect(esFactorAnalizable('Otros __________')).toBe(false);
    expect(esFactorAnalizable('  otros  ')).toBe(false);
    expect(esFactorAnalizable('Ruido')).toBe(true);
  });

  it('no descarta factores reales que empiecen parecido', () => {
    expect(esFactorAnalizable('Otras sustancias químicas')).toBe(true);
  });

  it('quita una línea «Otros» por categoría del formato', () => {
    const todos = MATRIZ_RIESGOS.flatMap(c => c.subgrupos.flatMap(g => g.items));
    expect(todos.length - factoresAnalizables.length).toBe(6);
  });

  it('conserva los factores propios de la operación con GLP', () => {
    expect(factoresAnalizables).toContain('Incendio y explosión (atmósfera GLP)');
    expect(factoresAnalizables).toContain('Manejo de recipientes a presión');
  });
});

describe('la matriz cabe en la página 2', () => {
  it('el alto de las filas de factores deja margen suficiente', () => {
    const disponible = ALTO_PAGINA - MARGEN * 2 - ALTO_CABECERA - ALTO_SECCION - ALTO_PUESTO - ALTO_MEDIDAS;
    const necesario = factoresAnalizables.length * ALTO_FILA;
    expect(necesario).toBeLessThan(disponible);
  });

  it('los encabezados de actividad ocupan pocas líneas', () => {
    // ~2 caracteres por mm a 4.2 pt: es la densidad con la que se maquetó.
    const caracteresPorLinea = ANCHO_COLUMNA_ACTIVIDAD * 2;
    PERFILES_RIESGO_CARGO.forEach(p => {
      resumirActividades(p.actividades.slice(0, MAX_ACTIVIDADES)).forEach(a => {
        const lineas = Math.ceil(a.length / caracteresPorLinea);
        expect(lineas, `${p.cargo}: ${a}`).toBeLessThanOrEqual(3);
      });
    });
  });

  it('sin resumir, los encabezados sí desbordarían', () => {
    // Deja constancia de por qué existe el resumen.
    const largas = PERFILES_RIESGO_CARGO
      .flatMap(p => p.actividades)
      .filter(a => a.length > LARGO_ACTIVIDAD_MATRIZ);
    expect(largas.length).toBeGreaterThan(0);
  });
});
