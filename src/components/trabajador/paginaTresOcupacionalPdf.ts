// Página 3 del formato HCU-form.123/2025 (vertical): secciones H a P.
//
// H lleva el recuadro de antecedentes de empleos con sus rótulos en vertical;
// el resto son recuadros de alto fijo o libre. Igual que las páginas 1 y 2,
// vive en su propio módulo para poder renderizarla en una prueba.
import type jsPDF from 'jspdf';
import { conFilasMinimas, FILAS_MINIMAS_HISTORIA_LABORAL } from '../../utils/tablasPdf';
import { ESTILO_BASE, ESTILO_HEAD, C_SEC, type CromoPdf } from './cromoOcupacionalPdf';

/**
 * Anchos en mm de las trece columnas del recuadro H. Suman los 196 mm útiles.
 * La columna de actividades se lleva la parte ancha porque es la única con
 * texto largo; especificar y observaciones suelen ir en una línea.
 */
export const ANCHOS_H = [26, 56, 6, 6, 7, 7, 7, 8, 6, 6, 14, 22, 25];

export interface DatosPagina3Ocupacional {
  ev: any;
  trabajador: any;
  fmtFecha: (f: any) => string;
  fmtHora: (f: any) => string;
}

export function dibujarPagina3Ocupacional(pdf: jsPDF, c: CromoPdf, d: DatosPagina3Ocupacional): void {
  const { ev, fmtFecha, fmtHora } = d;
  const base = ESTILO_BASE;
  const head = ESTILO_HEAD;

  c.cab('Página:    3 de 3');
  c.sec('H. ACTIVIDAD LABORAL / INCIDENTES / ACCIDENTES / ENFERMEDADES OCUPACIONALES');

  // Recuadro «ANTECEDENTES DE EMPLEOS ANTERIORES Y/O TRABAJO ACTUAL» tal como
  // está en el formato: tres bloques de encabezado (TRABAJO, accidentes y
  // enfermedades, calificación del IESS) y los rótulos estrechos en vertical.
  // Los registros pueden venir con huecos (una carga por CSV incompleta), así
  // que se filtran los vacíos antes de volcarlos.
  const emps = (Array.isArray(ev.antecedentesEmpleos) ? ev.antecedentesEmpleos : []).filter(Boolean);
  const rotuloH = (txt: string) => ({ content: '', textoRotado: txt, styles: { fillColor: C_SEC, fontStyle: 'bold' as const } });
  c.AT({
    startY: c.y, theme: 'grid',
    styles: { ...base, fontSize: 5.4, cellPadding: 0.6, halign: 'center', valign: 'middle' },
    columnStyles: Object.fromEntries(ANCHOS_H.map((w, i) => [i, { cellWidth: w }])),
    head: [
      [
        { content: 'CENTRO DE TRABAJO', rowSpan: 2, styles: { ...head, fontSize: 5.2, valign: 'middle' } },
        { content: 'ACTIVIDADES QUE DESEMPEÑABA', rowSpan: 2, styles: { ...head, fontSize: 5.2, valign: 'middle' } },
        { content: 'TRABAJO', colSpan: 3, styles: { ...head, fontSize: 5.2 } },
        { content: 'De los Accidentes de Trabajo y las Enfermedades Profesionales', colSpan: 3, styles: { ...head, fontSize: 4.6 } },
        { content: 'CALIFICADO POR INSTITUTO ECUATORIANO DE SEGURIDAD SOCIAL', colSpan: 5, styles: { ...head, fontSize: 5.2 } },
      ],
      [
        rotuloH('ANTERIOR'), rotuloH('ACTUAL'), rotuloH('TIEMPO DE TRABAJO'),
        rotuloH('INCIDENTE'), rotuloH('ACCIDENTE'), rotuloH('ENFERMEDAD PROFESIONAL'),
        { content: 'SI', styles: { ...head, fontSize: 5.2 } },
        { content: 'NO', styles: { ...head, fontSize: 5.2 } },
        { content: 'FECHA\naaaa/mm/dd', styles: { ...head, fontSize: 4.8 } },
        { content: 'ESPECIFICAR', styles: { ...head, fontSize: 5.2 } },
        { content: 'Observaciones', styles: { ...head, fontSize: 5.2 } },
      ],
    ],
    headStyles: { minCellHeight: 16, valign: 'middle' },
    body: conFilasMinimas(
      emps.map((e: any) => [
        { content: e.empresa || '', styles: { halign: 'left' as const } },
        { content: e.actividades || '', styles: { halign: 'left' as const, fontSize: 4.8, overflow: 'linebreak' as const } },
        e.esActual ? '' : 'X',
        e.esActual ? 'X' : '',
        e.tiempoMeses ? String(e.tiempoMeses) : '',
        e.incidente ? 'X' : '', e.accidente ? 'X' : '', e.enfermedadProfesional ? 'X' : '',
        e.calificadoIess === true ? 'X' : '', e.calificadoIess === false ? 'X' : '',
        e.fechaCalificacion || '',
        { content: e.especificar || '', styles: { halign: 'left' as const, fontSize: 4.8 } },
        { content: e.observaciones || '', styles: { halign: 'left' as const, fontSize: 4.8 } },
      ]),
      ANCHOS_H.length,
      FILAS_MINIMAS_HISTORIA_LABORAL,
    ),
    didDrawCell: (data: any) => {
      const raw = data.cell.raw as any;
      if (data.section !== 'head' || !raw?.textoRotado) return;
      pdf.setTextColor(0); pdf.setFont('helvetica', 'bold');
      const texto = String(raw.textoRotado);
      let cuerpo = 4.4;
      pdf.setFontSize(cuerpo);
      const disponible = data.cell.height - 1;
      const ancho = pdf.getTextWidth(texto);
      if (ancho > disponible) { cuerpo = Math.max(2.8, (cuerpo * disponible) / ancho); pdf.setFontSize(cuerpo); }
      const cx = data.cell.x + data.cell.width / 2;
      pdf.text(texto, cx + cuerpo * 0.14, data.cell.y + (data.cell.height + pdf.getTextWidth(texto)) / 2, { angle: 90 });
    },
  });
  c.y += 1;

  c.sec('I. ACTIVIDADES EXTRA LABORALES');
  c.libre(ev.actividadesExtraLaborales || 'Ninguna relevante reportada.', 6);
  c.y += 1;

  c.sec('J. RESULTADOS DE EXÁMENES GENERALES Y ESPECÍFICOS');
  const exs = (Array.isArray(ev.examenesComplementarios) ? ev.examenesComplementarios : []).filter((e: any) => e?.nombre?.trim());
  c.AT({ startY: c.y, theme: 'grid', styles: { ...base, fontSize: 6.5 }, headStyles: { ...head, fontSize: 6 }, head: [['NOMBRE DEL EXAMEN', 'FECHA', 'RESULTADOS']],
    body: conFilasMinimas(exs.map((e: any) => [e.nombre, e.fecha || '-', e.resultado || '-']), 3) });
  c.y += 1;

  c.sec('K. DIAGNÓSTICO                    PRE = PRESUNTIVO     DEF = DEFINITIVO');
  const dxs = (Array.isArray(ev.diagnosticos) ? ev.diagnosticos : []).filter((x: any) => x?.descripcion?.trim());
  if (dxs.length) {
    c.AT({ startY: c.y, theme: 'grid', styles: { ...base, fontSize: 6.5, halign: 'center' }, headStyles: { ...head, fontSize: 6, halign: 'center' }, head: [['CIE-10', 'DESCRIPCIÓN', 'PRE', 'DEF']],
      body: dxs.map((x: any) => [x.cie || '-', { content: x.descripcion, styles: { halign: 'left' } }, x.tipo === 'presuntivo' ? 'X' : '', x.tipo === 'definitivo' ? 'X' : '']),
      columnStyles: { 0: { cellWidth: 18 }, 2: { cellWidth: 12 }, 3: { cellWidth: 12 } } });
  } else {
    c.libre('PACIENTE SANO.', 5);
  }
  c.y += 1;

  c.sec('L. APTITUD MÉDICA PARA EL TRABAJO');
  c.AT({ startY: c.y, theme: 'grid', styles: { ...base, halign: 'center', fontSize: 7 }, headStyles: { ...head, halign: 'center' }, head: [['APTO', 'APTO EN OBSERVACIÓN', 'APTO CON LIMITACIONES', 'NO APTO']],
    body: [[(!ev.aptitudMedica || ev.aptitudMedica === 'apto') ? 'X' : '', ev.aptitudMedica === 'aptoObservacion' ? 'X' : '', ev.aptitudMedica === 'aptoLimitaciones' ? 'X' : '', ev.aptitudMedica === 'noApto' ? 'X' : '']] });
  c.libre('Observaciones: ' + (ev.aptitudObservacion || '-'), 6);
  c.y += 1;

  c.sec('M. RECOMENDACIONES Y/O TRATAMIENTO');
  c.libre(Array.isArray(ev.recomendaciones)
    ? ev.recomendaciones.join('; ') + (ev.recomendacionesOtras ? `; ${ev.recomendacionesOtras}` : '')
    : ev.recomendaciones || 'Ninguna particular.', 7);
  c.y += 1;

  if (String(ev.tipoEvaluacion || '').includes('retiro')) {
    c.sec('N. RETIRO (evaluación)');
    c.AT({ startY: c.y, theme: 'grid', styles: { ...base, fontSize: 6.5 }, body: [
      [{ content: 'Se realiza la evaluación', styles: { fontStyle: 'bold', cellWidth: 100 } }, { content: 'SI', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 10 } }, { content: ev.retiroEvaluacionRealizada === true ? 'X' : '', styles: { halign: 'center', cellWidth: 10 } }, { content: 'NO', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 10 } }, { content: ev.retiroEvaluacionRealizada === false ? 'X' : '', styles: { halign: 'center' } }],
      [{ content: 'La condición de salud está relacionada con el trabajo', styles: { fontStyle: 'bold' } }, { content: 'SI', styles: { halign: 'center', fontStyle: 'bold' } }, { content: ev.retiroRelacionadaTrabajo === true ? 'X' : '', styles: { halign: 'center' } }, { content: 'NO', styles: { halign: 'center', fontStyle: 'bold' } }, { content: ev.retiroRelacionadaTrabajo === false ? 'X' : '', styles: { halign: 'center' } }],
    ] });
    c.libre('Observación: ' + (ev.retiroObservacion || '-'), 6);
    c.y += 1;
  }

  c.check(24);
  c.sec('O. DATOS DEL PROFESIONAL                                                            P. FIRMA O HUELLA DEL TRABAJADOR');
  c.AT({ startY: c.y, theme: 'grid', styles: { ...base, fontSize: 6.5, halign: 'center' }, headStyles: { ...head, fontSize: 6, halign: 'center' },
    head: [['FECHA', 'HORA', 'NOMBRES Y APELLIDOS DEL PROFESIONAL', 'CÓDIGO MÉDICO', 'FIRMA Y SELLO', 'FIRMA / HUELLA DEL TRABAJADOR']],
    body: [[fmtFecha(ev.fecha), fmtHora(ev.fecha), (ev.medicoNombre || 'MÉDICO OCUPACIONAL').toUpperCase(), ev.medicoCedula || '-', '', '']],
    bodyStyles: { minCellHeight: 18, valign: 'bottom', halign: 'center' } });
}
