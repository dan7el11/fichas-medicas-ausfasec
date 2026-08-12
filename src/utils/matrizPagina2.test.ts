// La matriz de factores de riesgo tiene UNA sola página reservada en el
// formato (la 2, horizontal). Estas pruebas fijan las dos condiciones que la
// hacían desbordar: demasiadas filas y encabezados de actividad demasiado
// largos.
import { describe, it, expect } from 'vitest';
import { MATRIZ_RIESGOS, esFactorAnalizable } from './catalogosEvaluacion';
import { textosActividades, FUNCIONES_HISTORIA_LABORAL } from './resumenFuncion';
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
const ALTO_LINEA_ENCABEZADO = 1.7; // interlineado a 4.2 pt

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

  it('el encabezado de actividades cabe en el alto que le queda', () => {
    // A 4.2 pt en helvetica, un carácter mide ~0.74 mm: unos 40 por línea en
    // una columna de 30 mm. El encabezado lo marca la actividad más larga.
    const caracteresPorLinea = Math.floor(ANCHO_COLUMNA_ACTIVIDAD / 0.74);
    const disponible = ALTO_PAGINA - MARGEN * 2 - ALTO_CABECERA - ALTO_SECCION - ALTO_PUESTO - ALTO_MEDIDAS
      - factoresAnalizables.length * ALTO_FILA;

    PERFILES_RIESGO_CARGO.forEach(p => {
      const textos = textosActividades(p.actividades, p.actividadesResumen).slice(0, MAX_ACTIVIDADES);
      const lineas = Math.max(...textos.map(a => Math.ceil(a.length / caracteresPorLinea)));
      const altoEncabezado = lineas * ALTO_LINEA_ENCABEZADO + 2;
      expect(altoEncabezado, `${p.cargo}: ${lineas} líneas`).toBeLessThan(disponible);
    });
  });

  it('los encabezados llegan enteros, sin puntos suspensivos', () => {
    // Recortarlos era justo lo que dejaba las funciones a medias.
    PERFILES_RIESGO_CARGO.forEach(p => {
      textosActividades(p.actividades, p.actividadesResumen).forEach(a => {
        expect(a, `${p.cargo}: ${a}`).not.toContain('…');
      });
    });
  });

  it('la redacción revisada es bastante más corta que la función original', () => {
    // Es lo que hace viable imprimirla entera.
    const original = PERFILES_RIESGO_CARGO.flatMap(p => p.actividades);
    const revisada = PERFILES_RIESGO_CARGO.flatMap(p => p.actividadesResumen ?? []);
    const media = (xs: string[]) => xs.reduce((s, x) => s + x.length, 0) / xs.length;
    expect(media(revisada)).toBeLessThan(media(original) * 0.75);
  });
});

describe('el recuadro de historia laboral (Sección H)', () => {
  /** Columna «ACTIVIDADES QUE DESEMPEÑABA» del formato, en mm. */
  const ANCHO_ACTIVIDADES = 56;
  const CARACTERES_POR_LINEA = Math.floor(ANCHO_ACTIVIDADES / 0.847); // 4.8 pt
  const ALTO_LINEA = 1.9;

  it('el trabajo actual se limita a unas pocas funciones', () => {
    expect(FUNCIONES_HISTORIA_LABORAL).toBeGreaterThanOrEqual(4);
    expect(FUNCIONES_HISTORIA_LABORAL).toBeLessThanOrEqual(5);
  });

  it('la fila del trabajo actual no se dispara de alto en ningún cargo', () => {
    PERFILES_RIESGO_CARGO.forEach(p => {
      const texto = textosActividades(p.actividades, p.actividadesResumen, FUNCIONES_HISTORIA_LABORAL).join('; ');
      const alto = Math.ceil(texto.length / CARACTERES_POR_LINEA) * ALTO_LINEA;
      expect(alto, `${p.cargo}: ${texto.length} caracteres`).toBeLessThan(20);
    });
  });

  it('las funciones llegan enteras también aquí', () => {
    PERFILES_RIESGO_CARGO.forEach(p => {
      textosActividades(p.actividades, p.actividadesResumen, FUNCIONES_HISTORIA_LABORAL)
        .forEach(a => expect(a, p.cargo).not.toContain('…'));
    });
  });
});
