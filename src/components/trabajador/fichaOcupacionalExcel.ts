// FICHA OCUPACIONAL EN EXCEL — plantilla editable del formato
// SNS-MSP/HCU-form.123/2025.
//
// Reproduce las tres hojas del formato (datos y examen físico, matriz de
// riesgos, historia laboral y cierre) como tres pestañas con sus secciones,
// sus franjas de color y sus tablas, listas para rellenar o corregir a mano.
// Se puede generar con una evaluación (sale llena) o sin ninguna (sale en
// blanco, como plantilla).
//
// NO toca el PDF: lee los mismos catálogos y los mismos campos de la
// evaluación, pero por su cuenta. Lo que manda para el documento oficial sigue
// siendo el PDF; esto es para trabajar el contenido en una hoja de cálculo.
import type { Workbook, Worksheet } from 'exceljs';
import { MATRIZ_RIESGOS, esFactorAnalizable } from '../../utils/catalogosEvaluacion';
import { BLOQUES_EXAMEN_FISICO, tieneHallazgo } from '../../utils/examenFisicoOficial';
import { actividadesDeMatriz } from './paginaDosOcupacionalPdf';
import { tipoEvaluacionClave } from '../../utils/medicalHelpers';
import { MAX_ACTIVIDADES } from '../../constants/funcionesCargo';
import { FILAS_MINIMAS_HISTORIA_LABORAL, FILAS_MINIMAS_PAGINA3 } from '../../utils/tablasPdf';
import { partesFecha, edadDesde } from './paginaUnoOcupacionalPdf';
import { conExtension } from '../../utils/entregarArchivo';

const LILA = 'FFCCCCFF';   // franja de sección
const VERDE = 'FFCCFFCC';  // encabezado de campo
const CELESTE = 'FFCCFFFF'; // categorías de la matriz
const GRIS = 'FFF2F2F2';

/** Columnas de cada hoja. La 1 usa 15 porque es lo que pide el examen físico. */
const COLS_HOJA1 = 15;
const COLS_HOJA2 = 3 + MAX_ACTIVIDADES;
const COLS_HOJA3 = 13;

type Estilo = 'seccion' | 'campo' | 'dato' | 'marca' | 'nota';

interface Celda {
  v?: string | number;
  /** Columnas que ocupa (1 por defecto). */
  span?: number;
  /** Filas que ocupa (1 por defecto). */
  rows?: number;
  estilo?: Estilo;
  izq?: boolean;
  /** Alto de fila en puntos, cuando hace falta aire. */
  alto?: number;
}

const borde = {
  top: { style: 'thin' as const }, left: { style: 'thin' as const },
  bottom: { style: 'thin' as const }, right: { style: 'thin' as const },
};

function aplicar(celda: any, c: Celda) {
  const estilo = c.estilo ?? 'dato';
  celda.border = borde;
  celda.alignment = {
    vertical: 'middle',
    horizontal: c.izq ? 'left' : estilo === 'dato' ? 'left' : 'center',
    wrapText: true,
  };
  if (estilo === 'seccion') {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LILA } };
    celda.font = { bold: true, size: 10 };
    celda.alignment = { ...celda.alignment, horizontal: 'left' };
  } else if (estilo === 'campo') {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
    celda.font = { bold: true, size: 8 };
  } else if (estilo === 'marca') {
    celda.font = { bold: true, size: 10 };
    celda.alignment = { ...celda.alignment, horizontal: 'center' };
  } else if (estilo === 'nota') {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
    celda.font = { italic: true, size: 8 };
    celda.alignment = { ...celda.alignment, horizontal: 'left' };
  } else {
    celda.font = { size: 9 };
  }
}

/**
 * Escribe una fila repartiendo las celdas sobre el ancho de la hoja y
 * devolviendo la siguiente fila libre. Las celdas con `span` se combinan.
 */
function fila(ws: Worksheet, nFila: number, celdas: Celda[], totalCols: number): number {
  let col = 1;
  let maxRows = 1;
  celdas.forEach(c => {
    const span = Math.max(1, c.span ?? 1);
    const rows = Math.max(1, c.rows ?? 1);
    maxRows = Math.max(maxRows, rows);
    const celda = ws.getCell(nFila, col);
    celda.value = c.v ?? '';
    aplicar(celda, c);
    if (span > 1 || rows > 1) {
      ws.mergeCells(nFila, col, nFila + rows - 1, col + span - 1);
      // Las celdas tapadas por la combinación también llevan borde, o Excel
      // dibuja el recuadro incompleto.
      for (let f = nFila; f < nFila + rows; f++) {
        for (let k = col; k < col + span; k++) ws.getCell(f, k).border = borde;
      }
    }
    col += span;
  });
  // El resto del ancho se cierra con borde para que la fila no quede abierta.
  for (; col <= totalCols; col++) ws.getCell(nFila, col).border = borde;
  const alto = celdas.find(c => c.alto)?.alto;
  if (alto) ws.getRow(nFila).height = alto;
  return nFila + maxRows;
}

/** Franja de sección a todo el ancho. */
const seccion = (ws: Worksheet, n: number, texto: string, cols: number) =>
  fila(ws, n, [{ v: texto, span: cols, estilo: 'seccion', alto: 16 }], cols);

/** Franja verde de subtítulo a todo el ancho. */
const subtitulo = (ws: Worksheet, n: number, texto: string, cols: number) =>
  fila(ws, n, [{ v: texto, span: cols, estilo: 'campo', izq: true }], cols);

/** Recuadro de texto libre, con alto para escribir. */
const libre = (ws: Worksheet, n: number, texto: string, cols: number, alto = 30) =>
  fila(ws, n, [{ v: texto, span: cols, izq: true, alto }], cols);

const X = (activo: boolean) => (activo ? 'X' : '');

export interface DatosFichaExcel {
  /** Evaluación a volcar. Si falta, la ficha sale en blanco (plantilla). */
  ev?: any;
  trabajador?: any;
  empresa: { institucion: string; ruc: string; ciu: string; establecimiento: string };
}

// ── HOJA 1 ───────────────────────────────────────────────────────────────────
function hoja1(wb: Workbook, d: DatosFichaExcel) {
  const ev = d.ev ?? {};
  const t = d.trabajador ?? {};
  const ws = wb.addWorksheet('1. Datos y examen físico');
  const C = COLS_HOJA1;
  // Anchos pensados para que el examen físico (3 columnas por bloque) quepa.
  [10, 16, 5, 10, 16, 5, 10, 16, 5, 10, 16, 5, 10, 16, 5].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };

  let n = 1;
  n = fila(ws, n, [{ v: 'HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN MÉDICA OCUPACIONAL', span: C, estilo: 'campo', alto: 20 }], C);
  n = fila(ws, n, [
    { v: 'MACROPROCESO: PLANIFICACIÓN, SEGURIDAD Y AMBIENTE', span: 9, estilo: 'campo', izq: true },
    { v: 'Código: HCU-form.123/2025', span: 4, izq: true },
    { v: 'Página 1 de 3', span: 2, izq: true },
  ], C);

  n = seccion(ws, n, 'A. DATOS DEL ESTABLECIMIENTO - DATOS DEL USUARIO', C);
  n = fila(ws, n, [
    { v: 'INSTITUCIÓN DEL SISTEMA', span: 4, estilo: 'campo' }, { v: 'RUC', span: 2, estilo: 'campo' },
    { v: 'CIIU', span: 2, estilo: 'campo' }, { v: 'ESTABLECIMIENTO / CENTRO DE TRABAJO', span: 3, estilo: 'campo' },
    { v: 'N° HISTORIA CLÍNICA', span: 2, estilo: 'campo' }, { v: 'N° ARCHIVO', span: 2, estilo: 'campo' },
  ], C);
  n = fila(ws, n, [
    { v: d.empresa.institucion, span: 4 }, { v: d.empresa.ruc, span: 2 }, { v: d.empresa.ciu, span: 2 },
    { v: d.empresa.establecimiento, span: 3 },
    { v: ev.numeroHistoriaClinica || t.cedula || '', span: 2 }, { v: ev.numeroArchivo || '', span: 2 },
  ], C);
  n = fila(ws, n, [
    { v: 'PRIMER APELLIDO', span: 4, estilo: 'campo' }, { v: 'SEGUNDO APELLIDO', span: 4, estilo: 'campo' },
    { v: 'PRIMER NOMBRE', span: 4, estilo: 'campo' }, { v: 'SEGUNDO NOMBRE', span: 3, estilo: 'campo' },
  ], C);
  n = fila(ws, n, [
    { v: t.primerApellido || '', span: 4 }, { v: t.segundoApellido || '', span: 4 },
    { v: t.primerNombre || '', span: 4 }, { v: t.segundoNombre || '', span: 3 },
  ], C);

  const dp = ev.datosPersonales || {};
  const [anio, mes, dia] = partesFecha(dp.fechaNacimiento);
  const prioritarios: string[] = dp.gruposPrioritarios || [];
  n = fila(ws, n, [
    { v: 'GRUPO DE ATENCIÓN PRIORITARIA', span: 4, estilo: 'campo' },
    { v: 'SEXO', span: 2, estilo: 'campo' }, { v: 'FECHA DE NACIMIENTO', span: 3, estilo: 'campo' },
    { v: 'Edad', estilo: 'campo' }, { v: 'GRUPO SANGUÍNEO', span: 2, estilo: 'campo' },
    { v: 'LATERALIDAD', span: 3, estilo: 'campo' },
  ], C);
  n = fila(ws, n, [
    { v: 'Embarazada', estilo: 'campo' }, { v: 'Persona con discapacidad', estilo: 'campo' },
    { v: 'Enfermedad catastrófica', estilo: 'campo' }, { v: 'Adulto mayor', estilo: 'campo' },
    { v: 'Hombre', estilo: 'campo' }, { v: 'Mujer', estilo: 'campo' },
    { v: 'año', estilo: 'campo' }, { v: 'mes', estilo: 'campo' }, { v: 'día', estilo: 'campo' },
    { v: '', estilo: 'campo' }, { v: '', span: 2, estilo: 'campo' }, { v: '', span: 3, estilo: 'campo' },
  ], C);
  n = fila(ws, n, [
    { v: X(prioritarios.includes('Embarazada')), estilo: 'marca' },
    { v: X(prioritarios.includes('Persona con discapacidad')), estilo: 'marca' },
    { v: X(prioritarios.includes('Enfermedad catastrófica')), estilo: 'marca' },
    { v: X(prioritarios.includes('Adulto mayor')), estilo: 'marca' },
    { v: X(t.sexo === 'M'), estilo: 'marca' }, { v: X(t.sexo === 'F'), estilo: 'marca' },
    { v: anio, estilo: 'marca' }, { v: mes, estilo: 'marca' }, { v: dia, estilo: 'marca' },
    { v: edadDesde(dp.fechaNacimiento), estilo: 'marca' },
    { v: dp.grupoSanguineo || '', span: 2 }, { v: dp.lateralidad || '', span: 3 },
  ], C);

  n = seccion(ws, n, 'B. MOTIVO DE CONSULTA', C);
  n = fila(ws, n, [
    { v: 'Puesto de trabajo (CIUO)', span: 3, estilo: 'campo' }, { v: t.puestoTrabajo || '', span: 4 },
    { v: 'Fecha de atención (aaaa/mm/dd)', span: 4, estilo: 'campo' }, { v: ev.fechaAtencion || '', span: 4 },
  ], C);
  n = fila(ws, n, [
    { v: 'Fecha de ingreso al trabajo', span: 5, estilo: 'campo' },
    { v: 'Fecha de reintegro', span: 5, estilo: 'campo' },
    { v: 'Fecha del último día laboral / salida', span: 5, estilo: 'campo' },
  ], C);
  n = fila(ws, n, [
    { v: ev.fechaIngresoTrabajo || '', span: 5 }, { v: ev.fechaReingreso || '', span: 5 },
    { v: ev.fechaUltimoDiaLaboral || '', span: 5 },
  ], C);
  n = subtitulo(ws, n, 'TIPO DE EVALUACIÓN', C);
  const clave = d.ev ? tipoEvaluacionClave(ev) : null;
  n = fila(ws, n, [
    { v: 'INGRESO', span: 2, estilo: 'campo' }, { v: X(clave === 'preocupacional'), estilo: 'marca' },
    { v: 'PERIÓDICO', span: 2, estilo: 'campo' }, { v: X(clave === 'periodica'), estilo: 'marca' },
    { v: 'REINTEGRO', span: 3, estilo: 'campo' }, { v: X(clave === 'reintegro'), estilo: 'marca' },
    { v: 'RETIRO', span: 3, estilo: 'campo' }, { v: X(clave === 'retiro'), span: 2, estilo: 'marca' },
  ], C);
  n = subtitulo(ws, n, 'Observación / motivo', C);
  n = libre(ws, n, ev.motivoConsulta || '', C);

  n = seccion(ws, n, 'C. ANTECEDENTES PERSONALES', C);
  n = subtitulo(ws, n, 'ANTECEDENTES CLÍNICOS Y QUIRÚRGICOS', C);
  n = libre(ws, n, ev.antecedentesClinicosTexto || ev.antecedentesClinicosQuirurgicos || '', C, 40);
  n = subtitulo(ws, n, 'ANTECEDENTES FAMILIARES', C);
  n = libre(ws, n, ev.antecedentesFamiliaresTexto || '', C);
  n = subtitulo(ws, n, 'Condición especial para urgencias, emergencias y tratamiento médico (referido por el paciente)', C);
  const ce = ev.condicionEspecial || {};
  n = fila(ws, n, [
    { v: 'En caso de requerir transfusiones autoriza', span: 4, estilo: 'campo', izq: true },
    { v: 'SI', estilo: 'campo' }, { v: 'NO', estilo: 'campo' },
    { v: 'Se encuentra bajo algún tratamiento hormonal', span: 4, estilo: 'campo', izq: true },
    { v: 'SI', estilo: 'campo' }, { v: '¿Cuál? Describir', span: 3, estilo: 'campo' }, { v: 'NO', estilo: 'campo' },
  ], C);
  n = fila(ws, n, [
    { v: '', span: 4 },
    { v: X(ce.autorizaTransfusiones === true), estilo: 'marca' }, { v: X(ce.autorizaTransfusiones === false), estilo: 'marca' },
    { v: '', span: 4 },
    { v: X(ce.tratamientoHormonal === true), estilo: 'marca' },
    { v: ce.tratamientoHormonal === true ? (ce.tratamientoHormonalCual || '') : '', span: 3 },
    { v: X(ce.tratamientoHormonal === false), estilo: 'marca' },
  ], C);

  // Gineco y masculinos: el formato imprime los dos bloques siempre.
  const g = ev.antecedentesGineco || {};
  n = subtitulo(ws, n, 'ANTECEDENTES GINECO-OBSTÉTRICOS', C);
  n = fila(ws, n, [
    { v: 'Fecha de la última menstruación', span: 5, estilo: 'campo' }, { v: 'Gestas', estilo: 'campo' },
    { v: 'Partos', estilo: 'campo' }, { v: 'Cesáreas', estilo: 'campo' }, { v: 'Abortos', span: 2, estilo: 'campo' },
    { v: 'Planificación: sí', estilo: 'campo' }, { v: '¿Cuál?', span: 2, estilo: 'campo' },
    { v: 'no', estilo: 'campo' }, { v: 'no responde', estilo: 'campo' },
  ], C);
  n = fila(ws, n, [
    { v: g.fum || '', span: 5 }, { v: g.gestas || '' }, { v: g.partos || '' }, { v: g.cesareas || '' },
    { v: g.abortos || '', span: 2 },
    { v: X(g.planificacionFamiliar === true), estilo: 'marca' },
    { v: g.planificacionFamiliar === true ? (g.planificacionTipo || '') : '', span: 2 },
    { v: X(g.planificacionFamiliar === false), estilo: 'marca' }, { v: '' },
  ], C);
  const r = ev.antecedentesReproductivos || {};
  n = subtitulo(ws, n, 'ANTECEDENTES REPRODUCTIVOS MASCULINOS', C);
  n = fila(ws, n, [
    { v: 'Exámenes realizados ¿cuál?', span: 4, estilo: 'campo' }, { v: 'Tiempo (años)', estilo: 'campo' },
    { v: 'Resultado (solo si interfiere con la actividad laboral)', span: 3, estilo: 'campo' },
    { v: 'Planificación: SI', estilo: 'campo' }, { v: '¿Cuál?', span: 3, estilo: 'campo' },
    { v: 'NO', span: 2, estilo: 'campo' }, { v: 'No responde', estilo: 'campo' },
  ], C);
  n = fila(ws, n, [
    { v: r.antigenoProstatico?.realizado === true ? 'ANTÍGENO PROSTÁTICO' : '', span: 4 },
    { v: r.antigenoProstatico?.tiempoAnios || '' },
    { v: r.antigenoProstatico?.resultado || '', span: 3 },
    { v: X(r.planificacionFamiliar === true), estilo: 'marca' },
    { v: r.planificacionFamiliar === true ? (r.planificacionTipo || '') : '', span: 3 },
    { v: X(r.planificacionFamiliar === false), span: 2, estilo: 'marca' }, { v: '' },
  ], C);

  // Consumo de sustancias + estilo de vida + condición preexistente
  const habito = (tipo: string) => (ev.habitosToxicos || []).find((h: any) => h.tipo === tipo) || {};
  const evd = ev.estiloVida || {};
  n = fila(ws, n, [
    { v: 'CONSUMO DE SUSTANCIAS', span: 7, estilo: 'campo' },
    { v: 'ESTILO DE VIDA', span: 4, estilo: 'campo' },
    { v: 'CONDICIÓN PREEXISTENTE', span: 4, estilo: 'campo' },
  ], C);
  n = fila(ws, n, [
    { v: '', span: 3, estilo: 'campo' }, { v: 'Tiempo de consumo', estilo: 'campo' },
    { v: 'Ex consumidor', estilo: 'campo' }, { v: 'Tiempo de abstinencia', estilo: 'campo' },
    { v: 'No consume', estilo: 'campo' },
    { v: '', span: 2, estilo: 'campo' }, { v: '¿Cuál?', estilo: 'campo' }, { v: 'Tiempo', estilo: 'campo' },
    { v: '', span: 2, estilo: 'campo' }, { v: '¿Cuál?', estilo: 'campo' }, { v: 'Cantidad', estilo: 'campo' },
  ], C);
  const filaHabito = (etiqueta: string, h: any, extra: Celda[]): Celda[] => ([
    { v: etiqueta, span: 3, estilo: 'campo', izq: true },
    { v: h.consume ? (h.tiempoConsumo || 'X') : '' },
    { v: X(!!h.exConsumidor), estilo: 'marca' },
    { v: h.exConsumidor ? (h.tiempoAbstinencia || '') : '' },
    // Solo si hay evaluación: en la plantilla, un hábito sin responder no es
    // un «no consume», es una casilla por llenar.
    { v: d.ev ? X(!h.consume && !h.exConsumidor) : '', estilo: 'marca' },
    ...extra,
  ]);
  n = fila(ws, n, filaHabito('TABACO', habito('tabaco'), [
    { v: 'Actividad física', span: 2, estilo: 'campo', izq: true },
    { v: evd.tipoActividad || '' }, { v: evd.tiempoCantidad || '' },
    { v: 'Medicación habitual', span: 2, estilo: 'campo', izq: true },
    { v: evd.medicacionHabitual || '' }, { v: evd.medicacionCantidad || '' },
  ]), C);
  n = fila(ws, n, filaHabito('ALCOHOL', habito('alcohol'), [
    { v: '', span: 2 }, { v: '' }, { v: '' }, { v: '', span: 2 }, { v: '' }, { v: '' },
  ]), C);
  n = fila(ws, n, filaHabito('OTRAS ¿cuál?', habito('drogas'), [
    { v: 'Condición preexistente', span: 2, estilo: 'campo', izq: true },
    { v: ce.condicionPreexistente || '', span: 6 },
  ]), C);
  n = subtitulo(ws, n, 'Observación', C);
  n = libre(ws, n, ev.observacionHabitos || '', C, 24);

  n = seccion(ws, n, 'D. ENFERMEDAD O PROBLEMA ACTUAL', C);
  n = libre(ws, n, ev.enfermedadActual || '', C, 40);

  n = seccion(ws, n, 'E. CONSTANTES VITALES Y ANTROPOMETRÍA', C);
  const sv = ev.signosVitales || {};
  n = fila(ws, n, [
    { v: 'Temperatura (°C)', span: 2, estilo: 'campo' }, { v: 'Presión arterial (mmHg)', span: 2, estilo: 'campo' },
    { v: 'Frec. cardiaca (lat/min)', span: 2, estilo: 'campo' }, { v: 'Frec. respiratoria (fr/min)', span: 2, estilo: 'campo' },
    { v: 'Saturación O₂ (%)', span: 2, estilo: 'campo' }, { v: 'Peso (kg)', estilo: 'campo' },
    { v: 'Talla (cm)', estilo: 'campo' }, { v: 'IMC (kg/m²)', span: 2, estilo: 'campo' },
    { v: 'Perímetro abdominal (cm)', estilo: 'campo' },
  ], C);
  n = fila(ws, n, [
    { v: sv.temperatura || '', span: 2, estilo: 'marca' },
    { v: sv.presionSistolica || sv.presionDiastolica ? `${sv.presionSistolica || ''}/${sv.presionDiastolica || ''}` : '', span: 2, estilo: 'marca' },
    { v: sv.frecuenciaCardiaca || '', span: 2, estilo: 'marca' },
    { v: sv.frecuenciaRespiratoria || '', span: 2, estilo: 'marca' },
    { v: sv.saturacion || '', span: 2, estilo: 'marca' },
    { v: sv.peso || '', estilo: 'marca' }, { v: sv.talla || '', estilo: 'marca' },
    { v: sv.imc ? Number(Number(sv.imc).toFixed(1)) : '', span: 2, estilo: 'marca' },
    { v: sv.perimetroAbdominal || '', estilo: 'marca' },
  ], C);

  // F. Examen físico: los cinco bloques del formato, lado a lado.
  n = seccion(ws, n, 'F. EXAMEN FÍSICO REGIONAL', C);
  n = subtitulo(ws, n, 'REGIONES — marca con X la casilla con hallazgo y descríbelo abajo', C);
  const columnas = BLOQUES_EXAMEN_FISICO.map(b =>
    b.regiones.flatMap(reg => reg.items.map(item => ({
      region: reg.rotulo, etiqueta: `${item.letra}. ${item.nombre}`,
      marca: d.ev ? X(tieneHallazgo(ev.examenFisicoHallazgos, `${reg.numero}${item.letra}`, item.nombre)) : '',
    }))));
  const altoBloque = Math.max(...columnas.map(c => c.length));
  const filaInicial = n;
  for (let f = 0; f < altoBloque; f++) {
    n = fila(ws, n, columnas.flatMap((col, b) => {
      const c = col[f];
      // El rótulo de región solo se escribe en su primera fila: las de abajo
      // quedan para la celda combinada.
      const primeraDeRegion = !!c && (f === 0 || col[f - 1].region !== c.region);
      void b;
      return c
        ? [{ v: primeraDeRegion ? c.region : '', estilo: 'campo' as Estilo }, { v: c.etiqueta, izq: true }, { v: c.marca, estilo: 'marca' as Estilo }]
        : [{ v: '' }, { v: '' }, { v: '' }];
    }), C);
  }
  // Combinación vertical de cada rótulo de región sobre sus subregiones.
  columnas.forEach((col, b) => {
    const colRotulo = b * 3 + 1;
    let desde = 0;
    for (let f = 1; f <= col.length; f++) {
      if (f === col.length || col[f].region !== col[desde].region) {
        if (f - desde > 1) ws.mergeCells(filaInicial + desde, colRotulo, filaInicial + f - 1, colRotulo);
        desde = f;
      }
    }
  });
  const hallazgos = ev.examenFisicoHallazgos || [];
  n = subtitulo(ws, n, 'Observación del examen físico', C);
  n = libre(ws, n, hallazgos.map((h: any) => `${h.codigo}. ${h.subregion || h.region}: ${h.descripcion || ''}`).join(' · '), C, 48);
  return n;
}

// ── HOJA 2 ───────────────────────────────────────────────────────────────────
function hoja2(wb: Workbook, d: DatosFichaExcel) {
  const ev = d.ev ?? {};
  const fr = ev.factoresRiesgo || {};
  const ws = wb.addWorksheet('2. Factores de riesgo');
  const C = COLS_HOJA2;
  ws.getColumn(1).width = 14; ws.getColumn(2).width = 12; ws.getColumn(3).width = 34;
  for (let i = 4; i <= C; i++) ws.getColumn(i).width = 22;
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const acts = actividadesDeMatriz(fr);
  let n = 1;
  n = fila(ws, n, [{ v: 'G. FACTORES DE RIESGO DEL TRABAJO ACTUAL', span: C, estilo: 'seccion', alto: 16 }], C);
  n = fila(ws, n, [
    { v: 'PUESTO DE TRABAJO', span: 3, estilo: 'campo', izq: true },
    { v: fr.puestoArea || d.trabajador?.puestoTrabajo || '', span: C - 3, izq: true },
  ], C);
  n = fila(ws, n, [
    { v: 'ACTIVIDADES IMPORTANTES DENTRO DE LA JORNADA LABORAL', span: 3, estilo: 'campo', izq: true },
    ...Array.from({ length: MAX_ACTIVIDADES }, (_, i) => ({
      v: acts[i] ? `${i + 1}. ${acts[i]}` : String(i + 1), estilo: 'campo' as Estilo, izq: true, alto: 60,
    })),
  ], C);

  const marcadasDe = (riesgo: string, clave: string): number[] => {
    const mapa = fr.riesgoActividades || {};
    if (mapa[riesgo]) return mapa[riesgo];
    const lista: string[] = fr[clave] || [];
    return lista.includes(riesgo) ? [0] : [];
  };

  // Mismo criterio que el PDF: sin las líneas «Otros ______».
  MATRIZ_RIESGOS.forEach(cat => {
    const subgrupos = cat.subgrupos
      .map(g => ({ ...g, items: g.items.filter(esFactorAnalizable) }))
      .filter(g => g.items.length > 0);
    if (subgrupos.length === 0) return;
    const total = subgrupos.reduce((s, g) => s + g.items.length, 0);
    let primera = true;
    subgrupos.forEach(grupo => {
      grupo.items.forEach((factor, idx) => {
        const celdas: Celda[] = [];
        if (primera) { celdas.push({ v: cat.categoria, rows: total, estilo: 'campo' }); primera = false; }
        else celdas.push({ v: '__SALTAR__' });
        if (!grupo.subcategoria) {
          // Sin subcategoría el factor se extiende sobre esa columna.
          celdas.push({ v: factor, span: 2, izq: true });
        } else {
          celdas.push(idx === 0
            ? { v: grupo.subcategoria, rows: grupo.items.length, estilo: 'campo' }
            : { v: '__SALTAR__' });
          celdas.push({ v: factor, izq: true });
        }
        const marcadas = marcadasDe(factor, cat.clave as string);
        for (let i = 0; i < MAX_ACTIVIDADES; i++) celdas.push({ v: d.ev ? X(marcadas.includes(i)) : '', estilo: 'marca' });
        // Las celdas que ya están combinadas desde arriba no se reescriben.
        n = filaConSaltos(ws, n, celdas, C);
      });
    });
  });

  const medidas: string[] = fr.medidasActividades || [];
  n = fila(ws, n, [
    { v: 'MEDIDAS PREVENTIVAS', span: 3, estilo: 'campo', izq: true },
    ...Array.from({ length: MAX_ACTIVIDADES }, (_, i) => ({
      v: acts[i] ? (medidas[i] || '') : '', izq: true, alto: 80,
    })),
  ], C);
  return n;
}

/**
 * Variante de `fila` que respeta las celdas ya combinadas desde una fila
 * anterior: las marcadas con `__SALTAR__` solo avanzan la columna.
 */
function filaConSaltos(ws: Worksheet, nFila: number, celdas: Celda[], totalCols: number): number {
  let col = 1;
  celdas.forEach(c => {
    const span = Math.max(1, c.span ?? 1);
    if (c.v === '__SALTAR__') { col += span; return; }
    const rows = Math.max(1, c.rows ?? 1);
    const celda = ws.getCell(nFila, col);
    celda.value = c.v ?? '';
    aplicar(celda, c);
    if (span > 1 || rows > 1) {
      ws.mergeCells(nFila, col, nFila + rows - 1, col + span - 1);
      for (let f = nFila; f < nFila + rows; f++) {
        for (let k = col; k < col + span; k++) ws.getCell(f, k).border = borde;
      }
    }
    col += span;
  });
  for (; col <= totalCols; col++) ws.getCell(nFila, col).border = borde;
  return nFila + 1;
}

// ── HOJA 3 ───────────────────────────────────────────────────────────────────
function hoja3(wb: Workbook, d: DatosFichaExcel) {
  const ev = d.ev ?? {};
  const ws = wb.addWorksheet('3. Historia laboral y cierre');
  const C = COLS_HOJA3;
  [18, 34, 6, 6, 8, 7, 7, 9, 5, 5, 12, 16, 16].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  let n = 1;
  n = seccion(ws, n, 'H. ANTECEDENTES DE EMPLEOS ANTERIORES Y/O TRABAJO ACTUAL', C);
  n = filaConSaltos(ws, n, [
    { v: 'CENTRO DE TRABAJO', rows: 2, estilo: 'campo' }, { v: 'ACTIVIDADES QUE DESEMPEÑABA', rows: 2, estilo: 'campo' },
    { v: 'TRABAJO', span: 3, estilo: 'campo' },
    { v: 'Accidentes de trabajo y enfermedades profesionales', span: 3, estilo: 'campo' },
    { v: 'CALIFICADO POR EL IESS', span: 5, estilo: 'campo' },
  ], C);
  n = filaConSaltos(ws, n, [
    { v: '__SALTAR__' }, { v: '__SALTAR__' },
    { v: 'Anterior', estilo: 'campo' }, { v: 'Actual', estilo: 'campo' }, { v: 'Tiempo (meses)', estilo: 'campo' },
    { v: 'Incidente', estilo: 'campo' }, { v: 'Accidente', estilo: 'campo' }, { v: 'Enfermedad profesional', estilo: 'campo' },
    { v: 'SI', estilo: 'campo' }, { v: 'NO', estilo: 'campo' }, { v: 'Fecha', estilo: 'campo' },
    { v: 'Especificar', estilo: 'campo' }, { v: 'Observaciones', estilo: 'campo' },
  ], C);
  const emps: any[] = ev.antecedentesEmpleos || [];
  const filasEmpleo = Math.max(FILAS_MINIMAS_HISTORIA_LABORAL, emps.length);
  for (let i = 0; i < filasEmpleo; i++) {
    const e = emps[i];
    n = fila(ws, n, [
      { v: e?.empresa || '', izq: true }, { v: e?.actividades || '', izq: true },
      { v: e ? (e.esActual ? '' : 'X') : '', estilo: 'marca' }, { v: e?.esActual ? 'X' : '', estilo: 'marca' },
      { v: e?.tiempoMeses || '', estilo: 'marca' },
      { v: e?.incidente ? 'X' : '', estilo: 'marca' }, { v: e?.accidente ? 'X' : '', estilo: 'marca' },
      { v: e?.enfermedadProfesional ? 'X' : '', estilo: 'marca' },
      { v: e?.calificadoIess === true ? 'X' : '', estilo: 'marca' }, { v: e?.calificadoIess === false ? 'X' : '', estilo: 'marca' },
      { v: e?.fechaCalificacion || '', estilo: 'marca' },
      { v: e?.especificar || '', izq: true }, { v: e?.observaciones || '', izq: true },
    ], C);
  }

  n = seccion(ws, n, 'I. ACTIVIDADES EXTRA LABORALES', C);
  n = libre(ws, n, ev.actividadesExtraLaborales || '', C);

  n = seccion(ws, n, 'J. RESULTADOS DE EXÁMENES GENERALES Y ESPECÍFICOS', C);
  n = fila(ws, n, [
    { v: 'Nombre del examen', span: 5, estilo: 'campo' }, { v: 'Fecha', span: 3, estilo: 'campo' },
    { v: 'Resultados', span: 5, estilo: 'campo' },
  ], C);
  const exs: any[] = (ev.examenesComplementarios || []).filter((e: any) => e.nombre?.trim());
  for (let i = 0; i < Math.max(FILAS_MINIMAS_PAGINA3, exs.length); i++) {
    n = fila(ws, n, [
      { v: exs[i]?.nombre || '', span: 5, izq: true }, { v: exs[i]?.fecha || '', span: 3 },
      { v: exs[i]?.resultado || '', span: 5, izq: true },
    ], C);
  }

  n = seccion(ws, n, 'K. DIAGNÓSTICO (PRE = presuntivo · DEF = definitivo)', C);
  n = fila(ws, n, [
    { v: 'CIE-10', span: 2, estilo: 'campo' }, { v: 'Descripción', span: 7, estilo: 'campo' },
    { v: 'PRE', span: 2, estilo: 'campo' }, { v: 'DEF', span: 2, estilo: 'campo' },
  ], C);
  const dxs: any[] = (ev.diagnosticos || []).filter((x: any) => x.descripcion?.trim());
  for (let i = 0; i < Math.max(4, dxs.length); i++) {
    n = fila(ws, n, [
      { v: dxs[i]?.cie || '', span: 2 }, { v: dxs[i]?.descripcion || '', span: 7, izq: true },
      { v: dxs[i]?.tipo === 'presuntivo' ? 'X' : '', span: 2, estilo: 'marca' },
      { v: dxs[i]?.tipo === 'definitivo' ? 'X' : '', span: 2, estilo: 'marca' },
    ], C);
  }

  n = seccion(ws, n, 'L. APTITUD MÉDICA PARA EL TRABAJO', C);
  n = fila(ws, n, [
    { v: 'APTO', span: 3, estilo: 'campo' }, { v: 'APTO EN OBSERVACIÓN', span: 3, estilo: 'campo' },
    { v: 'APTO CON LIMITACIONES', span: 4, estilo: 'campo' }, { v: 'NO APTO', span: 3, estilo: 'campo' },
  ], C);
  const apt = ev.aptitudMedica;
  n = fila(ws, n, [
    { v: d.ev ? X(!apt || apt === 'apto') : '', span: 3, estilo: 'marca' },
    { v: X(apt === 'aptoObservacion'), span: 3, estilo: 'marca' },
    { v: X(apt === 'aptoLimitaciones'), span: 4, estilo: 'marca' },
    { v: X(apt === 'noApto'), span: 3, estilo: 'marca' },
  ], C);
  n = subtitulo(ws, n, 'Observaciones de la aptitud', C);
  n = libre(ws, n, ev.aptitudObservacion || '', C);

  n = seccion(ws, n, 'M. RECOMENDACIONES Y/O TRATAMIENTO', C);
  const recs = Array.isArray(ev.recomendaciones) ? ev.recomendaciones.join('; ') : (ev.recomendaciones || '');
  n = libre(ws, n, [recs, ev.recomendacionesOtras].filter(Boolean).join(' · '), C, 48);

  if (!d.ev || tipoEvaluacionClave(ev) === 'retiro') {
    n = seccion(ws, n, 'N. RETIRO', C);
    n = fila(ws, n, [
      { v: 'Se realiza la evaluación', span: 8, estilo: 'campo', izq: true },
      { v: 'SI', span: 2, estilo: 'campo' }, { v: X(ev.retiroEvaluacionRealizada === true), estilo: 'marca' },
      { v: 'NO', estilo: 'campo' }, { v: X(ev.retiroEvaluacionRealizada === false), estilo: 'marca' },
    ], C);
    n = fila(ws, n, [
      { v: 'La condición de salud está relacionada con el trabajo', span: 8, estilo: 'campo', izq: true },
      { v: 'SI', span: 2, estilo: 'campo' }, { v: X(ev.retiroRelacionadaTrabajo === true), estilo: 'marca' },
      { v: 'NO', estilo: 'campo' }, { v: X(ev.retiroRelacionadaTrabajo === false), estilo: 'marca' },
    ], C);
    n = libre(ws, n, ev.retiroObservacion || '', C, 24);
  }

  n = seccion(ws, n, 'O. DATOS DEL PROFESIONAL · P. FIRMA O HUELLA DEL TRABAJADOR', C);
  n = fila(ws, n, [
    { v: 'Fecha', span: 2, estilo: 'campo' }, { v: 'Nombres y apellidos del profesional', span: 5, estilo: 'campo' },
    { v: 'Código médico', span: 2, estilo: 'campo' }, { v: 'Firma y sello', span: 2, estilo: 'campo' },
    { v: 'Firma / huella del trabajador', span: 2, estilo: 'campo' },
  ], C);
  n = fila(ws, n, [
    { v: ev.fechaAtencion || '', span: 2 }, { v: (ev.medicoNombre || '').toUpperCase(), span: 5, izq: true },
    { v: ev.medicoCedula || '', span: 2 }, { v: '', span: 2 }, { v: '', span: 2, alto: 44 },
  ], C);
  n = fila(ws, n, [{ v: 'SNS-MSP/HCU-form.123/2025 · Evaluación Médica Ocupacional', span: C, estilo: 'nota' }], C);
  return n;
}

/** Hoja de instrucciones, para que la plantilla se explique sola. */
function hojaAyuda(wb: Workbook, conDatos: boolean) {
  const ws = wb.addWorksheet('Cómo usar');
  ws.getColumn(1).width = 110;
  const lineas = [
    'FICHA DE EVALUACIÓN MÉDICA OCUPACIONAL — versión editable',
    '',
    conDatos
      ? 'Esta copia viene con los datos de la evaluación seleccionada. Edita lo que haga falta y guarda.'
      : 'Esta es la plantilla en blanco del formato. Rellena las celdas sin fondo verde.',
    '',
    'Cómo está organizada:',
    '  · Hoja «1. Datos y examen físico»: secciones A a F del formato.',
    '  · Hoja «2. Factores de riesgo»: sección G, la matriz de riesgo por actividad.',
    '  · Hoja «3. Historia laboral y cierre»: secciones H a P.',
    '',
    'Para rellenarla:',
    '  · Las celdas con fondo verde son rótulos del formato: no hace falta tocarlas.',
    '  · Las casillas de marca se llenan con una X.',
    '  · Cada hoja ya viene configurada para imprimir en A4 ajustada al ancho.',
    '',
    'Importante: el documento oficial se emite desde el PDF de la aplicación.',
    'Este Excel es para trabajar el contenido con comodidad; lo que se edite aquí',
    'no vuelve a la aplicación por sí solo.',
  ];
  lineas.forEach((t, i) => {
    const c = ws.getCell(i + 1, 1);
    c.value = t;
    c.font = { bold: i === 0, size: i === 0 ? 13 : 10 };
    c.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  });
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

/** Arma el libro completo. Exportada para poder inspeccionarla en pruebas. */
export async function construirFichaExcel(d: DatosFichaExcel): Promise<Workbook> {
  // Carga diferida: exceljs pesa y solo hace falta al exportar. Se acepta la
  // forma CJS y la ESM del módulo, que cambia entre el navegador y Node.
  const mod: any = await import('exceljs');
  const ExcelJS = mod.default ?? mod;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = 'Sistema de fichas médicas ocupacionales';
  wb.created = new Date();
  hojaAyuda(wb, !!d.ev);
  hoja1(wb, d);
  hoja2(wb, d);
  hoja3(wb, d);
  return wb;
}

/** Tipo MIME de un libro de Excel. */
export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Genera el .xlsx y devuelve el archivo con su nombre. Entregarlo es cosa de
 * quien llama: en la app instalada no vale descargarlo, hay que compartirlo.
 */
export async function generarFichaExcel(d: DatosFichaExcel, nombreArchivo: string): Promise<{ blob: Blob; nombre: string }> {
  const wb = await construirFichaExcel(d);
  const buffer = await wb.xlsx.writeBuffer();
  return {
    blob: new Blob([buffer], { type: MIME_XLSX }),
    nombre: conExtension(nombreArchivo, '.xlsx'),
  };
}
