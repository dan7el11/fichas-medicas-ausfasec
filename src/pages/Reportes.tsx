import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import TopBar from '../components/dashboard/TopBar';
import { useNavigate } from 'react-router-dom';
import { workerStatus, lastEval, parseDate } from '../utils/medicalHelpers';
import type { Trabajador, EvaluacionMedica } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
      headStyles: { fillColor: [10, 107, 59], textColor: 255, fontStyle: 'bold', fontSize: 7 },
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

  if (cargando) return <div className="p-10 text-center font-bold text-slate-500">Calculando estadísticas...</div>;

  const evals = (t: Trabajador) => evaluaciones.filter(e => e.trabajadorId === t.id);
  const aptos = trabajadores.filter(t => workerStatus(evals(t)).tone === 'success').length;
  const porVencer = trabajadores.filter(t => workerStatus(evals(t)).tone === 'warning').length;
  const vencidas = trabajadores.filter(t => workerStatus(evals(t)).tone === 'danger').length;
  const sinEval = trabajadores.filter(t => workerStatus(evals(t)).label === 'Sin evaluación').length;

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex flex-col">
      <TopBar onNewWorker={() => navigate('/nuevo-trabajador')} />
      <div className="p-6 md:p-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Módulo de Reportes</h1>
          <div className="flex gap-2 flex-wrap">
            <button onClick={exportarMatrizGlobalExcel} className="px-4 py-2 bg-[#107c41] text-white font-semibold rounded-lg hover:bg-[#0c5c30] shadow-sm flex items-center gap-2 text-sm">
              📊 Excel
            </button>
            <button onClick={exportarMatrizPDF} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 shadow-sm flex items-center gap-2 text-sm">
              📄 PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Plantilla" value={trabajadores.length} color="text-slate-800" />
          <StatCard label="Aptos vigentes" value={aptos} color="text-green-600" />
          <StatCard label="Por vencer / Restric." value={porVencer} color="text-amber-600" pulse={porVencer > 0} />
          <StatCard label="Vencidas / No aptos" value={vencidas} color="text-red-600" pulse={vencidas > 0} />
        </div>

        {sinEval > 0 && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-sm font-bold text-orange-800">{sinEval} trabajador{sinEval === 1 ? '' : 'es'} sin evaluación registrada</p>
              <p className="text-xs text-orange-700 mt-0.5">Estos trabajadores no cuentan con ninguna historia clínica ocupacional en el sistema.</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Matriz de estado — todos los trabajadores</h2>
            <span className="text-xs text-slate-400">{trabajadores.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Cédula', 'Apellidos', 'Nombres', 'Puesto', 'Estado', 'Última eval.', 'Días rest.', 'Restricciones'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trabajadores.map(t => {
                  const ev = evals(t);
                  const le = lastEval(ev);
                  const ws = workerStatus(ev);
                  const colorCls = ws.tone === 'success' ? 'text-green-700 bg-green-50' : ws.tone === 'warning' ? 'text-amber-700 bg-amber-50' : ws.tone === 'danger' ? 'text-red-700 bg-red-50' : 'text-slate-500 bg-slate-50';
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 font-mono text-slate-600">{t.cedula}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{t.primerApellido} {t.segundoApellido || ''}</td>
                      <td className="px-3 py-2 text-slate-700">{t.primerNombre} {(t as any).segundoNombre || ''}</td>
                      <td className="px-3 py-2 text-slate-600 max-w-[140px] truncate">{t.puestoTrabajo}</td>
                      <td className="px-3 py-2"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${colorCls}`}>{ws.label}</span></td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{le ? parseDate(le.fecha).toLocaleDateString('es-EC') : '—'}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{ws.dias !== null ? (ws.dias < 0 ? <span className="text-red-600 font-semibold">Venció hace {Math.abs(ws.dias)}d</span> : `${ws.dias}d`) : '—'}</td>
                      <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate">{le?.aptitudLimitaciones || le?.aptitudObservacion || '—'}</td>
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

function StatCard({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) {
  return (
    <div className="bg-white p-5 rounded-xl border shadow-sm relative overflow-hidden">
      {pulse && value > 0 && <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
      <h3 className="text-slate-500 font-semibold text-xs">{label}</h3>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
