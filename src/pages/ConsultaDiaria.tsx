// Página: Consulta Médica Diaria. Ruta /consulta-diaria.
// Permite navegar a días previos y ver el registro por día, semana o mes,
// con la tabla en formato registro de morbilidad (estilo matriz Excel).
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query as fbQuery, orderBy } from 'firebase/firestore';
import {
  Stethoscope, Plus, Activity, List, Check, Clock, User, Pill,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { db } from '../services/firebase';
import { getTrabajadores } from '../services/trabajadores';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/dashboard/TopBar';
import type { Trabajador } from '../types';
import type { AtencionMedica } from '../types/atencion';
import {
  getAtencionesEnRango, calcularStats, rangoPeriodo, desplazarPeriodo,
  type PeriodoVista,
} from '../services/atenciones';
import { COLORS, FONTS, TONE } from '../theme';

import AtencionCard from '../components/consulta/AtencionCard';
import RegistroAtenciones from '../components/consulta/RegistroAtenciones';
import ConsultaResumen from '../components/consulta/ConsultaResumen';
import NuevaAtencionModal from '../components/consulta/NuevaAtencionModal';

const ACCENT = COLORS.blue;

const PERIODOS: { id: PeriodoVista; label: string }[] = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
];

function esMismoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Clave local yyyy-mm-dd (sin zona horaria)
function keyFecha(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function labelSemana(lunes: Date): string {
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  const di = lunes.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
  const df = domingo.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${di} – ${df}`;
}

function labelMes(d: Date): string {
  const s = d.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tituloPeriodo(periodo: PeriodoVista, ref: Date): string {
  if (periodo === 'dia') {
    const s = ref.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (periodo === 'semana') {
    const { inicio, fin } = rangoPeriodo('semana', ref);
    const ultimo = new Date(fin); ultimo.setDate(ultimo.getDate() - 1);
    const di = inicio.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
    const df = ultimo.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
    return `Semana del ${di} al ${df}`;
  }
  const s = ref.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ConsultaDiaria() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [atenciones, setAtenciones] = useState<AtencionMedica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<'feed' | 'tabla'>(
    () => (localStorage.getItem('consulta-vista') as 'feed' | 'tabla') || 'feed',
  );
  const [periodo, setPeriodo] = useState<PeriodoVista>(
    () => (localStorage.getItem('consulta-periodo') as PeriodoVista) || 'dia',
  );
  const [fechaRef, setFechaRef] = useState<Date>(() => new Date());
  const [modal, setModal] = useState(false);

  useEffect(() => { localStorage.setItem('consulta-vista', vista); }, [vista]);
  useEffect(() => { localStorage.setItem('consulta-periodo', periodo); }, [periodo]);

  const { inicio, fin } = useMemo(() => rangoPeriodo(periodo, fechaRef), [periodo, fechaRef]);
  const esHoy = periodo === 'dia' && esMismoDia(fechaRef, new Date());
  const incluyeHoy = new Date() >= inicio && new Date() < fin;

  const cargarAtenciones = async () => {
    setCargando(true);
    try {
      setAtenciones(await getAtencionesEnRango(inicio, fin));
    } catch (err) {
      console.error('Error al cargar atenciones:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarAtenciones(); }, [inicio.getTime(), fin.getTime()]);

  // Trabajadores solo se cargan una vez (para el modal de nueva atención).
  useEffect(() => {
    (async () => {
      try {
        setTrabajadores(await getTrabajadores());
      } catch (err) {
        console.error('Error al cargar trabajadores:', err);
      }
    })();
  }, []);

  const stats = useMemo(() => calcularStats(atenciones), [atenciones]);
  const espera = atenciones.filter((a) => a.estado === 'espera');
  const atendidas = atenciones.filter((a) => a.estado === 'atendido');

  const titulo = tituloPeriodo(periodo, fechaRef);
  const subPeriodo = periodo === 'dia' ? (esHoy ? 'hoy' : 'en el día') : periodo === 'semana' ? 'en la semana' : 'en el mes';

  // valor del <input type="date"> en hora local
  const fechaInput = keyFecha(fechaRef);

  // Opciones del selector cuando el período es semana o mes
  const opcionesSemana = useMemo(() => {
    if (periodo !== 'semana') return [];
    const { inicio: lunesActual } = rangoPeriodo('semana', new Date());
    const opts: { value: string; label: string }[] = [];
    for (let i = 4; i >= -52; i--) {
      const lunes = new Date(lunesActual);
      lunes.setDate(lunesActual.getDate() + i * 7);
      opts.push({ value: keyFecha(lunes), label: labelSemana(lunes) + (i === 0 ? ' · actual' : '') });
    }
    // Si se navegó fuera del rango listado, incluir la semana seleccionada
    const selKey = keyFecha(inicio);
    if (!opts.some((o) => o.value === selKey)) opts.push({ value: selKey, label: labelSemana(inicio) });
    return opts;
  }, [periodo, inicio]);

  const opcionesMes = useMemo(() => {
    if (periodo !== 'mes') return [];
    const hoy = new Date();
    const opts: { value: string; label: string }[] = [];
    for (let i = 2; i >= -24; i--) {
      const m = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
      opts.push({ value: keyFecha(m), label: labelMes(m) + (i === 0 ? ' · actual' : '') });
    }
    const selKey = keyFecha(new Date(fechaRef.getFullYear(), fechaRef.getMonth(), 1));
    if (!opts.some((o) => o.value === selKey)) opts.push({ value: selKey, label: labelMes(fechaRef) });
    return opts;
  }, [periodo, fechaRef]);

  const irAFecha = (value: string) => {
    const [y, m, d] = value.split('-').map(Number);
    if (y && m && d) setFechaRef(new Date(y, m - 1, d));
  };

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'DR';

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: COLORS.bg, color: COLORS.ink, fontFamily: FONTS.sans }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <main className="flex-1 overflow-y-auto">
        <div className={`mx-auto p-[24px_32px_80px] ${vista === 'tabla' ? 'max-w-[1380px]' : 'max-w-[1180px]'}`}>
          {/* Header */}
          <div className="flex items-end gap-3 mb-[14px] flex-wrap">
            <div>
              <div className="text-[11px] font-semibold uppercase" style={{ color: COLORS.brand, letterSpacing: '1.4px' }}>
                Consulta médica · {PERIODOS.find((p) => p.id === periodo)?.label}
              </div>
              <h1 className="mt-1.5 mb-0 text-[28px] font-bold tracking-tight" style={{ fontFamily: FONTS.serif }}>{titulo}</h1>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex gap-[3px] p-[3px] rounded-[9px]" style={{ background: '#e2e5ea' }}>
                <ToggleBtn active={vista === 'feed'} onClick={() => setVista('feed')} icon={<Activity size={14} />}>Feed</ToggleBtn>
                <ToggleBtn active={vista === 'tabla'} onClick={() => setVista('tabla')} icon={<List size={14} />}>Registro</ToggleBtn>
              </div>
              <button onClick={() => setModal(true)} className="inline-flex items-center gap-1.5 px-[18px] py-[11px] text-white border-none rounded-[9px] text-[14px] font-bold cursor-pointer" style={{ background: ACCENT }}>
                <Plus size={17} /> Nueva atención
              </button>
            </div>
          </div>

          {/* Navegación de período */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <div className="flex gap-[3px] p-[3px] rounded-[9px]" style={{ background: '#e2e5ea' }}>
              {PERIODOS.map((p) => (
                <ToggleBtn key={p.id} active={periodo === p.id} onClick={() => setPeriodo(p.id)} icon={<Stethoscope size={13} />}>{p.label}</ToggleBtn>
              ))}
            </div>
            <div className="flex items-center gap-1.5 bg-white border rounded-[9px] px-1.5 py-1" style={{ borderColor: COLORS.line }}>
              <NavBtn onClick={() => setFechaRef(desplazarPeriodo(periodo, fechaRef, -1))} title="Período anterior"><ChevronLeft size={16} /></NavBtn>
              {periodo === 'dia' ? (
                <input
                  type="date"
                  value={fechaInput}
                  onChange={(e) => irAFecha(e.target.value)}
                  className="border-none outline-none text-[12.5px] font-semibold bg-transparent cursor-pointer"
                  style={{ color: COLORS.ink, fontFamily: FONTS.mono }}
                />
              ) : (
                <select
                  value={periodo === 'semana' ? keyFecha(inicio) : keyFecha(new Date(fechaRef.getFullYear(), fechaRef.getMonth(), 1))}
                  onChange={(e) => irAFecha(e.target.value)}
                  className="border-none outline-none text-[12.5px] font-semibold bg-transparent cursor-pointer max-w-[220px]"
                  style={{ color: COLORS.ink }}
                >
                  {(periodo === 'semana' ? opcionesSemana : opcionesMes).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
              <NavBtn onClick={() => setFechaRef(desplazarPeriodo(periodo, fechaRef, 1))} title="Período siguiente"><ChevronRight size={16} /></NavBtn>
            </div>
            {!incluyeHoy && (
              <button
                onClick={() => setFechaRef(new Date())}
                className="px-3 py-[7px] rounded-[8px] text-[12.5px] font-bold cursor-pointer border"
                style={{ background: COLORS.blueBg, color: ACCENT, borderColor: 'transparent' }}
              >
                Volver a hoy
              </button>
            )}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-5 gap-[11px] mb-5">
            <Kpi value={stats.total} label="Atendidos" sub={subPeriodo} icon={<Check size={16} />} tone="info" />
            <Kpi value={stats.espera} label="En espera" sub="por atender" icon={<Clock size={16} />} tone="warning" />
            <Kpi value={`${stats.primeras}/${stats.subsec}`} label="1ª / subsec." sub="primeras vs control" icon={<User size={16} />} tone="muted" />
            <Kpi value={stats.ocupacionales} label="Ocupacionales" sub="relación laboral" icon={<Activity size={16} />} tone="muted" />
            <Kpi value={stats.medicamentos} label="Medicamentos" sub="unidades dispensadas" icon={<Pill size={16} />} tone="warning" />
          </div>

          {/* Contenido */}
          {cargando ? (
            <div className="p-16 text-center font-semibold" style={{ color: COLORS.faint }}>Cargando atenciones…</div>
          ) : vista === 'feed' ? (
            <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: '1fr 340px' }}>
              <div className="flex flex-col gap-4">
                {espera.length > 0 && (
                  <Grupo color={COLORS.warn} label="En espera" count={espera.length}>
                    {espera.map((a) => <AtencionCard key={a.id} atencion={a} />)}
                  </Grupo>
                )}
                <Grupo color={COLORS.ok} label="Atendidos" count={atendidas.length}>
                  {[...atendidas].reverse().map((a) => <AtencionCard key={a.id} atencion={a} />)}
                  {atendidas.length === 0 && (
                    <div className="p-10 text-center text-[13px] rounded-[13px] border" style={{ background: COLORS.panel, borderColor: COLORS.line, color: COLORS.faint }}>
                      {incluyeHoy
                        ? 'Aún no hay atenciones registradas. Pulsa «Nueva atención» para empezar.'
                        : 'No se registraron atenciones en este período.'}
                    </div>
                  )}
                </Grupo>
              </div>
              <div className="sticky top-0"><ConsultaResumen atenciones={atenciones} /></div>
            </div>
          ) : (
            <RegistroAtenciones atenciones={atenciones} tituloPeriodo={titulo} />
          )}
        </div>
      </main>

      {modal && (
        <NuevaAtencionModal
          trabajadores={trabajadores}
          medicoId={user?.uid ?? ''}
          medicoNombre={user?.email ?? 'Médico'}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); setFechaRef(new Date()); cargarAtenciones(); }}
        />
      )}
    </div>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────────────
function ToggleBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[7px] border-none cursor-pointer text-[12.5px] font-semibold"
      style={{ background: active ? COLORS.panel : 'transparent', color: active ? ACCENT : COLORS.muted, boxShadow: active ? '0 1px 2px rgba(28,29,34,0.1)' : 'none' }}>
      <span style={{ color: active ? ACCENT : COLORS.faint }}>{icon}</span>{children}
    </button>
  );
}

function NavBtn({ onClick, title, children }: { onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button onClick={onClick} title={title} className="grid place-items-center w-[26px] h-[26px] rounded-[6px] border-none cursor-pointer bg-transparent hover:bg-slate-100" style={{ color: COLORS.muted }}>
      {children}
    </button>
  );
}

function Kpi({ value, label, sub, icon, tone }: { value: ReactNode; label: string; sub: string; icon: ReactNode; tone: keyof typeof TONE }) {
  const t = TONE[tone];
  return (
    <div className="rounded-[14px] p-[14px_16px] flex items-center gap-3 border" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
      <span className="grid place-items-center w-[34px] h-[34px] rounded-[9px] flex-shrink-0" style={{ background: t.bg, color: t.fg }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[22px] font-bold tracking-tight leading-none" style={{ fontFamily: FONTS.mono, color: t.fg }}>{value}</div>
        <div className="text-[11px] font-semibold mt-1" style={{ color: COLORS.ink }}>{label}</div>
        <div className="text-[10.5px]" style={{ color: COLORS.faint }}>{sub}</div>
      </div>
    </div>
  );
}

function Grupo({ color, label, count, children }: { color: string; label: string; count: number; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-[7px] h-[7px] rounded-full" style={{ background: color }} />
        <h3 className="m-0 text-[15px] font-semibold" style={{ fontFamily: FONTS.serif, color: COLORS.ink }}>{label}</h3>
        <span className="text-[12px]" style={{ fontFamily: FONTS.mono, color: COLORS.faint }}>{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
