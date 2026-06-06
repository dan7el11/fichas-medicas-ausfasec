import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query as fbQuery, orderBy } from 'firebase/firestore';
import {
  Calendar, Plus, Search, BedDouble, AlertTriangle, X, BarChart3, Shield, ChevronDown, ChevronUp,
} from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/dashboard/TopBar';
import type { Trabajador } from '../types';
import type { PermisoMedico, EstadoPermiso, TipoPermiso } from '../types/permiso';
import {
  getPermisos, estadoPermiso, calcularAusentismo, controlJustificativos, permisosStats,
} from '../services/permisos';
import PermisoCard from '../components/permisos/PermisoCard';
import { NuevoPermisoModal, PermisoDetalleModal } from '../components/permisos/PermisoModales';

const BRAND = '#9a3036';

type Tab = 'todos' | 'vencido' | 'pendiente' | 'activo' | 'justificado' | 'indicadores';

const TABS: { key: Tab; label: string; dot?: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'vencido', label: 'Vencidos', dot: '#dc2e3c' },
  { key: 'pendiente', label: 'Pendientes', dot: '#e08a2c' },
  { key: 'activo', label: 'En reposo', dot: '#3b82f6' },
  { key: 'justificado', label: 'Justificados', dot: '#10a05a' },
  { key: 'indicadores', label: 'Indicadores' },
];

const GRUPOS: { key: EstadoPermiso; label: string; color: string; desc: string }[] = [
  { key: 'vencido', label: 'Vencidos sin justificar', color: '#dc2e3c', desc: 'Requieren acción inmediata' },
  { key: 'pendiente', label: 'Pendientes de justificativo', color: '#e08a2c', desc: 'Falta subir el certificado' },
  { key: 'activo', label: 'En reposo activo', color: '#3b82f6', desc: 'Trabajadores ausentes hoy' },
  { key: 'justificado', label: 'Justificados', color: '#10a05a', desc: 'Con certificado o internos' },
];

export default function Permisos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [permisos, setPermisos] = useState<PermisoMedico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState(false);
  const [detalle, setDetalle] = useState<PermisoMedico | null>(null);
  const [q, setQ] = useState('');
  const [fTipo, setFTipo] = useState<TipoPermiso | 'Todos'>('Todos');
  const [tab, setTab] = useState<Tab>('todos');
  const [showAus, setShowAus] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const [tSnap, ps] = await Promise.all([
        getDocs(fbQuery(collection(db, 'trabajadores'), orderBy('primerApellido'))),
        getPermisos(),
      ]);
      setTrabajadores(tSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Trabajador)));
      setPermisos(ps);
    } catch (err) { console.error('Error al cargar permisos:', err); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const filtrados = useMemo(() => {
    let l = permisos;
    if (fTipo !== 'Todos') l = l.filter((p) => p.tipo === fTipo);
    if (q) l = l.filter((p) => `${p.apellidos} ${p.nombres} ${p.cedula}`.toLowerCase().includes(q.toLowerCase()));
    if (tab !== 'todos' && tab !== 'indicadores') l = l.filter((p) => estadoPermiso(p) === tab);
    return l;
  }, [permisos, q, fTipo, tab]);

  const stats = permisosStats(permisos);
  const aus = calcularAusentismo(permisos);
  const cj = controlJustificativos(permisos);
  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'DR';

  const countByEstado = (estado: EstadoPermiso) => permisos.filter((p) => estadoPermiso(p) === estado).length;

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden text-slate-900" style={{ background: '#f5f7fa', fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <div className="flex-1 overflow-y-auto">
        {/* ── Hero header ── */}
        <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #7a2028 100%)` }}>
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #fff 0%, transparent 60%)' }} />
          <div className="relative max-w-5xl mx-auto px-6 pt-7 pb-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <Calendar size={18} className="text-white" />
                  </div>
                  <h1 className="text-2xl font-extrabold text-white tracking-tight m-0">Permisos Médicos</h1>
                </div>
                <p className="text-sm ml-12 m-0" style={{ color: 'rgba(255,255,255,0.7)' }}>Reposos, citas y control de justificativos · AUSFASEC</p>
              </div>
              <button
                onClick={() => setNuevo(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-none cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', backdropFilter: 'blur(4px)' }}
              >
                <Plus size={16} /> Registrar permiso
              </button>
            </div>

            {/* KPI chips */}
            <div className="flex gap-3 mt-5 flex-wrap">
              <KpiChip value={stats.activos} label="En reposo" color="#60a5fa" />
              <KpiChip value={stats.pendientes} label="Pendientes" color="#fbbf24" />
              <KpiChip value={stats.vencidos} label="Vencidos" color="#f87171" urgent={stats.vencidos > 0} />
              <KpiChip value={stats.total} label="Total" color="rgba(255,255,255,0.9)" />
            </div>
          </div>

          {/* Tab bar */}
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex gap-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {TABS.map((t) => {
                const active = tab === t.key;
                const count = t.key === 'vencido' ? countByEstado('vencido')
                  : t.key === 'pendiente' ? countByEstado('pendiente')
                  : t.key === 'activo' ? countByEstado('activo')
                  : t.key === 'justificado' ? countByEstado('justificado')
                  : null;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className="px-4 py-3 text-sm font-semibold whitespace-nowrap border-none cursor-pointer transition-all flex items-center gap-1.5"
                    style={{
                      background: 'transparent',
                      color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                      borderBottom: active ? '2px solid #fff' : '2px solid transparent',
                    }}
                  >
                    {t.dot && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: active ? '#fff' : t.dot }} />}
                    {t.label}
                    {count != null && count > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)', color: '#fff' }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="max-w-5xl mx-auto px-6 py-6">
          {tab === 'indicadores' ? (
            <IndicadoresPanel aus={aus} cj={cj} />
          ) : (
            <>
              {/* Search + filter bar */}
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 bg-white flex-1 min-w-[200px] max-w-[340px] shadow-sm">
                  <Search size={15} className="text-slate-400 flex-shrink-0" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar trabajador…" className="flex-1 border-none outline-none text-sm bg-transparent" />
                </div>
                <select value={fTipo} onChange={(e) => setFTipo(e.target.value as any)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-[12.5px] font-semibold text-slate-700 cursor-pointer outline-none shadow-sm">
                  <option value="Todos">Todos los tipos</option>
                  <option value="reposo_interno">Reposo interno</option>
                  <option value="reposo_iess">Reposo IESS</option>
                  <option value="cita">Cita médica</option>
                </select>

                {/* Indicadores ausentismo (mini toggle) */}
                <button
                  onClick={() => setShowAus((v) => !v)}
                  className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-[12.5px] font-semibold text-slate-700 shadow-sm cursor-pointer"
                >
                  <BarChart3 size={14} className="text-slate-500" />
                  Indicadores
                  {showAus ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {/* Ausentismo expandible */}
              {showAus && (
                <div className="mb-5 bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                  <IndicadoresPanel aus={aus} cj={cj} compact />
                </div>
              )}

              {/* Content */}
              {cargando ? (
                <div className="p-16 text-center text-slate-400 font-semibold">Cargando permisos…</div>
              ) : tab === 'todos' ? (
                <div className="flex flex-col gap-6">
                  {GRUPOS.map((g) => {
                    const items = filtrados.filter((p) => estadoPermiso(p) === g.key);
                    if (items.length === 0) return null;
                    return (
                      <div key={g.key}>
                        <div className="flex items-center gap-2.5 mb-3">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color }} />
                          <h3 className="m-0 text-sm font-bold text-slate-900">{g.label}</h3>
                          <span className="text-[11px] font-bold rounded-full px-2 py-px" style={{ color: g.color, background: `${g.color}14` }}>{items.length}</span>
                          <span className="text-[12px] text-slate-400">· {g.desc}</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {items.map((p) => <PermisoCard key={p.id} permiso={p} onOpen={setDetalle} />)}
                        </div>
                      </div>
                    );
                  })}
                  {filtrados.length === 0 && <EmptyState />}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filtrados.length === 0 ? <EmptyState /> : filtrados.map((p) => <PermisoCard key={p.id} permiso={p} onOpen={setDetalle} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {nuevo && (
        <NuevoPermisoModal trabajadores={trabajadores} medicoId={user?.uid ?? ''} medicoNombre={user?.email ?? 'Médico'}
          onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); cargar(); }} />
      )}
      {detalle && <PermisoDetalleModal permiso={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

function KpiChip({ value, label, color, urgent }: { value: ReactNode; label: string; color: string; urgent?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${urgent ? 'animate-pulse' : ''}`} style={{ background: 'rgba(0,0,0,0.18)' }}>
      <span className="text-lg font-extrabold leading-none" style={{ color }}>{value}</span>
      <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-10 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200 shadow-sm">
      No hay permisos en esta categoría. Pulsa <strong>Registrar permiso</strong> para empezar.
    </div>
  );
}

function IndicadoresPanel({ aus, cj, compact }: { aus: ReturnType<typeof calcularAusentismo>; cj: ReturnType<typeof controlJustificativos>; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'bg-white rounded-2xl border border-slate-200 shadow-sm p-6'}>
      {!compact && (
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${BRAND}15`, color: BRAND }}>
            <BarChart3 size={16} />
          </div>
          <div>
            <h2 className="m-0 text-sm font-bold text-slate-900">Indicadores de ausentismo</h2>
            <p className="m-0 text-[11px] text-slate-400">Reposos · últimos 30 días</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Metric value={`${aus.pctAusentismo}%`} label="% Ausentismo" color="#8a4a0a" />
        <Metric value={aus.frecuencia} label="Í. Frecuencia (IF)" color={BRAND} />
        <Metric value={aus.gravedad} label="Í. Gravedad (IG)" color="#a01f2a" />
        <Metric value={aus.duracionMedia} label="Duración media" />
      </div>
      <div className="flex gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100 mb-4">
        <Shield size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
        <span className="text-[10.5px] text-slate-500 leading-snug">IF e IG según <strong>Resolución C.D. 513 del IESS</strong> y <strong>Decreto Ejecutivo 2393</strong>, con K&nbsp;=&nbsp;200.000 horas-hombre.</span>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-bold text-slate-900">Control de justificativos</span>
          <span className="text-[12px] font-bold" style={{ color: cj.pct === 100 ? '#0a6b3b' : '#8a4a0a' }}>{cj.pct}% con cert.</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex mb-2">
          {cj.total > 0 && <>
            <div style={{ width: `${(cj.conCert / cj.total) * 100}%`, background: '#10a05a' }} />
            <div style={{ width: `${(cj.pendientes / cj.total) * 100}%`, background: '#e08a2c' }} />
            <div style={{ width: `${(cj.vencidos / cj.total) * 100}%`, background: '#dc2e3c' }} />
          </>}
        </div>
        <div className="flex gap-4 text-[11.5px] text-slate-500">
          <Leg color="#10a05a" t={`${cj.conCert} con cert.`} />
          <Leg color="#e08a2c" t={`${cj.pendientes} pend.`} />
          <Leg color="#dc2e3c" t={`${cj.vencidos} venc.`} />
        </div>
      </div>
    </div>
  );
}

function Metric({ value, label, color = '#0d1b2a' }: { value: ReactNode; label: string; color?: string }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
      <div className="text-xl font-extrabold tracking-tight font-mono" style={{ color }}>{value}</div>
      <div className="text-[11px] font-bold text-slate-600 mt-0.5">{label}</div>
    </div>
  );
}

function Leg({ color, t }: { color: string; t: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-[3px]" style={{ background: color }} />{t}</span>;
}
