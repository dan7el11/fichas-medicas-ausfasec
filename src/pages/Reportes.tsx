// Página: Reportes y estadísticas. Ruta /reportes.
// Restyle v2 (tema central): Spectral en títulos, mono en datos, neutros fríos.
// Acento del módulo: verde. NINGÚN cambio funcional (export PDF/Excel intacto).
import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import TopBar from '../components/dashboard/TopBar';
import { useNavigate } from 'react-router-dom';
import { workerStatus, lastEval, parseDate } from '../utils/medicalHelpers';
import type { Trabajador, EvaluacionMedica } from '../types';
import { FileSpreadsheet, FileText, AlertTriangle, Users, CheckCircle2, Clock, XCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COLORS, FONTS } from '../theme';

const ACCENT = COLORS.green;

const TONE_COLOR: Record<string, [number, number, number]> = {
  success: [16, 160, 90],
  warning: [224, 138, 44],
  danger: [220, 46, 60],
  muted: [148, 162, 179],
};

export default function Reportes() {
  const navigate = useNavigate();
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionMedica[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const tSnap = await getDocs(collection(db, 'trabajadores'));
      const eSnap = await getDocs(collection(db, 'evaluaciones'));
      setTrabajadores(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Trabajador)));
      setEvaluaciones(eSnap.docs.map(d => ({ id: d.id, ...d.data() } as EvaluacionMedica)));
      setCargando(false);
    };
    fetchData();
  }, []);

  const exportarMatrizGlobalExcel = () => {
    const rows = [['CÉDULA', 'APELLIDOS', 'NOMBRES', 'PUESTO', 'ESTADO', 'ÚLTIMA EVAL.', 'APTITUD', 'RESTRICCIONES']];
    trabajadores.forEach(t => {
      const evals = evaluaciones.filter(e => e.trabajadorId === t.id);
      const le = lastEval(evals);
      const ws = workerStatus(evals);
      rows.push([
        t.cedula,
        `${t.primerApellido} ${t.segundoApellido || ''}`,
        `${t.primerNombre} ${t.segundoNombre || ''}`,
        t.puestoTrabajo,
        ws.label,
        le ? parseDate(le.fecha).toLocaleDateString('es-EC') : 'Ninguna',
        le?.aptitudMedica || '-',
        le?.aptitudLimitaciones || le?.aptitudObservacion || '-',
      ]);
    });
    const csvContent = "﻿" + rows.map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "Matriz_Ocupacional_Global.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarMatrizPDF = () => {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const fecha = new Date().toLocaleDateString('es-EC');

    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CEM AUSTROGAS — Matriz de Estado Ocupacional', 14, 14);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generado: ${fecha}  |  Total trabajadores: ${trabajadores.length}`, 14, 20);

    const body: any[][] = trabajadores.map(t => {
      const evals = evaluaciones.filter(e => e.trabajadorId === t.id);
      const le = lastEval(evals);
      const ws = workerStatus(evals);
      const color = TONE_COLOR[ws.tone] ?? [100, 100, 100];
      return [
        t.cedula,
        `${t.primerApellido} ${t.segundoApellido || ''}`,
        `${t.primerNombre} ${t.segundoNombre || ''}`,
        t.puestoTrabajo,
        { content: ws.label, styles: { textColor: color, fontStyle: 'bold' } },
        le ? parseDate(le.fecha).toLocaleDateString('es-EC') : 'Ninguna',
        ws.dias !== null ? (ws.dias < 0 ? `Venció hace ${Math.abs(ws.dias)}d` : `${ws.dias}d restantes`) : '-',
        le?.aptitudLimitaciones || le?.aptitudObservacion || '-',
      ];
    });

    autoTable(pdf, {
      startY: 24,
      head: [['CÉDULA', 'APELLIDOS', 'NOMBRES', 'PUESTO', 'ESTADO', 'ÚLTIMA EVAL.', 'DÍAS REST.', 'RESTRICCIONES']],
      body,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [154, 48, 54], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 32 },
        2: { cellWidth: 28 },
        3: { cellWidth: 40 },
        4: { cellWidth: 24 },
        5: { cellWidth: 22 },
        6: { cellWidth: 22 },
        7: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14 },
    });

    const totalPages = (pdf as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7);
      pdf.setTextColor(150);
      pdf.text(`Página ${i} de ${totalPages}`, pdf.internal.pageSize.width - 30, pdf.internal.pageSize.height - 8);
    }

    pdf.save(`Matriz_Ocupacional_${fecha.replace(/\//g, '-')}.pdf`);
  };

  if (cargando) return <div className="min-h-screen grid place-items-center font-bold" style={{ background: COLORS.bg, color: COLORS.faint }}>Calculando estadísticas…</div>;

  const evals = (t: Trabajador) => evaluaciones.filter(e => e.trabajadorId === t.id);
  const aptos = trabajadores.filter(t => workerStatus(evals(t)).tone === 'success').length;
  const porVencer = trabajadores.filter(t => workerStatus(evals(t)).tone === 'warning').length;
  const vencidas = trabajadores.filter(t => workerStatus(evals(t)).tone === 'danger').length;
  const sinEval = trabajadores.filter(t => workerStatus(evals(t)).label === 'Sin evaluación').length;
  const hoy = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: COLORS.bg, color: COLORS.ink, fontFamily: FONTS.sans }}>
      <TopBar onNewWorker={() => navigate('/nuevo-trabajador')} />
      <div className="p-6 md:p-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-6">
          <div>
            <div className="text-[11px] font-semibold uppercase" style={{ color: COLORS.brand, letterSpacing: '1.4px' }}>
              {hoy.charAt(0).toUpperCase() + hoy.slice(1)}
            </div>
            <h1 className="mt-1.5 mb-0 text-[28px] font-bold tracking-tight" style={{ fontFamily: FONTS.serif }}>Reportes y estadísticas</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={exportarMatrizGlobalExcel} className="px-4 py-2.5 text-white font-bold rounded-[9px] shadow-sm flex items-center gap-2 text-[13px] cursor-pointer border-none" style={{ background: ACCENT }}>
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button onClick={exportarMatrizPDF} className="px-4 py-2.5 text-white font-bold rounded-[9px] shadow-sm flex items-center gap-2 text-[13px] cursor-pointer border-none" style={{ background: COLORS.brand }}>
              <FileText size={16} /> PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total plantilla" value={trabajadores.length} icon={<Users size={16} />} tone="muted" />
          <StatCard label="Aptos vigentes" value={aptos} icon={<CheckCircle2 size={16} />} tone="success" />
          <StatCard label="Por vencer / restric." value={porVencer} icon={<Clock size={16} />} tone="warning" pulse={porVencer > 0} />
          <StatCard label="Vencidas / no aptos" value={vencidas} icon={<XCircle size={16} />} tone="danger" pulse={vencidas > 0} />
        </div>

        {sinEval > 0 && (
          <div className="mb-6 rounded-[12px] px-5 py-4 flex items-center gap-3 border" style={{ background: COLORS.warnBg, borderColor: '#ecdcc0' }}>
            <AlertTriangle size={22} style={{ color: COLORS.warn }} />
            <div>
              <p className="m-0 text-[13px] font-bold" style={{ color: COLORS.warn }}>{sinEval} trabajador{sinEval === 1 ? '' : 'es'} sin evaluación registrada</p>
              <p className="m-0 text-[12px] mt-0.5" style={{ color: '#a06a2a' }}>Estos trabajadores no cuentan con ninguna historia clínica ocupacional en el sistema.</p>
            </div>
          </div>
        )}

        <div className="rounded-[14px] border overflow-hidden" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
          <div className="px-5 py-3.5 border-b flex items-center gap-2.5" style={{ borderColor: COLORS.line }}>
            <span className="grid place-items-center w-[28px] h-[28px] rounded-lg" style={{ background: COLORS.greenBg, color: ACCENT }}><Users size={15} /></span>
            <h2 className="m-0 text-[15px] font-semibold" style={{ fontFamily: FONTS.serif }}>Matriz de estado — todos los trabajadores</h2>
            <span className="ml-auto text-[12px]" style={{ fontFamily: FONTS.mono, color: COLORS.faint }}>{trabajadores.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b" style={{ background: COLORS.bg, borderColor: COLORS.line }}>
                  {['Cédula', 'Apellidos', 'Nombres', 'Puesto', 'Estado', 'Última eval.', 'Días rest.', 'Restricciones'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-bold uppercase tracking-wide whitespace-nowrap text-[10.5px]" style={{ color: COLORS.faint }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trabajadores.map((t, i) => {
                  const ev = evals(t);
                  const le = lastEval(ev);
                  const ws = workerStatus(ev);
                  const tn = ws.tone === 'success' ? { fg: COLORS.ok, bg: COLORS.okBg } : ws.tone === 'warning' ? { fg: COLORS.warn, bg: COLORS.warnBg } : ws.tone === 'danger' ? { fg: COLORS.bad, bg: COLORS.badBg } : { fg: COLORS.muted, bg: COLORS.bg };
                  return (
                    <tr key={t.id} style={{ borderTop: i > 0 ? `1px solid ${COLORS.line}` : 'none' }} className="hover:bg-[#faf7f8] transition-colors">
                      <td className="px-3 py-2" style={{ fontFamily: FONTS.mono, color: COLORS.muted }}>{t.cedula}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: COLORS.ink }}>{t.primerApellido} {t.segundoApellido || ''}</td>
                      <td className="px-3 py-2" style={{ color: COLORS.muted }}>{t.primerNombre} {(t as any).segundoNombre || ''}</td>
                      <td className="px-3 py-2 max-w-[140px] truncate" style={{ color: COLORS.muted }}>{t.puestoTrabajo}</td>
                      <td className="px-3 py-2"><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ color: tn.fg, background: tn.bg }}>{ws.label}</span></td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ fontFamily: FONTS.mono, color: COLORS.muted }}>{le ? parseDate(le.fecha).toLocaleDateString('es-EC') : '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ fontFamily: FONTS.mono, color: COLORS.muted }}>{ws.dias !== null ? (ws.dias < 0 ? <span className="font-semibold" style={{ color: COLORS.bad }}>Venció hace {Math.abs(ws.dias)}d</span> : `${ws.dias}d`) : '—'}</td>
                      <td className="px-3 py-2 max-w-[160px] truncate" style={{ color: COLORS.faint }}>{le?.aptitudLimitaciones || le?.aptitudObservacion || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, tone, pulse }: { label: string; value: number; icon: ReactNode; tone: 'success' | 'warning' | 'danger' | 'muted'; pulse?: boolean }) {
  const map = {
    success: { fg: COLORS.ok, bg: COLORS.okBg }, warning: { fg: COLORS.warn, bg: COLORS.warnBg },
    danger: { fg: COLORS.bad, bg: COLORS.badBg }, muted: { fg: COLORS.ink, bg: COLORS.bg },
  } as const;
  const t = map[tone];
  return (
    <div className="rounded-[14px] border p-[16px_18px] relative overflow-hidden flex items-center gap-3" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
      {pulse && value > 0 && <span className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background: t.fg }} />}
      <span className="grid place-items-center w-[34px] h-[34px] rounded-[9px] flex-shrink-0" style={{ background: t.bg, color: t.fg }}>{icon}</span>
      <div>
        <p className="m-0 text-[28px] font-bold tracking-tight leading-none" style={{ fontFamily: FONTS.mono, color: t.fg }}>{value}</p>
        <h3 className="m-0 font-semibold text-[11px] mt-1.5 uppercase tracking-wide" style={{ color: COLORS.faint }}>{label}</h3>
      </div>
    </div>
  );
}
