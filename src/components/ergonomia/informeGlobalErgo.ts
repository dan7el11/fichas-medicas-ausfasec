// Informe global de TODAS las evaluaciones de un método (ej. todas las ROSA):
// estadísticas agregadas, distribución por nivel, promedios de componentes,
// interpretación y tabla completa de evaluaciones.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EvaluacionErgonomica, MetodoErgo } from '../../types/ergonomia';
import type { DatosEmpresa } from '../../contexts/EmpresaContext';
import { estadisticasErgo } from '../../utils/ergonomia/estadisticas';
import { INTRO_METODO, DETALLE_LABEL } from '../../utils/ergonomia/interpretacion';
import { toDate } from '../../services/atenciones';

const TONE_RGB: Record<string, [number, number, number]> = {
  success: [16, 160, 90],
  warning: [224, 138, 44],
  danger: [220, 46, 60],
};

const fmtF = (d: Date | null) => (d && !isNaN(d.getTime()) ? d.toLocaleDateString('es-EC') : '—');

export function generarInformeGlobalErgo(
  metodo: MetodoErgo,
  evals: EvaluacionErgonomica[],
  empresa: DatosEmpresa,
  logo: { data: string; format: string },
) {
  const s = estadisticasErgo(evals);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = pdf.internal.pageSize.width;
  const pageH = pdf.internal.pageSize.height;

  // Encabezado
  try { pdf.addImage(logo.data, logo.format, 14, 10, 28, 12); } catch { /* sin logo */ }
  pdf.setFontSize(13); pdf.setFont('helvetica', 'bold');
  pdf.text(empresa.institucion, 46, 15);
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
  pdf.text(`RUC: ${empresa.ruc}  ·  ${empresa.establecimiento}`, 46, 20);
  pdf.setFontSize(14); pdf.setFont('helvetica', 'bold');
  pdf.text(`Informe global de evaluaciones ergonómicas — ${metodo}`, 14, 32);
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal');
  pdf.text(`Período: ${fmtF(s.desde)} a ${fmtF(s.hasta)}   ·   Generado: ${new Date().toLocaleDateString('es-EC')}`, 14, 38);

  // Resumen ejecutivo
  autoTable(pdf, {
    startY: 42,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.2, halign: 'center' },
    head: [['Evaluaciones', 'Trabajadores', 'Promedio', 'Mínimo', 'Máximo', 'En riesgo (acción necesaria)']],
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
    body: [[String(s.n), String(s.trabajadoresUnicos), String(s.promedio), String(s.minimo), String(s.maximo), `${s.enRiesgo} (${s.pctEnRiesgo}%)`]],
    margin: { left: 14, right: 14 },
  });
  let y = (pdf as any).lastAutoTable.finalY + 5;

  // Distribución por nivel de riesgo
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
  pdf.text('Distribución por nivel de riesgo', 14, y); y += 3;
  autoTable(pdf, {
    startY: y,
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 2 },
    head: [['Nivel de riesgo', 'Evaluaciones', '%']],
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 8 },
    columnStyles: { 1: { halign: 'center', cellWidth: 32 }, 2: { halign: 'center', cellWidth: 24 } },
    body: s.porNivel.map((niv) => [
      { content: niv.nivel, styles: { textColor: TONE_RGB[niv.tone] ?? [0, 0, 0], fontStyle: 'bold' as const } },
      String(niv.n), `${niv.pct}%`,
    ]),
    margin: { left: 14, right: 14 },
  });
  y = (pdf as any).lastAutoTable.finalY + 5;

  // Promedios de componentes / puntajes intermedios
  if (s.promedioDetalle.length > 0) {
    pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
    pdf.text('Promedios por componente', 14, y); y += 3;
    autoTable(pdf, {
      startY: y,
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 2 },
      head: [['Componente', 'Promedio']],
      headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 8 },
      columnStyles: { 1: { halign: 'center', cellWidth: 30 } },
      body: s.promedioDetalle.map((dd) => [DETALLE_LABEL[dd.key] ?? dd.key, String(dd.promedio)]),
      margin: { left: 14, right: 14 },
    });
    y = (pdf as any).lastAutoTable.finalY + 5;
  }

  // Interpretación
  const parrafos = [
    INTRO_METODO[metodo] ?? '',
    `Se analizaron ${s.n} evaluaciones ${metodo} realizadas a ${s.trabajadoresUnicos} trabajador(es) entre ${fmtF(s.desde)} y ${fmtF(s.hasta)}. ` +
    `La puntuación promedio fue ${s.promedio} (rango ${s.minimo}–${s.maximo}). ` +
    `${s.enRiesgo === 0
      ? 'Ninguna evaluación quedó en zona de riesgo alto; se recomienda mantener las condiciones actuales y re-evaluar periódicamente.'
      : `${s.enRiesgo} evaluación(es) (${s.pctEnRiesgo}%) quedaron en zona de riesgo que requiere intervención: priorícelas comenzando por las puntuaciones más altas de la tabla siguiente.`}`,
    'Las evaluaciones individuales (disponibles como informes separados) detallan los parámetros desfavorables de cada puesto y las recomendaciones específicas de corrección.',
  ];
  if (y > pageH - 40) { pdf.addPage(); y = 16; }
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
  pdf.text('Interpretación', 14, y); y += 5;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(40);
  for (const parrafo of parrafos) {
    const lineas = pdf.splitTextToSize(parrafo, W - 28);
    if (y + lineas.length * 3.8 > pageH - 18) { pdf.addPage(); y = 16; }
    pdf.text(lineas, 14, y);
    y += lineas.length * 3.8 + 2.5;
  }
  pdf.setTextColor(0);
  y += 2;

  // Tabla completa (ordenada de mayor a menor riesgo)
  const ordenadas = [...evals].sort((a, b) => b.resultado.puntajeFinal - a.resultado.puntajeFinal);
  if (y > pageH - 40) { pdf.addPage(); y = 16; }
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
  pdf.text('Detalle de evaluaciones (de mayor a menor riesgo)', 14, y); y += 3;
  autoTable(pdf, {
    startY: y,
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    head: [['Fecha', 'Trabajador', 'Puesto', 'Área', 'Puntaje', 'Nivel']],
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7.5 },
    columnStyles: { 4: { halign: 'center', cellWidth: 18 } },
    body: ordenadas.map((e) => [
      toDate(e.fecha).toLocaleDateString('es-EC'),
      `${e.apellidos} ${e.nombres}`,
      e.puesto,
      e.area,
      String(e.resultado.puntajeFinal),
      { content: e.resultado.nivel, styles: { textColor: TONE_RGB[e.resultado.tone] ?? [0, 0, 0], fontStyle: 'bold' as const } },
    ]),
    margin: { left: 14, right: 14 },
  });

  // Pie con paginación
  const totalPages = (pdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7); pdf.setTextColor(150);
    pdf.text(`${empresa.institucion} — Informe global ${metodo} · Página ${i} de ${totalPages}`, 14, pageH - 8);
  }

  pdf.save(`Informe_Global_${metodo}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
