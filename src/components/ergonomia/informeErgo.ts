// Genera el informe PDF de una evaluación ergonómica.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EvaluacionErgonomica } from '../../types/ergonomia';
import type { DatosEmpresa } from '../../contexts/EmpresaContext';
import { METODOS } from '../../utils/ergonomia/definiciones';
import { toDate } from '../../services/atenciones';
import { cargarLogoParaPdf } from '../../utils/logoPdf';

const TONE_RGB: Record<string, [number, number, number]> = {
  success: [16, 160, 90],
  warning: [224, 138, 44],
  danger: [220, 46, 60],
};

// Etiquetas legibles de los puntajes intermedios (resultado.detalle)
const DETALLE_LABEL: Record<string, string> = {
  posturaA: 'Postura grupo A', puntajeA: 'Puntaje grupo A',
  posturaB: 'Postura grupo B', puntajeB: 'Puntaje grupo B', puntajeC: 'Puntaje C',
  RWL: 'Peso límite recomendado — RWL (kg)', LI: 'Índice de levantamiento (LI)',
  HM: 'Multiplicador horizontal (HM)', VM: 'Multiplicador vertical (VM)',
  DM: 'Multiplicador de desplazamiento (DM)', AM: 'Multiplicador de asimetría (AM)',
  FM: 'Multiplicador de frecuencia (FM)', CM: 'Multiplicador de agarre (CM)',
  silla: 'Puntaje silla', monitorTelefono: 'Monitor y teléfono',
  ratonTeclado: 'Ratón y teclado', perifericos: 'Periféricos y pantalla',
};

export async function generarInformeErgo(
  ev: EvaluacionErgonomica,
  empresa: DatosEmpresa,
  logo: { data: string; format: string },
) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = pdf.internal.pageSize.width;

  // Encabezado
  try { pdf.addImage(logo.data, logo.format, 14, 10, 28, 12); } catch { /* sin logo */ }
  pdf.setFontSize(13); pdf.setFont('helvetica', 'bold');
  pdf.text(empresa.institucion, 46, 15);
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
  pdf.text(`RUC: ${empresa.ruc}  ·  ${empresa.establecimiento}`, 46, 20);
  pdf.setFontSize(14); pdf.setFont('helvetica', 'bold');
  pdf.text('Informe de Evaluación Ergonómica', 14, 32);
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal');
  const f = toDate(ev.fecha);
  pdf.text(`Método: ${ev.metodo}   ·   Fecha: ${isNaN(f.getTime()) ? '—' : f.toLocaleDateString('es-EC')}`, 14, 38);

  // Datos del trabajador
  autoTable(pdf, {
    startY: 42,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    head: [['Trabajador', 'Cédula', 'Puesto', 'Área']],
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
    body: [[`${ev.apellidos} ${ev.nombres}`, ev.cedula, ev.puesto, ev.area]],
    margin: { left: 14, right: 14 },
  });
  let y = (pdf as any).lastAutoTable.finalY + 4;

  if (ev.tarea) {
    pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.text('Tarea evaluada:', 14, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(pdf.splitTextToSize(ev.tarea, W - 50), 45, y);
    y += 7;
  }

  // Resultado destacado
  const rgb = TONE_RGB[ev.resultado.tone] ?? [100, 100, 100];
  pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
  pdf.rect(14, y, W - 28, 16, 'F');
  pdf.setTextColor(255); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
  pdf.text(`Puntaje ${ev.metodo}: ${ev.resultado.puntajeFinal}  —  ${ev.resultado.nivel}`, 18, y + 7);
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
  pdf.text(ev.resultado.accion, 18, y + 12);
  pdf.setTextColor(0);
  y += 22;

  // Tabla de puntajes por segmento
  const campos = METODOS[ev.metodo].campos;
  const filas = campos.map((c) => {
    const val = ev.entradas[c.key];
    if (c.tipo === 'numero') return [c.label, `${val ?? '—'}${c.unidad ? ' ' + c.unidad : ''}`];
    const op = c.opciones?.find((o) => o.valor === val);
    return [c.label, op ? `${val} · ${op.label}` : String(val ?? '—')];
  });
  autoTable(pdf, {
    startY: y,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 1.8 },
    head: [['Segmento / factor', 'Puntaje']],
    headStyles: { fillColor: [16, 160, 90], textColor: 255, fontSize: 8 },
    columnStyles: { 1: { halign: 'center', cellWidth: 30 } },
    body: filas,
    margin: { left: 14, right: 14 },
  });
  y = (pdf as any).lastAutoTable.finalY + 4;

  // Puntajes intermedios del método (silla, grupos A/B, multiplicadores, etc.)
  const detalle = Object.entries(ev.resultado.detalle ?? {});
  if (detalle.length > 0) {
    autoTable(pdf, {
      startY: y,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 1.8 },
      head: [['Puntaje intermedio', 'Valor']],
      headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 8 },
      columnStyles: { 1: { halign: 'center', cellWidth: 30 } },
      body: detalle.map(([k, v]) => [DETALLE_LABEL[k] ?? k, String(v)]),
      margin: { left: 14, right: 14 },
    });
    y = (pdf as any).lastAutoTable.finalY + 5;
  }

  // Si queda poco espacio, continuar en página nueva
  if ((ev.observaciones || ev.recomendaciones) && y > pdf.internal.pageSize.height - 45) {
    pdf.addPage(); y = 16;
  }

  if (ev.observaciones) {
    pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.text('Observaciones', 14, y); y += 4;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
    const t = pdf.splitTextToSize(ev.observaciones, W - 28);
    pdf.text(t, 14, y); y += t.length * 4 + 3;
  }
  if (ev.recomendaciones) {
    pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.text('Recomendaciones', 14, y); y += 4;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
    const t = pdf.splitTextToSize(ev.recomendaciones, W - 28);
    pdf.text(t, 14, y);
  }

  // Pie
  pdf.setFontSize(7); pdf.setTextColor(150);
  pdf.text(`Generado por ${ev.medicoNombre || 'Servicio Médico Ocupacional'} — ${empresa.institucion}`, 14, pdf.internal.pageSize.height - 8);

  // Fotos anotadas (cada una en su página)
  for (const foto of ev.fotos ?? []) {
    const im = await cargarLogoParaPdf(foto.url);
    if (!im) continue;
    try {
      pdf.addPage();
      pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
      pdf.text('Foto de la evaluación', 14, 16);
      const props = pdf.getImageProperties(im.data);
      const maxW = W - 28;
      const maxH = pdf.internal.pageSize.height - 30;
      let w = maxW, h = (props.height / props.width) * w;
      if (h > maxH) { h = maxH; w = (props.width / props.height) * h; }
      pdf.addImage(im.data, im.format, 14, 22, w, h);
    } catch (err) { console.warn('No se pudo añadir una foto al PDF:', err); }
  }

  pdf.save(`Ergonomia_${ev.metodo}_${ev.apellidos}_${ev.nombres}.pdf`.replace(/\s+/g, '_'));
}
