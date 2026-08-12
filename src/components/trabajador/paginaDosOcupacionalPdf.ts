// PÁGINA 2 del formato SNS-MSP/HCU-form.123/2025 — Sección G, matriz de
// factores de riesgo por actividad (A4 horizontal).
//
// Las FILAS son los factores de riesgo agrupados por categoría y subcategoría;
// las COLUMNAS 1..7, las actividades importantes de la jornada. La hoja
// reserva UNA sola página para el recuadro, así que el ajuste vertical manda:
// por eso se omiten las líneas «Otros ______» y las actividades se imprimen
// con su redacción revisada, que la celda parte en varias líneas.
import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MATRIZ_RIESGOS, esFactorAnalizable } from '../../utils/catalogosEvaluacion';
import { textosActividades } from '../../utils/resumenFuncion';
import { MAX_ACTIVIDADES } from '../../constants/funcionesCargo';

const NEGRO: [number, number, number] = [0, 0, 0];
const VERDE = '#ccffcc';
const CELESTE = '#ccffff';

/** Anchos (mm) del bloque de factores; el resto se reparte entre actividades. */
const ANCHO_CATEGORIA = 17;
const ANCHO_SUBCATEGORIA = 13;
const ANCHO_FACTOR = 42;

export interface DatosPagina2Ocupacional {
  /** El objeto `factoresRiesgo` de la evaluación. */
  fr: any;
  /** Puesto de trabajo, para la fila superior. */
  puestoTrabajo: string;
  /** Margen izquierdo/derecho y ancho útil de la página horizontal. */
  margen: number;
  anchoUtil: number;
}

/** Actividades de la jornada tal como se imprimen en los encabezados. */
export function actividadesDeMatriz(fr: any): string[] {
  const completas: string[] = (fr?.actividadesJornada?.length
    ? fr.actividadesJornada
    : String(fr?.actividades || '').split(/\s*[;\n]\s*/).filter(Boolean)
  ).slice(0, MAX_ACTIVIDADES);
  return textosActividades(completas, fr?.actividadesResumen);
}

/** Factores que se imprimen, ya sin las líneas «Otros ______». */
export function factoresDeMatriz(): { categoria: string; clave: string; color: string; subgrupos: { subcategoria?: string; items: string[] }[] }[] {
  return MATRIZ_RIESGOS
    .map(c => ({
      categoria: c.categoria,
      clave: c.clave as string,
      color: (c as any).color as string,
      subgrupos: c.subgrupos
        .map(g => ({ subcategoria: g.subcategoria, items: g.items.filter(esFactorAnalizable) }))
        .filter(g => g.items.length > 0),
    }))
    .filter(c => c.subgrupos.length > 0);
}

/**
 * Dibuja la matriz de la Sección G a partir de `y` y devuelve la `y` final.
 * La página horizontal y su encabezado ya deben estar puestos.
 */
export function dibujarMatrizRiesgos(pdf: jsPDF, y: number, d: DatosPagina2Ocupacional): number {
  const { fr, puestoTrabajo, margen: M, anchoUtil: CW } = d;
  const acts = actividadesDeMatriz(fr);
  const base = { lineColor: NEGRO, lineWidth: 0.2, fontSize: 6.5, cellPadding: 1.2, textColor: NEGRO };

  const marcadasDe = (riesgo: string, clave: string): number[] => {
    const mapa = fr?.riesgoActividades || {};
    if (mapa[riesgo]) return mapa[riesgo];
    // Compatibilidad: si solo hay arreglos por categoría, se marca la actividad 1.
    const lista: string[] = fr?.[clave] || [];
    return lista.includes(riesgo) ? [0] : [];
  };

  // Puesto de trabajo (una sola fila: rótulo + valor, como en la hoja).
  autoTable(pdf, {
    startY: y, margin: { left: M, right: M }, theme: 'grid',
    styles: { ...base, fontSize: 6.5, cellPadding: 0.8 },
    body: [[
      { content: 'PUESTO DE TRABAJO', styles: { fillColor: VERDE, fontStyle: 'bold', cellWidth: 45, fontSize: 6 } },
      { content: fr?.puestoArea || puestoTrabajo || '-' },
    ]],
  });
  y = (pdf as any).lastAutoTable.finalY;

  const wAct = (CW - ANCHO_CATEGORIA - ANCHO_SUBCATEGORIA - ANCHO_FACTOR) / MAX_ACTIVIDADES;

  // Encabezado: cada columna es UNA actividad de la jornada (número + texto).
  const cabActividades: any[] = [
    { content: 'ACTIVIDADES IMPORTANTES DENTRO DE LA JORNADA LABORAL', colSpan: 3, styles: { fillColor: VERDE, fontStyle: 'bold', fontSize: 5.5, halign: 'left', valign: 'middle' } },
    ...Array.from({ length: MAX_ACTIVIDADES }, (_, i) => ({
      content: acts[i] ? `${i + 1}.  ${acts[i]}` : String(i + 1),
      styles: { fillColor: VERDE, fontStyle: 'bold' as const, halign: 'left' as const, valign: 'top' as const, fontSize: 4.2, cellPadding: 0.5, overflow: 'linebreak' as const },
    })),
  ];

  const cuerpo: any[] = [];
  factoresDeMatriz().forEach((categoria) => {
    const totalFilas = categoria.subgrupos.reduce((s, g) => s + g.items.length, 0);
    let primeraDeCategoria = true;
    categoria.subgrupos.forEach((grupo) => {
      grupo.items.forEach((factor, idxItem) => {
        const fila: any[] = [];
        if (primeraDeCategoria) {
          fila.push({ content: categoria.categoria, rowSpan: totalFilas, styles: { fillColor: CELESTE, fontStyle: 'bold', valign: 'middle', halign: 'center', fontSize: 5.4, overflow: 'linebreak' } });
          primeraDeCategoria = false;
        }
        if (idxItem === 0 && grupo.subcategoria) {
          fila.push({ content: grupo.subcategoria, rowSpan: grupo.items.length, styles: { fillColor: '#f2f5f8', fontStyle: 'bold', valign: 'middle', halign: 'center', fontSize: 4.8, overflow: 'linebreak' } });
        }
        // Sin subcategoría, la celda del factor se extiende sobre esa columna.
        fila.push(grupo.subcategoria
          ? { content: factor, styles: { fontSize: 4.6, overflow: 'linebreak' } }
          : { content: factor, colSpan: 2, styles: { fontSize: 4.6, overflow: 'linebreak' } });
        const marcadas = marcadasDe(factor, categoria.clave);
        for (let i = 0; i < MAX_ACTIVIDADES; i++) {
          fila.push({ content: marcadas.includes(i) ? 'X' : '', styles: { halign: 'center' as const, fontStyle: 'bold' as const, fontSize: 5.6 } });
        }
        cuerpo.push(fila);
      });
    });
  });

  // Última fila: las medidas preventivas al pie de la columna de cada actividad.
  const medidas: string[] = fr?.medidasActividades || [];
  cuerpo.push([
    { content: 'MEDIDAS PREVENTIVAS', colSpan: 3, styles: { fillColor: VERDE, fontStyle: 'bold' as const, fontSize: 5.2, halign: 'left' as const, valign: 'middle' as const, minCellHeight: 12 } },
    ...Array.from({ length: MAX_ACTIVIDADES }, (_, i) => ({
      content: acts[i] ? (medidas[i] || fr?.medidasPreventivas || '') : '',
      styles: { fontSize: 4.2, halign: 'left' as const, valign: 'top' as const, cellPadding: 0.5, overflow: 'linebreak' as const, minCellHeight: 12 },
    })),
  ]);

  const colStyles: Record<number, any> = {
    0: { cellWidth: ANCHO_CATEGORIA }, 1: { cellWidth: ANCHO_SUBCATEGORIA }, 2: { cellWidth: ANCHO_FACTOR },
  };
  for (let i = 0; i < MAX_ACTIVIDADES; i++) colStyles[3 + i] = { cellWidth: wAct };

  autoTable(pdf, {
    startY: y, theme: 'grid',
    // margin.bottom explícito: autotable usa 40 mm por defecto y partiría la matriz.
    margin: { left: M, right: M, top: 7, bottom: 5 },
    styles: { lineColor: NEGRO, lineWidth: 0.2, cellPadding: 0.12, textColor: NEGRO, fontSize: 4.6, minCellHeight: 2.05, overflow: 'linebreak', valign: 'middle' },
    headStyles: { lineColor: NEGRO, lineWidth: 0.2, cellPadding: 0.6, textColor: NEGRO, fillColor: VERDE, fontStyle: 'bold', fontSize: 6 },
    columnStyles: colStyles,
    head: [cabActividades],
    body: cuerpo,
  });
  return (pdf as any).lastAutoTable.finalY;
}
