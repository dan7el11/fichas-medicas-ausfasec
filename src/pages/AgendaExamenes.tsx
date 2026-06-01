// Página: Agenda de Exámenes Ocupacionales. Archivo NUEVO (src/pages/AgendaExamenes.tsx).
// Ruta sugerida: /agenda-examenes. Pestañas: Agenda · Cobertura · Protocolos.
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query as fbQuery, orderBy } from 'firebase/firestore';
import {
  ClipboardList, CalendarPlus, Calendar, Check, AlertTriangle, Layers, Users,
} from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/dashboard/TopBar';
import type { Trabajador } from '../types';
import type { TipoExamen } from '../types';
import type { OrdenExamen, EstadoOrden } from '../types/examenPlan';
import {
  getOrdenes, estadoOrden, calcularStats, agruparPorEstado,
} from '../services/examenesPlan';
import { getProtocolos } from '../services/protocolos';
import OrdenCard from '../components/examenes/OrdenCard';
import { ProgramarExamenModal, OrdenDetalleModal } from '../components/examenes/ExamenModales';
import ProtocolosEditor from '../components/examenes/ProtocolosEditor';

const ACCENT = '#0e7490';
type Tab = 'agenda' | 'cobertura' | 'protocolos';

export default function AgendaExamenes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem('examenes-tab') as Tab) || 'agenda');
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenExamen[]>([]);
  const [protocolos, setProtocolos] = useState<Record<string, { nombre: string; tipo: TipoExamen }[]>>({});
  const [cargando, setCargando] = useState(true);
  const [programar, setProgramar] = useState(false);
  const [detalle, setDetalle] = useState<OrdenExamen | null>(null);

  useEffect(() => { localStorage.setItem('examenes-tab', tab); }, [tab]);

  const cargar = async () => {
    setCargando(true);
    try {
      const [tSnap, ord, proto] = await Promise.all([
        getDocs(fbQuery(collection(db, 'trabajadores'), orderBy('primerApellido'))),
        getOrdenes(),
        getProtocolos(),
      ]);
      setTrabajadores(tSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Trabajador)));
      setOrdenes(ord);
      setProtocolos(proto);
    } catch (err) { console.error('Error al cargar exámenes:', err); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const stats = useMemo(() => calcularStats(ordenes), [ordenes]);
  const grupos = useMemo(() => agruparPorEstado(ordenes), [ordenes]);

  const puestos = useMemo(() => {
    const m = new Map<string, number>();
    trabajadores.forEach((w) => { const p = w.puestoTrabajo || ''; m.set(p, (m.get(p) || 0) + 1); });
    return [...m.entries()].map(([nombre, nTrabajadores]) => ({ nombre, nTrabajadores }));
  }, [trabajadores]);

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'DR';

  const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: 'agenda', label: 'Agenda', icon: <Calendar size={15} /> },
    { key: 'cobertura', label: 'Cobertura', icon: <Check size={15} /> },
    { key: 'protocolos', label: 'Protocolos por puesto', icon: <Layers size={15} /> },
  ];

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden text-slate-900" style={{ background: '#f5f7fa', fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      {/* Sub-header con pestañas */}
      <div className="bg-white border-b border-slate-200 px-8 flex items-center gap-1 flex-shrink-0">
        <span className="grid place-items-center w-[30px] h-[30px] rounded-lg mr-2.5" style={{ background: '#e0f2fa', color: ACCENT }}><ClipboardList size={17} /></span>
        <span className="text-[14px] font-extrabold tracking-tight mr-4 whitespace-nowrap">Exámenes ocupacionales</span>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className="inline-flex items-center gap-1.5 px-3.5 py-[14px] border-none bg-transparent cursor-pointer text-[13px] -mb-px"
              style={{ fontWeight: active ? 700 : 600, color: active ? ACCENT : '#5a6a7a', borderBottom: `2px solid ${active ? ACCENT : 'transparent'}` }}>
              <span style={{ color: active ? ACCENT : '#94a2b3' }}>{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1240px] mx-auto p-[24px_32px_80px]">
          {cargando ? (
            <div className="p-16 text-center text-slate-400 font-semibold">Cargando exámenes…</div>
          ) : tab === 'protocolos' ? (
            <ProtocolosEditor protocolos={protocolos} puestos={puestos} onSaved={cargar} />
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-4 gap-3 mb-[22px]">
                <Kpi value={stats.programados} label="Programados" sub="por realizar" icon={<Calendar size={16} />} tone="info" />
                <Kpi value={stats.atrasados} label="Atrasados" sub="pasaron su fecha" icon={<AlertTriangle size={16} />} tone="danger" />
                <Kpi value={stats.realizadosMes} label="Realizados" sub="este mes" icon={<Check size={16} />} tone="success" />
                <Kpi value={`${stats.cobertura}%`} label="Cobertura" sub="órdenes completas" icon={<ClipboardList size={16} />} tone="accent" />
              </div>

              {tab === 'agenda' ? (
                <AgendaTab grupos={grupos} onProgram={() => setProgramar(true)} onDetail={setDetalle} />
              ) : (
                <CoberturaTab grupos={grupos} stats={stats} total={ordenes.length} />
              )}
            </>
          )}
        </div>
      </main>

      {programar && (
        <ProgramarExamenModal trabajadores={trabajadores} protocolos={protocolos} medicoId={user?.uid ?? ''} medicoNombre={user?.email ?? 'Médico'}
          onClose={() => setProgramar(false)} onSaved={() => { setProgramar(false); cargar(); }} />
      )}
      {detalle && <OrdenDetalleModal orden={detalle} onClose={() => setDetalle(null)} onSaved={() => { setDetalle(null); cargar(); }} />}
    </div>
  );
}

// ── Pestaña Agenda ───────────────────────────────────────────────────────────
function AgendaTab({ grupos, onProgram, onDetail }: {
  grupos: Record<EstadoOrden, OrdenExamen[]>; onProgram: () => void; onDetail: (o: OrdenExamen) => void;
}) {
  const total = grupos.atrasado.length + grupos.proceso.length + grupos.programado.length;
  return (
    <div>
      <div className="flex items-center mb-[18px]">
        <div>
          <h2 className="m-0 text-[18px] font-extrabold tracking-tight">Agenda de exámenes</h2>
          <p className="mt-0.5 mb-0 text-[13px] text-slate-500">Órdenes activas. Atrasadas primero.</p>
        </div>
        <button onClick={onProgram} className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 text-white border-none rounded-[9px] text-[14px] font-bold cursor-pointer" style={{ background: ACCENT }}>
          <CalendarPlus size={16} /> Programar exámenes
        </button>
      </div>

      {total === 0 && (
        <div className="p-10 text-center text-slate-400 text-[13px] bg-white rounded-[14px] border border-slate-200">
          No hay órdenes activas. Pulsa «Programar exámenes» para crear la primera.
        </div>
      )}
      <Grupo color="#dc2e3c" label="Atrasados" items={grupos.atrasado} onDetail={onDetail} />
      <Grupo color="#e08a2c" label="En proceso" items={grupos.proceso} onDetail={onDetail} />
      <Grupo color="#0e9bbf" label="Programados" items={grupos.programado} onDetail={onDetail} />
    </div>
  );
}
function Grupo({ color, label, items, onDetail }: { color: string; label: string; items: OrdenExamen[]; onDetail: (o: OrdenExamen) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-[22px]">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-[7px] h-[7px] rounded-full" style={{ background: color }} />
        <h3 className="m-0 text-[14px] font-bold text-slate-900">{label}</h3>
        <span className="text-[12px] text-slate-400">{items.length}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {items.map((o) => <OrdenCard key={o.id} orden={o} onOpen={onDetail} />)}
      </div>
    </div>
  );
}

// ── Pestaña Cobertura ────────────────────────────────────────────────────────
function CoberturaTab({ grupos, stats, total }: { grupos: Record<EstadoOrden, OrdenExamen[]>; stats: ReturnType<typeof calcularStats>; total: number }) {
  const filas: { label: string; n: number; color: string }[] = [
    { label: 'Completadas', n: grupos.completado.length, color: '#10a05a' },
    { label: 'En proceso', n: grupos.proceso.length, color: '#e08a2c' },
    { label: 'Programadas', n: grupos.programado.length, color: '#0e9bbf' },
    { label: 'Atrasadas', n: grupos.atrasado.length, color: '#dc2e3c' },
  ];
  const max = Math.max(...filas.map((f) => f.n), 1);
  return (
    <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1fr 360px' }}>
      <div className="bg-white border border-slate-200 rounded-[16px] shadow-sm p-[20px_22px]">
        <h2 className="m-0 mb-1 text-[16px] font-extrabold tracking-tight">Cobertura de exámenes</h2>
        <p className="mt-0 mb-4 text-[13px] text-slate-500">Distribución de las {total} órdenes por estado</p>
        {/* barra apilada */}
        <div className="flex h-2.5 rounded-full overflow-hidden mb-4 bg-slate-100">
          {filas.map((f) => f.n > 0 && <div key={f.label} title={`${f.label}: ${f.n}`} style={{ width: `${(f.n / Math.max(total, 1)) * 100}%`, background: f.color }} />)}
        </div>
        <div className="flex flex-col gap-3">
          {filas.map((f) => (
            <div key={f.label}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: f.color }} />
                <span className="flex-1 text-[13px] text-slate-700">{f.label}</span>
                <span className="text-[13px] font-bold text-slate-900">{f.n}</span>
                <span className="text-[11px] text-slate-400 min-w-[34px] text-right">{total ? Math.round((f.n / total) * 100) : 0}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(f.n / max) * 100}%`, background: f.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[16px] shadow-sm p-[20px_22px]">
        <div className="flex items-center gap-2 mb-4">
          <span className="grid place-items-center w-7 h-7 rounded-lg" style={{ background: '#e0f2fa', color: ACCENT }}><Users size={16} /></span>
          <h3 className="m-0 text-[15px] font-bold">Resumen</h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Metric value={`${stats.cobertura}%`} label="Cobertura global" color={ACCENT} />
          <Metric value={stats.completados} label="Completadas" color="#0a6b3b" />
          <Metric value={stats.atrasados} label="Atrasadas" color="#a01f2a" />
          <Metric value={stats.realizadosMes} label="Realizados (mes)" />
        </div>
      </div>
    </div>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────────────
const TONES: Record<string, { fg: string; bg: string }> = {
  accent: { fg: ACCENT, bg: '#e0f2fa' }, success: { fg: '#0a6b3b', bg: '#e6f6ee' },
  warning: { fg: '#8a4a0a', bg: '#fff4e3' }, danger: { fg: '#a01f2a', bg: '#fce8eb' }, info: { fg: '#1d4fad', bg: '#eaf3ff' },
};
function Kpi({ value, label, sub, icon, tone }: { value: ReactNode; label: string; sub: string; icon: ReactNode; tone: string }) {
  const t = TONES[tone] ?? TONES.accent;
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-[14px_17px] relative overflow-hidden shadow-sm">
      <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ background: t.fg }} />
      <div className="flex items-center justify-between">
        <div className="text-[28px] font-extrabold tracking-tight leading-none" style={{ color: t.fg }}>{value}</div>
        <span className="grid place-items-center w-[30px] h-[30px] rounded-lg" style={{ background: t.bg, color: t.fg }}>{icon}</span>
      </div>
      <div className="text-[12.5px] font-semibold text-slate-900 mt-2">{label}</div>
      <div className="text-[11px] text-slate-400">{sub}</div>
    </div>
  );
}
function Metric({ value, label, color = '#0d1b2a' }: { value: ReactNode; label: string; color?: string }) {
  return <div className="bg-slate-50 border border-slate-100 rounded-[10px] p-[11px_12px]">
    <div className="text-[20px] font-extrabold tracking-tight font-mono" style={{ color }}>{value}</div>
    <div className="text-[11px] font-bold text-slate-600 mt-0.5">{label}</div>
  </div>;
}
