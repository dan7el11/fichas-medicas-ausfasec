// Sección de FACTORES DE RIESGO en los PDF (SO-RE-38 y SO-RE-41) con el
// formato de matriz de la hoja oficial: una columna por factor con el rótulo
// rotado 90° y una X en la casilla de cada factor marcado en la evaluación.
// Solo afecta al PDF exportado; la pantalla de captura no cambia.
import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  RIESGOS_FISICOS, RIESGOS_MECANICOS, RIESGOS_QUIMICOS,
  RIESGOS_BIOLOGICOS, RIESGOS_ERGONOMICOS, RIESGOS_PSICOSOCIALES,
} from '../../utils/catalogosEvaluacion';

const NEGRO: [number, number, number] = [0, 0, 0];
const VERDE = '#ccffcc';

interface Opts {
  M: number;        // margen izquierdo
  CW: number;       // ancho útil
  y: number;        // posición vertical actual
  puestoDefault: string;
  /** Filas numeradas de la matriz (la hoja oficial trae 4). */
  filas?: number;
  /** Alto (mm) de la fila de rótulos rotados: debe permitir el nombre completo. */
  altoEncabezado?: number;
  /** Alto mínimo (mm) de cada fila numerada del cuerpo. */
  altoFila?: number;
}

/** Celda de encabezado con el texto rotado 90° (se dibuja en didDrawCell). */
const rotada = (txt: string) => ({
  content: '',
  textToRotate: txt,
  styles: { fillColor: VERDE, valign: 'bottom' as const },
});

function dibujarRotados(pdf: jsPDF) {
  return (data: any) => {
    const raw = data.cell.raw as any;
    if (data.section !== 'head' || !raw?.textToRotate) return;
    pdf.setTextColor(0); pdf.setFontSize(4.6); pdf.setFont('helvetica', 'normal');
    const alto = data.cell.height;
    const cx = data.cell.x + data.cell.width / 2;
    const cy = data.cell.y + alto / 2;
    const str = String(raw.textToRotate);
    // El encabezado es lo bastante alto para el nombre completo; si un rótulo
    // muy largo no cabe en una línea, se reparte en dos (sin recortar).
    const max = alto - 2;
    if (pdf.getTextWidth(str) > max) {
      const partes: string[] = pdf.splitTextToSize(str, max);
      const l1 = partes[0];
      const l2 = partes.slice(1).join(' ');
      pdf.text(l1, cx + 1.4, cy + Math.min(pdf.getTextWidth(l1), max) / 2, { angle: 90 });
      if (l2) pdf.text(l2, cx - 0.6, cy + Math.min(pdf.getTextWidth(l2), max) / 2, { angle: 90 });
    } else {
      pdf.text(str, cx + 0.4, cy + pdf.getTextWidth(str) / 2, { angle: 90 });
    }
  };
}

/**
 * Dibuja las dos tablas matriz de factores de riesgo y devuelve la nueva `y`.
 * `fr` es el objeto `factoresRiesgo` de la evaluación (o undefined).
 */
export function dibujarFactoresRiesgoPdf(pdf: jsPDF, fr: any, opts: Opts): number {
  const { M, CW, puestoDefault } = opts;
  const FILAS = opts.filas ?? 4;
  const ALTO_ENCABEZADO = opts.altoEncabezado ?? 34;
  const ALTO_FILA = opts.altoFila ?? 6;
  let y = opts.y;
  const f = fr ?? {};
  const marcado = (lista: string[] | undefined, item: string) => (lista ?? []).includes(item) ? 'X' : '';

  const base = { lineColor: NEGRO, lineWidth: 0.2, fontSize: 5.5, cellPadding: 0.8, textColor: NEGRO };
  const alturaTabla = ALTO_ENCABEZADO + 5 + FILAS * ALTO_FILA + 4;

  const saltoSiNoCabe = (necesario: number) => {
    if (y + necesario > 285) { pdf.addPage(); y = 7; }
  };

  // Los grupos con su catálogo + columna final "Otros ____" (como la hoja).
  const grupos1 = [
    { nombre: 'FÍSICO', items: [...RIESGOS_FISICOS, 'Otros __________'], lista: f.fisicos },
    { nombre: 'MECÁNICO', items: [...RIESGOS_MECANICOS, 'Otros __________'], lista: f.mecanicos },
    { nombre: 'QUÍMICO', items: [...RIESGOS_QUIMICOS, 'Otros __________'], lista: f.quimicos },
  ];
  const grupos2 = [
    { nombre: 'BIOLÓGICO', items: [...RIESGOS_BIOLOGICOS, 'Otros __________'], lista: f.biologicos },
    { nombre: 'ERGONÓMICO', items: [...RIESGOS_ERGONOMICOS, 'Otros __________'], lista: f.ergonomicos },
    { nombre: 'PSICOSOCIAL', items: [...RIESGOS_PSICOSOCIALES, 'Otros __________'], lista: f.psicosociales },
  ];

  const tabla = (grupos: typeof grupos1, anchoPuesto: number, anchoActividades: number, medidas: boolean) => {
    const nCols = grupos.reduce((s, g) => s + g.items.length, 0);
    const anchoMedidas = medidas ? 38 : 0;
    const anchoCol = (CW - anchoPuesto - anchoActividades - anchoMedidas) / nCols;

    // Encabezado: fila 1 = grupos; fila 2 = rótulos rotados. Todo en el verde
    // institucional del formato (igual que PUESTO DE TRABAJO / ÁREA).
    const head1: any[] = [
      { content: 'PUESTO DE TRABAJO / ÁREA', rowSpan: 2, styles: { valign: 'middle' as const, halign: 'center' as const, fillColor: VERDE } },
      { content: 'ACTIVIDADES', rowSpan: 2, styles: { valign: 'middle' as const, halign: 'center' as const, fillColor: VERDE } },
      ...grupos.map(g => ({ content: g.nombre, colSpan: g.items.length, styles: { halign: 'center' as const, fillColor: VERDE } })),
      ...(medidas ? [{ content: 'MEDIDAS PREVENTIVAS', rowSpan: 2, styles: { valign: 'middle' as const, halign: 'center' as const, fillColor: VERDE } }] : []),
    ];
    const head2: any[] = grupos.flatMap(g => g.items.map(rotada));

    // Cuerpo: fila 1 con los datos y las X; el resto numeradas vacías.
    const body: any[][] = [];
    for (let n = 1; n <= FILAS; n++) {
      const primera = n === 1;
      body.push([
        { content: `${n}. ${primera ? (f.puestoArea || puestoDefault || '') : ''}`, styles: { fontSize: 5.5 } },
        { content: primera ? (f.actividades || '') : '', styles: { fontSize: 5.5 } },
        ...grupos.flatMap(g => g.items.map(item => ({
          content: primera ? marcado(g.lista, item) : '',
          styles: { halign: 'center' as const, fontStyle: 'bold' as const, fontSize: 6 },
        }))),
        ...(medidas ? [{ content: primera ? (f.medidasPreventivas || '') : '', styles: { fontSize: 5.5 } }] : []),
      ]);
    }

    const columnStyles: Record<number, any> = { 0: { cellWidth: anchoPuesto }, 1: { cellWidth: anchoActividades } };
    for (let i = 0; i < nCols; i++) columnStyles[2 + i] = { cellWidth: anchoCol };
    if (medidas) columnStyles[2 + nCols] = { cellWidth: anchoMedidas };

    autoTable(pdf, {
      startY: y,
      margin: { left: M, right: M },
      theme: 'grid',
      styles: base,
      headStyles: { ...base, fontStyle: 'bold', fontSize: 5.5, minCellHeight: 5 },
      bodyStyles: { minCellHeight: ALTO_FILA },
      columnStyles,
      head: [head1, head2],
      body,
      willDrawCell: (data: any) => {
        // La fila de rótulos rotados necesita altura fija.
        if (data.section === 'head' && data.row.index === 1) data.cell.styles.minCellHeight = ALTO_ENCABEZADO;
      },
      didDrawCell: dibujarRotados(pdf),
    });
    y = (pdf as any).lastAutoTable.finalY + 1.5;
  };

  saltoSiNoCabe(alturaTabla);
  tabla(grupos1, 26, 34, false);
  saltoSiNoCabe(alturaTabla);
  tabla(grupos2, 24, 28, true);

  // Tiempo de trabajo (dato de la pantalla que la matriz oficial no incluye).
  if (f.tiempoTrabajoMeses) {
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { ...base, fontSize: 6 },
      body: [[{ content: 'TIEMPO DE TRABAJO EN EL PUESTO (MESES):', styles: { fontStyle: 'bold', cellWidth: 70 } }, { content: String(f.tiempoTrabajoMeses) }]],
    });
    y = (pdf as any).lastAutoTable.finalY;
  }

  return y;
}
