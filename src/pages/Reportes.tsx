// Página: Reportes y estadísticas. Ruta /reportes.
// Tres secciones: Estado ocupacional (matriz + vencimientos), Morbilidad
// (diagnósticos CIE-10, tendencia y consumo de consultas) y Ausentismo &
// riesgo (permisos, días perdidos y perfil metabólico de la plantilla).
import type { ReactNode } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import TopBar from '../components/dashboard/TopBar';
import { useNavigate } from 'react-router-dom';
import { useEmpresa } from '../contexts/EmpresaContext';
import { workerStatus, lastEval, parseDate, venceEn, areaDeTrabajador, nombreCorto } from '../utils/medicalHelpers';
import type { Trabajador, EvaluacionMedica } from '../types';
import type { AtencionMedica } from '../types/atencion';
import type { PermisoMedico } from '../types/permiso';
import {
  toDate, topDiagnosticos, morbilidadCapitulos, tendenciaConsultas,
  ausentismoPorArea, distribucionTipoPermiso, tendenciaMensual, perfilMetabolico,
} from '../utils/reporteHelpers';
import {
  FileSpreadsheet, FileText, AlertTriangle, Users, CheckCircle2, Clock, XCircle,
  Stethoscope, Pill, BedDouble, CalendarClock, HeartPulse, Activity,
} from 'lucide-react';
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

type TabId = 'estado' | 'morbilidad' | 'ausentismo';
type PeriodoId = 'mes' | 'trimestre' | 'anio' | 'todo';

const PERIODOS: { id: PeriodoId; label: string }[] = [
  { id: 'mes', label: 'Este mes' },
  { id: 'trimestre', label: 'Últimos 3 meses' },
  { id: 'anio', label: 'Este año' },
  { id: 'todo', label: 'Histórico' },
];

function inicioPeriodo(p: PeriodoId): Date | null {
  const now = new Date();
  if (p === 'mes') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === 'trimestre') return new Date(now.getFullYear(), now.getMonth() - 2, 1);
  if (p === 'anio') return new Date(now.getFullYear(), 0, 1);
  return null;
}

export default function Reportes() {
  const navigate = useNavigate();
  const { empresa } = useEmpresa();
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionMedica[]>([]);
  const [atenciones, setAtenciones] = useState<AtencionMedica[]>([]);
  const [permisos, setPermisos] = useState<PermisoMedico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<TabId>('estado');
  const [periodo, setPeriodo] = useState<PeriodoId>('trimestre');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tSnap, eSnap, aSnap, pSnap] = await Promise.all([
          getDocs(collection(db, 'trabajadores')),
          getDocs(collection(db, 'evaluaciones')),
          getDocs(collection(db, 'atenciones')),
          getDocs(collection(db, 'permisos')),
        ]);
        setTrabajadores(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Trabajador)));
        setEvaluaciones(eSnap.docs.map(d => ({ id: d.id, ...d.data() } as EvaluacionMedica)));
        setAtenciones(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as AtencionMedica)));
        setPermisos(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as PermisoMedico)));
      } catch (err) {
        console.error('Error al cargar reportes:', err);
      } finally {
        setCargando(false);
      }
    };
    fetchData();
  }, []);

  // ── Filtro por período (morbilidad y ausentismo) ──────────────────────────
  const desde = inicioPeriodo(periodo);
  const enPeriodo = (fecha: any) => !desde || toDate(fecha) >= desde;
  const atencionesP = useMemo(() => atenciones.filter(a => enPeriodo(a.fecha)), [atenciones, periodo]);
  const evaluacionesP = useMemo(() => evaluaciones.filter(e => enPeriodo(e.fecha)), [evaluaciones, periodo]);
  const permisosP = useMemo(() => permisos.filter(p => enPeriodo(p.desde)), [permisos, periodo]);

  // ── Estadísticas derivadas ─────────────────────────────────────────────────
  const topDx = useMemo(() => topDiagnosticos(evaluacionesP, atencionesP, 10), [evaluacionesP, atencionesP]);
  const capitulos = useMemo(() => morbilidadCapitulos(evaluacionesP, atencionesP), [evaluacionesP, atencionesP]);
  const tendencia = useMemo(() => tendenciaConsultas(atenciones, 12), [atenciones]);
  const porArea = useMemo(() => ausentismoPorArea(permisosP), [permisosP]);
  const porTipoPermiso = useMemo(() => distribucionTipoPermiso(permisosP), [permisosP]);
  const tendenciaAusentismo = useMemo(() => tendenciaMensual(permisos, 12), [permisos]);
  const perfil = useMemo(() => perfilMetabolico(evaluaciones), [evaluaciones]);

  const topMedicamentos = useMemo(() => {
    const m = new Map<string, number>();
    atencionesP.forEach(a => (a.medicacion ?? []).forEach(x => m.set(x.nombre, (m.get(x.nombre) ?? 0) + (x.cantidad || 1))));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [atencionesP]);

  const frecuentes = useMemo(() => {
    const m = new Map<string, { nombre: string; n: number; ocupacionales: number }>();
    atencionesP.forEach(a => {
      const key = a.trabajadorId || `${a.pacienteApellidos}|${a.pacienteNombres}`;
      const prev = m.get(key) ?? { nombre: `${a.pacienteApellidos} ${a.pacienteNombres}`.trim(), n: 0, ocupacionales: 0 };
      prev.n++;
      if (a.relacion === 'Ocupacional') prev.ocupacionales++;
      m.set(key, prev);
    });
    return [...m.values()].filter(x => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 8);
  }, [atencionesP]);

  const vencimientos = useMemo(() => {
    return trabajadores
      .map(t => {
        const le = lastEval(evaluaciones.filter(e => e.trabajadorId === t.id));
        if (!le) return null;
        const vence = venceEn(le.fecha);
        const dias = Math.round((vence.getTime() - Date.now()) / 86400000);
        return { t, vence, dias };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.dias <= 90)
      .sort((a, b) => a.dias - b.dias);
  }, [trabajadores, evaluaciones]);

  // ── Exportaciones ──────────────────────────────────────────────────────────
  const descargarCSV = (rows: string[][], nombre: string) => {
    const csv = '﻿' + rows.map(r => r.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', nombre);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const exportarMatrizGlobalExcel = () => {
    const rows = [['CÉDULA', 'APELLIDOS', 'NOMBRES', 'PUESTO', 'ÁREA', 'ESTADO', 'ÚLTIMA EVAL.', 'VENCE', 'APTITUD', 'RESTRICCIONES']];
    trabajadores.forEach(t => {
      const evals = evaluaciones.filter(e => e.trabajadorId === t.id);
      const le = lastEval(evals);
      const ws = workerStatus(evals);
      rows.push([
        t.cedula,
        `${t.primerApellido} ${t.segundoApellido || ''}`.trim(),
        `${t.primerNombre} ${t.segundoNombre || ''}`.trim(),
        t.puestoTrabajo,
        areaDeTrabajador(t),
        ws.label,
        le ? parseDate(le.fecha).toLocaleDateString('es-EC') : 'Ninguna',
        le ? venceEn(le.fecha).toLocaleDateString('es-EC') : '-',
        le?.aptitudMedica || '-',
        le?.aptitudLimitaciones || le?.aptitudObservacion || '-',
      ]);
    });
    descargarCSV(rows, 'Matriz_Ocupacional_Global.csv');
  };

  const exportarMorbilidadCSV = () => {
    const label = PERIODOS.find(p => p.id === periodo)?.label ?? '';
    const rows = [['REPORTE DE MORBILIDAD', label], []];
    rows.push(['CÓDIGO CIE-10', 'DIAGNÓSTICO', 'CAPÍTULO', 'CASOS', '%']);
    topDx.forEach(d => rows.push([d.cie, d.desc, d.capitulo, String(d.n), `${d.pct}%`]));
    rows.push([], ['CAPÍTULO CIE-10', 'CASOS', '%']);
    capitulos.forEach(c => rows.push([c.label, String(c.n), `${c.pct}%`]));
    rows.push([], ['MEDICAMENTO', 'UNIDADES DISPENSADAS']);
    topMedicamentos.forEach(([nombre, n]) => rows.push([nombre, String(n)]));
    descargarCSV(rows, `Morbilidad_${periodo}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportarMatrizPDF = () => {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const fecha = new Date().toLocaleDateString('es-EC');

    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${empresa.institucion} — Matriz de Estado Ocupacional`, 14, 14);
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
        0: { cellWidth: 22 }, 1: { cellWidth: 32 }, 2: { cellWidth: 28 }, 3: { cellWidth: 40 },
        4: { cellWidth: 24 }, 5: { cellWidth: 22 }, 6: { cellWidth: 22 }, 7: { cellWidth: 'auto' },
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

  const ocupacionalesP = atencionesP.filter(a => a.relacion === 'Ocupacional').length;
  const medicamentosP = atencionesP.reduce((s, a) => s + (a.medicacion ?? []).reduce((q, m) => q + (m.cantidad || 0), 0), 0);
  const reposoDiasP = atencionesP.reduce((s, a) => s + (a.reposoDias || 0), 0);
  const diasPerdidosP = permisosP.filter(p => p.tipo !== 'cita').reduce((s, p) => s + (p.dias || 0), 0);

  const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: 'estado', label: 'Estado ocupacional', icon: <Users size={14} /> },
    { id: 'morbilidad', label: 'Morbilidad y consultas', icon: <Stethoscope size={14} /> },
    { id: 'ausentismo', label: 'Ausentismo y riesgo', icon: <BedDouble size={14} /> },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: COLORS.bg, color: COLORS.ink, fontFamily: FONTS.sans }}>
      <TopBar onNewWorker={() => navigate('/nuevo-trabajador')} />
      <div className="p-6 md:p-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-5">
          <div>
            <div className="text-[11px] font-semibold uppercase" style={{ color: COLORS.brand, letterSpacing: '1.4px' }}>
              {hoy.charAt(0).toUpperCase() + hoy.slice(1)}
            </div>
            <h1 className="mt-1.5 mb-0 text-[28px] font-bold tracking-tight" style={{ fontFamily: FONTS.serif }}>Reportes y estadísticas</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            {tab === 'morbilidad' ? (
              <button onClick={exportarMorbilidadCSV} className="px-4 py-2.5 text-white font-bold rounded-[9px] shadow-sm flex items-center gap-2 text-[13px] cursor-pointer border-none" style={{ background: ACCENT }}>
                <FileSpreadsheet size={16} /> Exportar morbilidad
              </button>
            ) : (
              <>
                <button onClick={exportarMatrizGlobalExcel} className="px-4 py-2.5 text-white font-bold rounded-[9px] shadow-sm flex items-center gap-2 text-[13px] cursor-pointer border-none" style={{ background: ACCENT }}>
                  <FileSpreadsheet size={16} /> Excel
                </button>
                <button onClick={exportarMatrizPDF} className="px-4 py-2.5 text-white font-bold rounded-[9px] shadow-sm flex items-center gap-2 text-[13px] cursor-pointer border-none" style={{ background: COLORS.brand }}>
                  <FileText size={16} /> PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs + período */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex gap-[3px] p-[3px] rounded-[9px]" style={{ background: '#e2e5ea' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[7px] border-none cursor-pointer text-[12.5px] font-semibold"
                style={{ background: tab === t.id ? COLORS.panel : 'transparent', color: tab === t.id ? ACCENT : COLORS.muted, boxShadow: tab === t.id ? '0 1px 2px rgba(28,29,34,0.1)' : 'none' }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
          {tab !== 'estado' && (
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoId)}
              className="px-3 py-2 border rounded-[9px] text-[12.5px] font-semibold cursor-pointer outline-none bg-white"
              style={{ borderColor: COLORS.line, color: COLORS.ink }}>
              {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          )}
        </div>

        {/* ════════ TAB 1: Estado ocupacional ════════ */}
        {tab === 'estado' && (
          <>
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

            {/* Vencimientos próximos: lo accionable primero */}
            {vencimientos.length > 0 && (
              <Panel icon={<CalendarClock size={15} />} titulo="Próximos vencimientos (90 días)" extra={`${vencimientos.length} evaluaciones`}>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b" style={{ background: COLORS.bg, borderColor: COLORS.line }}>
                      {['Trabajador', 'Puesto', 'Área', 'Última eval.', 'Vence', 'Días'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-bold uppercase tracking-wide whitespace-nowrap text-[10.5px]" style={{ color: COLORS.faint }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vencimientos.map(({ t, vence, dias }) => (
                      <tr key={t.id} className="border-t" style={{ borderColor: COLORS.line }}>
                        <td className="px-3 py-2 font-semibold">{nombreCorto(t)}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate" style={{ color: COLORS.muted }}>{t.puestoTrabajo}</td>
                        <td className="px-3 py-2" style={{ color: COLORS.muted }}>{areaDeTrabajador(t)}</td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ fontFamily: FONTS.mono, color: COLORS.muted }}>
                          {parseDate(lastEval(evals(t))!.fecha).toLocaleDateString('es-EC')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ fontFamily: FONTS.mono, color: COLORS.muted }}>{vence.toLocaleDateString('es-EC')}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold" style={dias < 0 ? { color: COLORS.bad, background: COLORS.badBg } : { color: COLORS.warn, background: COLORS.warnBg }}>
                            {dias < 0 ? `Venció hace ${Math.abs(dias)}d` : `${dias}d`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}

            <Panel icon={<Users size={15} />} titulo="Matriz de estado — todos los trabajadores" extra={`${trabajadores.length} registros`}>
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
                        <td className="px-3 py-2" style={{ color: COLORS.muted }}>{t.primerNombre} {t.segundoNombre || ''}</td>
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
            </Panel>
          </>
        )}

        {/* ════════ TAB 2: Morbilidad y consultas ════════ */}
        {tab === 'morbilidad' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard label="Atenciones" value={atencionesP.length} icon={<Stethoscope size={16} />} tone="muted" />
              <StatCard label="Ocupacionales" value={ocupacionalesP} icon={<Activity size={16} />} tone="warning" pulse={ocupacionalesP > 0} />
              <StatCard label="Medicamentos dispensados" value={medicamentosP} icon={<Pill size={16} />} tone="muted" />
              <StatCard label="Días de reposo emitidos" value={reposoDiasP} icon={<BedDouble size={16} />} tone="danger" pulse={reposoDiasP > 0} />
            </div>

            <Panel icon={<Activity size={15} />} titulo="Tendencia de consultas — últimos 12 meses" extra="total vs ocupacionales" padded>
              <MiniBarChart
                data={tendencia.map(m => ({ label: m.label, value: m.total, value2: m.ocupacionales }))}
                color={ACCENT} color2={COLORS.warn}
                leyenda={[['Total', ACCENT], ['Ocupacionales', COLORS.warn]]}
              />
            </Panel>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <Panel icon={<Stethoscope size={15} />} titulo="Diagnósticos más frecuentes (CIE-10)" extra={PERIODOS.find(p => p.id === periodo)?.label} padded>
                {topDx.length === 0 && <Vacio msg="Sin diagnósticos registrados en el período." />}
                {topDx.map(d => (
                  <BarRow key={d.cie} label={`${d.cie} · ${d.desc}`} n={d.n} pct={d.pct} color={d.color} max={topDx[0]?.n ?? 1} />
                ))}
              </Panel>

              <Panel icon={<HeartPulse size={15} />} titulo="Morbilidad por capítulo CIE-10" extra={PERIODOS.find(p => p.id === periodo)?.label} padded>
                {capitulos.length === 0 && <Vacio msg="Sin datos en el período." />}
                {capitulos.map(c => (
                  <BarRow key={c.label} label={c.label} n={c.n} pct={c.pct} color={c.color} max={capitulos[0]?.n ?? 1} />
                ))}
              </Panel>

              <Panel icon={<Pill size={15} />} titulo="Medicamentos más dispensados" extra="unidades" padded>
                {topMedicamentos.length === 0 && <Vacio msg="Sin medicación registrada en el período." />}
                {topMedicamentos.map(([nombre, n]) => (
                  <BarRow key={nombre} label={nombre} n={n} color={ACCENT} max={topMedicamentos[0]?.[1] ?? 1} />
                ))}
              </Panel>

              <Panel icon={<Users size={15} />} titulo="Pacientes con consultas repetidas" extra="2+ atenciones" padded>
                {frecuentes.length === 0 && <Vacio msg="Ningún paciente con 2 o más atenciones en el período." />}
                {frecuentes.map(f => (
                  <div key={f.nombre} className="flex items-center gap-2 py-1.5 border-b last:border-0" style={{ borderColor: COLORS.line }}>
                    <span className="text-[12.5px] font-semibold flex-1 truncate">{f.nombre}</span>
                    {f.ocupacionales > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-px rounded-full" style={{ color: COLORS.warn, background: COLORS.warnBg }}>{f.ocupacionales} ocup.</span>
                    )}
                    <span className="text-[13px] font-bold" style={{ fontFamily: FONTS.mono, color: ACCENT }}>{f.n}</span>
                  </div>
                ))}
              </Panel>
            </div>
          </>
        )}

        {/* ════════ TAB 3: Ausentismo y riesgo ════════ */}
        {tab === 'ausentismo' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard label="Permisos / reposos" value={permisosP.length} icon={<BedDouble size={16} />} tone="muted" />
              <StatCard label="Días perdidos" value={diasPerdidosP} icon={<Clock size={16} />} tone="danger" pulse={diasPerdidosP > 0} />
              <StatCard label="Personal con riesgo múltiple" value={perfil.riesgoMultiple.n} icon={<AlertTriangle size={16} />} tone="warning" pulse={perfil.riesgoMultiple.n > 0} />
              <StatCard label="Hipertensión detectada" value={perfil.hta.n} icon={<HeartPulse size={16} />} tone="danger" pulse={perfil.hta.n > 0} />
            </div>

            <Panel icon={<Activity size={15} />} titulo="Días perdidos por mes — últimos 12 meses" extra="reposos internos + IESS" padded>
              <MiniBarChart
                data={tendenciaAusentismo.map(m => ({ label: m.label, value: m.diasPerdidos }))}
                color={COLORS.bad}
                leyenda={[['Días perdidos', COLORS.bad]]}
              />
            </Panel>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <Panel icon={<BedDouble size={15} />} titulo="Ausentismo por área" extra="días perdidos" padded>
                {porArea.length === 0 && <Vacio msg="Sin permisos registrados en el período." />}
                {porArea.map(a => (
                  <BarRow key={a.area} label={`${a.area} (${a.nCasos} casos)`} n={a.dias} color={COLORS.bad} max={porArea[0]?.dias ?? 1} />
                ))}
              </Panel>

              <Panel icon={<Clock size={15} />} titulo="Distribución por tipo de permiso" padded>
                {porTipoPermiso.length === 0 && <Vacio msg="Sin permisos registrados en el período." />}
                {porTipoPermiso.map(t => (
                  <div key={t.tipo} className="flex items-center gap-2 py-1.5 border-b last:border-0" style={{ borderColor: COLORS.line }}>
                    <span className="text-[12.5px] font-semibold flex-1">{t.label}</span>
                    <span className="text-[11px]" style={{ color: COLORS.faint }}>{t.dias > 0 ? `${t.dias} días` : ''}</span>
                    <span className="text-[13px] font-bold" style={{ fontFamily: FONTS.mono, color: COLORS.ink }}>{t.n}</span>
                  </div>
                ))}
              </Panel>
            </div>

            <div className="mt-4">
              <Panel icon={<HeartPulse size={15} />} titulo="Perfil de riesgo metabólico-cardiovascular de la plantilla" extra={`base: ${perfil.nBase} últimas evaluaciones`} padded>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <PerfilItem label="Hipertensión (≥140/90)" v={perfil.hta} />
                  <PerfilItem label="Sobrepeso (IMC 25–30)" v={perfil.sobrepeso} />
                  <PerfilItem label="Obesidad (IMC ≥30)" v={perfil.obesidad} />
                  <PerfilItem label="Glucosa alterada (≥100)" v={perfil.glucosaAlterada} />
                  <PerfilItem label="Riesgo múltiple (2+)" v={perfil.riesgoMultiple} destacado />
                  <PerfilItem label="Consumo de tabaco" v={perfil.tabaco} />
                  <PerfilItem label="Consumo de alcohol" v={perfil.alcohol} />
                </div>
                {perfil.nBase === 0 && <Vacio msg="Aún no hay evaluaciones con signos vitales para calcular el perfil." />}
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

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

function Panel({ icon, titulo, extra, padded = false, children }: { icon: ReactNode; titulo: string; extra?: string; padded?: boolean; children: ReactNode }) {
  return (
    <div className="rounded-[14px] border overflow-hidden mb-4" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
      <div className="px-5 py-3.5 border-b flex items-center gap-2.5" style={{ borderColor: COLORS.line }}>
        <span className="grid place-items-center w-[28px] h-[28px] rounded-lg" style={{ background: COLORS.greenBg, color: ACCENT }}>{icon}</span>
        <h2 className="m-0 text-[15px] font-semibold" style={{ fontFamily: FONTS.serif }}>{titulo}</h2>
        {extra && <span className="ml-auto text-[12px]" style={{ fontFamily: FONTS.mono, color: COLORS.faint }}>{extra}</span>}
      </div>
      <div className={padded ? 'p-5' : 'overflow-x-auto'}>{children}</div>
    </div>
  );
}

function BarRow({ label, n, pct, color, max }: { label: string; n: number; pct?: number; color: string; max: number }) {
  return (
    <div className="py-1.5">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[12px] font-semibold flex-1 truncate" title={label}>{label}</span>
        <span className="text-[12.5px] font-bold" style={{ fontFamily: FONTS.mono, color }}>{n}</span>
        {pct !== undefined && <span className="text-[10.5px] w-[34px] text-right" style={{ color: COLORS.faint }}>{pct}%</span>}
      </div>
      <div className="h-[6px] rounded-full overflow-hidden" style={{ background: COLORS.bg }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(4, (n / max) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function MiniBarChart({ data, color, color2, leyenda }: {
  data: { label: string; value: number; value2?: number }[];
  color: string; color2?: string;
  leyenda?: [string, string][];
}) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 120 }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${d.label}: ${d.value}${d.value2 !== undefined ? ` (${d.value2} ocup.)` : ''}`}>
            <span className="text-[10px] font-bold mb-0.5" style={{ fontFamily: FONTS.mono, color: d.value > 0 ? COLORS.muted : COLORS.line }}>{d.value > 0 ? d.value : ''}</span>
            <div className="w-full relative rounded-t-[4px]" style={{ height: `${(d.value / max) * 100}%`, background: color, minHeight: d.value > 0 ? 3 : 0 }}>
              {d.value2 !== undefined && d.value > 0 && (
                <div className="absolute bottom-0 left-0 right-0 rounded-t-[4px]" style={{ height: `${(d.value2 / d.value) * 100}%`, background: color2 }} />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[9.5px] truncate" style={{ color: COLORS.faint }}>{d.label}</div>
        ))}
      </div>
      {leyenda && (
        <div className="flex gap-4 mt-2.5 justify-center">
          {leyenda.map(([l, c]) => (
            <span key={l} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: COLORS.muted }}>
              <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: c }} />{l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PerfilItem({ label, v, destacado = false }: { label: string; v: { n: number; pct: number }; destacado?: boolean }) {
  return (
    <div className="rounded-[10px] border p-3" style={{ borderColor: destacado && v.n > 0 ? '#ecdcc0' : COLORS.line, background: destacado && v.n > 0 ? COLORS.warnBg : COLORS.bg }}>
      <div className="text-[20px] font-bold leading-none" style={{ fontFamily: FONTS.mono, color: destacado && v.n > 0 ? COLORS.warn : COLORS.ink }}>
        {v.n} <span className="text-[12px] font-semibold" style={{ color: COLORS.faint }}>({v.pct}%)</span>
      </div>
      <div className="text-[11px] font-semibold mt-1.5" style={{ color: COLORS.muted }}>{label}</div>
    </div>
  );
}

function Vacio({ msg }: { msg: string }) {
  return <div className="py-6 text-center text-[12.5px]" style={{ color: COLORS.faint }}>{msg}</div>;
}
