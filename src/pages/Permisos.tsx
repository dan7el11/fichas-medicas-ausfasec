// Página: Permisos médicos. Ruta /permisos. Layout "Por estado".
// Restyle v2 (tema central): Spectral en títulos, mono en datos, neutros fríos.
// Acento del módulo: violeta. NINGÚN cambio funcional.
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query as fbQuery, orderBy } from 'firebase/firestore';
import {
  Calendar, Plus, Search, BedDouble, AlertTriangle, X, BarChart3, Shield,
} from 'lucide-react';
import { db } from '../services/firebase';
import { getTrabajadores } from '../services/trabajadores';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/dashboard/TopBar';
import type { Trabajador } from '../types';
import type { PermisoMedico, EstadoPermiso, TipoPermiso } from '../types/permiso';
import {
  getPermisos, estadoPermiso, calcularAusentismo, controlJustificativos, permisosStats,
} from '../services/permisos';
import PermisoCard from '../components/permisos/PermisoCard';
import { NuevoPermisoModal, PermisoDetalleModal } from '../components/permisos/PermisoModales';
import { COLORS, FONTS, TONE } from '../theme';

const ACCENT = COLORS.violet;
const ACCENT_BG = COLORS.violetBg;

const GRUPOS: { key: EstadoPermiso; label: string; color: string; desc: string }[] = [
  { key: 'vencido', label: 'Vencidos sin justificar', color: COLORS.bad, desc: 'Requieren acción inmediata' },
  { key: 'pendiente', label: 'Pendientes de justificativo', color: COLORS.warn, desc: 'Falta subir el certificado' },
  { key: 'activo', label: 'En reposo activo', color: COLORS.blue, desc: 'Trabajadores ausentes hoy' },
  { key: 'justificado', label: 'Justificados', color: COLORS.ok, desc: 'Con certificado o internos' },
];

export default function Permisos() {
  const { user, nombreProfesional } = useAuth();
  const navigate = useNavigate();
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [permisos, setPermisos] = useState<PermisoMedico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState(false);
  const [detalle, setDetalle] = useState<PermisoMedico | null>(null);
  const [q, setQ] = useState('');
  const [fTipo, setFTipo] = useState<TipoPermiso | 'Todos'>('Todos');

  const cargar = async () => {
    setCargando(true);
    try {
      const [ts, ps] = await Promise.all([
        getTrabajadores(),
        getPermisos(),
      ]);
      setTrabajadores(ts);
      setPermisos(ps);
    } catch (err) { console.error('Error al cargar permisos:', err); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const filtrados = useMemo(() => {
    let l = permisos;
    if (fTipo !== 'Todos') l = l.filter((p) => p.tipo === fTipo);
    if (q) l = l.filter((p) => `${p.apellidos} ${p.nombres} ${p.cedula}`.toLowerCase().includes(q.toLowerCase()));
    return l;
  }, [permisos, q, fTipo]);

  const stats = permisosStats(permisos);
  const aus = calcularAusentismo(permisos);
  const cj = controlJustificativos(permisos);
  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'DR';
  const hoy = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: COLORS.bg, color: COLORS.ink, fontFamily: FONTS.sans }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] overflow-y-auto lg:overflow-hidden">
        {/* Columna principal */}
        <div className="lg:overflow-y-auto p-[16px_16px_60px] md:p-[24px_28px_80px]">
          <div className="max-w-[720px] mx-auto">
            {/* Header */}
            <div className="flex items-end gap-3 mb-[20px] flex-wrap">
              <div>
                <div className="text-[11px] font-semibold uppercase" style={{ color: COLORS.brand, letterSpacing: '1.4px' }}>
                  {hoy.charAt(0).toUpperCase() + hoy.slice(1)}
                </div>
                <h1 className="mt-1.5 mb-0 text-[28px] font-bold tracking-tight" style={{ fontFamily: FONTS.serif }}>Permisos médicos</h1>
                <p className="mt-1 mb-0 text-[13px]" style={{ color: COLORS.muted }}>Reposos, citas y control de justificativos</p>
              </div>
              <button onClick={() => setNuevo(true)} className="ml-auto inline-flex items-center gap-1.5 px-[18px] py-[11px] text-white border-none rounded-[9px] text-[14px] font-bold cursor-pointer" style={{ background: ACCENT }}>
                <Plus size={17} /> Registrar permiso
              </button>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-2 mb-3.5 flex-wrap">
              <div className="flex items-center gap-2 p-[8px_12px] rounded-[9px] border flex-1 min-w-[200px] max-w-[320px]" style={{ borderColor: COLORS.line, background: COLORS.panel }}>
                <Search size={15} style={{ color: COLORS.faint }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar trabajador…" className="flex-1 border-none outline-none text-[13px] bg-transparent" style={{ color: COLORS.ink }} />
              </div>
              <select value={fTipo} onChange={(e) => setFTipo(e.target.value as any)} className="px-3 py-[9px] rounded-[9px] border text-[12.5px] font-semibold cursor-pointer outline-none" style={{ borderColor: COLORS.line, background: COLORS.panel, color: COLORS.muted }}>
                <option value="Todos">Todos los tipos</option>
                <option value="reposo_interno">Reposo interno</option>
                <option value="reposo_iess">Reposo IESS</option>
                <option value="cita">Cita médica</option>
              </select>
            </div>

            {/* Grupos por estado */}
            {cargando ? (
              <div className="p-16 text-center font-semibold" style={{ color: COLORS.faint }}>Cargando permisos…</div>
            ) : (
              <div className="flex flex-col gap-5">
                {GRUPOS.map((g) => {
                  const items = filtrados.filter((p) => estadoPermiso(p) === g.key);
                  if (items.length === 0) return null;
                  return (
                    <div key={g.key}>
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                        <h3 className="m-0 text-[15px] font-semibold" style={{ fontFamily: FONTS.serif, color: COLORS.ink }}>{g.label}</h3>
                        <span className="text-[12px] font-bold rounded-full px-2.5 py-px" style={{ fontFamily: FONTS.mono, color: g.color, background: `${g.color}16` }}>{items.length}</span>
                        <span className="text-[12px]" style={{ color: COLORS.faint }}>· {g.desc}</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {items.map((p) => <PermisoCard key={p.id} permiso={p} onOpen={setDetalle} />)}
                      </div>
                    </div>
                  );
                })}
                {filtrados.length === 0 && (
                  <div className="p-10 text-center text-[13px] rounded-[13px] border" style={{ background: COLORS.panel, borderColor: COLORS.line, color: COLORS.faint }}>
                    No hay permisos registrados. Pulsa «Registrar permiso» para empezar.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Panel lateral derecho */}
        <div className="border-t lg:border-t-0 lg:border-l lg:overflow-y-auto p-[24px_22px]" style={{ borderColor: COLORS.line, background: '#e9ebef' }}>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <MiniKpi value={stats.activos} label="En reposo" sub="hoy" icon={<BedDouble size={16} />} tone="info" />
            <MiniKpi value={stats.pendientes} label="Pendientes" sub="justificativo" icon={<AlertTriangle size={16} />} tone="warning" />
            <MiniKpi value={stats.vencidos} label="Vencidos" sub="sin justificar" icon={<X size={16} />} tone="danger" />
            <MiniKpi value={stats.total} label="Total" sub="periodo" icon={<Calendar size={16} />} tone="violet" />
          </div>

          {/* Indicadores de ausentismo */}
          <div className="rounded-[14px] p-[16px_18px] border" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="grid place-items-center w-[26px] h-[26px] rounded-[7px]" style={{ background: ACCENT_BG, color: ACCENT }}><BarChart3 size={15} /></span>
              <h3 className="m-0 text-[15px] font-semibold" style={{ fontFamily: FONTS.serif }}>Indicadores de ausentismo</h3>
            </div>
            <p className="mt-0 mb-3.5 ml-[34px] text-[11.5px]" style={{ color: COLORS.faint }}>Reposos · últimos 30 días</p>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <Metric value={`${aus.pctAusentismo}%`} label="% Ausentismo" color={COLORS.warn} />
              <Metric value={aus.frecuencia} label="Í. Frecuencia (IF)" color={ACCENT} />
              <Metric value={aus.gravedad} label="Í. Gravedad (IG)" color={COLORS.bad} />
              <Metric value={aus.duracionMedia} label="Duración media" color={COLORS.ink} />
            </div>
            <div className="flex gap-1.5 p-[9px_12px] rounded-[9px] border mb-4" style={{ background: COLORS.bg, borderColor: COLORS.line }}>
              <Shield size={14} className="flex-shrink-0" style={{ color: COLORS.faint }} />
              <span className="text-[10.5px] leading-snug" style={{ color: COLORS.muted }}>IF e IG según <strong>Resolución C.D. 513 del IESS</strong> y <strong>Decreto Ejecutivo 2393</strong>, con K = 200.000 horas-hombre.</span>
            </div>
            {/* Control de justificativos */}
            <div className="pt-3.5 border-t" style={{ borderColor: COLORS.line }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-bold" style={{ color: COLORS.ink }}>Control de justificativos</span>
                <span className="text-[12px] font-bold" style={{ color: cj.pct === 100 ? COLORS.ok : COLORS.warn }}>{cj.pct}% con cert.</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden flex mb-2" style={{ background: COLORS.bg }}>
                {cj.total > 0 && <>
                  <div style={{ width: `${(cj.conCert / cj.total) * 100}%`, background: COLORS.ok }} />
                  <div style={{ width: `${(cj.pendientes / cj.total) * 100}%`, background: COLORS.warn }} />
                  <div style={{ width: `${(cj.vencidos / cj.total) * 100}%`, background: COLORS.bad }} />
                </>}
              </div>
              <div className="flex gap-3.5 text-[11.5px]" style={{ color: COLORS.muted }}>
                <Leg color={COLORS.ok} t={`${cj.conCert} con cert.`} />
                <Leg color={COLORS.warn} t={`${cj.pendientes} pend.`} />
                <Leg color={COLORS.bad} t={`${cj.vencidos} venc.`} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {nuevo && (
        <NuevoPermisoModal trabajadores={trabajadores} medicoId={user?.uid ?? ''} medicoNombre={nombreProfesional}
          onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); cargar(); }} />
      )}
      {detalle && <PermisoDetalleModal permiso={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

function MiniKpi({ value, label, sub, icon, tone }: { value: ReactNode; label: string; sub: string; icon: ReactNode; tone: keyof typeof TONE | 'violet' }) {
  const t = tone === 'violet' ? { fg: COLORS.violet, bg: COLORS.violetBg } : TONE[tone];
  return (
    <div className="rounded-[14px] p-[13px_15px] border" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
      <div className="flex items-center justify-between">
        <div className="text-[24px] font-bold tracking-tight leading-none" style={{ fontFamily: FONTS.mono, color: t.fg }}>{value}</div>
        <span className="grid place-items-center w-7 h-7 rounded-lg" style={{ background: t.bg, color: t.fg }}>{icon}</span>
      </div>
      <div className="text-[12px] font-semibold mt-1.5" style={{ color: COLORS.ink }}>{label}</div>
      <div className="text-[10.5px]" style={{ color: COLORS.faint }}>{sub}</div>
    </div>
  );
}
function Metric({ value, label, color }: { value: ReactNode; label: string; color: string }) {
  return <div className="rounded-[10px] p-[10px_12px] border" style={{ background: COLORS.bg, borderColor: COLORS.line }}>
    <div className="text-[20px] font-bold tracking-tight" style={{ fontFamily: FONTS.mono, color }}>{value}</div>
    <div className="text-[11px] font-bold mt-0.5" style={{ color: COLORS.muted }}>{label}</div>
  </div>;
}
function Leg({ color, t }: { color: string; t: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-[3px]" style={{ background: color }} />{t}</span>;
}
