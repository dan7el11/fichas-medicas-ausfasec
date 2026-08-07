// PÁGINA 1 del formato SNS-MSP/HCU-form.123/2025 (Evaluación Médica
// Ocupacional), replicada con las medidas de la hoja oficial.
//
// Todos los anchos están en milímetros y salen de medir el PDF del formato:
// margen 7 mm y ancho útil 196 mm. Las secciones A a F se dibujan con esos
// mismos cortes de columna para que el resultado calce con el impreso.
import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BLOQUES_EXAMEN_FISICO, filasDeBloque, tieneHallazgo, ALTO_EXAMEN_FISICO,
} from '../../utils/examenFisicoOficial';
import { tipoEvaluacionClave } from '../../utils/medicalHelpers';

const NEGRO: [number, number, number] = [0, 0, 0];
const LILA = '#ccccff';    // franja de sección (A, B, C…)
const VERDE = '#ccffcc';   // encabezado de campo
const BLANCO = '#ffffff';

export const MARGEN = 7;
export const ANCHO_UTIL = 196;

// ── Cortes de columna de cada fila, medidos del formato ─────────────────────
const A_ESTABLECIMIENTO = [58.7, 19.0, 18.5, 47.8, 32.0, 20.0];
const A_NOMBRES = [58.7, 58.7, 37.1, 41.5];
/** prioritaria ×4 | sexo ×2 | fecha nacimiento ×3 | edad | grupo sang. | lateralidad */
const A_PRIORITARIA = [17.2, 12.8, 11.0, 17.7, 13.2, 10.5, 10.4, 10.0, 6.7, 7.9, 37.1, 41.5];
const B_PUESTO = [26.0, 51.4, 39.9, 78.7];
const B_FECHAS = [98.4, 45.4, 52.2];
const B_TIPO = [16.9, 28.8, 36.4, 16.0, 29.4, 16.0, 34.3, 18.2];
const C_TRANSFUSION = [45.7, 9.1, 12.4, 49.9, 22.6, 48.2, 8.1];
const C_GINECO = [71.6, 15.5, 15.4, 14.6, 22.6, 6.9, 23.0, 7.4, 19.0];
const C_GINECO_EXAMENES = [58.4, 13.2, 124.4];
const C_MASCULINO = [45.7, 12.7, 44.1, 6.7, 45.0, 21.4, 20.4];
const C_CONSUMO = [40.7, 14.1, 16.8, 15.5, 15.4, 25.0, 12.2, 11.3, 15.3, 16.8, 12.9];
const E_CONSTANTES = [22.9, 25.8, 18.5, 25.3, 19.8, 15.2, 16.0, 18.7, 33.8];

/** Convierte una lista de anchos en el `columnStyles` de autotable. */
const anchos = (lista: number[]): Record<number, any> =>
  Object.fromEntries(lista.map((w, i) => [i, { cellWidth: w }]));

export interface DatosPagina1Ocupacional {
  ev: any;
  trabajador: any;
  empresa: { institucion: string; ruc: string; ciu: string; establecimiento: string };
  logoPdf: { data: string; format: string };
  /** Formatea una fecha de Firestore a dd/mm/aaaa. */
  fmtFecha: (f: any) => string;
}

/** Edad en años cumplidos a partir de la fecha de nacimiento (aaaa-mm-dd). */
export function edadDesde(fechaNacimiento: any, referencia = new Date()): string {
  if (!fechaNacimiento) return '';
  const txt = String(fechaNacimiento);
  const d = new Date(txt.length === 10 ? `${txt}T12:00:00` : txt);
  if (isNaN(d.getTime())) return '';
  let edad = referencia.getFullYear() - d.getFullYear();
  const m = referencia.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && referencia.getDate() < d.getDate())) edad--;
  return edad >= 0 && edad < 130 ? String(edad) : '';
}

/** Parte una fecha aaaa-mm-dd en sus tres casillas (año | mes | día). */
export function partesFecha(fecha: any): [string, string, string] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha ?? ''));
  return m ? [m[1], m[2], m[3]] : ['', '', ''];
}

/**
 * Dibuja la página 1 completa y devuelve la `y` final.
 * El documento debe estar posicionado en una página vertical A4 vacía.
 */
export function dibujarPagina1Ocupacional(pdf: jsPDF, d: DatosPagina1Ocupacional): number {
  const { ev, trabajador, empresa, logoPdf, fmtFecha } = d;
  const M = MARGEN, CW = ANCHO_UTIL;
  let y = 6;

  const base = { lineColor: NEGRO, lineWidth: 0.2, fontSize: 6, cellPadding: 0.7, textColor: NEGRO, valign: 'middle' as const };
  const AT = (opts: any) => {
    autoTable(pdf, { margin: { left: M, right: M }, theme: 'grid', styles: base, ...opts });
    y = (pdf as any).lastAutoTable.finalY;
  };
  /** Franja lila de sección, a todo el ancho. */
  const seccion = (texto: string) => {
    pdf.setFillColor(LILA); pdf.setDrawColor(0); pdf.rect(M, y, CW, 4.6, 'FD');
    pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
    pdf.text(texto, M + 1.5, y + 3.3);
    y += 4.6;
  };
  /** Franja verde de subtítulo, a todo el ancho. */
  const subtitulo = (texto: string) => {
    pdf.setFillColor(VERDE); pdf.setDrawColor(0); pdf.rect(M, y, CW, 3.8, 'FD');
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
    pdf.text(texto, M + 1.5, y + 2.7);
    y += 3.8;
  };
  /** Recuadro de texto libre. */
  const libre = (texto: string, alto = 4.6) => {
    pdf.setDrawColor(0); pdf.setFillColor(BLANCO); pdf.rect(M, y, CW, alto, 'FD');
    pdf.setFontSize(6.2); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(0);
    const lineas = pdf.splitTextToSize(texto || '', CW - 3);
    pdf.text(lineas.slice(0, Math.max(1, Math.floor(alto / 2.6))), M + 1.5, y + 2.6);
    y += alto;
  };
  const X = (activo: boolean) => (activo ? 'X' : '');
  /**
   * Celda de encabezado (verde). `colSpan`/`rowSpan` van en la celda y no en
   * `styles`: autotable los ignora si se cuelan dentro del objeto de estilos.
   */
  const cabecera = (t: string, extra: any = {}) => {
    const { colSpan, rowSpan, ...estilos } = extra;
    return {
      content: t,
      ...(colSpan ? { colSpan } : {}),
      ...(rowSpan ? { rowSpan } : {}),
      styles: { fillColor: VERDE, fontStyle: 'bold' as const, halign: 'center' as const, ...estilos },
    };
  };

  // ══════════ CABECERA ══════════
  autoTable(pdf, {
    startY: y, margin: { left: M, right: M }, theme: 'grid',
    styles: { ...base, fontSize: 6.5, cellPadding: 0.8 },
    columnStyles: anchos([44.0, 122.0, 30.0]),
    body: [
      [{ content: '', rowSpan: 3 },
       { content: 'HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN MÉDICA OCUPACIONAL', styles: { fontStyle: 'bold', fontSize: 8, halign: 'center' } },
       { content: 'Revisión: 1', styles: { fontSize: 6, halign: 'left' } }],
      [{ content: 'MACROPROCESO:  PLANIFICACIÓN, SEGURIDAD Y AMBIENTE', styles: { fontSize: 5.6, fontStyle: 'bold', halign: 'left' } },
       { content: 'Página:   1 de 3', styles: { fontSize: 6, halign: 'left' } }],
      [{ content: 'PROCESO ADJETIVO:  GESTIÓN DE SEGURIDAD INDUSTRIAL Y MEDICINA OCUPACIONAL', styles: { fontSize: 5.6, fontStyle: 'bold', halign: 'left' } },
       { content: '', styles: { fontSize: 6 } }],
    ],
  });
  try { pdf.addImage(logoPdf.data, logoPdf.format, M + 2, y + 1.5, 38, 9); } catch { /* sin logo */ }
  y = (pdf as any).lastAutoTable.finalY;
  AT({ startY: y, styles: { ...base, fontSize: 7.5, fontStyle: 'bold', halign: 'center', fillColor: LILA },
    body: [[{ content: 'FORMULARIO DE EVALUACIÓN MÉDICA OCUPACIONAL' }]] });

  // ══════════ A. DATOS DEL ESTABLECIMIENTO ══════════
  seccion('A. DATOS DEL ESTABLECIMIENTO - DATOS DEL USUARIO');
  AT({ startY: y, columnStyles: anchos(A_ESTABLECIMIENTO),
    styles: { ...base, halign: 'center', fontSize: 5.6 },
    body: [
      [cabecera('INSTITUCIÓN DEL SISTEMA'), cabecera('RUC'), cabecera('CIIU'),
       cabecera('ESTABLECIMIENTO /CENTRO DE TRABAJO'), cabecera('NÚMERO DE HISTORIA CLÍNICA'), cabecera('NÚMERO DE ARCHIVO')],
      [empresa.institucion, empresa.ruc, empresa.ciu, empresa.establecimiento,
       ev.numeroHistoriaClinica || trabajador.cedula || '', ev.numeroArchivo || ''],
    ] });
  AT({ startY: y, columnStyles: anchos(A_NOMBRES),
    styles: { ...base, halign: 'center', fontSize: 5.8 },
    body: [
      [cabecera('PRIMER APELLIDO'), cabecera('SEGUNDO APELLIDO'), cabecera('PRIMER NOMBRE'), cabecera('SEGUNDO NOMBRE')],
      [{ content: trabajador.primerApellido || '', styles: { fontStyle: 'bold' } },
       { content: trabajador.segundoApellido || '', styles: { fontStyle: 'bold' } },
       { content: trabajador.primerNombre || '', styles: { fontStyle: 'bold' } },
       { content: trabajador.segundoNombre || '', styles: { fontStyle: 'bold' } }],
    ] });

  // Grupo prioritario (rótulos rotados) + sexo + nacimiento + edad + grupo
  // sanguíneo + lateralidad, en una sola tabla como la hoja oficial.
  const dp = ev.datosPersonales || {};
  const prioritarios: string[] = dp.gruposPrioritarios || [];
  const [anio, mes, dia] = partesFecha(dp.fechaNacimiento);
  const ROTADOS = ['Embarazada', 'Persona con Discapacidad', 'Enfermedad Catastrófica', 'Adulto Mayor'];
  const rotado = (txt: string) => ({ content: '', textoRotado: txt, styles: { fillColor: VERDE, minCellHeight: 11.5 } });
  AT({
    startY: y, columnStyles: anchos(A_PRIORITARIA),
    styles: { ...base, halign: 'center', fontSize: 5.6 },
    body: [
      [cabecera('GRUPO DE ATENCIÓN PRIORITARIA', { colSpan: 4 }),
       cabecera('SEXO', { colSpan: 2 }),
       cabecera('FECHA DE NACIMIENTO', { colSpan: 3 }),
       cabecera('Edad', { rowSpan: 2, valign: 'middle' }),
       cabecera('GRUPO SANGUÍNEO', { rowSpan: 2, valign: 'middle' }),
       cabecera('LATERALIDAD', { rowSpan: 2, valign: 'middle' })],
      [...ROTADOS.map(rotado),
       cabecera('Hombre', { valign: 'bottom' }), cabecera('Mujer', { valign: 'bottom' }),
       cabecera('año', { valign: 'bottom' }), cabecera('mes', { valign: 'bottom' }), cabecera('día', { valign: 'bottom' })],
      [...ROTADOS.map(r => X(prioritarios.includes(r) || prioritarios.some(p => p.toLowerCase().startsWith(r.toLowerCase().slice(0, 8))))),
       X(trabajador.sexo === 'M'), X(trabajador.sexo === 'F'),
       anio, mes, dia,
       edadDesde(dp.fechaNacimiento),
       dp.grupoSanguineo || '', dp.lateralidad || ''],
    ],
    didDrawCell: (data: any) => {
      const raw = data.cell.raw as any;
      if (data.section !== 'body' || !raw?.textoRotado) return;
      pdf.setTextColor(0); pdf.setFontSize(4.2); pdf.setFont('helvetica', 'normal');
      // El rótulo se parte en las líneas que quepan en el alto de la celda y
      // se centra vertical y horizontalmente dentro de ella.
      const lineas = pdf.splitTextToSize(String(raw.textoRotado), data.cell.height - 1.5) as string[];
      const cx = data.cell.x + data.cell.width / 2;
      const primera = cx - ((lineas.length - 1) * 1.9) / 2;
      lineas.forEach((l, i) => {
        const ancho = pdf.getTextWidth(l);
        pdf.text(l, primera + i * 1.9 + 0.7, data.cell.y + (data.cell.height + ancho) / 2, { angle: 90 });
      });
    },
  });

  // ══════════ B. MOTIVO DE CONSULTA ══════════
  seccion('B. MOTIVO DE CONSULTA');
  AT({ startY: y, columnStyles: anchos(B_PUESTO), styles: { ...base, fontSize: 5.8 },
    body: [[
      cabecera('Puesto de Trabajo CIUO', { halign: 'left' }),
      { content: trabajador.puestoTrabajo || '', styles: { fontSize: 5.4 } },
      cabecera('Fecha de Atención aaaa/mm/dd', { halign: 'left' }),
      { content: ev.fechaAtencion || fmtFecha(ev.fecha) || '' },
    ]] });
  AT({ startY: y, columnStyles: anchos(B_FECHAS), styles: { ...base, fontSize: 5.8, halign: 'center' },
    body: [
      [cabecera('Fecha de Ingreso al trabajo   aaaa/mm/dd', { halign: 'left' }),
       cabecera('Fecha de Reintegro aaaa/mm/dd', { halign: 'left' }),
       cabecera('Fecha del Último día laboral/salida aaaa/mm/dd', { halign: 'left' })],
      [ev.fechaIngresoTrabajo || '', ev.fechaReingreso || '', ev.fechaUltimoDiaLaboral || ''],
    ] });
  subtitulo('TIPO DE EVAUACIÓN');
  const clave = tipoEvaluacionClave(ev);
  AT({ startY: y, columnStyles: anchos(B_TIPO), styles: { ...base, fontSize: 6, halign: 'center' },
    body: [[
      cabecera('INGRESO', { halign: 'left' }), X(clave === 'preocupacional'),
      cabecera('PERIÓDICO', { halign: 'left' }), X(clave === 'periodica'),
      cabecera('REINTEGRO', { halign: 'left' }), X(clave === 'reintegro'),
      cabecera('RETIRO', { halign: 'left' }), X(clave === 'retiro'),
    ]] });
  subtitulo('Observación');
  libre(ev.motivoConsulta || '');

  // ══════════ C. ANTECEDENTES PERSONALES ══════════
  seccion('C. ANTECEDENTES PERSONALES');
  subtitulo('ANTECEDENTES CLÍNICOS Y QUIRÚRGICOS');
  libre(ev.antecedentesClinicosTexto || ev.antecedentesClinicosQuirurgicos || '');
  subtitulo('ANTECEDENTES FAMILIARES');
  libre(ev.antecedentesFamiliaresTexto || '');
  subtitulo('Condición especial para las atenciones de urgencia,emergencia,y tratamiento médico (referido por el paciente).');

  const ce = ev.condicionEspecial || {};
  AT({ startY: y, columnStyles: anchos(C_TRANSFUSION), styles: { ...base, fontSize: 5.8, halign: 'center' },
    body: [
      [{ content: 'En caso de requerir transfusiones autoriza :', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
       cabecera('SI'), cabecera('NO'),
       { content: 'Se encuentra bajo algún tratamiento hormonal', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
       cabecera('SI'), cabecera('¿Cuál?  Describir'), cabecera('NO')],
      [X(ce.autorizaTransfusiones === true), X(ce.autorizaTransfusiones === false),
       X(ce.tratamientoHormonal === true),
       { content: ce.tratamientoHormonal === true ? (ce.tratamientoHormonalCual || '') : '', styles: { fontSize: 5.2 } },
       X(ce.tratamientoHormonal === false)],
    ] });

  // Gineco-obstétricos y reproductivos masculinos: la hoja imprime AMBOS
  // bloques siempre, aunque solo se llene el que corresponde al sexo.
  const g = ev.antecedentesGineco || {};
  subtitulo('ANTECEDENTES GINECO OBSTÉTRICOS');
  AT({ startY: y, columnStyles: anchos(C_GINECO), styles: { ...base, fontSize: 5.4, halign: 'center' },
    body: [
      [cabecera('FECHA DE LA ÚLTIMA MENSTRUACIÓN                    aaaa /mm/dd', { rowSpan: 2, valign: 'middle' }),
       cabecera('GESTAS', { rowSpan: 2, valign: 'middle' }), cabecera('PARTOS', { rowSpan: 2, valign: 'middle' }),
       cabecera('CESÁREAS', { rowSpan: 2, valign: 'middle' }), cabecera('ABORTOS', { rowSpan: 2, valign: 'middle' }),
       cabecera('MÉTODO DE PLANIFICACION FAMILIAR', { colSpan: 4 })],
      [cabecera('si'), cabecera('¿Cual?'), cabecera('no'), cabecera('no responde')],
      [g.fum || '', g.gestas || '', g.partos || '', g.cesareas || '', g.abortos || '',
       X(g.planificacionFamiliar === true), g.planificacionFamiliar === true ? (g.planificacionTipo || '') : '',
       X(g.planificacionFamiliar === false), ''],
    ] });
  const tamizajesGineco = [g.papanicolaou, g.mamografia].filter((t: any) => t?.realizado === true);
  AT({ startY: y, columnStyles: anchos(C_GINECO_EXAMENES), styles: { ...base, fontSize: 5.4, halign: 'center' },
    body: [
      [cabecera('EXÁMENES REALIZADOS ¿CUAL?'), cabecera('TIEMPO\n(años)'),
       cabecera('Registrar resultado únicamente si interfiere con la actividad laboral y previa autorización del titular', { fontSize: 5 })],
      ...(tamizajesGineco.length
        ? [
            g.papanicolaou?.realizado === true ? ['PAPANICOLAOU', g.papanicolaou.tiempoAnios || '', g.papanicolaou.resultado || ''] : null,
            g.mamografia?.realizado === true ? ['MAMOGRAFÍA', g.mamografia.tiempoAnios || '', g.mamografia.resultado || ''] : null,
          ].filter(Boolean) as string[][]
        : [['', '', ''], ['', '', '']]),
    ] });

  const r = ev.antecedentesReproductivos || {};
  subtitulo('ANTECEDENTES REPRODUCTIVOS MASCULINOS');
  AT({ startY: y, columnStyles: anchos(C_MASCULINO), styles: { ...base, fontSize: 5.4, halign: 'center' },
    body: [
      [cabecera('EXÁMENES REALIZADOS ¿CUÁL?', { rowSpan: 2, valign: 'middle', halign: 'left' }),
       cabecera('TIEMPO\n(años)', { rowSpan: 2, valign: 'middle' }),
       cabecera('Registrar resultado únicamente si interfiere con la actividad laboral y previa autorización del titular', { rowSpan: 2, valign: 'middle', fontSize: 4.8 }),
       cabecera('MÉTODO DE PLANIFICACIÓN FAMILIAR', { colSpan: 4 })],
      [cabecera('SI'), cabecera('¿CUÁL?'), cabecera('NO'), cabecera('NO RESPONDE')],
      [{ content: r.antigenoProstatico?.realizado === true ? 'ANTÍGENO PROSTÁTICO' : '', styles: { halign: 'left' } },
       r.antigenoProstatico?.tiempoAnios || '',
       { content: r.antigenoProstatico?.resultado || '', styles: { halign: 'left' } },
       X(r.planificacionFamiliar === true),
       { content: r.planificacionFamiliar === true ? (r.planificacionTipo || '') : '', styles: { halign: 'left' } },
       X(r.planificacionFamiliar === false), ''],
    ] });

  // Consumo de sustancias + estilo de vida + condición preexistente
  const habito = (tipo: string) => (ev.habitosToxicos || []).find((h: any) => h.tipo === tipo) || {};
  const tabaco = habito('tabaco'), alcohol = habito('alcohol'), otras = habito('drogas');
  const evd = ev.estiloVida || {};
  const filaHabito = (etiqueta: string, h: any) => ([
    { content: etiqueta, styles: { halign: 'left' as const } },
    h.consume ? (h.tiempoConsumo || 'X') : '',
    X(!!h.exConsumidor),
    h.exConsumidor ? (h.tiempoAbstinencia || '') : '',
    X(!h.consume && !h.exConsumidor),
  ]);
  AT({ startY: y, columnStyles: anchos(C_CONSUMO), styles: { ...base, fontSize: 5.2, halign: 'center' },
    body: [
      [cabecera('CONSUMO DE SUSTANCIAS', { colSpan: 5, halign: 'left' }),
       cabecera('ESTILO DE VIDA', { colSpan: 3 }),
       cabecera('CONDICIÓN PREEXISTENTE', { colSpan: 3 })],
      [cabecera(''), cabecera('TIEMPO DE CONSUMO'), cabecera('EX CONSUMIDOR'), cabecera('TIEMPO DE ABSTINENCIA'), cabecera('NO CONSUME'),
       cabecera(''), cabecera('¿CUÁL?'), cabecera('TIEMPO'),
       cabecera(''), cabecera('¿ CUÁL?'), cabecera('CANTIDAD')],
      [...filaHabito('TABACO', tabaco),
       { content: 'ACTIVIDAD FÍSICA', rowSpan: 3, styles: { valign: 'middle' } },
       { content: evd.tipoActividad || '', rowSpan: 3, styles: { valign: 'middle', fontSize: 5 } },
       { content: evd.tiempoCantidad || '', rowSpan: 3, styles: { valign: 'middle' } },
       { content: 'MEDICACIÓN HABITUAL', rowSpan: 3, styles: { valign: 'middle' } },
       { content: evd.medicacionHabitual || ce.condicionPreexistente || '', rowSpan: 3, styles: { valign: 'middle', fontSize: 5 } },
       { content: evd.medicacionCantidad || '', rowSpan: 3, styles: { valign: 'middle' } }],
      filaHabito('ALCOHOL', alcohol),
      filaHabito('OTRAS: ¿Cuál?  __________', otras),
    ] });
  libre('Observación: ' + (ev.observacionHabitos || ''), 4.2);

  // ══════════ D. ENFERMEDAD O PROBLEMA ACTUAL ══════════
  seccion('D. ENFERMEDAD O PROBLEMA  ACTUAL');
  subtitulo('Descripción');
  libre(ev.enfermedadActual || '');

  // ══════════ E. CONSTANTES VITALES ══════════
  seccion('E. CONSTANTES VITALES Y ANTROPOMETRÍA');
  const sv = ev.signosVitales || {};
  AT({ startY: y, columnStyles: anchos(E_CONSTANTES), styles: { ...base, fontSize: 5.4, halign: 'center' },
    body: [
      [cabecera('TEMPERATURA (°C)'), cabecera('PRESIÓN ARTERIAL\n(mmHg)'), cabecera('FRECUENCIA\nCARDIACA (Lat/min)'),
       cabecera('FRECUENCIA RESPIRATORIA\n(fr/min)'), cabecera('SATURACIÓN DE\nOXÍGENO (O2%)'), cabecera('PESO (Kg)'),
       cabecera('TALLA (cm)'), cabecera('ÍNDICE DE MASA\nCORPORAL (kg/m2)'), cabecera('PERÍMETRO ABDOMINAL (cm)')],
      [sv.temperatura || '',
       sv.presionSistolica || sv.presionDiastolica ? `${sv.presionSistolica || ''}/${sv.presionDiastolica || ''}` : '',
       sv.frecuenciaCardiaca || '', sv.frecuenciaRespiratoria || '', sv.saturacion || '',
       sv.peso || '', sv.talla || '', sv.imc ? Number(sv.imc).toFixed(1) : '', sv.perimetroAbdominal || ''],
    ] });

  // ══════════ F. EXAMEN FÍSICO REGIONAL ══════════
  seccion('F. EXAMEN FÍSICO REGIONAL');
  subtitulo('REGIONES');
  y = dibujarExamenFisico(pdf, ev, y);

  AT({ startY: y, styles: { ...base, fontSize: 5.4, halign: 'left', fillColor: '#f4f4f4' },
    body: [[{ content: 'SI EXISTE EVIDENCIA DE PATOLOGÍA MARCAR CON "X" Y DESCRIBIR EN LA SIGUIENTE SECCIÓN COLOCANDO EL NUMERAL' }]] });
  const hallazgos = ev.examenFisicoHallazgos || [];
  const detalle = hallazgos
    .map((h: any) => `${h.codigo}. ${h.subregion || h.region}: ${h.descripcion || 'hallazgo'}`)
    .join(' · ');
  libre('Observación: ' + detalle, 9);

  // Pie de página del formato
  pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(0);
  pdf.text('SNS-MSP/HCU-form.123/2025', M, y + 3.2);
  pdf.text('Evaluación Médica Ocupacional', M + CW * 0.62, y + 3.2);
  return y + 3.2;
}

/**
 * Rejilla del examen físico: cinco bloques verticales lado a lado. Cada uno
 * lleva su propio número de filas y reparte el mismo alto total, igual que en
 * la hoja oficial (por eso las columnas de la derecha van más apretadas).
 */
function dibujarExamenFisico(pdf: jsPDF, ev: any, yInicio: number): number {
  let x = MARGEN;
  let yFinal = yInicio;

  BLOQUES_EXAMEN_FISICO.forEach((bloque) => {
    const [wRot, wSub, wChk] = bloque.anchos;
    const altoFila = ALTO_EXAMEN_FISICO / filasDeBloque(bloque);
    const body: any[] = [];

    bloque.regiones.forEach((region) => {
      region.items.forEach((item, i) => {
        const fila: any[] = [];
        if (i === 0) {
          fila.push({
            content: '', textoRotado: region.rotulo, rowSpan: region.items.length,
            styles: { fillColor: '#ccffff', valign: 'middle', halign: 'center' },
          });
        }
        fila.push({ content: `${item.letra}. ${item.nombre}`, styles: { halign: 'left', fillColor: '#ffffff' } });
        fila.push({
          content: tieneHallazgo(ev.examenFisicoHallazgos, `${region.numero}${item.letra}`, item.nombre) ? 'X' : '',
          styles: { halign: 'center', fontStyle: 'bold', fillColor: '#ffffff' },
        });
        body.push(fila);
      });
    });

    autoTable(pdf, {
      startY: yInicio,
      margin: { left: x, right: 210 - x - (wRot + wSub + wChk) },
      theme: 'grid',
      styles: {
        lineColor: NEGRO, lineWidth: 0.2, textColor: NEGRO,
        fontSize: 4.8, cellPadding: 0.4, minCellHeight: altoFila, valign: 'middle',
      },
      columnStyles: { 0: { cellWidth: wRot }, 1: { cellWidth: wSub }, 2: { cellWidth: wChk } },
      body,
      didDrawCell: (data: any) => {
        const raw = data.cell.raw as any;
        if (!raw?.textoRotado) return;
        const texto = String(raw.textoRotado);
        pdf.setTextColor(0); pdf.setFont('helvetica', 'normal');
        // El rótulo va rotado 90°, así que su LARGO consume el ALTO de la
        // celda. Regiones de una o dos filas no dan para el cuerpo normal:
        // se reduce la fuente lo justo para que no invada las vecinas.
        let cuerpo = 4.6;
        pdf.setFontSize(cuerpo);
        const disponible = data.cell.height - 0.8;
        const ancho = pdf.getTextWidth(texto);
        if (ancho > disponible) {
          cuerpo = Math.max(2.6, (cuerpo * disponible) / ancho);
          pdf.setFontSize(cuerpo);
        }
        const cx = data.cell.x + data.cell.width / 2;
        pdf.text(texto, cx + cuerpo * 0.14, data.cell.y + (data.cell.height + pdf.getTextWidth(texto)) / 2, { angle: 90 });
      },
    });
    yFinal = Math.max(yFinal, (pdf as any).lastAutoTable.finalY);
    x += wRot + wSub + wChk;
  });

  return yFinal;
}
