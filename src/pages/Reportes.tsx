import { useMemo, useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, FileText, Download, Heart, Stethoscope, FlaskConical,
  AlertTriangle, TrendingDown, Users, Calendar,
} from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/dashboard/TopBar';
import type { Trabajador, EvaluacionMedica, ExamenComplementarioDoc } from '../types';
import type { PermisoMedico } from '../types/permiso';
import type { AtencionMedica } from '../types/atencion';
import type { OrdenExamen } from '../types/examenPlan';
import { workerStatus, lastEval, parseDate, dashboardStats } from '../utils/medicalHelpers';
import { getPermisos, calcularAusentismo, controlJustificativos, estadoPermiso } from '../services/permisos';
import { getOrdenes, calcularStats as statsExamenes, estadoOrden } from '../services/examenesPlan';
import {
  topDiagnosticos, morbilidadCapitulos, ausentismoPorArea, distribucionTipoPermiso,
  tendenciaMensual, perfilMetabolico, patologicosPorTipo, tendenciaConsultas,
} from '../utils/reporteHelpers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND = '#9a3036';
const TONE_COLOR: Record<string, [number, number, number]> = {
  success: [16, 160, 90], warning: [224, 138, 44], danger: [220, 46, 60], muted: [148, 162, 179],
};

type Tab = 'resumen' | 'aptitud' | 'morbilidad' | 'ausentismo' | 'metabolica' | 'examenes' | 'exportar';
const TABS: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
  { key: 'resumen', label: 'Resumen', icon: BarChart3 },
  { key: 'aptitud', label: 'Aptitud médica', icon: Users },
  { key: 'morbilidad', label: 'Morbilidad', icon: Stethoscope },
  { key: 'ausentismo', label: 'Ausentismo', icon: TrendingDown },
  { key: 'metabolica', label: 'Salud metabólica', icon: Heart },
  { key: 'examenes', label: 'Exámenes', icon: FlaskConical },
  { key: 'exportar', label: 'Exportar', icon: Download },
];

export default function Reportes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('resumen');

  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionMedica[]>([]);
  const [atenciones, setAtenciones] = useState<AtencionMedica[]>([]);
  const [permisos, setPermisos] = useState<PermisoMedico[]>([]);
  const [examenes, setExamenes] = useState<ExamenComplementarioDoc[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenExamen[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const [tRes, eRes, aRes, pRes, exRes, oRes] = await Promise.allSettled([
        getDocs(collection(db, 'trabajadores')),
        getDocs(collection(db, 'evaluaciones')),
        getDocs(collection(db, 'atenciones')),
        getPermisos(),
        getDocs(collection(db, 'examenes')),
        getOrdenes(),
      ]);
      if (tRes.status === 'fulfilled') setTrabajadores(tRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as Trabajador)));
      if (eRes.status === 'fulfilled') setEvaluaciones(eRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as EvaluacionMedica)));
      if (aRes.status === 'fulfilled') setAtenciones(aRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as AtencionMedica)));
      if (pRes.status === 'fulfilled') setPermisos(pRes.value);
      if (exRes.status === 'fulfilled') setExamenes(exRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as ExamenComplementarioDoc)));
      if (oRes.status === 'fulfilled') setOrdenes(oRes.value);
      setCargando(false);
    })();
  }, []);

  // ── Derived data (memoized) ────────────────────────────────────────────────
  const evMap = useMemo(() => {
    const m = new Map<string, EvaluacionMedica[]>();
    evaluaciones.forEach((e) => { const a = m.get(e.trabajadorId) ?? []; a.push(e); m.set(e.trabajadorId, a); });
    return m;
  }, [evaluaciones]);

  const ds = useMemo(() => dashboardStats(trabajadores, evMap), [trabajadores, evMap]);
  const aus = useMemo(() => calcularAusentismo(permisos), [permisos]);
  const cj = useMemo(() => controlJustificativos(permisos), [permisos]);
  const exStats = useMemo(() => statsExamenes(ordenes), [ordenes]);
  const topDx = useMemo(() => topDiagnosticos(evaluaciones, atenciones), [evaluaciones, atenciones]);
  const capsDx = useMemo(() => morbilidadCapitulos(evaluaciones, atenciones), [evaluaciones, atenciones]);
  const ausPorArea = useMemo(() => ausentismoPorArea(permisos), [permisos]);
  const tiposPermiso = useMemo(() => distribucionTipoPermiso(permisos), [permisos]);
  const tendAus = useMemo(() => tendenciaMensual(permisos), [permisos]);
  const metabolico = useMemo(() => perfilMetabolico(evaluaciones), [evaluaciones]);
  const exPatologicos = useMemo(() => patologicosPorTipo(examenes), [examenes]);
  const tendConsultas = useMemo(() => tendenciaConsultas(atenciones), [atenciones]);

  const porVencerProximas = useMemo(() =>
    trabajadores
      .map((t) => ({ t, evals: evMap.get(t.id!) ?? [] }))
      .filter(({ evals }) => { const ws = workerStatus(evals); return ws.tone === 'warning' || ws.tone === 'danger'; })
      .sort((a, b) => {
        const wa = workerStatus(a.evals); const wb = workerStatus(b.evals);
        return (wa.dias ?? 9999) - (wb.dias ?? 9999);
      }),
    [trabajadores, evMap]);

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'DR';

  // ── Export functions ───────────────────────────────────────────────────────
  const exportMatrizCSV = () => {
    const rows = [['CÉDULA', 'APELLIDOS', 'NOMBRES', 'PUESTO', 'ESTADO', 'ÚLTIMA EVAL.', 'APTITUD', 'RESTRICCIONES']];
    trabajadores.forEach((t) => {
      const evals = evMap.get(t.id!) ?? [];
      const le = lastEval(evals);
      const ws = workerStatus(evals);
      rows.push([t.cedula, `${t.primerApellido} ${t.segundoApellido || ''}`.trim(), `${t.primerNombre} ${(t as any).segundoNombre || ''}`.trim(), t.puestoTrabajo, ws.label, le ? parseDate(le.fecha).toLocaleDateString('es-EC') : 'Ninguna', le?.aptitudMedica || '-', le?.aptitudLimitaciones || le?.aptitudObservacion || '-']);
    });
    const blob = new Blob(['﻿' + rows.map((r) => r.join(';')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'Matriz_Ocupacional_Global.csv'; a.click();
  };

  const exportMatrizPDF = () => {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const fecha = new Date().toLocaleDateString('es-EC');
    pdf.setFontSize(13); pdf.setFont('helvetica', 'bold');
    pdf.text('CEM AUSTROGAS — Matriz de Estado Ocupacional', 14, 14);
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
    pdf.text(`Generado: ${fecha}  |  Total trabajadores: ${trabajadores.length}`, 14, 20);
    const body = trabajadores.map((t) => {
      const evals = evMap.get(t.id!) ?? []; const le = lastEval(evals); const ws = workerStatus(evals);
      const color = TONE_COLOR[ws.tone] ?? [100, 100, 100];
      return [t.cedula, `${t.primerApellido} ${t.segundoApellido || ''}`.trim(), `${t.primerNombre} ${(t as any).segundoNombre || ''}`.trim(), t.puestoTrabajo, { content: ws.label, styles: { textColor: color, fontStyle: 'bold' as const } }, le ? parseDate(le.fecha).toLocaleDateString('es-EC') : 'Ninguna', ws.dias !== null ? (ws.dias < 0 ? `Venció hace ${Math.abs(ws.dias)}d` : `${ws.dias}d`) : '-', le?.aptitudLimitaciones || le?.aptitudObservacion || '-'];
    });
    autoTable(pdf, { startY: 24, head: [['CÉDULA', 'APELLIDOS', 'NOMBRES', 'PUESTO', 'ESTADO', 'ÚLTIMA EVAL.', 'DÍAS', 'RESTRICCIONES']], body, styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [154, 48, 54], textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 14, right: 14 } });
    const tot = (pdf as any).internal.getNumberOfPages();
    for (let i = 1; i <= tot; i++) { pdf.setPage(i); pdf.setFontSize(7); pdf.setTextColor(150); pdf.text(`Página ${i} de ${tot}`, pdf.internal.pageSize.width - 30, pdf.internal.pageSize.height - 8); }
    pdf.save(`Matriz_Ocupacional_${fecha.replace(/\//g, '-')}.pdf`);
  };

  const exportMorbilidadPDF = () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const fecha = new Date().toLocaleDateString('es-EC');
    pdf.setFontSize(13); pdf.setFont('helvetica', 'bold');
    pdf.text('CEM AUSTROGAS — Reporte de Morbilidad', 14, 14);
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
    pdf.text(`Generado: ${fecha}  |  Base: ${evaluaciones.length} evaluaciones + ${atenciones.length} consultas`, 14, 20);
    autoTable(pdf, {
      startY: 25, head: [['Código CIE-10', 'Diagnóstico', 'Capítulo', 'Casos', '% del total']],
      body: topDx.map((d) => [d.cie, d.desc, d.capitulo, d.n, `${d.pct}%`]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [154, 48, 54], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 14, right: 14 },
    });
    pdf.save(`Morbilidad_${fecha.replace(/\//g, '-')}.pdf`);
  };

  const exportAusentismoPDF = () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const fecha = new Date().toLocaleDateString('es-EC');
    pdf.setFontSize(13); pdf.setFont('helvetica', 'bold');
    pdf.text('CEM AUSTROGAS — Indicadores de Ausentismo', 14, 14);
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
    pdf.text(`Generado: ${fecha}  |  Resolución CD 513 IESS · K = 200.000`, 14, 20);
    autoTable(pdf, {
      startY: 25, head: [['Indicador', 'Valor']],
      body: [['Días perdidos (últimos 30 días)', aus.diasPerdidos], ['Número de casos', aus.nCasos], ['% Ausentismo', `${aus.pctAusentismo}%`], ['Índice de Frecuencia (IF)', aus.frecuencia], ['Índice de Gravedad (IG)', aus.gravedad], ['Duración media (días)', aus.duracionMedia]],
      styles: { fontSize: 9 }, headStyles: { fillColor: [154, 48, 54], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });
    if (ausPorArea.length > 0) {
      autoTable(pdf, {
        startY: (pdf as any).lastAutoTable.finalY + 8,
        head: [['Área', 'Días perdidos', 'Nº casos']],
        body: ausPorArea.map((a) => [a.area, a.dias, a.nCasos]),
        styles: { fontSize: 9 }, headStyles: { fillColor: [154, 48, 54], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 14, right: 14 },
      });
    }
    pdf.save(`Ausentismo_${fecha.replace(/\//g, '-')}.pdf`);
  };

  // ── Hero KPI chips ─────────────────────────────────────────────────────────
  const heroChips = [
    { label: 'Trabajadores', value: trabajadores.length, color: 'rgba(255,255,255,0.9)' },
    { label: 'Consultas registradas', value: atenciones.length, color: '#93c5fd' },
    { label: 'Días perdidos (mes)', value: aus.diasPerdidos, color: aus.diasPerdidos > 0 ? '#fca5a5' : 'rgba(255,255,255,0.7)' },
    { label: 'Exámenes atrasados', value: exStats.atrasados, color: exStats.atrasados > 0 ? '#fbbf24' : 'rgba(255,255,255,0.7)', urgent: exStats.atrasados > 0 },
  ];

  if (cargando) {
    return (
      <div className="w-screen h-screen flex flex-col" style={{ background: '#f5f7fa' }}>
        <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: `${BRAND}30`, borderTopColor: BRAND }} />
            <p className="text-sm font-semibold text-slate-500">Calculando estadísticas…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden text-slate-900" style={{ background: '#f5f7fa', fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <div className="flex-1 overflow-y-auto">
        {/* ── Hero ── */}
        <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #7a2028 100%)` }}>
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #fff 0%, transparent 60%)' }} />
          <div className="relative max-w-6xl mx-auto px-6 pt-7 pb-5">
            <div className="flex items-start gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <BarChart3 size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight m-0">Reportes y Analítica</h1>
                <p className="text-sm m-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>Indicadores de medicina ocupacional · AUSFASEC</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4 flex-wrap">
              {heroChips.map((c) => (
                <div key={c.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${c.urgent ? 'animate-pulse' : ''}`} style={{ background: 'rgba(0,0,0,0.18)' }}>
                  <span className="text-lg font-extrabold leading-none" style={{ color: c.color }}>{c.value}</span>
                  <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Tab bar */}
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex gap-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {TABS.map((t) => {
                const active = tab === t.key;
                const Icon = t.icon;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className="px-4 py-3 text-sm font-semibold whitespace-nowrap border-none cursor-pointer transition-all flex items-center gap-1.5"
                    style={{ background: 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.55)', borderBottom: active ? '2px solid #fff' : '2px solid transparent' }}>
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="max-w-6xl mx-auto px-6 py-6">
          {tab === 'resumen' && <TabResumen ds={ds} aus={aus} exStats={exStats} atenciones={atenciones} porVencerCount={porVencerProximas.length} ds_total={trabajadores.length} tendConsultas={tendConsultas} />}
          {tab === 'aptitud' && <TabAptitud trabajadores={trabajadores} evMap={evMap} ds={ds} porVencerProximas={porVencerProximas} />}
          {tab === 'morbilidad' && <TabMorbilidad topDx={topDx} capsDx={capsDx} atenciones={atenciones} evaluaciones={evaluaciones} nTrabajadores={trabajadores.length} tendConsultas={tendConsultas} />}
          {tab === 'ausentismo' && <TabAusentismo aus={aus} cj={cj} ausPorArea={ausPorArea} tiposPermiso={tiposPermiso} tendAus={tendAus} />}
          {tab === 'metabolica' && <TabMetabolica metabolico={metabolico} />}
          {tab === 'examenes' && <TabExamenes exStats={exStats} exPatologicos={exPatologicos} ordenes={ordenes} />}
          {tab === 'exportar' && <TabExportar onMatrizCSV={exportMatrizCSV} onMatrizPDF={exportMatrizPDF} onMorbilidadPDF={exportMorbilidadPDF} onAusentismoPDF={exportAusentismoPDF} nTrabajadores={trabajadores.length} nEvaluaciones={evaluaciones.length} nConsultas={atenciones.length} />}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: RESUMEN EJECUTIVO
// ══════════════════════════════════════════════════════════════════════════════
function TabResumen({ ds, aus, exStats, atenciones, porVencerCount, ds_total, tendConsultas }: any) {
  const pctOcup = atenciones.length ? Math.round((atenciones.filter((a: any) => a.relacion === 'Ocupacional').length / atenciones.length) * 100) : 0;
  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total plantilla" value={ds_total} sub="trabajadores activos" color="#1d4fad" />
        <KpiCard label="Aptos vigentes" value={ds.aptos} sub={`${ds_total ? Math.round((ds.aptos / ds_total) * 100) : 0}% de la plantilla`} color="#0a6b3b" />
        <KpiCard label="Alertas activas" value={ds.porVencer + ds.vencidasONoApto} sub="por vencer o vencidas" color="#8a4a0a" urgent={ds.porVencer + ds.vencidasONoApto > 0} />
        <KpiCard label="Sin evaluación" value={ds.sinEval} sub="sin historia clínica" color="#3a4a5e" urgent={ds.sinEval > 0} />
      </div>

      {/* Alertas banner */}
      {ds.vencidasONoApto > 0 && (
        <AlertBanner tone="danger" icon={<AlertTriangle size={18} />} title={`${ds.vencidasONoApto} trabajador${ds.vencidasONoApto > 1 ? 'es' : ''} con evaluación vencida o no aptos`} desc="Requieren nueva evaluación médica con carácter urgente." />
      )}
      {ds.sinEval > 0 && (
        <AlertBanner tone="warning" icon={<AlertTriangle size={18} />} title={`${ds.sinEval} trabajador${ds.sinEval > 1 ? 'es' : ''} sin evaluación registrada`} desc="No cuentan con historia clínica ocupacional en el sistema." />
      )}

      {/* Segundo nivel de KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Consultas totales" value={atenciones.length} sub="todas las registradas" color="#0e6b7c" />
        <KpiCard label="% Ocupacionales" value={`${pctOcup}%`} sub="del total de consultas" color="#7c5cf2" />
        <KpiCard label="Días perdidos" value={aus.diasPerdidos} sub="último mes (reposos)" color={aus.diasPerdidos > 0 ? '#a01f2a' : '#0a6b3b'} />
        <KpiCard label="Exámenes atrasados" value={exStats.atrasados} sub="órdenes sin completar" color={exStats.atrasados > 0 ? '#8a4a0a' : '#0a6b3b'} urgent={exStats.atrasados > 0} />
      </div>

      {/* Tendencia de consultas */}
      <SecCard title="Consultas médicas — últimos 6 meses" icon={<Stethoscope size={15} />}>
        <MiniBarChart data={tendConsultas.map((m: any) => ({ label: m.label, value: m.total, sub: `${m.ocupacionales} ocup.` }))} color="#1d4fad" />
      </SecCard>

      {/* Aptitud resumen visual */}
      <SecCard title="Estado de aptitud médica — resumen" icon={<Users size={15} />}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Aptos vigentes', n: ds.aptos, color: '#10a05a', bg: '#e6f6ee' },
            { label: 'Por vencer / Restricciones', n: ds.porVencer, color: '#e08a2c', bg: '#fff4e3' },
            { label: 'Vencidas / No aptos', n: ds.vencidasONoApto, color: '#dc2e3c', bg: '#fce8eb' },
            { label: 'Sin evaluación', n: ds.sinEval, color: '#94a2b3', bg: '#eef1f5' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg }}>
              <div className="text-2xl font-extrabold" style={{ color: s.color }}>{s.n}</div>
              <div className="text-[11px] font-semibold text-slate-600 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        <DistBar total={ds_total} segments={[
          { n: ds.aptos, color: '#10a05a' },
          { n: ds.porVencer, color: '#e08a2c' },
          { n: ds.vencidasONoApto, color: '#dc2e3c' },
          { n: ds.sinEval, color: '#94a2b3' },
        ]} />
      </SecCard>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: APTITUD MÉDICA
// ══════════════════════════════════════════════════════════════════════════════
function TabAptitud({ trabajadores, evMap, ds, porVencerProximas }: any) {
  const areas = ['Operaciones', 'Mantenimiento', 'Logística', 'Administración', 'Seguridad y Salud', 'Comercial'];
  const areaStats = areas.map((area) => {
    const tw = trabajadores.filter((t: any) => (t.departamento || 'Operaciones') === area);
    const aptos = tw.filter((t: any) => workerStatus(evMap.get(t.id!) ?? []).tone === 'success').length;
    const warning = tw.filter((t: any) => workerStatus(evMap.get(t.id!) ?? []).tone === 'warning').length;
    const danger = tw.filter((t: any) => workerStatus(evMap.get(t.id!) ?? []).tone === 'danger').length;
    return { area, total: tw.length, aptos, warning, danger };
  }).filter((a) => a.total > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Aptos vigentes" value={ds.aptos} sub="" color="#0a6b3b" />
        <KpiCard label="Por vencer" value={ds.porVencer} sub="≤30 días" color="#8a4a0a" />
        <KpiCard label="Vencidas / No aptos" value={ds.vencidasONoApto} sub="" color="#a01f2a" urgent={ds.vencidasONoApto > 0} />
        <KpiCard label="Sin evaluación" value={ds.sinEval} sub="" color="#3a4a5e" />
      </div>

      {/* Por área */}
      <SecCard title="Distribución de aptitud por área" icon={<Users size={15} />}>
        <div className="space-y-3">
          {areaStats.map((a) => (
            <div key={a.area}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">{a.area}</span>
                <span className="text-slate-400">{a.total} trabajadores</span>
              </div>
              <DistBar total={a.total} segments={[
                { n: a.aptos, color: '#10a05a' },
                { n: a.warning, color: '#e08a2c' },
                { n: a.danger, color: '#dc2e3c' },
                { n: a.total - a.aptos - a.warning - a.danger, color: '#94a2b3' },
              ]} />
              <div className="flex gap-3 text-[10px] text-slate-500 mt-1">
                <LegDot color="#10a05a" label={`${a.aptos} aptos`} />
                <LegDot color="#e08a2c" label={`${a.warning} por vencer`} />
                <LegDot color="#dc2e3c" label={`${a.danger} vencidas`} />
              </div>
            </div>
          ))}
        </div>
      </SecCard>

      {/* Tabla próximas a vencer */}
      {porVencerProximas.length > 0 && (
        <SecCard title={`Trabajadores con alertas (${porVencerProximas.length})`} icon={<AlertTriangle size={15} />}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Trabajador', 'Cédula', 'Puesto', 'Estado', 'Días rest.', 'Aptitud'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {porVencerProximas.map(({ t, evals }: any) => {
                  const ws = workerStatus(evals); const le = lastEval(evals);
                  const badgeColor = ws.tone === 'danger' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-800">{t.primerApellido} {t.primerNombre}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{t.cedula}</td>
                      <td className="px-3 py-2 text-slate-600">{t.puestoTrabajo}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}`}>{ws.label}</span></td>
                      <td className="px-3 py-2 font-semibold" style={{ color: ws.dias !== null && ws.dias < 0 ? '#a01f2a' : '#8a4a0a' }}>{ws.dias !== null ? (ws.dias < 0 ? `Venció hace ${Math.abs(ws.dias)}d` : `${ws.dias}d`) : '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{le?.aptitudMedica ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SecCard>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: MORBILIDAD
// ══════════════════════════════════════════════════════════════════════════════
function TabMorbilidad({ topDx, capsDx, atenciones, evaluaciones, nTrabajadores, tendConsultas }: any) {
  const totalConsultas = atenciones.length;
  const ocupacionales = atenciones.filter((a: any) => a.relacion === 'Ocupacional').length;
  const tasaMorbilidad = nTrabajadores ? ((totalConsultas / nTrabajadores) * 1000).toFixed(1) : '—';
  const pctOcup = totalConsultas ? Math.round((ocupacionales / totalConsultas) * 100) : 0;
  const totalDx = evaluaciones.reduce((s: number, e: any) => s + (e.diagnosticos?.length || 0), 0);
  const enfermedadesProfesionales = evaluaciones.filter((e: any) => e.enfermedadesProfesionales?.calificada).length;
  const accidentesTrabajo = evaluaciones.filter((e: any) => e.accidentesTrabajo?.calificado).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Tasa de morbilidad" value={tasaMorbilidad} sub="consultas × 1 000 trabajadores" color="#1d4fad" />
        <KpiCard label="% Ocupacional" value={`${pctOcup}%`} sub={`${ocupacionales} de ${totalConsultas} consultas`} color="#7c5cf2" />
        <KpiCard label="Total diagnósticos" value={totalDx} sub="en evaluaciones" color="#0e6b7c" />
        <KpiCard label="Enf. profesionales" value={enfermedadesProfesionales} sub="calificadas" color={enfermedadesProfesionales > 0 ? '#a01f2a' : '#3a4a5e'} urgent={enfermedadesProfesionales > 0} />
      </div>

      {accidentesTrabajo > 0 && (
        <AlertBanner tone="warning" icon={<AlertTriangle size={18} />} title={`${accidentesTrabajo} accidente${accidentesTrabajo > 1 ? 's' : ''} de trabajo calificado${accidentesTrabajo > 1 ? 's' : ''} registrado${accidentesTrabajo > 1 ? 's' : ''}`} desc="Documentados en las evaluaciones médicas ocupacionales." />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top diagnósticos */}
        <SecCard title={`Top ${topDx.length} diagnósticos ICD-10`} icon={<Stethoscope size={15} />}>
          {topDx.length === 0 ? <EmptyState label="Sin diagnósticos registrados" /> : (
            <div className="space-y-2.5">
              {topDx.map((d: any) => (
                <div key={d.cie}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-mono font-bold" style={{ color: d.color }}>{d.cie}</span>
                    <span className="text-slate-500">{d.n} casos · {d.pct}%</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mb-1 truncate">{d.desc}</p>
                  <HBar pct={d.pct} color={d.color} />
                </div>
              ))}
            </div>
          )}
        </SecCard>

        {/* Por capítulo */}
        <SecCard title="Morbilidad por capítulo ICD-10" icon={<BarChart3 size={15} />}>
          {capsDx.length === 0 ? <EmptyState label="Sin datos" /> : (
            <div className="space-y-2.5">
              {capsDx.slice(0, 10).map((c: any) => (
                <div key={c.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">{c.label}</span>
                    <span className="text-slate-500">{c.n} · {c.pct}%</span>
                  </div>
                  <HBar pct={c.pct} color={c.color} />
                </div>
              ))}
            </div>
          )}
        </SecCard>
      </div>

      {/* Tendencia consultas */}
      <SecCard title="Consultas médicas — últimos 6 meses" icon={<Calendar size={15} />}>
        <MiniBarChart data={tendConsultas.map((m: any) => ({ label: m.label, value: m.total, sub: `${m.ocupacionales} ocup.` }))} color="#7c5cf2" />
      </SecCard>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: AUSENTISMO
// ══════════════════════════════════════════════════════════════════════════════
function TabAusentismo({ aus, cj, ausPorArea, tiposPermiso, tendAus }: any) {
  const maxDias = Math.max(...tendAus.map((m: any) => m.diasPerdidos), 1);
  const colores = ['#1d4fad', '#7c5cf2', '#0e9bbf'];

  return (
    <div className="space-y-5">
      {/* KPIs IESS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Índice de Frecuencia (IF)" value={aus.frecuencia} sub="accidentes · K=200.000" color={BRAND} />
        <KpiCard label="Índice de Gravedad (IG)" value={aus.gravedad} sub="días perdidos · K=200.000" color="#7c5cf2" />
        <KpiCard label="% Ausentismo" value={`${aus.pctAusentismo}%`} sub="último mes (días/programados)" color={parseFloat(aus.pctAusentismo) > 5 ? '#a01f2a' : '#0a6b3b'} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Días perdidos" value={aus.diasPerdidos} sub="en los últimos 30 días" color="#0e6b7c" />
        <KpiCard label="Número de casos" value={aus.nCasos} sub="reposos médicos" color="#0e6b7c" />
        <KpiCard label="Duración media" value={`${aus.duracionMedia} d`} sub="por caso de reposo" color="#3a4a5e" />
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-2 text-[11px] text-slate-500">
        <span className="flex-shrink-0 mt-0.5 text-slate-400">ⓘ</span>
        IF e IG según <strong className="mx-1">Resolución C.D. 513 del IESS</strong> y <strong className="mx-1">Decreto Ejecutivo 2393</strong> · K = 200.000 horas-hombre · Base laboral ≈ 40 trabajadores × 21 días × 8 horas.
      </div>

      {/* Tendencia mensual */}
      <SecCard title="Tendencia de ausentismo — últimos 12 meses" icon={<TrendingDown size={15} />}>
        <div className="flex items-end gap-1.5 h-28">
          {tendAus.map((m: any, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-slate-500 font-semibold">{m.diasPerdidos > 0 ? m.diasPerdidos : ''}</span>
              <div className="w-full rounded-t-sm" style={{ height: `${Math.max((m.diasPerdidos / maxDias) * 88, m.diasPerdidos > 0 ? 4 : 0)}px`, background: m.diasPerdidos > 0 ? BRAND : '#e2e8f0' }} />
              <span className="text-[8px] text-slate-400 text-center leading-tight">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 text-[10px] text-slate-400 text-right">Días perdidos por mes (reposos)</div>
      </SecCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Por área */}
        <SecCard title="Días perdidos por área" icon={<BarChart3 size={15} />}>
          {ausPorArea.length === 0 ? <EmptyState label="Sin datos de ausentismo" /> : (
            <div className="space-y-2.5">
              {ausPorArea.map((a: any, i: number) => (
                <div key={a.area}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">{a.area}</span>
                    <span className="text-slate-500">{a.dias}d · {a.nCasos} caso{a.nCasos !== 1 ? 's' : ''}</span>
                  </div>
                  <HBar pct={Math.round((a.dias / Math.max(...ausPorArea.map((x: any) => x.dias))) * 100)} color={colores[i % colores.length]} />
                </div>
              ))}
            </div>
          )}
        </SecCard>

        {/* Por tipo de permiso */}
        <SecCard title="Distribución por tipo de permiso" icon={<Calendar size={15} />}>
          {tiposPermiso.length === 0 ? <EmptyState label="Sin permisos registrados" /> : (
            <div className="space-y-3">
              {tiposPermiso.map((tp: any, i: number) => (
                <div key={tp.tipo} className="rounded-xl p-3" style={{ background: `${colores[i % colores.length]}10` }}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold" style={{ color: colores[i % colores.length] }}>{tp.label}</span>
                    <span className="text-xs font-bold text-slate-600">{tp.n}</span>
                  </div>
                  {tp.dias > 0 && <p className="text-[11px] text-slate-500 mt-0.5">{tp.dias} días de reposo</p>}
                </div>
              ))}
            </div>
          )}
        </SecCard>
      </div>

      {/* Control de justificativos */}
      <SecCard title="Control de justificativos" icon={<FileText size={15} />}>
        <div className="flex justify-between text-sm mb-2">
          <span className="font-semibold text-slate-700">Certificados adjuntados</span>
          <span className="font-bold" style={{ color: cj.pct >= 80 ? '#0a6b3b' : '#8a4a0a' }}>{cj.pct}%</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex mb-2">
          {cj.total > 0 && <>
            <div style={{ width: `${(cj.conCert / cj.total) * 100}%`, background: '#10a05a', transition: 'width 0.6s' }} />
            <div style={{ width: `${(cj.pendientes / cj.total) * 100}%`, background: '#e08a2c' }} />
            <div style={{ width: `${(cj.vencidos / cj.total) * 100}%`, background: '#dc2e3c' }} />
          </>}
        </div>
        <div className="flex gap-4 text-[11.5px] text-slate-500">
          <LegDot color="#10a05a" label={`${cj.conCert} con cert.`} />
          <LegDot color="#e08a2c" label={`${cj.pendientes} pendientes`} />
          <LegDot color="#dc2e3c" label={`${cj.vencidos} vencidos`} />
        </div>
      </SecCard>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: SALUD METABÓLICA
// ══════════════════════════════════════════════════════════════════════════════
function TabMetabolica({ metabolico }: any) {
  const m = metabolico;
  const INDICADORES = [
    { label: 'Hipertensión arterial', desc: 'PA sistólica ≥140 o diastólica ≥90 mmHg', ...m.hta, color: '#dc2e3c', ref: '≥140/90 mmHg', alerta: m.hta.pct > 20 },
    { label: 'Sobrepeso', desc: 'IMC entre 25 y 29.9 kg/m²', ...m.sobrepeso, color: '#e08a2c', ref: 'IMC 25–29.9', alerta: m.sobrepeso.pct > 30 },
    { label: 'Obesidad', desc: 'IMC ≥ 30 kg/m²', ...m.obesidad, color: '#a01f2a', ref: 'IMC ≥ 30', alerta: m.obesidad.pct > 15 },
    { label: 'Glucosa alterada', desc: 'Glucosa capilar ≥100 mg/dL (prediabetes/DM)', ...m.glucosaAlterada, color: '#b45309', ref: '≥100 mg/dL', alerta: m.glucosaAlterada.pct > 10 },
    { label: 'Riesgo metabólico múltiple', desc: '≥2 factores simultáneos: HTA, exceso de peso, glucosa alta', ...m.riesgoMultiple, color: BRAND, ref: '≥2 factores', alerta: m.riesgoMultiple.pct > 15 },
    { label: 'Consumo de tabaco', desc: 'Trabajadores con hábito tabáquico activo', ...m.tabaco, color: '#64748b', ref: 'Hábito activo', alerta: m.tabaco.pct > 20 },
    { label: 'Consumo de alcohol', desc: 'Trabajadores con consumo habitual de alcohol', ...m.alcohol, color: '#475569', ref: 'Consumo habitual', alerta: m.alcohol.pct > 15 },
  ];

  if (m.nBase === 0) {
    return <div className="p-16 text-center"><EmptyState label="No hay evaluaciones con datos de signos vitales registrados" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-[12px] text-blue-800">
        <strong>Base de cálculo:</strong> Última evaluación de {m.nBase} trabajador{m.nBase !== 1 ? 'es' : ''} con datos de signos vitales registrados.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INDICADORES.map((ind) => (
          <div key={ind.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">{ind.label}</span>
                  {ind.alerta && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 animate-pulse">ATENCIÓN</span>}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{ind.desc}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-extrabold" style={{ color: ind.color }}>{ind.pct}%</div>
                <div className="text-[10px] text-slate-400">{ind.n}/{m.nBase}</div>
              </div>
            </div>
            <HBar pct={ind.pct} color={ind.color} height={8} />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Ref: {ind.ref}</span>
              <span>{ind.n} trabajador{ind.n !== 1 ? 'es' : ''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: EXÁMENES
// ══════════════════════════════════════════════════════════════════════════════
function TabExamenes({ exStats, exPatologicos, ordenes }: any) {
  const ordenesAtrasadas = ordenes.filter((o: any) => estadoOrden(o).key === 'atrasado');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Cobertura de protocolo" value={`${exStats.cobertura}%`} sub="órdenes completadas" color={exStats.cobertura >= 80 ? '#0a6b3b' : '#8a4a0a'} />
        <KpiCard label="Completadas" value={exStats.completados} sub="órdenes" color="#0a6b3b" />
        <KpiCard label="En proceso" value={exStats.enProceso} sub="parcialmente realizadas" color="#1d4fad" />
        <KpiCard label="Atrasadas" value={exStats.atrasados} sub="fecha programada vencida" color={exStats.atrasados > 0 ? '#a01f2a' : '#0a6b3b'} urgent={exStats.atrasados > 0} />
      </div>

      {/* Exámenes patológicos */}
      <SecCard title="Exámenes con resultados patológicos por tipo" icon={<FlaskConical size={15} />}>
        {exPatologicos.length === 0 ? <EmptyState label="Sin exámenes registrados en el sistema" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Tipo de examen', 'Total realizados', 'Patológicos', '% Patológicos'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exPatologicos.map((ex: any) => (
                  <tr key={ex.tipo} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-semibold text-slate-800">{ex.tipo}</td>
                    <td className="px-3 py-2 text-slate-600">{ex.total}</td>
                    <td className="px-3 py-2">
                      <span className={`font-bold ${ex.patologicos > 0 ? 'text-red-600' : 'text-slate-400'}`}>{ex.patologicos}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div style={{ width: `${ex.pct}%`, background: ex.pct >= 30 ? '#dc2e3c' : ex.pct >= 10 ? '#e08a2c' : '#10a05a' }} className="h-full rounded-full" />
                        </div>
                        <span className={`font-bold text-[11px] ${ex.pct >= 30 ? 'text-red-600' : ex.pct >= 10 ? 'text-amber-700' : 'text-green-700'}`}>{ex.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SecCard>

      {/* Órdenes atrasadas */}
      {ordenesAtrasadas.length > 0 && (
        <SecCard title={`Órdenes atrasadas (${ordenesAtrasadas.length})`} icon={<AlertTriangle size={15} />}>
          <div className="space-y-2">
            {ordenesAtrasadas.map((o: any) => {
              const { dias } = estadoOrden(o);
              return (
                <div key={o.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{o.apellidos} {o.nombres}</p>
                    <p className="text-[11px] text-slate-500">{o.tipoEvaluacion} · {o.examenes.length} examen{o.examenes.length !== 1 ? 'es' : ''}</p>
                  </div>
                  <span className="text-[11px] font-bold text-red-600">Atrasado {Math.abs(dias ?? 0)}d</span>
                </div>
              );
            })}
          </div>
        </SecCard>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: EXPORTAR
// ══════════════════════════════════════════════════════════════════════════════
function TabExportar({ onMatrizCSV, onMatrizPDF, onMorbilidadPDF, onAusentismoPDF, nTrabajadores, nEvaluaciones, nConsultas }: any) {
  const exports = [
    { title: 'Matriz Ocupacional Global', desc: `${nTrabajadores} trabajadores · estado de aptitud, última evaluación, restricciones`, btnLabel: 'Descargar CSV', btnColor: '#107c41', onClick: onMatrizCSV, icon: '📊' },
    { title: 'Matriz Ocupacional PDF', desc: `Documento A4 horizontal con colores por estado de aptitud`, btnLabel: 'Descargar PDF', btnColor: BRAND, onClick: onMatrizPDF, icon: '📄' },
    { title: 'Reporte de Morbilidad', desc: `Top diagnósticos ICD-10 · ${nEvaluaciones} evaluaciones + ${nConsultas} consultas`, btnLabel: 'Descargar PDF', btnColor: '#7c5cf2', onClick: onMorbilidadPDF, icon: '🏥' },
    { title: 'Indicadores de Ausentismo', desc: 'IF, IG, % ausentismo, días perdidos por área · Resolución CD 513 IESS', btnLabel: 'Descargar PDF', btnColor: '#0e6b7c', onClick: onAusentismoPDF, icon: '📉' },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-slate-500">Genera y descarga los reportes institucionales en formato PDF o CSV.</p>
      {exports.map((e) => (
        <div key={e.title} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{e.icon}</span>
            <div>
              <p className="font-bold text-slate-800 text-sm">{e.title}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{e.desc}</p>
            </div>
          </div>
          <button onClick={e.onClick} className="flex-shrink-0 px-4 py-2 rounded-xl text-white text-sm font-bold border-none cursor-pointer" style={{ background: e.btnColor }}>
            {e.btnLabel}
          </button>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════
function KpiCard({ label, value, sub, color, urgent }: { label: string; value: any; sub: string; color: string; urgent?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
      {urgent && value > 0 && <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-400 animate-ping" />}
      <div className="text-[11px] font-semibold text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-extrabold tracking-tight" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function SecCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <span style={{ color: BRAND }}>{icon}</span>
        <h3 className="text-sm font-bold text-slate-800 m-0">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function HBar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  return (
    <div className="w-full bg-slate-100 rounded-full overflow-hidden" style={{ height }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, background: color, height: '100%', borderRadius: 'inherit', transition: 'width 0.6s' }} />
    </div>
  );
}

function DistBar({ total, segments }: { total: number; segments: { n: number; color: string }[] }) {
  if (!total) return null;
  return (
    <div className="h-2.5 rounded-full overflow-hidden flex mt-1.5">
      {segments.map((s, i) => s.n > 0 && (
        <div key={i} style={{ width: `${(s.n / total) * 100}%`, background: s.color }} />
      ))}
    </div>
  );
}

function MiniBarChart({ data, color }: { data: { label: string; value: number; sub?: string }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[9px] font-bold text-slate-600">{d.value > 0 ? d.value : ''}</span>
          <div className="w-full rounded-t" style={{ height: `${Math.max((d.value / max) * 72, d.value > 0 ? 3 : 0)}px`, background: d.value > 0 ? color : '#e2e8f0', transition: 'height 0.5s' }} />
          <span className="text-[8px] text-slate-400 text-center leading-tight">{d.label}</span>
          {d.sub && <span className="text-[8px] text-slate-300 text-center">{d.sub}</span>}
        </div>
      ))}
    </div>
  );
}

function AlertBanner({ tone, icon, title, desc }: { tone: 'danger' | 'warning'; icon: React.ReactNode; title: string; desc: string }) {
  const s = tone === 'danger' ? { bg: '#fce8eb', border: '#f5b8be', text: '#a01f2a' } : { bg: '#fff4e3', border: '#f5d99a', text: '#8a4a0a' };
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border" style={{ background: s.bg, borderColor: s.border }}>
      <span style={{ color: s.text }} className="mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-bold" style={{ color: s.text }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: s.text, opacity: 0.8 }}>{desc}</p>
      </div>
    </div>
  );
}

function LegDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-[3px] flex-shrink-0" style={{ background: color }} />
      {label}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-center text-sm text-slate-400 py-6">{label}</p>;
}
