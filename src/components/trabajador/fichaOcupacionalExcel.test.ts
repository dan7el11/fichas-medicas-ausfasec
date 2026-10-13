import { describe, it, expect, beforeAll } from 'vitest';
import type { Workbook, Worksheet } from 'exceljs';
import JSZip from 'jszip';
import { construirFichaExcel, dibujarFichaOcupacional, generarFichaExcel } from './fichaOcupacionalExcel';
import { PX_DIGITO } from '../../utils/pdfAExcel';
import type { Grabacion, OpRect, OpTexto } from '../../utils/grabadorPdf';
import { PERFILES_RIESGO_CARGO } from '../../constants/perfilRiesgoCargo';

/**
 * La meta del Excel: al imprimir cada hoja sale la misma página que el PDF.
 * Misma orientación, una sola página por hoja, la misma cuadrícula en mm, los
 * mismos textos. Las pruebas comparan contra lo que dibuja el propio PDF.
 */

const empresa = { institucion: 'AUSTROGAS', ruc: '190070301001', ciu: '4661', establecimiento: 'MEDICINA OCUPACIONAL' };
const perfil = PERFILES_RIESGO_CARGO[3];
const ev = {
  formato: 'ocupacional-unificado', tipoEvaluacion: 'retiro', fecha: { seconds: 1760000000 },
  datosPersonales: { grupoSanguineo: 'O +', lateralidad: 'DERECHO', fechaNacimiento: '1982-06-15' },
  antecedentesClinicosTexto: 'HTA desde hace 6 años, en tratamiento con Losartán.',
  signosVitales: { presionSistolica: '130', presionDiastolica: '85', peso: '78', talla: '172', imc: 26.37 },
  examenFisicoHallazgos: [{ codigo: '8b', region: 'Tórax', subregion: 'Corazón', descripcion: 'soplo' }],
  factoresRiesgo: {
    puestoArea: perfil.cargo, actividadesJornada: perfil.actividades,
    actividadesResumen: perfil.actividadesResumen, riesgoActividades: perfil.riesgoActividades,
    medidasActividades: (perfil.medidasActividades ?? []).map(m => m.join('; ')),
  },
  antecedentesEmpleos: [{ empresa: 'AUSTROGAS', actividades: (perfil.actividades ?? []).join('; '), tiempoMeses: '78', esActual: true }],
  diagnosticos: [{ cie: 'I10', descripcion: 'Hipertensión esencial', tipo: 'definitivo' }],
  aptitudMedica: 'aptoObservacion',
  recomendaciones: ['Dieta baja en sal'],
  retiroEvaluacionRealizada: true,
};
const trabajador = { primerApellido: 'Jiménez', primerNombre: 'José', cedula: '1204208001', sexo: 'M', puestoTrabajo: perfil.cargo };
const datos = { ev, trabajador, empresa };

const PX_POR_MM = 96 / 25.4;

/** Textos de una hoja, celda por celda, incluido el texto enriquecido. */
function textos(ws: Worksheet): string[] {
  const out: string[] = [];
  ws.eachRow(row => row.eachCell(c => {
    const v: any = c.value;
    if (v == null) return;
    if (typeof v === 'object' && Array.isArray(v.richText)) out.push(v.richText.map((r: any) => r.text).join(''));
    else if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
  }));
  return out;
}

/** Posiciones acumuladas (mm) de los cortes de columna y fila de la hoja. */
function cortes(ws: Worksheet) {
  const x0 = (ws.pageSetup.margins!.left as number) * 25.4;
  const y0 = (ws.pageSetup.margins!.top as number) * 25.4;
  const xs = [x0], ys = [y0];
  for (let c = 1; c <= ws.columnCount; c++) {
    // Lo que pinta Excel: trunc(ancho·dígito + 0,49) px.
    const px = Math.trunc((ws.getColumn(c).width ?? 0) * PX_DIGITO + 0.49);
    xs.push(xs[xs.length - 1] + px / PX_POR_MM);
  }
  for (let r = 1; r <= ws.rowCount; r++) ys.push(ys[ys.length - 1] + (ws.getRow(r).height ?? 0) / 72 * 25.4);
  return { xs, ys };
}

const distancia = (lista: number[], v: number) => Math.min(...lista.map(x => Math.abs(x - v)));

/**
 * Primera celda cuyo texto cumple la condición. Es la maestra del rango: al
 * leer una celda esclava de un rango combinado, exceljs devuelve el valor de
 * la maestra, así que hay que quedarse con la primera.
 */
function celdaCon(ws: Worksheet, cumple: (t: string) => boolean): any {
  let hallada: any = null;
  ws.eachRow(row => row.eachCell(c => {
    if (!hallada && typeof c.value === 'string' && cumple(c.value)) hallada = c;
  }));
  return hallada;
}

describe('ficha ocupacional en Excel: cada hoja es una página del PDF', () => {
  let wb: Workbook;
  let plantilla: Workbook;
  let pdf: Grabacion;
  let paginas: { ancho: number; alto: number }[];

  beforeAll(async () => {
    wb = await construirFichaExcel(datos);
    plantilla = await construirFichaExcel({ empresa });
    pdf = dibujarFichaOcupacional(datos);
    paginas = pdf.paginas();
  }, 60_000);

  it('una hoja por página del PDF, sin hoja de instrucciones', () => {
    expect(paginas).toHaveLength(3);
    expect(wb.worksheets.map(w => w.name)).toEqual(['Página 1', 'Página 2', 'Página 3']);
    expect(plantilla.worksheets.map(w => w.name)).toEqual(['Página 1', 'Página 2', 'Página 3']);
  });

  it('cada hoja en A4 con la orientación de su página: la 2 horizontal', () => {
    expect(wb.worksheets.map(w => w.pageSetup.orientation)).toEqual(['portrait', 'landscape', 'portrait']);
    wb.worksheets.forEach((ws, i) => {
      expect(ws.pageSetup.paperSize, ws.name).toBe(9);
      const esHorizontal = paginas[i].ancho > paginas[i].alto;
      expect(ws.pageSetup.orientation, ws.name).toBe(esHorizontal ? 'landscape' : 'portrait');
    });
  });

  it('cada hoja se imprime en una sola página, sin partirse', () => {
    wb.worksheets.forEach(ws => {
      expect(ws.pageSetup.fitToPage, ws.name).toBe(true);
      expect(ws.pageSetup.fitToWidth, ws.name).toBe(1);
      expect(ws.pageSetup.fitToHeight, ws.name).toBe(1);
      expect(ws.pageSetup.printArea, ws.name).toMatch(/^A1:[A-Z]+\d+$/);
    });
  });

  it('el contenido cabe en la página a tamaño real: no hace falta encogerlo', () => {
    wb.worksheets.forEach((ws, i) => {
      const { xs, ys } = cortes(ws);
      expect(xs[xs.length - 1], ws.name).toBeLessThanOrEqual(paginas[i].ancho);
      expect(ys[ys.length - 1], ws.name).toBeLessThanOrEqual(paginas[i].alto);
    });
  });

  it('los cortes de columna y de fila caen sobre los bordes de las celdas del PDF', () => {
    wb.worksheets.forEach((ws, i) => {
      const { xs, ys } = cortes(ws);
      const rects = pdf.ops.filter((o): o is OpRect => o.tipo === 'rect' && o.pagina === i + 1 && o.w > 0.05 && o.h > 0.05);
      expect(rects.length, ws.name).toBeGreaterThan(20);
      let peorX = 0, peorY = 0;
      rects.forEach(r => {
        peorX = Math.max(peorX, distancia(xs, r.x), distancia(xs, r.x + r.w));
        peorY = Math.max(peorY, distancia(ys, r.y), distancia(ys, r.y + r.h));
      });
      // Medio milímetro: la agrupación de cortes (0,3) más el redondeo a píxel.
      expect(peorX, `${ws.name}: desvío horizontal en mm`).toBeLessThan(0.5);
      expect(peorY, `${ws.name}: desvío vertical en mm`).toBeLessThan(0.5);
    });
  });

  it('cada línea de texto del PDF está en la hoja de su página', () => {
    wb.worksheets.forEach((ws, i) => {
      const todo = textos(ws).join('\n');
      const lineas = pdf.ops
        .filter((o): o is OpTexto => o.tipo === 'texto' && o.pagina === i + 1)
        .flatMap(t => t.lineas.map(l => l.trim()).filter(Boolean));
      const faltan = lineas.filter(l => !todo.includes(l));
      expect(faltan, ws.name).toEqual([]);
    });
  });

  it('conserva los colores de las franjas y encabezados', () => {
    const colores = new Set<string>();
    wb.worksheets.forEach(ws => ws.eachRow(row => row.eachCell(c => {
      const f: any = c.fill;
      if (f?.fgColor?.argb) colores.add(f.fgColor.argb);
    })));
    expect(colores).toContain('FFCCCCFF');   // franja de sección
    expect(colores).toContain('FFCCFFCC');   // encabezado de campo
  });

  it('las celdas combinadas conservan cada una su borde', () => {
    // Al combinar, exceljs hacía que todas las celdas del rango compartieran
    // estilo y se perdían las líneas del examen físico.
    const ws = wb.getWorksheet('Página 1')!;
    const celda = celdaCon(ws, t => t === 'a. Cicatrices');
    expect(celda).not.toBeNull();
    const rango = (ws as any)._merges[celda.address]?.model;
    expect(rango, 'a. Cicatrices debe abarcar varias filas').toBeTruthy();
    expect(rango.bottom).toBeGreaterThan(rango.top);
    const ultima = rango.bottom;
    expect(ws.getCell(celda.row, celda.col).border?.top?.style).toBe('thin');
    expect(ws.getCell(ultima, celda.col).border?.bottom?.style).toBe('thin');
  });

  it('los párrafos alineados a la izquierda en el PDF lo están en la hoja', () => {
    const ws = wb.getWorksheet('Página 3')!;
    const inicio = (perfil.actividades ?? [''])[0].slice(0, 25);
    const actividades = celdaCon(ws, t => t.startsWith(inicio));
    expect(actividades).not.toBeNull();
    expect(actividades.alignment.horizontal).toBe('left');
    // Y un encabezado centrado sigue centrado.
    const encabezado = celdaCon(ws, t => t === 'CENTRO DE TRABAJO');
    expect(encabezado.alignment.horizontal).toBe('center');
  });

  it('el logo de la cabecera va en las tres hojas', () => {
    wb.worksheets.forEach(ws => expect(ws.getImages().length, ws.name).toBe(1));
  });

  describe('plantilla en blanco', () => {
    it('no trae ninguna marca ni relleno por defecto del PDF', () => {
      plantilla.worksheets.forEach(ws => {
        const t = textos(ws).map(s => s.trim());
        expect(t.filter(s => s === 'X'), ws.name).toEqual([]);
        expect(t, ws.name).not.toContain('PACIENTE SANO.');
        expect(t, ws.name).not.toContain('Ninguna relevante reportada.');
        expect(t.filter(s => s === '-'), ws.name).toEqual([]);
      });
    });

    it('conserva los rótulos del formato y los datos de la institución', () => {
      const t1 = textos(plantilla.getWorksheet('Página 1')!).join('\n');
      ['A. DATOS DEL ESTABLECIMIENTO', 'GRUPO SANGUÍNEO', 'F. EXAMEN FÍSICO REGIONAL', 'AUSTROGAS'].forEach(r => expect(t1).toContain(r));
      expect(t1).not.toContain('Jiménez');
      const t3 = textos(plantilla.getWorksheet('Página 3')!).join('\n');
      ['H. ACTIVIDAD LABORAL', 'K. DIAGNÓSTICO', 'L. APTITUD MÉDICA', 'O. DATOS DEL PROFESIONAL'].forEach(r => expect(t3).toContain(r));
    });

    it('con la misma orientación y ajuste de página', () => {
      expect(plantilla.worksheets.map(w => w.pageSetup.orientation)).toEqual(['portrait', 'landscape', 'portrait']);
      plantilla.worksheets.forEach(ws => expect(ws.pageSetup.fitToHeight).toBe(1));
    });
  });

  describe('archivo final', () => {
    it('la fuente Normal es Courier New 10, la que mide igual en Excel y en LibreOffice', async () => {
      const { blob } = await generarFichaExcel(datos, 'ficha');
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const estilos = await zip.file('xl/styles.xml')!.async('string');
      const primera = /<fonts\b[^>]*>\s*(<font>[\s\S]*?<\/font>)/.exec(estilos)![1];
      expect(primera).toContain('Courier New');
      expect(primera).toContain('<sz val="10"/>');
    }, 60_000);

    it('se puede volver a abrir y conserva las tres hojas', async () => {
      const { blob } = await generarFichaExcel(datos, 'ficha');
      const mod: any = await import('exceljs');
      const ExcelJS = mod.default ?? mod;
      const releido: Workbook = new ExcelJS.Workbook();
      await releido.xlsx.load(await blob.arrayBuffer());
      expect(releido.worksheets.map(w => w.name)).toEqual(['Página 1', 'Página 2', 'Página 3']);
    }, 60_000);

    it('el nombre no lleva barras de la fecha', async () => {
      const { nombre } = await generarFichaExcel(datos, 'Ficha_Jiménez_9/10/2025');
      expect(nombre).toBe('Ficha_Jiménez_9-10-2025.xlsx');
    }, 60_000);
  });
});
