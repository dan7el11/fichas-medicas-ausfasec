// Elementos comunes a todas las páginas del formato HCU-form.123/2025: la
// cabecera con el logo y el código del documento, las franjas de sección y los
// recuadros de texto libre.
//
// Vivían dentro del componente de la ficha, donde no había manera de
// renderizarlos en una prueba. Al sacarlos aquí, las páginas 2 y 3 se dibujan
// desde un script igual que la página 1 y se verifica el PDF completo.
import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const NEGRO: [number, number, number] = [0, 0, 0];
export const C_PRI = '#ccccff';   // franja de sección (A, B, C…)
export const C_SEC = '#ccffcc';   // encabezado de campo
export const C_TER = '#ccffff';

export const ESTILO_BASE = { lineColor: NEGRO, lineWidth: 0.25, fontSize: 6.5, cellPadding: 1.2, textColor: NEGRO };
export const ESTILO_HEAD = { fillColor: C_SEC, textColor: NEGRO, fontStyle: 'bold' as const, fontSize: 6.5, lineColor: NEGRO, lineWidth: 0.25, cellPadding: 1.2 };

export interface Logo { data: string; format: string }

/**
 * Cursor de dibujo con los ayudantes de maquetación. Mantiene `y` (el alto ya
 * consumido) y el ancho útil de la página en curso, que cambia al pasar a la
 * horizontal.
 */
export interface CromoPdf {
  /** Alto consumido en la página actual. */
  y: number;
  /** Margen y ancho útil de la página actual. */
  M: number;
  CW: number;
  /** Recalcula el ancho útil y vuelve arriba. Se llama tras cada `addPage`. */
  reiniciar(): void;
  /** autoTable con los márgenes del formato; deja `y` al final de la tabla. */
  AT(opts: any): void;
  /** Salta de página si no caben `n` mm. */
  check(n: number): void;
  /** Franja de título de sección. */
  sec(texto: string, bg?: string): void;
  /** Recuadro de texto libre, de alto variable según el contenido. */
  libre(texto: string, minH?: number): void;
  /** Cabecera del formato. `compacto` la reduce para la página horizontal. */
  cab(pagina: string, compacto?: boolean): void;
}

export function crearCromo(pdf: jsPDF, logo: Logo): CromoPdf {
  const base = ESTILO_BASE;
  const c: CromoPdf = {
    y: 7,
    M: 7,
    CW: pdf.internal.pageSize.getWidth() - 14,

    reiniciar() {
      c.CW = pdf.internal.pageSize.getWidth() - c.M * 2;
      c.y = 7;
    },

    AT(opts: any) {
      autoTable(pdf, { margin: { left: c.M, right: c.M }, ...opts });
      c.y = (pdf as any).lastAutoTable.finalY;
    },

    check(n: number) {
      if (c.y + n > pdf.internal.pageSize.getHeight() - 8) { pdf.addPage(); c.y = 7; }
    },

    sec(texto: string, bg = C_PRI) {
      c.check(9);
      pdf.setFillColor(bg); pdf.setDrawColor(0);
      pdf.rect(c.M, c.y, c.CW, 5, 'FD');
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
      pdf.text(texto, c.M + 1.5, c.y + 3.5);
      c.y += 5;
    },

    libre(texto: string, minH = 6) {
      pdf.setDrawColor(0); pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(0);
      const l = pdf.splitTextToSize(texto || '-', c.CW - 3);
      const h = Math.max(minH, l.length * 3 + 2);
      c.check(h + 2);
      pdf.rect(c.M, c.y, c.CW, h, 'S');
      pdf.text(l, c.M + 1.5, c.y + 3);
      c.y += h;
    },

    cab(pagina: string, compacto = false) {
      const ty = c.y;
      if (compacto) {
        c.AT({ startY: c.y, theme: 'grid', styles: { ...base, halign: 'center', fontSize: 8, cellPadding: 0.7 }, columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 46 } }, body: [
          [{ content: '', rowSpan: 2 }, { content: 'HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN MÉDICA OCUPACIONAL', styles: { fontStyle: 'bold', fontSize: 8.5 } }, { content: 'Código: HCU-form.123/2025', styles: { fontSize: 6, halign: 'left' } }],
          [{ content: 'MACROPROCESO:  PLANIFICACIÓN, SEGURIDAD Y AMBIENTE', styles: { fontSize: 5.6, fontStyle: 'bold' } }, { content: `Revisión: 1     ${pagina}`, styles: { fontSize: 6, halign: 'left' } }],
        ] });
        try { pdf.addImage(logo.data, logo.format, c.M + 1, ty + 0.8, 38, 9); } catch { /* sin logo */ }
      } else {
        c.AT({ startY: c.y, theme: 'grid', styles: { ...base, halign: 'center', fontSize: 8 }, columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 33 } }, body: [
          [{ content: '', rowSpan: 3, styles: { fontSize: 10, valign: 'middle' } }, { content: 'HISTORIA CLÍNICA OCUPACIONAL:\nEVALUACIÓN MÉDICA OCUPACIONAL', rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, valign: 'middle' } }, { content: 'Código:  HCU-form.123/2025', styles: { fontSize: 7, halign: 'left' } }],
          [{ content: 'Revisión:  1', styles: { fontSize: 7, halign: 'left' } }],
          [{ content: 'MACROPROCESO:  PLANIFICACIÓN, SEGURIDAD Y AMBIENTE', styles: { fontSize: 6, fontStyle: 'bold' } }, { content: pagina, styles: { fontSize: 7, halign: 'left' } }],
        ] });
        try { pdf.addImage(logo.data, logo.format, c.M + 1, ty + 1, 40, 12); } catch { /* sin logo */ }
      }
      c.y += 2;
    },
  };
  return c;
}
