// Página: Agenda de Exámenes Ocupacionales. Ruta /agenda-examenes.
// Restyle v2 (tema central): Spectral en títulos, mono en datos, neutros fríos.
// Acento del módulo: cian. NINGÚN cambio funcional.
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
  getOrdenes, calcularStats, agruparPorEstado,
} from '../services/examenesPlan';
import { getProtocolos } from '../services/protocolos';
import OrdenCard from '../components/examenes/OrdenCard';
import { ProgramarExamenModal, OrdenDetalleModal } from '../components/examenes/ExamenModales';
import ProtocolosEditor from '../components/examenes/ProtocolosEditor';
import { COLORS, FONTS, TONE } from '../theme';

const ACCENT = COLORS.cyan;
const ACCENT_BG = COLORS.cyanBg;
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
  const hoy = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: 'agenda', label: 'Agenda', icon: <Calendar size={15} /> },
    { key: 'cobertura', label: 'Cobertura', icon: <Check size={15} /> },
    { key: 'protocolos', label: 'Protocolos por puesto', icon: <Layers size={15} /> },
  ];

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: COLORS.bg, color: COLORS.ink, fontFamily: FONTS.sans }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      {/* Sub-header con pestañas */}
      <div className="border-b px-8 flex items-center gap-1 flex-shrink-0" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
        <span className="grid place-items-center w-[30px] h-[30px] rounded-lg mr-2.5" style={{ background: ACCENT_BG, color: ACCENT }}><ClipboardList size={17} /></span>
        <span className="text-[15px] font-semibold mr-4 whitespace-nowrap" style={{ fontFamily: FONTS.serif }}>Exámenes ocupacionales</span>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className="inline-flex items-center gap-1.5 px-3.5 py-[14px] border-none bg-transparent cursor-pointer text-[13px] -mb-px"
              style={{ fontWeight: active ? 700 : 600, color: active ? ACCENT : COLORS.muted, borderBottom: `2.5px solid ${active ? ACCENT : 'transparent'}` }}>
              <span style={{ color: active ? ACCENT : COLORS.faint }}>{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1240px] mx-auto p-[24px_32px_80px]">
          {cargando ? (
            <div className="p-16 text-center font-semibold" style={{ color: COLORS.faint }}>Cargando exámenes…</div>
          ) : tab === 'protocolos' ? (
            <ProtocolosEditor protocolos={protocolos} puestos={puestos} onSaved={cargar} />
          ) : (
            <>
              {/* Eyebrow + KPIs */}
              <div className="text-[11px] font-semibold uppercase mb-3" style={{ color: COLORS.brand, letterSpacing: '1.4px' }}>
                {hoy.charAt(0).toUpperCase() + hoy.slice(1)}
              </div>
              <div className="grid grid-cols-4 gap-3 mb-[22px]">
                <Kpi value={stats.programados} label="Programados" sub="por realizar" icon={<Calendar size={16} />} tone="info" />
                <Kpi value={stats.atrasados} label="Atrasados" sub="pasaron su fecha" icon={<AlertTriangle size={16} />} tone="danger" />
                <Kpi value={stats.realizadosMes} label="Realizados" sub="este mes" icon={<Check size={16} />} tone="success" />
                <Kpi value={`${stats.cobertura}%`} label="Cobertura" sub="órdenes completas" icon={<ClipboardList size={16} />} tone="cyan" />
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
      {detalle && <OrdenDetalleModal orden={detalle} onClose={() => setDetalle(null)} onSaved={() => { setDetalle(null); cargar(); }} onDeleted={() => { setDetalle(null); cargar(); }} />}
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
          <h2 className="m-0 text-[19px] font-semibold tracking-tight" style={{ fontFamily: FONTS.serif }}>Agenda de exámenes</h2>
          <p className="mt-0.5 mb-0 text-[13px]" style={{ color: COLORS.muted }}>Órdenes activas. Atrasadas primero.</p>
        </div>
        <button onClick={onProgram} className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 text-white border-none rounded-[9px] text-[14px] font-bold cursor-pointer" style={{ background: ACCENT }}>
          <CalendarPlus size={16} /> Programar exámenes
        </button>
      </div>

      {total === 0 && (
        <div className="p-10 text-center text-[13px] rounded-[14px] border" style={{ background: COLORS.panel, borderColor: COLORS.line, color: COLORS.faint }}>
          No hay órdenes activas. Pulsa «Programar exámenes» para crear la primera.
        </div>
      )}
      <Grupo color={COLORS.bad} label="Atrasados" items={grupos.atrasado} onDetail={onDetail} />
      <Grupo color={COLORS.warn} label="En proceso" items={grupos.proceso} onDetail={onDetail} />
      <Grupo color={ACCENT} label="Programados" items={grupos.programado} onDetail={onDetail} />
    </div>
  );
}
function Grupo({ color, label, items, onDetail }: { color: string; label: string; items: OrdenExamen[]; onDetail: (o: OrdenExamen) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-[22px]">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-[7px] h-[7px] rounded-full" style={{ background: color }} />
        <h3 className="m-0 text-[15px] font-semibold" style={{ fontFamily: FONTS.serif, color: COLORS.ink }}>{label}</h3>
        <span className="text-[12px]" style={{ fontFamily: FONTS.mono, color: COLORS.faint }}>{items.length}</span>
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
    { label: 'Completadas', n: grupos.completado.length, color: COLORS.ok },
    { label: 'En proceso', n: grupos.proceso.length, color: COLORS.warn },
    { label: 'Programadas', n: grupos.programado.length, color: ACCENT },
    { label: 'Atrasadas', n: grupos.atrasado.length, color: COLORS.bad },
  ];
  const max = Math.max(...filas.map((f) => f.n), 1);
  return (
    <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1fr 360px' }}>
      <div className="rounded-[16px] border p-[20px_22px]" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
        <h2 className="m-0 mb-1 text-[17px] font-semibold tracking-tight" style={{ fontFamily: FONTS.serif }}>Cobertura de exámenes</h2>
        <p className="mt-0 mb-4 text-[13px]" style={{ color: COLORS.muted }}>Distribución de las {total} órdenes por estado</p>
        <div className="flex h-2.5 rounded-full overflow-hidden mb-4" style={{ background: COLORS.bg }}>
          {filas.map((f) => f.n > 0 && <div key={f.label} title={`${f.label}: ${f.n}`} style={{ width: `${(f.n / Math.max(total, 1)) * 100}%`, background: f.color }} />)}
        </div>
        <div className="flex flex-col gap-3">
          {filas.map((f) => (
            <div key={f.label}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: f.color }} />
                <span className="flex-1 text-[13px]" style={{ color: COLORS.muted }}>{f.label}</span>
                <span className="text-[13px] font-bold" style={{ fontFamily: FONTS.mono, color: COLORS.ink }}>{f.n}</span>
                <span className="text-[11px] min-w-[34px] text-right" style={{ color: COLORS.faint }}>{total ? Math.round((f.n / total) * 100) : 0}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.bg }}>
                <div className="h-full rounded-full" style={{ width: `${(f.n / max) * 100}%`, background: f.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[16px] border p-[20px_22px]" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="grid place-items-center w-7 h-7 rounded-lg" style={{ background: ACCENT_BG, color: ACCENT }}><Users size={16} /></span>
          <h3 className="m-0 text-[15px] font-semibold" style={{ fontFamily: FONTS.serif }}>Resumen</h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Metric value={`${stats.cobertura}%`} label="Cobertura global" color={ACCENT} />
          <Metric value={stats.completados} label="Completadas" color={COLORS.ok} />
          <Metric value={stats.atrasados} label="Atrasadas" color={COLORS.bad} />
          <Metric value={stats.realizadosMes} label="Realizados (mes)" color={COLORS.ink} />
        </div>
      </div>
    </div>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────────────
function Kpi({ value, label, sub, icon, tone }: { value: ReactNode; label: string; sub: string; icon: ReactNode; tone: keyof typeof TONE | 'cyan' }) {
  const t = tone === 'cyan' ? { fg: COLORS.cyan, bg: COLORS.cyanBg } : TONE[tone];
  return (
    <div className="rounded-[14px] p-[14px_16px] flex items-center gap-3 border" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
      <span className="grid place-items-center w-[34px] h-[34px] rounded-[9px] flex-shrink-0" style={{ background: t.bg, color: t.fg }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[22px] font-bold tracking-tight leading-none" style={{ fontFamily: FONTS.mono, color: t.fg }}>{value}</div>
        <div className="text-[12px] font-semibold mt-1" style={{ color: COLORS.ink }}>{label}</div>
        <div className="text-[10.5px]" style={{ color: COLORS.faint }}>{sub}</div>
      </div>
    </div>
  );
}
function Metric({ value, label, color }: { value: ReactNode; label: string; color: string }) {
  return <div className="rounded-[10px] border p-[11px_12px]" style={{ background: COLORS.bg, borderColor: COLORS.line }}>
    <div className="text-[20px] font-bold tracking-tight" style={{ fontFamily: FONTS.mono, color }}>{value}</div>
    <div className="text-[11px] font-bold mt-0.5" style={{ color: COLORS.muted }}>{label}</div>
  </div>;
}
