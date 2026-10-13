// Registro de lo que se dibuja en un documento jsPDF.
//
// Sirve para sacar la ficha en Excel con la MISMA maqueta que el PDF: en lugar
// de mantener una segunda maqueta a mano (que se desvía en cuanto cambia la
// primera), se ejecutan los mismos dibujantes del PDF sobre un documento
// envuelto por este registro y se trasladan a la hoja las celdas, líneas,
// textos e imágenes que salieron.
//
// El envoltorio no cambia nada de lo que se dibuja: anota y llama al método
// original. No importa jsPDF en tiempo de ejecución, sólo sus tipos, para que
// se pueda usar también desde una prueba que sustituye el módulo.
import type jsPDF from 'jspdf';

export interface OpRect { tipo: 'rect'; pagina: number; x: number; y: number; w: number; h: number; relleno: string | null; trazo: boolean; grosor: number }
export interface OpLinea { tipo: 'linea'; pagina: number; x1: number; y1: number; x2: number; y2: number; grosor: number }
export interface OpTexto {
  tipo: 'texto'; pagina: number;
  /** Líneas en el orden en que se pintan. */
  lineas: string[];
  /** Ancho de cada línea, en mm. */
  anchos: number[];
  x: number; y: number;
  /** Distancia entre líneas, en mm. */
  interlineado: number;
  angulo: number;
  alinear: 'left' | 'center' | 'right';
  /** Cuerpo en puntos. */
  cuerpo: number;
  negrita: boolean;
  cursiva: boolean;
  color: string;
}
export interface OpImagen { tipo: 'imagen'; pagina: number; datos: string; formato: string; x: number; y: number; w: number; h: number }
export type OpDibujo = OpRect | OpLinea | OpTexto | OpImagen;

export interface Grabacion {
  /** El documento que se grabó, por si además se quiere guardar como PDF. */
  documento: jsPDF;
  ops: OpDibujo[];
  /** Tamaño en mm de cada página, en orden. */
  paginas(): { ancho: number; alto: number }[];
}

const MM_POR_PT = 25.4 / 72;

/** Normaliza un color de jsPDF a «#rrggbb» en minúsculas. */
function hex(c: unknown): string {
  const s = String(c ?? '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + s.slice(1).split('').map(d => d + d).join('');
  // Gris en escala 0-1 o 0-255, como lo devuelve jsPDF a veces.
  const n = Number(s);
  if (Number.isFinite(n)) {
    const v = Math.round(n <= 1 ? n * 255 : n);
    const h = Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
    return `#${h}${h}${h}`;
  }
  return '#000000';
}

/**
 * Empieza a registrar lo que se dibuja en `pdf`. Si ya se estaba registrando,
 * devuelve el mismo registro (llamarlo dos veces no duplica nada).
 */
export function grabarDibujo(pdf: jsPDF): Grabacion {
  const doc: any = pdf;
  if (doc.__grabacion) return doc.__grabacion as Grabacion;

  const ops: OpDibujo[] = [];
  const pagina = (): number => doc.getCurrentPageInfo().pageNumber;

  const rect = doc.rect.bind(doc);
  doc.rect = function (x: number, y: number, w: number, h: number, estilo?: string | null) {
    const r = rect(x, y, w, h, estilo);
    // null es «sólo el trazado» (recortes): no pinta nada.
    if (estilo !== null) {
      const e = String(estilo ?? 'S').toUpperCase();
      const rellena = e.includes('F') || e === 'B' || e === 'B*';
      const traza = e.includes('S') || e.includes('D') || e === 'B' || e === 'B*';
      ops.push({
        tipo: 'rect', pagina: pagina(),
        x: Math.min(x, x + w), y: Math.min(y, y + h), w: Math.abs(w), h: Math.abs(h),
        relleno: rellena ? hex(doc.getFillColor()) : null,
        trazo: traza,
        grosor: doc.getLineWidth(),
      });
    }
    return r;
  };

  const linea = doc.line.bind(doc);
  doc.line = function (x1: number, y1: number, x2: number, y2: number, estilo?: string) {
    const r = linea(x1, y1, x2, y2, estilo);
    ops.push({ tipo: 'linea', pagina: pagina(), x1, y1, x2, y2, grosor: doc.getLineWidth() });
    return r;
  };

  const texto = doc.text.bind(doc);
  doc.text = function (t: string | string[], x: number, y: number, opciones?: any, transform?: any) {
    // Lo que va a pintar, con el estado de fuente de este momento.
    const o = opciones && typeof opciones === 'object' ? opciones : {};
    let lineas: string[] = Array.isArray(t) ? t.map(String) : String(t ?? '').split(/\r\n|\r|\n/);
    if (o.maxWidth) lineas = lineas.flatMap(l => doc.splitTextToSize(l, o.maxWidth) as string[]);
    const anchos = lineas.map(l => doc.getTextWidth(l));
    const cuerpo: number = doc.getFontSize();
    const factor: number = doc.getLineHeightFactor ? doc.getLineHeightFactor() : 1.15;
    const fuente = doc.getFont();
    const estilo = String(fuente?.fontStyle ?? '').toLowerCase();
    const r = texto(t, x, y, opciones, transform);
    if (lineas.some(l => l.trim())) {
      ops.push({
        tipo: 'texto', pagina: pagina(), lineas, anchos, x, y,
        interlineado: cuerpo * MM_POR_PT * factor,
        angulo: Number(o.angle ?? 0) || 0,
        alinear: o.align === 'center' || o.align === 'right' ? o.align : 'left',
        cuerpo,
        negrita: estilo.includes('bold'),
        cursiva: estilo.includes('italic') || estilo.includes('oblique'),
        color: hex(doc.getTextColor()),
      });
    }
    return r;
  };

  const imagen = doc.addImage.bind(doc);
  doc.addImage = function (datos: any, formato: any, x: number, y: number, w: number, h: number, ...resto: any[]) {
    // Si la imagen no vale, el original lanza y no se anota nada.
    const r = imagen(datos, formato, x, y, w, h, ...resto);
    if (typeof datos === 'string' && datos) {
      ops.push({ tipo: 'imagen', pagina: pagina(), datos, formato: String(formato || 'PNG').toUpperCase(), x, y, w, h });
    }
    return r;
  };

  const grabacion: Grabacion = {
    documento: pdf,
    ops,
    paginas() {
      const actual = pagina();
      const n: number = doc.getNumberOfPages();
      const out: { ancho: number; alto: number }[] = [];
      for (let i = 1; i <= n; i++) {
        doc.setPage(i);
        out.push({ ancho: doc.internal.pageSize.getWidth(), alto: doc.internal.pageSize.getHeight() });
      }
      doc.setPage(actual);
      return out;
    },
  };
  doc.__grabacion = grabacion;
  return grabacion;
}
