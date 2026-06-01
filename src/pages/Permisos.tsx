// Página: Permisos médicos. Archivo NUEVO (src/pages/Permisos.tsx).
// Ruta sugerida: /permisos. Layout "Por estado" (el elegido en el prototipo).
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query as fbQuery, orderBy } from 'firebase/firestore';
import {
  Calendar, Plus, Search, BedDouble, AlertTriangle, X, BarChart3, Shield, Download,
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

const ACCENT = '#7c5cf2';

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
    return l;
  }, [permisos, q, fTipo]);

  const stats = permisosStats(permisos);
  const aus = calcularAusentismo(permisos);
  const cj = controlJustificativos(permisos);
  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'DR';

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden text-slate-900" style={{ background: '#f5f7fa', fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <main className="flex-1 overflow-hidden grid" style={{ gridTemplateColumns: '1fr 360px' }}>
        {/* Columna principal */}
        <div className="overflow-y-auto p-[24px_28px_80px]">
          <div className="max-w-[720px] mx-auto">
            {/* Header */}
            <div className="flex items-end gap-3 mb-[18px] flex-wrap">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="grid place-items-center w-8 h-8 rounded-[9px]" style={{ background: '#f0ebff', color: ACCENT }}><Calendar size={18} /></span>
                  <h1 className="m-0 text-[22px] font-extrabold tracking-tight">Permisos médicos</h1>
                </div>
                <p className="mt-1.5 mb-0 ml-[41px] text-[13px] text-slate-500">Reposos, citas y control de justificativos</p>
              </div>
              <button onClick={() => setNuevo(true)} className="ml-auto inline-flex items-center gap-1.5 px-[18px] py-[11px] text-white border-none rounded-[9px] text-[14px] font-bold cursor-pointer" style={{ background: ACCENT }}>
                <Plus size={17} /> Registrar permiso
              </button>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-2 mb-3.5 flex-wrap">
              <div className="flex items-center gap-2 p-[8px_12px] rounded-[9px] border border-slate-300 bg-white flex-1 min-w-[200px] max-w-[320px]">
                <Search size={15} className="text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar trabajador…" className="flex-1 border-none outline-none text-[13px] bg-transparent" />
              </div>
              <select value={fTipo} onChange={(e) => setFTipo(e.target.value as any)} className="px-3 py-[9px] rounded-[9px] border border-slate-300 bg-white text-[12.5px] font-semibold text-slate-700 cursor-pointer outline-none">
                <option value="Todos">Todos los tipos</option>
                <option value="reposo_interno">Reposo interno</option>
                <option value="reposo_iess">Reposo IESS</option>
                <option value="cita">Cita médica</option>
              </select>
            </div>

            {/* Grupos por estado */}
            {cargando ? (
              <div className="p-16 text-center text-slate-400 font-semibold">Cargando permisos…</div>
            ) : (
              <div className="flex flex-col gap-5">
                {GRUPOS.map((g) => {
                  const items = filtrados.filter((p) => estadoPermiso(p) === g.key);
                  if (items.length === 0) return null;
                  return (
                    <div key={g.key}>
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                        <h3 className="m-0 text-[14.5px] font-bold text-slate-900">{g.label}</h3>
                        <span className="text-[12px] font-bold rounded-full px-2.5 py-px" style={{ color: g.color, background: `${g.color}14` }}>{items.length}</span>
                        <span className="text-[12px] text-slate-400">· {g.desc}</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {items.map((p) => <PermisoCard key={p.id} permiso={p} onOpen={setDetalle} />)}
                      </div>
                    </div>
                  );
                })}
                {filtrados.length === 0 && (
                  <div className="p-10 text-center text-slate-400 text-[13px] bg-white rounded-[13px] border border-slate-200">
                    No hay permisos registrados. Pulsa «Registrar permiso» para empezar.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Panel lateral derecho */}
        <div className="border-l border-slate-200 overflow-y-auto p-[24px_22px]" style={{ background: '#f7f8fb' }}>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <MiniKpi value={stats.activos} label="En reposo" sub="hoy" icon={<BedDouble size={16} />} tone="info" />
            <MiniKpi value={stats.pendientes} label="Pendientes" sub="justificativo" icon={<AlertTriangle size={16} />} tone="warning" />
            <MiniKpi value={stats.vencidos} label="Vencidos" sub="sin justificar" icon={<X size={16} />} tone="danger" />
            <MiniKpi value={stats.total} label="Total" sub="periodo" icon={<Calendar size={16} />} tone="accent" />
          </div>

          {/* Indicadores de ausentismo */}
          <div className="bg-white border border-slate-200 rounded-[14px] p-[16px_18px] shadow-sm">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="grid place-items-center w-[26px] h-[26px] rounded-[7px]" style={{ background: '#f0ebff', color: ACCENT }}><BarChart3 size={15} /></span>
              <h3 className="m-0 text-[14px] font-bold">Indicadores de ausentismo</h3>
            </div>
            <p className="mt-0 mb-3.5 ml-[34px] text-[11.5px] text-slate-400">Reposos · últimos 30 días</p>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <Metric value={`${aus.pctAusentismo}%`} label="% Ausentismo" color="#8a4a0a" />
              <Metric value={aus.frecuencia} label="Í. Frecuencia (IF)" color="#7c5cf2" />
              <Metric value={aus.gravedad} label="Í. Gravedad (IG)" color="#a01f2a" />
              <Metric value={aus.duracionMedia} label="Duración media" />
            </div>
            <div className="flex gap-1.5 p-[9px_12px] rounded-[9px] bg-slate-50 border border-slate-100 mb-4">
              <Shield size={14} className="text-slate-400 flex-shrink-0" />
              <span className="text-[10.5px] text-slate-500 leading-snug">IF e IG según <strong>Resolución C.D. 513 del IESS</strong> y <strong>Decreto Ejecutivo 2393</strong>, con K = 200.000 horas-hombre.</span>
            </div>
            {/* Control de justificativos */}
            <div className="pt-3.5 border-t border-slate-100">
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
              <div className="flex gap-3.5 text-[11.5px] text-slate-500">
                <Leg color="#10a05a" t={`${cj.conCert} con cert.`} />
                <Leg color="#e08a2c" t={`${cj.pendientes} pend.`} />
                <Leg color="#dc2e3c" t={`${cj.vencidos} venc.`} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {nuevo && (
        <NuevoPermisoModal trabajadores={trabajadores} medicoId={user?.uid ?? ''} medicoNombre={user?.email ?? 'Médico'}
          onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); cargar(); }} />
      )}
      {detalle && <PermisoDetalleModal permiso={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

const TONES: Record<string, { fg: string; bg: string }> = {
  accent: { fg: ACCENT, bg: '#f0ebff' }, info: { fg: '#1d4fad', bg: '#eaf3ff' },
  warning: { fg: '#8a4a0a', bg: '#fff4e3' }, danger: { fg: '#a01f2a', bg: '#fce8eb' },
};
function MiniKpi({ value, label, sub, icon, tone }: { value: ReactNode; label: string; sub: string; icon: ReactNode; tone: string }) {
  const t = TONES[tone] ?? TONES.accent;
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-[13px_15px] relative overflow-hidden shadow-sm">
      <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ background: t.fg }} />
      <div className="flex items-center justify-between">
        <div className="text-[24px] font-extrabold tracking-tight leading-none" style={{ color: t.fg }}>{value}</div>
        <span className="grid place-items-center w-7 h-7 rounded-lg" style={{ background: t.bg, color: t.fg }}>{icon}</span>
      </div>
      <div className="text-[12px] font-semibold text-slate-900 mt-1.5">{label}</div>
      <div className="text-[10.5px] text-slate-400">{sub}</div>
    </div>
  );
}
function Metric({ value, label, color = '#0d1b2a' }: { value: ReactNode; label: string; color?: string }) {
  return <div className="bg-slate-50 border border-slate-100 rounded-[10px] p-[10px_12px]">
    <div className="text-[20px] font-extrabold tracking-tight font-mono" style={{ color }}>{value}</div>
    <div className="text-[11px] font-bold text-slate-600 mt-0.5">{label}</div>
  </div>;
}
function Leg({ color, t }: { color: string; t: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-[3px]" style={{ background: color }} />{t}</span>;
}
