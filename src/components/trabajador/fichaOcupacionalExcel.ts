// FICHA OCUPACIONAL EN EXCEL — el formato SNS-MSP/HCU-form.123/2025 en una
// hoja de cálculo que se imprime igual que el PDF.
//
// No tiene maqueta propia. Ejecuta los mismos dibujantes que el PDF (página 1,
// matriz de riesgos, página 3), en el mismo orden y con los mismos datos, sobre
// un documento que registra lo que se pinta, y traslada cada página a una hoja:
// mismas columnas y filas en mm, mismas celdas combinadas, rellenos, bordes,
// textos, logo y orientación. Así no puede haber diferencias entre las dos
// salidas: si el PDF cambia, el Excel cambia con él.
//
// El PDF no se toca: este módulo sólo lee sus dibujantes.
import jsPDF from 'jspdf';
import type { Workbook } from 'exceljs';
import { dibujarPagina1Ocupacional } from './paginaUnoOcupacionalPdf';
import { dibujarMatrizRiesgos } from './paginaDosOcupacionalPdf';
import { dibujarPagina3Ocupacional } from './paginaTresOcupacionalPdf';
import { crearCromo, type Logo } from './cromoOcupacionalPdf';
import { grabarDibujo, type Grabacion, type OpTexto } from '../../utils/grabadorPdf';
import { paginaAHoja, fijarFuenteNormal } from '../../utils/pdfAExcel';
import { conExtension } from '../../utils/entregarArchivo';
import { LOGO_EMPRESA } from '../../assets/logoEmpresa';

export interface DatosFichaExcel {
  /** Sin evaluación sale la plantilla en blanco. */
  ev?: any;
  trabajador?: any;
  empresa: any;
  /** El mismo logo que usa el PDF. */
  logoPdf?: Logo;
  /** Los mismos formateadores de fecha y hora que usa el PDF. */
  fmtFecha?: (f: any) => string;
  fmtHora?: (f: any) => string;
}

const LOGO_POR_DEFECTO: Logo = { data: LOGO_EMPRESA, format: 'PNG' };
const fechaSimple = (f: any): string => {
  const d = f?.seconds ? new Date(f.seconds * 1000) : f instanceof Date ? f : null;
  return d ? d.toLocaleDateString('es-EC') : (f ? String(f) : '');
};
const horaSimple = (f: any): string => {
  const d = f?.seconds ? new Date(f.seconds * 1000) : f instanceof Date ? f : null;
  return d ? d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '';
};

/**
 * Dibuja la ficha completa y devuelve lo que se pintó.
 *
 * Es la misma secuencia que `generarPDFOcupacional` en FichaTrabajador.tsx: si
 * se cambia allí, hay que cambiarla aquí. La prueba
 * `FichaTrabajador.exportados.test.tsx` pulsa los dos botones de la ficha y
 * comprueba que ambos dibujan exactamente lo mismo.
 */
export function dibujarFichaOcupacional(d: DatosFichaExcel): Grabacion {
  const ev: any = d.ev ?? {};
  const trabajador: any = d.trabajador ?? {};
  const empresa: any = d.empresa ?? {};
  const logoPdf = d.logoPdf ?? LOGO_POR_DEFECTO;
  const fmtFecha = d.fmtFecha ?? fechaSimple;
  const fmtHora = d.fmtHora ?? horaSimple;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const grabacion = grabarDibujo(pdf);
  const cromo = crearCromo(pdf, logoPdf);

  cromo.y = dibujarPagina1Ocupacional(pdf, { ev, trabajador, empresa, logoPdf, fmtFecha });

  pdf.addPage('a4', 'landscape');
  cromo.reiniciar();
  cromo.cab('Página: 2 de 3', true);
  cromo.sec('G. FACTORES DE RIESGO DEL TRABAJO ACTUAL');
  cromo.y = dibujarMatrizRiesgos(pdf, cromo.y, {
    fr: ev.factoresRiesgo || {},
    puestoTrabajo: trabajador.puestoTrabajo,
    margen: cromo.M, anchoUtil: cromo.CW,
  });

  pdf.addPage('a4', 'portrait');
  cromo.reiniciar();
  dibujarPagina3Ocupacional(pdf, cromo, { ev, trabajador, fmtFecha, fmtHora });
  return grabacion;
}

/**
 * Textos que el PDF pone cuando falta el dato y que en una plantilla para
 * llenar a mano sobran: la casilla APTO que se marca por defecto, «PACIENTE
 * SANO.» si no hay diagnósticos, los guiones de campo vacío, etc.
 */
const RELLENOS_POR_DEFECTO = new Set([
  'X', '-', 'PACIENTE SANO.', 'Ninguna relevante reportada.', 'Ninguna particular.',
  'MÉDICO OCUPACIONAL', 'Observaciones: -', 'Observación: -', 'undefined', 'null',
]);

function vaciarParaPlantilla(g: Grabacion): void {
  for (let i = g.ops.length - 1; i >= 0; i--) {
    const op = g.ops[i];
    if (op.tipo !== 'texto') continue;
    const t = op as OpTexto;
    const conservar = t.lineas.map(l => {
      const s = l.trim();
      if (RELLENOS_POR_DEFECTO.has(s)) return '';
      // «Observaciones: -» → «Observaciones:», que es el rótulo.
      return l.replace(/:\s*-\s*$/, ':');
    });
    if (!conservar.some(l => l.trim())) g.ops.splice(i, 1);
    else t.lineas = conservar;
  }
}

/** Nombre de la pestaña de cada página. */
const nombreHoja = (n: number, total: number) => (total <= 3 ? `Página ${n}` : `Página ${n} de ${total}`);

export async function construirFichaExcel(d: DatosFichaExcel): Promise<Workbook> {
  const mod: any = await import('exceljs');
  const ExcelJS = mod.default ?? mod;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = 'Fichas Médicas Ocupacionales';
  wb.title = 'Evaluación Médica Ocupacional — HCU-form.123/2025';

  const grabacion = dibujarFichaOcupacional(d);
  if (!d.ev) vaciarParaPlantilla(grabacion);

  const paginas = grabacion.paginas();
  paginas.forEach((pagina, i) => {
    paginaAHoja(wb, grabacion, i + 1, { nombre: nombreHoja(i + 1, paginas.length), pagina });
  });
  return wb;
}

/** Tipo MIME de un libro de Excel. */
export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Genera el .xlsx y devuelve el archivo con su nombre. Entregarlo es cosa de
 * quien llama.
 */
export async function generarFichaExcel(d: DatosFichaExcel, nombreArchivo: string): Promise<{ blob: Blob; nombre: string }> {
  const wb = await construirFichaExcel(d);
  const buffer = await fijarFuenteNormal(await wb.xlsx.writeBuffer() as ArrayBuffer);
  return {
    blob: new Blob([buffer as BlobPart], { type: MIME_XLSX }),
    // Sin barras: la fecha ecuatoriana «9/10/2025» las trae y el navegador
    // las toma por carpetas y descarta el nombre.
    nombre: conExtension(nombreArchivo.replace(/[/\\:*?"<>|]+/g, '-'), '.xlsx'),
  };
}
