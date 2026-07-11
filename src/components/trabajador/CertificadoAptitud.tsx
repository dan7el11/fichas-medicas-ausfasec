// CERTIFICADO DE APTITUD MÉDICO LABORAL (SO-RE-20).
// Anexo a cualquier evaluación ocupacional: se autocompleta desde la evaluación
// (tipo, aptitud, observaciones, limitaciones, sección de retiro y
// recomendaciones), se guarda dentro del documento de la evaluación y genera
// un PDF de 1 página fiel a la hoja oficial.
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../../services/firebase';
import { registrarAuditoria } from '../../services/auditoria';
import type { CertificadoAptitud, LimitacionCertificado } from '../../types';

type LogoPdf = { data: string; format: string };

const APTITUDES: { value: CertificadoAptitud['aptitud']; label: string }[] = [
  { value: 'apto', label: 'APTO' },
  { value: 'aptoObservacion', label: 'APTO EN OBSERVACIÓN' },
  { value: 'aptoLimitaciones', label: 'APTO CON LIMITACIONES' },
  { value: 'noApto', label: 'NO APTO' },
];

const TIPOS_EVALUACION: CertificadoAptitud['tipoEvaluacion'][] = ['INGRESO', 'PERIÓDICO', 'REINTEGRO', 'RETIRO'];

const fmtF = (fecha: any): string => {
  if (!fecha) return '-';
  const d = fecha?.seconds ? new Date(fecha.seconds * 1000) : fecha instanceof Date ? fecha : new Date(fecha);
  return isNaN(d.getTime()) ? String(fecha) : d.toLocaleDateString('es-EC');
};

/** Construye el certificado inicial a partir de la evaluación (autocompletado). */
export function certificadoDesdeEvaluacion(ev: any): CertificadoAptitud {
  if (ev.certificadoAptitud) {
    // Ya tiene certificado guardado: se edita sobre él.
    return { limitaciones: [], ...ev.certificadoAptitud };
  }
  const esRetiro = ev.tipo === 'RETIRO';
  const tipoEvaluacion: CertificadoAptitud['tipoEvaluacion'] = esRetiro ? 'RETIRO'
    : String(ev.tipoEvaluacion || '').toLowerCase().includes('preocupacional') ? 'INGRESO'
    : String(ev.tipoEvaluacion || '').toLowerCase().includes('reintegro') ? 'REINTEGRO'
    : 'PERIÓDICO';
  const dxs: any[] = Array.isArray(ev.diagnosticos) ? ev.diagnosticos : [];
  const recTexto = (Array.isArray(ev.recomendaciones) ? ev.recomendaciones.join('\n') : (ev.recomendaciones || ''))
    + (ev.recomendacionesOtras ? `\n${ev.recomendacionesOtras}` : '');
  return {
    fechaEmision: new Date().toISOString().slice(0, 10),
    tipoEvaluacion,
    aptitud: ev.aptitudMedica || 'apto',
    observaciones: ev.aptitudObservacion || '',
    limitaciones: ev.aptitudLimitaciones
      ? [{ actividad: ev.aptitudLimitaciones, severidad: 'MODERADA' }]
      : [],
    retiroRealizada: esRetiro ? (ev.evaluacionRealizada ?? true) : null,
    retiroCondicionDiagnostico: esRetiro
      ? (dxs.some(d => d.tipo === 'definitivo') ? 'definitiva' : dxs.length > 0 ? 'presuntiva' : 'noAplica')
      : 'noAplica',
    retiroRelacionadaTrabajo: esRetiro ? 'no' : 'noAplica',
    recomendaciones: recTexto.trim(),
  };
}

// ── PDF SO-RE-20 (1 página) ──────────────────────────────────────────────────
export function generarPDFCertificado(cert: CertificadoAptitud, ev: any, trabajador: any, empresa: any, logoPdf: LogoPdf) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const M = 7;
  const CW = W - M * 2;
  let y = 7;

  const colorPrimario = '#ccccff';
  const colorSecundario = '#ccffcc';
  const negro: [number, number, number] = [0, 0, 0];
  const base = { lineColor: negro, lineWidth: 0.25, fontSize: 6.5, cellPadding: 1.2, textColor: negro };
  const head = { fillColor: colorSecundario, textColor: negro, fontStyle: 'bold' as const, fontSize: 6.5, lineColor: negro, lineWidth: 0.25, cellPadding: 1.2 };

  const AT = (opts: any) => { autoTable(pdf, opts); y = (pdf as any).lastAutoTable.finalY; };

  const secHeader = (texto: string, bgColor = colorPrimario) => {
    pdf.setFillColor(bgColor); pdf.setDrawColor(0);
    pdf.rect(M, y, CW, 5, 'FD');
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
    pdf.text(texto, M + 1.5, y + 3.5);
    y += 5;
  };

  const textoLibre = (texto: string, minH = 8) => {
    pdf.setDrawColor(0); pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(0);
    const lines = pdf.splitTextToSize(texto || '-', CW - 3);
    const h = Math.max(minH, lines.length * 3 + 2);
    pdf.rect(M, y, CW, h, 'S');
    pdf.text(lines, M + 1.5, y + 3);
    y += h;
  };

  // Encabezado con logo
  const tableStartY = y;
  AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, halign: 'center', fontSize: 8 }, columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 33 } }, body: [
    [{ content: '', rowSpan: 3, styles: { fontSize: 11, valign: 'middle' } }, { content: 'CERTIFICADO DE APTITUD\nMÉDICO LABORAL', rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 10, valign: 'middle' } }, { content: 'Código:   SO-RE-20', styles: { fontSize: 7, halign: 'left' } }],
    [{ content: 'Revisión:  2', styles: { fontSize: 7, halign: 'left' } }],
    [{ content: 'MACROPROCESO: PLANIFICACIÓN, SEGURIDAD Y AMBIENTE', styles: { fontSize: 6, fontStyle: 'bold' } }, { content: 'Página:   1 de 1', styles: { fontSize: 7, halign: 'left' } }],
  ] });
  pdf.addImage(logoPdf.data, logoPdf.format, M + 1, tableStartY + 1, 40, 12);
  y += 2;

  // A. Datos
  secHeader('A. DATOS DEL ESTABLECIMIENTO - EMPRESA Y USUARIO');
  AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head, head: [['INSTITUCIÓN DEL SISTEMA O NOMBRE DE LA EMPRESA', 'RUC', 'CIIU', 'ESTABLECIMIENTO DE SALUD', 'N° HISTORIA CLÍNICA', 'N° ARCHIVO']], body: [[empresa.institucion, empresa.ruc, empresa.ciu, empresa.establecimiento, ev.numeroHistoriaClinica || trabajador.cedula, ev.numeroArchivo || trabajador.cedula]] });
  AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: base, headStyles: head, head: [['PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'SEXO', 'PUESTO DE TRABAJO (CIUO)']], body: [[trabajador.primerApellido, trabajador.segundoApellido || '-', trabajador.primerNombre, trabajador.segundoNombre || '-', trabajador.sexo, trabajador.puestoTrabajo]] });
  y += 2;

  // B. Datos generales
  secHeader('B. DATOS GENERALES');
  const [anio, mes, dia] = (cert.fechaEmision || '').split('-');
  AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5 }, body: [[
    { content: 'FECHA DE EMISIÓN:', styles: { fontStyle: 'bold', cellWidth: 40 } },
    { content: `aaaa: ${anio || '-'}`, styles: { halign: 'center' } },
    { content: `mm: ${mes || '-'}`, styles: { halign: 'center' } },
    { content: `dd: ${dia || '-'}`, styles: { halign: 'center' } },
  ]] });
  AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5, halign: 'center' }, body: [[
    { content: 'EVALUACIÓN:', styles: { fontStyle: 'bold', halign: 'left', cellWidth: 40 } },
    ...TIPOS_EVALUACION.flatMap(t => ([
      { content: t, styles: { fontStyle: 'bold' as const } },
      { content: cert.tipoEvaluacion === t ? 'X' : '', styles: { fontStyle: 'bold' as const, cellWidth: 8 } },
    ])),
  ]] });
  y += 2;

  // C. Aptitud
  secHeader('C. APTITUD MÉDICA LABORAL');
  pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setDrawColor(0);
  pdf.rect(M, y, CW, 5, 'S');
  pdf.text('Después de la valoración médica ocupacional se certifica que la persona en mención, es calificada como:', M + 1.5, y + 3.3);
  y += 5;
  AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, halign: 'center', fontSize: 7 }, body: [
    APTITUDES.flatMap(a => ([
      { content: a.label, styles: { fontStyle: 'bold' as const, fillColor: '#ccffff' } },
      { content: cert.aptitud === a.value ? 'X' : '', styles: { fontStyle: 'bold' as const, cellWidth: 8 } },
    ])),
  ] });
  AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5 }, headStyles: head, head: [['DETALLE DE OBSERVACIONES:']], body: [[cert.observaciones || 'Ninguna.']], bodyStyles: { minCellHeight: 10 } });

  // Tipo de limitación
  const lims = (cert.limitaciones || []).filter(l => l.actividad.trim());
  AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5 }, headStyles: { ...head, fontSize: 6 },
    head: [[{ content: 'TIPO DE LIMITACIÓN:', colSpan: 4, styles: { halign: 'left' } }], ['ACTIVIDAD', 'LEVE', 'MODERADA', 'GRAVE']],
    body: lims.length > 0
      ? lims.map(l => [l.actividad, l.severidad === 'LEVE' ? 'X' : '', l.severidad === 'MODERADA' ? 'X' : '', l.severidad === 'GRAVE' ? 'X' : ''])
      : [['Ninguna', '', '', '']],
    columnStyles: { 1: { halign: 'center', cellWidth: 18 }, 2: { halign: 'center', cellWidth: 18 }, 3: { halign: 'center', cellWidth: 18 } } });
  y += 2;

  // D. Evaluación médica de retiro
  secHeader('D. EVALUACIÓN MÉDICA DE RETIRO');
  const filaSiNo = (pregunta: string, opciones: [string, boolean][]) => ([
    { content: pregunta, styles: { fontStyle: 'bold' as const, cellWidth: 95 } },
    ...opciones.flatMap(([label, marcado]) => ([
      { content: label, styles: { fontStyle: 'bold' as const, halign: 'center' as const } },
      { content: marcado ? 'X' : '', styles: { fontStyle: 'bold' as const, halign: 'center' as const, cellWidth: 7 } },
    ])),
  ]);
  AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6 }, body: [
    filaSiNo('El usuario se realizó la evaluación médica de retiro', [['SI', cert.retiroRealizada === true], ['NO', cert.retiroRealizada === false], ['No aplica', cert.retiroRealizada === null]]),
    filaSiNo('Condición del diagnóstico', [['Presuntiva', cert.retiroCondicionDiagnostico === 'presuntiva'], ['Definitiva', cert.retiroCondicionDiagnostico === 'definitiva'], ['No aplica', cert.retiroCondicionDiagnostico === 'noAplica']]),
    filaSiNo('La condición de salud está relacionada con el trabajo', [['SI', cert.retiroRelacionadaTrabajo === 'si'], ['NO', cert.retiroRelacionadaTrabajo === 'no'], ['No aplica', cert.retiroRelacionadaTrabajo === 'noAplica']]),
  ] });
  y += 2;

  // E. Recomendaciones
  secHeader('E. RECOMENDACIONES');
  textoLibre(cert.recomendaciones || 'Ninguna particular al momento.', 12);
  y += 1;

  pdf.setFillColor(248, 248, 248); pdf.setDrawColor(0);
  const certText = 'Con este documento certifico que el trabajador se ha sometido a la evaluación médica requerida para (el ingreso / la ejecución / el reintegro y retiro) al puesto laboral y se ha informado sobre los riesgos relacionados con el trabajo emitiendo recomendaciones relacionadas con su estado de salud.\n\nLa presente certificación se expide con base en la historia ocupacional del usuario (a), la cual tiene carácter de confidencial.';
  const certLines = pdf.splitTextToSize(certText, CW - 3);
  const certH = certLines.length * 3 + 3;
  pdf.rect(M, y, CW, certH, 'FD');
  pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.text(certLines, M + 1.5, y + 3);
  y += certH + 3;

  // F/G. Firmas
  secHeader('F. DATOS DEL PROFESIONAL DE SALUD                                                          G. FIRMA DEL USUARIO');
  AT({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...base, fontSize: 6.5, halign: 'center' }, headStyles: { ...head, fontSize: 6, halign: 'center' }, head: [['NOMBRE Y APELLIDO', 'CÓDIGO', 'FIRMA Y SELLO', 'FIRMA DEL USUARIO']], body: [[(ev.medicoNombre || 'MÉDICO OCUPACIONAL').toUpperCase(), ev.medicoCedula || '-', '', '']], bodyStyles: { minCellHeight: 20, valign: 'bottom', halign: 'center' } });

  pdf.save(`SO-RE-20_CERTIFICADO_${trabajador.primerApellido}_${trabajador.primerNombre}_${cert.fechaEmision || fmtF(ev.fecha)}.pdf`.replace(/\s+/g, '_'));
}

// ── Modal ────────────────────────────────────────────────────────────────────
interface Props {
  evaluacion: any;           // evaluación (con id) a la que se anexa el certificado
  trabajador: any;
  empresa: any;
  logoPdf: LogoPdf;
  onClose: () => void;
  /** Se llama con el certificado guardado para refrescar el estado local. */
  onGuardado?: (cert: CertificadoAptitud) => void;
}

export default function CertificadoAptitudModal({ evaluacion, trabajador, empresa, logoPdf, onClose, onGuardado }: Props) {
  const [cert, setCert] = useState<CertificadoAptitud>(() => certificadoDesdeEvaluacion(evaluacion));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const esRetiro = cert.tipoEvaluacion === 'RETIRO';
  const patch = (p: Partial<CertificadoAptitud>) => setCert(prev => ({ ...prev, ...p }));
  const patchLim = (idx: number, p: Partial<LimitacionCertificado>) =>
    setCert(prev => ({ ...prev, limitaciones: prev.limitaciones.map((l, i) => i === idx ? { ...l, ...p } : l) }));

  const guardarYGenerar = async () => {
    setGuardando(true);
    setError('');
    try {
      const certLimpio: CertificadoAptitud = { ...cert, limitaciones: cert.limitaciones.filter(l => l.actividad.trim()) };
      if (evaluacion.id) {
        await updateDoc(doc(db, 'evaluaciones', evaluacion.id), { certificadoAptitud: certLimpio });
        await registrarAuditoria('editar', 'evaluacion', evaluacion.id, `Certificado de aptitud (SO-RE-20) de ${trabajador.primerApellido} ${trabajador.primerNombre}`);
      }
      generarPDFCertificado(certLimpio, evaluacion, trabajador, empresa, logoPdf);
      onGuardado?.(certLimpio);
      onClose();
    } catch (err) {
      console.error('Error al guardar el certificado:', err);
      setError('No se pudo guardar el certificado. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-xl shadow-2xl md:max-w-3xl md:max-h-[92vh] flex flex-col">
        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50 shrink-0 md:rounded-t-xl">
          <div>
            <h2 className="m-0 text-base font-bold text-slate-800">Certificado de Aptitud Médico Laboral</h2>
            <p className="m-0 text-xs text-slate-500">SO-RE-20 · anexo a la evaluación del {fmtF(evaluacion.fecha)} · {trabajador.primerApellido} {trabajador.primerNombre}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <p className="m-0 text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            Los datos se autocompletaron desde la evaluación. Revisa, ajusta lo necesario y genera el PDF.
          </p>

          {/* B. Datos generales */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 mb-2 border-b pb-1.5">B. DATOS GENERALES</h3>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de emisión</label>
                <input type="date" value={cert.fechaEmision} onChange={e => patch({ fechaEmision: e.target.value })} className={inputCls} />
              </div>
              <div className="flex-1 min-w-[260px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Evaluación</label>
                <div className="flex gap-2 flex-wrap">
                  {TIPOS_EVALUACION.map(t => (
                    <label key={t} className={`px-3 py-2 border-2 rounded-lg cursor-pointer text-xs font-bold transition-colors ${cert.tipoEvaluacion === t ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'}`}>
                      <input type="radio" className="hidden" checked={cert.tipoEvaluacion === t} onChange={() => patch({ tipoEvaluacion: t })} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* C. Aptitud */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 mb-2 border-b pb-1.5">C. APTITUD MÉDICA LABORAL</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              {APTITUDES.map(a => (
                <label key={a.value} className={`flex items-center justify-center p-2.5 rounded-lg border-2 cursor-pointer text-xs font-bold text-center transition-colors ${cert.aptitud === a.value ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'}`}>
                  <input type="radio" className="hidden" checked={cert.aptitud === a.value} onChange={() => patch({ aptitud: a.value })} />
                  {a.label}
                </label>
              ))}
            </div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Detalle de observaciones</label>
            <textarea rows={2} value={cert.observaciones} onChange={e => patch({ observaciones: e.target.value })} className={inputCls} placeholder="Ninguna." />

            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600">Tipo de limitación (actividad + severidad)</label>
                <button type="button" onClick={() => setCert(prev => ({ ...prev, limitaciones: [...prev.limitaciones, { actividad: '', severidad: 'LEVE' }] }))} className="text-blue-600 text-xs font-bold hover:underline">+ Agregar limitación</button>
              </div>
              {cert.limitaciones.length === 0 && <p className="text-xs text-slate-400 italic m-0">Sin limitaciones.</p>}
              <div className="space-y-1.5">
                {cert.limitaciones.map((l, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input type="text" placeholder="Actividad limitada" value={l.actividad} onChange={e => patchLim(idx, { actividad: e.target.value })} className={inputCls + ' flex-1'} />
                    <select value={l.severidad} onChange={e => patchLim(idx, { severidad: e.target.value as any })} className="px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                      <option value="LEVE">Leve</option>
                      <option value="MODERADA">Moderada</option>
                      <option value="GRAVE">Grave</option>
                    </select>
                    <button type="button" onClick={() => setCert(prev => ({ ...prev, limitaciones: prev.limitaciones.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-600 font-bold px-1">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* D. Evaluación médica de retiro */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 mb-2 border-b pb-1.5">D. EVALUACIÓN MÉDICA DE RETIRO {!esRetiro && <span className="font-normal text-slate-400">(no aplica para esta evaluación)</span>}</h3>
            <div className="space-y-2.5">
              <FilaOpciones
                pregunta="El usuario se realizó la evaluación médica de retiro"
                opciones={[['SI', cert.retiroRealizada === true], ['NO', cert.retiroRealizada === false], ['No aplica', cert.retiroRealizada === null]]}
                onSelect={(i) => patch({ retiroRealizada: i === 0 ? true : i === 1 ? false : null })}
              />
              <FilaOpciones
                pregunta="Condición del diagnóstico"
                opciones={[['Presuntiva', cert.retiroCondicionDiagnostico === 'presuntiva'], ['Definitiva', cert.retiroCondicionDiagnostico === 'definitiva'], ['No aplica', cert.retiroCondicionDiagnostico === 'noAplica']]}
                onSelect={(i) => patch({ retiroCondicionDiagnostico: i === 0 ? 'presuntiva' : i === 1 ? 'definitiva' : 'noAplica' })}
              />
              <FilaOpciones
                pregunta="La condición de salud está relacionada con el trabajo"
                opciones={[['SI', cert.retiroRelacionadaTrabajo === 'si'], ['NO', cert.retiroRelacionadaTrabajo === 'no'], ['No aplica', cert.retiroRelacionadaTrabajo === 'noAplica']]}
                onSelect={(i) => patch({ retiroRelacionadaTrabajo: i === 0 ? 'si' : i === 1 ? 'no' : 'noAplica' })}
              />
            </div>
          </div>

          {/* E. Recomendaciones */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 mb-2 border-b pb-1.5">E. RECOMENDACIONES</h3>
            <textarea rows={4} value={cert.recomendaciones} onChange={e => patch({ recomendaciones: e.target.value })} className={inputCls} placeholder="Una recomendación por línea..." />
          </div>

          {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-2 text-xs">{error}</div>}
        </div>

        {/* Pie */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t bg-slate-50 shrink-0 md:rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100">Ahora no</button>
          <button onClick={guardarYGenerar} disabled={guardando} className="px-5 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando…' : '📄 Guardar y generar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FilaOpciones({ pregunta, opciones, onSelect }: { pregunta: string; opciones: [string, boolean][]; onSelect: (idx: number) => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
      <span className="text-xs text-slate-700 font-medium flex-1">{pregunta}</span>
      <div className="flex gap-1.5">
        {opciones.map(([label, activo], i) => (
          <button key={label} type="button" onClick={() => onSelect(i)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${activo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
