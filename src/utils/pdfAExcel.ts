// Traslada a una hoja de Excel lo que se dibujó en una página de PDF.
//
// La idea es que al imprimir la hoja salga la misma página. Para eso:
//
//  - Cada borde de celda del PDF se convierte en un corte de columna o de fila.
//    Las columnas y filas de la hoja tienen el ancho y el alto exactos en mm
//    del espacio entre dos cortes, así que la cuadrícula es la del PDF.
//  - Cada celda del PDF ocupa el rango de la cuadrícula entre sus cortes; si
//    abarca varias, se combinan. Lleva su relleno y sus bordes.
//  - Cada texto va a la celda donde se pintó, con su cuerpo, su negrita, su
//    color, su giro y sus saltos de línea. La alineación se deduce de dónde
//    quedó el texto dentro de la celda.
//  - La hoja se configura en el tamaño y la orientación de la página, con los
//    mismos márgenes, y ajustada a una sola página para que nunca se parta.
//
// Unidades: el PDF trabaja en mm. Excel mide columnas en píxeles a 96 ppp y
// filas en puntos. Para que el redondeo a píxeles no se acumule a lo largo de
// cien columnas, se redondean las posiciones acumuladas, no los anchos.
import type { Workbook, Worksheet, Border } from 'exceljs';
import type { Grabacion, OpRect, OpTexto, OpLinea, OpImagen } from './grabadorPdf';

const PX_POR_MM = 96 / 25.4;
const MM_POR_PT = 25.4 / 72;
/** Dos cortes a menos de esta distancia son el mismo (redondeos de autotable). */
const TOLERANCIA_MM = 0.3;
/**
 * Unidad de ancho de columna, en píxeles: el ancho del dígito «0» de la fuente
 * Normal del libro.
 *
 * Excel la redondea a píxeles enteros (es la fórmula del estándar OOXML) y
 * LibreOffice usa el valor exacto. Con Calibri 11, la fuente por defecto, son
 * 7 px en Excel y 7,43 en LibreOffice: la misma hoja sale un 6 % más ancha en
 * uno que en otro y, ajustada a una página, se imprime encogida. Courier New
 * 10 tiene los dígitos de exactamente 0,6 em = 8,00 px, y ahí los dos
 * coinciden. Por eso la fuente Normal del libro se cambia a Courier New 10
 * (ver `fijarFuenteNormal`); no se ve en ninguna celda, todas llevan Arial.
 */
export const PX_DIGITO = 8;

/** Fuente de las celdas sin texto, para lo que se escriba a mano. */
const FUENTE_VACIA = { name: 'Arial', size: 6.5 };

/**
 * Cambia la fuente Normal del libro ya escrito a Courier New 10, que es la que
 * hace que `PX_DIGITO` valga lo mismo en Excel y en LibreOffice. exceljs fija
 * Calibri 11 sin opción para cambiarla, así que se retoca styles.xml.
 */
export async function fijarFuenteNormal(xlsx: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(xlsx);
  const ruta = 'xl/styles.xml';
  const estilos = await zip.file(ruta)!.async('string');
  const normal = '<font><sz val="10"/><color theme="1"/><name val="Courier New"/><family val="3"/></font>';
  // La primera <font> de <fonts> es la 0, la de la fuente Normal.
  const nuevo = estilos.replace(/(<fonts\b[^>]*>)\s*<font>[\s\S]*?<\/font>/, `$1${normal}`);
  if (nuevo === estilos) throw new Error('No se encontró la fuente Normal en styles.xml');
  zip.file(ruta, nuevo);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

interface Caja { x0: number; y0: number; x1: number; y1: number }
interface Rango { r0: number; c0: number; r1: number; c1: number }

/** Agrupa valores cercanos y devuelve un representante por grupo, ordenados. */
export function agruparCortes(valores: number[], tolerancia = TOLERANCIA_MM): number[] {
  const v = valores.filter(Number.isFinite).sort((a, b) => a - b);
  const grupos: number[][] = [];
  for (const x of v) {
    const g = grupos[grupos.length - 1];
    if (g && x - g[0] <= tolerancia) g.push(x);
    else grupos.push([x]);
  }
  return grupos.map(g => g.reduce((s, x) => s + x, 0) / g.length);
}

/** Índice del corte más cercano. */
function cercano(cortes: number[], v: number): number {
  let lo = 0, hi = cortes.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (cortes[m] < v) lo = m + 1; else hi = m;
  }
  if (lo > 0 && Math.abs(cortes[lo - 1] - v) <= Math.abs(cortes[lo] - v)) return lo - 1;
  return lo;
}

/** Índice del tramo [cortes[i], cortes[i+1]) que contiene v, o -1. */
function tramo(cortes: number[], v: number): number {
  if (v < cortes[0] || v >= cortes[cortes.length - 1]) return -1;
  let lo = 0, hi = cortes.length - 2;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (cortes[m] <= v) lo = m; else hi = m - 1;
  }
  return lo;
}

/** Caja que ocupa un texto en la página, en mm. */
export function cajaTexto(t: OpTexto): Caja {
  const mm = t.cuerpo * MM_POR_PT;
  const ancho = Math.max(0, ...t.anchos);
  const n = t.lineas.length;
  if (Math.abs(t.angulo - 90) < 1) {
    // Girado 90° a la izquierda: la línea base sube desde (x, y).
    return { x0: t.x - mm * 0.78 - (n - 1) * t.interlineado, y0: t.y - ancho, x1: t.x + mm * 0.22, y1: t.y };
  }
  const desplazar = t.alinear === 'center' ? ancho / 2 : t.alinear === 'right' ? ancho : 0;
  return {
    x0: t.x - desplazar,
    y0: t.y - mm * 0.78,
    x1: t.x - desplazar + ancho,
    y1: t.y + (n - 1) * t.interlineado + mm * 0.22,
  };
}

const dentro = (c: Caja, x: number, y: number) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1;
const area = (r: Rango) => (r.r1 - r.r0) * (r.c1 - r.c0);
const contiene = (a: Rango, b: Rango) => a.r0 <= b.r0 && a.c0 <= b.c0 && a.r1 >= b.r1 && a.c1 >= b.c1;
const igual = (a: Rango, b: Rango) => a.r0 === b.r0 && a.c0 === b.c0 && a.r1 === b.r1 && a.c1 === b.c1;

/**
 * Cuerpo de letra para Excel. Excel sólo maneja medios puntos, y se redondea
 * hacia abajo: con un cuerpo mayor que el del PDF, una línea que allí cabía
 * justa no cabe en la celda y Excel la parte, y la fila (de alto fijo, el del
 * PDF) la corta.
 */
export function cuerpoExcel(pt: number): number {
  return Math.max(1, Math.floor(pt * 2 + 1e-6) / 2);
}

function estiloBorde(grosor: number): Border['style'] {
  if (grosor > 0.6) return 'thick';
  if (grosor > 0.35) return 'medium';
  return 'thin';
}

const argb = (hex: string) => 'FF' + hex.replace('#', '').toUpperCase();

interface Fragmento { texto: string; base: number; izq: number; t: OpTexto }

/**
 * Une los textos que caen en una misma celda en el orden de lectura: los de
 * la misma línea con un espacio, las líneas con un salto. En los textos
 * girados, las líneas van de izquierda a derecha.
 */
function componer(textos: OpTexto[]): { fragmentos: { texto: string; t: OpTexto }[]; girado: boolean } {
  const girado = textos.every(t => Math.abs(t.angulo - 90) < 1);
  const piezas: Fragmento[] = [];
  textos.forEach(t => t.lineas.forEach((l, i) => {
    if (!l.trim()) return;
    piezas.push(girado
      ? { texto: l, base: t.x + i * t.interlineado, izq: -t.y, t }
      : { texto: l, base: t.y + i * t.interlineado, izq: t.x, t });
  }));
  piezas.sort((a, b) => a.base - b.base || a.izq - b.izq);

  const out: { texto: string; t: OpTexto }[] = [];
  let anterior: Fragmento | null = null;
  for (const p of piezas) {
    if (anterior) {
      const misma = Math.abs(p.base - anterior.base) < p.t.cuerpo * MM_POR_PT * 0.4;
      out.push({ texto: misma ? ' ' : '\n', t: p.t });
    }
    out.push({ texto: p.texto, t: p.t });
    anterior = p;
  }
  // Une los trozos seguidos con la misma fuente.
  const unidos: { texto: string; t: OpTexto }[] = [];
  for (const f of out) {
    const u = unidos[unidos.length - 1];
    if (u && mismaFuente(u.t, f.t)) u.texto += f.texto;
    else unidos.push({ ...f });
  }
  return { fragmentos: unidos, girado };
}

const mismaFuente = (a: OpTexto, b: OpTexto) =>
  cuerpoExcel(a.cuerpo) === cuerpoExcel(b.cuerpo) && a.negrita === b.negrita && a.cursiva === b.cursiva && a.color === b.color;

const fuenteExcel = (t: OpTexto) => ({
  name: 'Arial',   // misma métrica que la Helvetica del PDF
  size: cuerpoExcel(t.cuerpo),
  bold: t.negrita || undefined,
  italic: t.cursiva || undefined,
  color: { argb: argb(t.color) },
});

const dispersion = (v: number[]) => Math.max(...v) - Math.min(...v);

/**
 * Dónde quedó el texto dentro de su celda: izquierda, centro o derecha.
 *
 * Con varias líneas se mira cómo se pintaron, que es más fiable que los
 * huecos: autotable pinta un párrafo alineado a la izquierda en una sola
 * llamada con todas sus líneas, y uno centrado o a la derecha línea por línea,
 * cada una con su propia x. Un párrafo que llena la celda deja huecos iguales
 * a los dos lados y, mirando sólo los huecos, parecería centrado.
 */
function alineacion(textos: OpTexto[], caja: Caja, celda: Caja) {
  const arr = caja.y0 - celda.y0, aba = celda.y1 - caja.y1;
  const vertical = Math.abs(arr - aba) <= 1 ? 'middle' : arr < aba ? 'top' : 'bottom';

  let horizontal: 'left' | 'center' | 'right' | null = null;
  const rectos = textos.filter(t => Math.abs(t.angulo) < 1);
  if (rectos.some(t => t.lineas.length > 1 && t.alinear === 'left')) horizontal = 'left';
  else if (rectos.length > 1) {
    const lineas = rectos.flatMap(t => t.anchos.map(a => ({ x0: t.x, x1: t.x + a })));
    if (dispersion(lineas.map(l => l.x0)) < 0.3 && dispersion(lineas.map(l => l.x1)) >= 0.3) horizontal = 'left';
    else if (dispersion(lineas.map(l => (l.x0 + l.x1) / 2)) < 0.3) horizontal = 'center';
    else if (dispersion(lineas.map(l => l.x1)) < 0.3) horizontal = 'right';
  }
  if (!horizontal) {
    const izq = caja.x0 - celda.x0, der = celda.x1 - caja.x1;
    horizontal = Math.abs(izq - der) <= 1 ? 'center' : izq < der ? 'left' : 'right';
  }
  return { horizontal, vertical } as const;
}

export interface OpcionesHoja {
  /** Nombre de la pestaña. */
  nombre: string;
  /** Tamaño de la página del PDF, en mm. */
  pagina: { ancho: number; alto: number };
}

/**
 * Crea en `wb` una hoja con el dibujo de la página `numero` de la grabación.
 * Devuelve la hoja.
 */
export function paginaAHoja(wb: Workbook, g: Grabacion, numero: number, o: OpcionesHoja): Worksheet {
  const ops = g.ops.filter(op => op.pagina === numero);
  const rects = ops.filter((op): op is OpRect => op.tipo === 'rect' && op.w > 0.05 && op.h > 0.05);
  const lineas = ops.filter((op): op is OpLinea => op.tipo === 'linea');
  const textos = ops.filter((op): op is OpTexto => op.tipo === 'texto');
  const imagenes = ops.filter((op): op is OpImagen => op.tipo === 'imagen');

  const cajasRect: Caja[] = rects.map(r => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }));
  const cajasTexto = textos.map(cajaTexto);
  const centro = (c: Caja) => ({ x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2 });
  const libre = textos.map((_, i) => {
    const { x, y } = centro(cajasTexto[i]);
    return !cajasRect.some(c => dentro(c, x, y));
  });

  // ── Cuadrícula ──────────────────────────────────────────────────────────
  const xs: number[] = [], ys: number[] = [];
  cajasRect.forEach(c => { xs.push(c.x0, c.x1); ys.push(c.y0, c.y1); });
  lineas.forEach(l => {
    if (Math.abs(l.y1 - l.y2) < 0.05) ys.push(l.y1);
    if (Math.abs(l.x1 - l.x2) < 0.05) xs.push(l.x1);
  });
  // Los textos sueltos (fuera de toda celda, como el pie de la página 1)
  // necesitan su propia franja para tener dónde ir.
  textos.forEach((_, i) => {
    if (!libre[i]) return;
    const c = cajasTexto[i];
    xs.push(c.x0, c.x1); ys.push(c.y0 - 0.4, c.y1 + 0.4);
  });
  const xb = agruparCortes(xs);
  const yb = agruparCortes(ys);
  const ws = wb.addWorksheet(o.nombre, {
    views: [{ showGridLines: false, zoomScale: 100 }],
  });
  if (xb.length < 2 || yb.length < 2) return ws;
  const ncol = xb.length - 1, nfil = yb.length - 1;

  // Anchos y altos a partir de posiciones acumuladas ya redondeadas.
  const pxX = xb.map(v => Math.round(v * PX_POR_MM));
  const pxY = yb.map(v => Math.round(v * PX_POR_MM));
  for (let c = 0; c < ncol; c++) {
    // Ancho de columna en «caracteres»: Excel lo pinta como trunc(w·8 + 0,5) px.
    ws.getColumn(c + 1).width = Math.max(1, pxX[c + 1] - pxX[c]) / PX_DIGITO;
  }
  for (let r = 0; r < nfil; r++) {
    ws.getRow(r + 1).height = Math.max(1, pxY[r + 1] - pxY[r]) * 0.75;
  }

  const rangoDe = (c: Caja): Rango => ({ r0: cercano(yb, c.y0), c0: cercano(xb, c.x0), r1: cercano(yb, c.y1), c1: cercano(xb, c.x1) });
  const cajaDe = (r: Rango): Caja => ({ x0: xb[r.c0], y0: yb[r.r0], x1: xb[r.c1], y1: yb[r.r1] });

  // ── Celdas: una por rango, con lo que se pintó en él ────────────────────
  interface Celda { rango: Rango; relleno: string | null; trazo: boolean; grosor: number }
  const porClave = new Map<string, Celda>();
  rects.forEach((r, i) => {
    const rango = rangoDe(cajasRect[i]);
    if (rango.r1 <= rango.r0 || rango.c1 <= rango.c0) return;
    const k = `${rango.r0},${rango.c0},${rango.r1},${rango.c1}`;
    const previa = porClave.get(k);
    const relleno = r.relleno && r.relleno !== '#ffffff' ? r.relleno : null;
    if (previa) {
      previa.relleno = relleno ?? previa.relleno;
      previa.trazo ||= r.trazo;
      previa.grosor = Math.max(previa.grosor, r.trazo ? r.grosor : 0);
    } else {
      porClave.set(k, { rango, relleno, trazo: r.trazo, grosor: r.trazo ? r.grosor : 0 });
    }
  });
  const celdas = [...porClave.values()];
  // Un rectángulo que envuelve a otros es un marco: aporta bordes, no se
  // combina (taparía las celdas de dentro).
  const marcos = new Set(celdas.filter(a => celdas.some(b => b !== a && contiene(a.rango, b.rango) && !igual(a.rango, b.rango))));
  const ocupada = new Int32Array(nfil * ncol).fill(-1);
  const combinadas: Rango[] = [];
  celdas
    .filter(c => !marcos.has(c))
    .sort((a, b) => area(a.rango) - area(b.rango))
    .forEach(c => {
      const { r0, c0, r1, c1 } = c.rango;
      for (let r = r0; r < r1; r++) for (let k = c0; k < c1; k++) if (ocupada[r * ncol + k] !== -1) return;
      const id = combinadas.length;
      combinadas.push(c.rango);
      for (let r = r0; r < r1; r++) for (let k = c0; k < c1; k++) ocupada[r * ncol + k] = id;
    });

  // ── Bordes y rellenos ───────────────────────────────────────────────────
  const bordes = new Map<number, Partial<Record<'top' | 'left' | 'bottom' | 'right', Border>>>();
  const borde = (r: number, c: number, lado: 'top' | 'left' | 'bottom' | 'right', grosor: number) => {
    if (r < 0 || c < 0 || r >= nfil || c >= ncol) return;
    const k = r * ncol + c;
    const b = bordes.get(k) ?? {};
    b[lado] = { style: estiloBorde(grosor), color: { argb: 'FF000000' } };
    bordes.set(k, b);
  };
  const rellenos = new Map<number, string>();
  celdas.forEach(c => {
    const { r0, c0, r1, c1 } = c.rango;
    if (c.relleno && !marcos.has(c)) {
      for (let r = r0; r < r1; r++) for (let k = c0; k < c1; k++) rellenos.set(r * ncol + k, c.relleno);
    }
    if (!c.trazo) return;
    for (let k = c0; k < c1; k++) { borde(r0, k, 'top', c.grosor); borde(r1 - 1, k, 'bottom', c.grosor); borde(r0 - 1, k, 'bottom', c.grosor); borde(r1, k, 'top', c.grosor); }
    for (let r = r0; r < r1; r++) { borde(r, c0, 'left', c.grosor); borde(r, c1 - 1, 'right', c.grosor); borde(r, c0 - 1, 'right', c.grosor); borde(r, c1, 'left', c.grosor); }
  });
  lineas.forEach(l => {
    if (Math.abs(l.y1 - l.y2) < 0.05) {
      const r = cercano(yb, l.y1);
      const a = cercano(xb, Math.min(l.x1, l.x2)), b = cercano(xb, Math.max(l.x1, l.x2));
      for (let k = a; k < b; k++) { borde(r, k, 'top', l.grosor); borde(r - 1, k, 'bottom', l.grosor); }
    } else if (Math.abs(l.x1 - l.x2) < 0.05) {
      const c = cercano(xb, l.x1);
      const a = cercano(yb, Math.min(l.y1, l.y2)), b = cercano(yb, Math.max(l.y1, l.y2));
      for (let r = a; r < b; r++) { borde(r, c, 'left', l.grosor); borde(r, c - 1, 'right', l.grosor); }
    }
  });

  // ── Textos ──────────────────────────────────────────────────────────────
  const destino = new Map<number, OpTexto[]>();   // por id de combinada
  // Franjas creadas para textos sueltos: van en una línea, sin ajustar, y se
  // desbordan como en el PDF.
  const sueltas = new Set<number>();
  textos.forEach((t, i) => {
    const caja = cajasTexto[i];
    const { x, y } = centro(caja);
    let mejor = -1;
    combinadas.forEach((rg, id) => {
      if (dentro(cajaDe(rg), x, y) && (mejor === -1 || area(rg) < area(combinadas[mejor]))) mejor = id;
    });
    if (mejor === -1) {
      // Texto suelto: se le da su franja; si está libre, se combina para que
      // no dependa de desbordarse a las celdas vecinas.
      const r = tramo(yb, y), c = tramo(xb, caja.x0 + 0.01);
      if (r < 0 || c < 0) return;
      const id = ocupada[r * ncol + c];
      if (id !== -1) { mejor = id; }
      else {
        const c1 = Math.max(c + 1, cercano(xb, caja.x1));
        let fin = c + 1;
        while (fin < c1 && ocupada[r * ncol + fin] === -1) fin++;
        mejor = combinadas.length;
        sueltas.add(mejor);
        combinadas.push({ r0: r, c0: c, r1: r + 1, c1: fin });
        for (let k = c; k < fin; k++) ocupada[r * ncol + k] = mejor;
      }
    }
    destino.set(mejor, [...(destino.get(mejor) ?? []), t]);
  });

  // ── Volcado ─────────────────────────────────────────────────────────────
  rellenos.forEach((hexa, k) => {
    ws.getCell(Math.floor(k / ncol) + 1, (k % ncol) + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hexa) } };
  });
  bordes.forEach((b, k) => {
    ws.getCell(Math.floor(k / ncol) + 1, (k % ncol) + 1).border = { ...b };
  });
  destino.forEach((ts, id) => {
    const rg = combinadas[id];
    const celda = ws.getCell(rg.r0 + 1, rg.c0 + 1);
    const { fragmentos, girado } = componer(ts);
    if (!fragmentos.length) return;
    const cajas = ts.map(cajaTexto);
    const conjunto: Caja = {
      x0: Math.min(...cajas.map(c => c.x0)), y0: Math.min(...cajas.map(c => c.y0)),
      x1: Math.max(...cajas.map(c => c.x1)), y1: Math.max(...cajas.map(c => c.y1)),
    };
    const al = alineacion(ts, conjunto, cajaDe(rg));
    if (fragmentos.length === 1) {
      celda.value = fragmentos[0].texto;
      celda.font = fuenteExcel(fragmentos[0].t);
    } else {
      celda.value = { richText: fragmentos.map(f => ({ text: f.texto, font: fuenteExcel(f.t) })) };
      celda.font = fuenteExcel(fragmentos[0].t);
    }
    celda.alignment = {
      horizontal: al.horizontal,
      vertical: al.vertical,
      wrapText: !sueltas.has(id),
      ...(girado ? { textRotation: 90 } : {}),
    };
  });

  // Las celdas sin texto llevan Arial: si no, lo que se escriba a mano saldría
  // en la fuente Normal (Courier). Las estrechas, que son casillas de marca,
  // centradas.
  for (let r = 0; r < nfil; r++) {
    for (let c = 0; c < ncol; c++) {
      const celda = ws.getCell(r + 1, c + 1);
      if (celda.value !== null && celda.value !== undefined) continue;
      const id = ocupada[r * ncol + c];
      const ancho = id === -1 ? xb[c + 1] - xb[c] : xb[combinadas[id].c1] - xb[combinadas[id].c0];
      celda.font = { ...FUENTE_VACIA };
      celda.alignment = { horizontal: ancho < 12 ? 'center' : 'left', vertical: 'middle', wrapText: true };
    }
  }

  // Se combina al final y sin estilo: `mergeCells` de exceljs hace que todas
  // las celdas del rango compartan el MISMO objeto de estilo que la primera,
  // y cada borde asignado a una de ellas pisaba a las demás. En el examen
  // físico, donde cada celda abarca varias filas de la cuadrícula, se perdían
  // todas las líneas de separación.
  combinadas.forEach(rg => {
    if (rg.r1 - rg.r0 > 1 || rg.c1 - rg.c0 > 1) ws.mergeCellsWithoutStyle(rg.r0 + 1, rg.c0 + 1, rg.r1, rg.c1);
  });

  // ── Imágenes (el logo de la cabecera) ───────────────────────────────────
  imagenes.forEach(im => {
    const m = /^data:image\/(png|jpe?g);base64,(.*)$/i.exec(im.datos);
    const base64 = m ? m[2] : im.datos;
    const extension = (m ? m[1] : im.formato).toLowerCase().startsWith('j') ? 'jpeg' : 'png';
    const id = wb.addImage({ base64, extension });
    const fraccion = (cortes: number[], v: number) => {
      const i = Math.max(0, Math.min(cortes.length - 2, tramo(cortes, v) === -1 ? 0 : tramo(cortes, v)));
      return i + (v - cortes[i]) / (cortes[i + 1] - cortes[i]);
    };
    ws.addImage(id, {
      tl: { col: fraccion(xb, im.x), row: fraccion(yb, im.y) } as any,
      ext: { width: im.w * PX_POR_MM, height: im.h * PX_POR_MM },
      editAs: 'oneCell',
    });
  });

  // ── Impresión: la página del PDF, entera en una sola hoja ───────────────
  const pulgadas = (mm: number) => Math.max(0, mm) / 25.4;
  ws.pageSetup = {
    paperSize: 9,   // A4
    orientation: o.pagina.ancho > o.pagina.alto ? 'landscape' : 'portrait',
    fitToPage: true, fitToWidth: 1, fitToHeight: 1,
    horizontalCentered: false, verticalCentered: false,
    margins: {
      left: pulgadas(xb[0]), top: pulgadas(yb[0]),
      // Medio milímetro de holgura para que el redondeo a píxeles no obligue
      // a encoger la página.
      right: pulgadas(o.pagina.ancho - xb[ncol] - 0.5),
      bottom: pulgadas(o.pagina.alto - yb[nfil] - 0.5),
      header: 0, footer: 0,
    },
    printArea: `A1:${ws.getColumn(ncol).letter}${nfil}`,
  } as any;
  return ws;
}

/** Ancho en mm que ocupa una columna de la hoja al imprimirse. */
export function anchoColumnaMm(ancho: number): number {
  return Math.trunc(ancho * PX_DIGITO + 0.49) / PX_POR_MM;
}
