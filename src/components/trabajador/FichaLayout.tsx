// REDISEÑO de la ficha — capa de PRESENTACIÓN con pestañas (verde de marca).
// Archivo NUEVO: src/components/trabajador/FichaLayout.tsx
// NO contiene lógica: recibe datos + callbacks por props. Tu FichaTrabajador.tsx
// conserva TODO (carga de datos, generadores de PDF SO-RE-38/40, modales, ExamenesPanel).
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  ArrowLeft, Sparkles, ClipboardList, Activity, Stethoscope, CalendarDays,
  ChevronDown, ChevronRight, Search, Plus, FileText, Upload, Pencil, X, Check, ArrowRight,
} from 'lucide-react';
import { estadoPermiso, duracionPermiso, fmtFecha as fmtPF, toDate } from '../../services/permisos';
import { TIPOS_PERMISO } from '../../types/permiso';
import type { PermisoMedico } from '../../types/permiso';
import type { OrdenExamen } from '../../types/examenPlan';
import SeguimientoSignos from './SeguimientoSignos';

const BRAND = '#0a6b3b';

// Mapeo aptitud (enum Firestore → label + tono)
const APT: Record<string, { label: string; fg: string; bg: string; bar: string }> = {
  apto: { label: 'Apto', fg: '#0a6b3b', bg: '#e6f6ee', bar: '#10a05a' },
  aptoObservacion: { label: 'Apto en observación', fg: '#8a4a0a', bg: '#fff4e3', bar: '#e08a2c' },
  aptoLimitaciones: { label: 'Apto con limitaciones', fg: '#8a4a0a', bg: '#fff4e3', bar: '#e08a2c' },
  noApto: { label: 'No apto', fg: '#a01f2a', bg: '#fce8eb', bar: '#dc2e3c' },
};
function aptInfo(a: string) { return APT[a] ?? { label: a || 'Pendiente', fg: '#3a4a5e', bg: '#eef1f5', bar: '#94a2b3' }; }

const fmtF = (f: any): string => {
  if (!f) return '—';
  const d = f?.seconds ? new Date(f.seconds * 1000) : f instanceof Date ? f : new Date(f);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
};

export interface FichaLayoutProps {
  trabajador: any;
  nombreCompleto: string;
  evaluaciones: any[];
  permisos: PermisoMedico[];
  atenciones: any[];
  ordenes: OrdenExamen[];
  totalPatologicos: number;
  examenesPanel: ReactNode;            // tu <ExamenesPanel/> tal cual
  busquedaEval: string;
  setBusquedaEval: (v: string) => void;
  onBack?: () => void;
  onOpenEval: (ev: any) => void;
  onEditarDatos: () => void;
  onNuevaPeriodica: () => void;
  onNuevaRetiro: () => void;
  onNuevoPermiso: () => void;
  onEditPermiso: (p: PermisoMedico) => void;
  onDeletePermiso: (id: string) => void;
  onPedirCert: (p: PermisoMedico) => void;
  subiendoCert: string | null;
  onVerOrden: (o: OrdenExamen) => void;
  onDeleteOrden: (id: string) => void;
  onVerPdf?: (url: string, nombre: string) => void;
}

type Tab = 'resumen' | 'evaluaciones' | 'signos' | 'consultas' | 'examenes' | 'permisos';

export default function FichaLayout(props: FichaLayoutProps) {
  const { trabajador: t, nombreCompleto, evaluaciones, permisos, atenciones, ordenes } = props;
  const [tab, setTab] = useState<Tab>('resumen');
  const [menuEval, setMenuEval] = useState(false);

  const ultEval = evaluaciones[0];
  const apt = ultEval ? aptInfo(ultEval.aptitudMedica) : null;
  const ini = ((t.primerApellido?.[0] ?? '') + (t.primerNombre?.[0] ?? '')).toUpperCase();
  const futuros = ordenes.filter((o) => toDate(o.fechaProgramada) >= new Date());
  const proximoExamen = [...futuros].sort((a, b) => toDate(a.fechaProgramada).getTime() - toDate(b.fechaProgramada).getTime())[0] ?? null;
  const anio = new Date().getFullYear();
  const diasReposoAnio = permisos
    .filter((p) => p.tipo !== 'cita' && toDate(p.desde).getFullYear() === anio)
    .reduce((s, p) => s + (p.dias || 0), 0);

  const tabs: { key: Tab; label: string; icon: ReactNode; n?: number }[] = [
    { key: 'resumen', label: 'Resumen', icon: <Sparkles size={15} /> },
    { key: 'evaluaciones', label: 'Evaluaciones', icon: <ClipboardList size={15} />, n: evaluaciones.length },
    { key: 'signos', label: 'Signos', icon: <Activity size={15} /> },
    { key: 'consultas', label: 'Consultas', icon: <Stethoscope size={15} />, n: atenciones.length },
    { key: 'examenes', label: 'Exámenes', icon: <ClipboardList size={15} />, n: ordenes.length },
    { key: 'permisos', label: 'Permisos', icon: <CalendarDays size={15} />, n: permisos.length },
  ];

  return (
    <div style={{ fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      {/* HERO */}
      <div className="border-b border-slate-200" style={{ background: 'linear-gradient(135deg,#e6f6ee 0%,#fff 70%)' }}>
        <div className="max-w-[1080px] mx-auto px-8 pt-4">
          {props.onBack && (
            <button onClick={props.onBack} className="inline-flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-slate-500 text-[13px] font-semibold mb-3.5 p-0 hover:text-slate-700">
              <ArrowLeft size={15} /> Volver
            </button>
          )}
          <div className="flex items-start gap-4 pb-4">
            <div className="w-[62px] h-[62px] rounded-full grid place-items-center font-extrabold text-[18px] flex-shrink-0" style={{ background: '#fff', color: BRAND, border: `2px solid ${BRAND}22` }}>{ini}</div>
            <div className="flex-1 min-w-0">
              <h1 className="m-0 text-[24px] font-extrabold tracking-tight">{nombreCompleto}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap text-[12.5px] text-slate-500">
                <span>{t.puestoTrabajo}</span>
                {t.departamento && <><span className="text-slate-300">·</span><span>{t.departamento}</span></>}
                <span className="text-slate-300">·</span><span className="font-mono">CI {t.cedula}</span>
                <span className="text-slate-300">·</span><span>{t.sexo === 'M' ? 'Masculino' : 'Femenino'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {apt && <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold" style={{ background: apt.bg, color: apt.fg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: apt.bar }} />{apt.label}</span>}
              <button onClick={props.onEditarDatos} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-slate-700 border border-slate-300 rounded-[9px] text-[13px] font-semibold cursor-pointer whitespace-nowrap"><Pencil size={14} /> Editar datos</button>
              <div className="relative">
                <button onClick={() => setMenuEval((o) => !o)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-white border-none rounded-[9px] text-[13px] font-bold cursor-pointer whitespace-nowrap" style={{ background: BRAND }}><Plus size={15} /> Nueva evaluación <ChevronDown size={14} /></button>
                {menuEval && (
                  <>
                    <div onClick={() => setMenuEval(false)} className="fixed inset-0 z-30" />
                    <div className="absolute right-0 mt-1.5 z-40 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden min-w-[220px]">
                      <button onClick={() => { setMenuEval(false); props.onNuevaPeriodica(); }} className="flex items-center gap-2 w-full text-left px-3.5 py-3 text-[13px] font-semibold hover:bg-emerald-50 border-none bg-white cursor-pointer">
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">PERIÓDICA</span> SO-RE-38
                      </button>
                      <button onClick={() => { setMenuEval(false); props.onNuevaRetiro(); }} className="flex items-center gap-2 w-full text-left px-3.5 py-3 text-[13px] font-semibold hover:bg-orange-50 border-t border-slate-100 border-x-0 border-b-0 bg-white cursor-pointer">
                        <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">RETIRO</span> SO-RE-40
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* MINI-KPIS DEL HERO */}
          <div className="flex gap-2.5 pb-4">
            <HeroKpi v={`${evaluaciones.length}`} l="Evaluaciones" />
            <HeroKpi v={proximoExamen ? fmtPF(proximoExamen.fechaProgramada) : '—'} l="Próximo examen" color="#0e7490" />
            <HeroKpi v={`${diasReposoAnio} d`} l="Reposo (año)" color="#7c5cf2" />
            <HeroKpi v={apt ? apt.label : '—'} l="Aptitud actual" color={apt ? apt.fg : undefined} />
          </div>
          {/* TABS */}
          <div className="flex gap-0.5">
            {tabs.map((tb) => {
              const on = tab === tb.key;
              return (
                <button key={tb.key} onClick={() => setTab(tb.key)} className="inline-flex items-center gap-1.5 px-[15px] py-3 border-none bg-transparent cursor-pointer text-[13.5px] -mb-px"
                  style={{ fontWeight: on ? 700 : 600, color: on ? BRAND : '#5a6a7a', borderBottom: `2.5px solid ${on ? BRAND : 'transparent'}` }}>
                  <span style={{ color: on ? BRAND : '#94a2b3' }}>{tb.icon}</span>{tb.label}
                  {tb.n != null && <span className="text-[10.5px] font-bold px-[7px] py-px rounded-full" style={{ background: on ? '#e6f6ee' : '#eef1f5', color: on ? BRAND : '#94a2b3' }}>{tb.n}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="max-w-[1080px] mx-auto px-8 py-6">
        {tab === 'resumen' && <Resumen {...props} ultEval={ultEval} apt={apt} futuros={futuros.length} setTab={setTab} />}
        {tab === 'evaluaciones' && <Evaluaciones {...props} />}
        {tab === 'signos' && (
          <SeguimientoSignos
            trabajadorId={t.id}
            tallaMetros={(Number(evaluaciones[0]?.signosVitales?.talla) / 100) || 1.65}
            nombreCompleto={nombreCompleto}
          />
        )}
        {tab === 'consultas' && <Consultas atenciones={atenciones} />}
        {tab === 'examenes' && <Examenes {...props} />}
        {tab === 'permisos' && <Permisos {...props} />}
      </div>
    </div>
  );
}

// ── SecCard ──────────────────────────────────────────────────────────────────
function SecCard({ icon, color, title, n, action, children, pad = true }: { icon: ReactNode; color: string; title: string; n?: number; action?: ReactNode; children: ReactNode; pad?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-[18px] py-3.5 border-b border-slate-100">
        <span className="grid place-items-center w-7 h-7 rounded-lg" style={{ background: `${color}14`, color }}>{icon}</span>
        <h3 className="m-0 text-[14.5px] font-bold">{title}</h3>
        {n != null && <span className="text-[11px] font-bold bg-slate-100 text-slate-500 px-2 py-px rounded-full">{n}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className={pad ? 'p-[16px_18px]' : ''}>{children}</div>
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) { return <div className="p-4 text-center text-slate-400 text-[12.5px] bg-slate-50 rounded-[10px]">{children}</div>; }
function Link({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button onClick={onClick} className="inline-flex items-center gap-1 bg-transparent border-none cursor-pointer text-[12.5px] font-bold p-0" style={{ color: BRAND }}>{children} <ArrowRight size={13} /></button>; }
function HeroKpi({ v, l, color }: { v: string; l: string; color?: string }) {
  return (
    <div className="flex-1 bg-white border border-slate-200 rounded-xl p-[10px_14px] shadow-sm">
      <div className="text-[18px] font-extrabold tracking-tight" style={{ color: color ?? '#0d1b2a' }}>{v}</div>
      <div className="text-[11px] text-slate-400 font-semibold mt-0.5">{l}</div>
    </div>
  );
}

// ── Tab Resumen ──────────────────────────────────────────────────────────────
function Resumen(p: FichaLayoutProps & { ultEval: any; apt: any; futuros: number; setTab: (t: Tab) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <SecCard icon={<Activity size={16} />} color={BRAND} title="Seguimiento de signos" action={<Link onClick={() => p.setTab('signos')}>Ver detalle</Link>}>
        <SignosGrid evaluaciones={p.evaluaciones} mini />
      </SecCard>
      <div className="grid grid-cols-2 gap-4">
        <SecCard icon={<ClipboardList size={16} />} color="#1d4fad" title="Última evaluación" action={<Link onClick={() => p.setTab('evaluaciones')}>Todas</Link>}>
          {p.ultEval ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ color: BRAND, background: '#e6f6ee' }}>{p.ultEval.tipo === 'RETIRO' ? 'RETIRO' : 'PERIÓDICA'}</span>
                <span className="text-[13.5px] font-bold">{p.apt?.label}</span>
              </div>
              <div className="text-[12.5px] text-slate-500">Realizada {fmtF(p.ultEval.fecha)}</div>
            </div>
          ) : <Empty>Sin evaluaciones.</Empty>}
        </SecCard>
        <SecCard icon={<CalendarDays size={16} />} color="#7c5cf2" title="Permisos" n={p.permisos.length} action={<Link onClick={() => p.setTab('permisos')}>Ver</Link>}>
          {p.permisos.length === 0 ? <Empty>Sin permisos.</Empty> : <div className="flex flex-col gap-2">{p.permisos.slice(0, 3).map((pm) => <PermisoMini key={pm.id} p={pm} />)}</div>}
        </SecCard>
      </div>
      <SecCard icon={<Stethoscope size={16} />} color="#1d4fad" title="Últimas atenciones" n={p.atenciones.length} action={<Link onClick={() => p.setTab('consultas')}>Ver</Link>} pad={false}>
        {p.atenciones.length === 0 ? <div className="p-4"><Empty>Sin consultas.</Empty></div> : p.atenciones.slice(0, 4).map((a, i) => <AtRow key={a.id} a={a} border={i > 0} />)}
      </SecCard>
      <SecCard icon={<ClipboardList size={16} />} color="#0e7490" title="Exámenes ocupacionales" action={<Link onClick={() => p.setTab('examenes')}>Ver</Link>}>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 border border-slate-100 rounded-[11px] p-[12px_14px]"><div className="text-[11px] font-bold uppercase text-slate-400 mb-1.5">Programados</div><div className="text-[13px] text-slate-900"><strong className="text-[20px] font-mono" style={{ color: '#0e7490' }}>{p.futuros}</strong> próximos</div></div>
          <div className="bg-slate-50 border border-slate-100 rounded-[11px] p-[12px_14px]"><div className="text-[11px] font-bold uppercase text-slate-400 mb-1.5">Complementarios</div><div className="text-[13px] text-slate-900">{p.totalPatologicos > 0 ? <span className="text-red-700 font-bold">{p.totalPatologicos} patológico{p.totalPatologicos !== 1 ? 's' : ''}</span> : 'Sin patológicos'}</div></div>
        </div>
      </SecCard>
    </div>
  );
}

// ── Tab Evaluaciones ─────────────────────────────────────────────────────────
function Evaluaciones(p: FichaLayoutProps) {
  const list = p.evaluaciones.filter((e) => !p.busquedaEval || `${e.tipo} ${e.aptitudMedica} ${fmtF(e.fecha)} ${e.motivoConsulta ?? ''}`.toLowerCase().includes(p.busquedaEval.toLowerCase()));
  return (
    <SecCard icon={<ClipboardList size={16} />} color="#1d4fad" title="Evaluaciones" n={p.evaluaciones.length} pad={false}>
      <div className="p-[12px_18px] border-b border-slate-100">
        <div className="flex items-center gap-2 p-[8px_12px] rounded-[9px] border border-slate-300 bg-slate-50">
          <Search size={15} className="text-slate-400" />
          <input value={p.busquedaEval} onChange={(e) => p.setBusquedaEval(e.target.value)} placeholder="Buscar por fecha, motivo, diagnóstico o aptitud…" className="flex-1 border-none outline-none text-[13px] bg-transparent" />
        </div>
      </div>
      {list.length === 0 ? <div className="p-4"><Empty>Sin evaluaciones.</Empty></div> : list.map((ev, i) => {
        const a = aptInfo(ev.aptitudMedica); const retiro = ev.tipo === 'RETIRO';
        const dxCount = Array.isArray(ev.diagnosticos) ? ev.diagnosticos.length : 0;
        return (
          <button key={ev.id} onClick={() => p.onOpenEval(ev)} className="flex items-center gap-3.5 w-full text-left p-[13px_18px] bg-white cursor-pointer hover:bg-slate-50" style={{ border: 'none', borderTop: i > 0 ? '1px solid #f4f6f9' : 'none' }}>
            <div className="text-center min-w-[54px]">
              <div className="text-[16px] font-extrabold text-slate-900 leading-none">{fmtF(ev.fecha).split(' ')[0]}</div>
              <div className="text-[10.5px] text-slate-400">{fmtF(ev.fecha).split(' ').slice(1).join(' ')}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-slate-900">{retiro ? 'Evaluación de retiro' : (ev.motivoConsulta || 'Evaluación periódica')}</div>
              <div className="text-[12px] text-slate-400">{dxCount > 0 ? `${dxCount} diagnóstico${dxCount > 1 ? 's' : ''}` : 'Sin diagnósticos'}{ev.medicoNombre ? ` · Dr. ${ev.medicoNombre}` : ''}</div>
            </div>
            <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: retiro ? '#fff1e6' : '#eaf3ff', color: retiro ? '#9a4a07' : '#1d4fad' }}>{retiro ? 'RETIRO' : 'PERIÓDICA'}</span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: a.bg, color: a.fg }}>{a.label}</span>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
        );
      })}
    </SecCard>
  );
}

// ── Tab Signos ───────────────────────────────────────────────────────────────
function Signos({ evaluaciones }: { evaluaciones: any[] }) {
  const serie = [...evaluaciones].reverse().map((e) => e.signosVitales || {});
  const metrics = [
    { key: 'peso', label: 'Peso', unidad: 'kg', color: '#0f766e', get: (s: any) => num(s.peso) },
    { key: 'pa', label: 'Presión sistólica', unidad: 'mmHg', color: '#dc2e3c', get: (s: any) => num(s.presionSistolica) },
    { key: 'imc', label: 'IMC', unidad: 'kg/m²', color: '#7c5cf2', get: (s: any) => num(s.imc) },
    { key: 'pab', label: 'Perímetro abdominal', unidad: 'cm', color: '#a01f2a', get: (s: any) => num(s.perimetroAbdominal) },
  ];
  const hayDatos = serie.some((s) => Object.keys(s).length > 0);
  if (!hayDatos) return <SecCard icon={<Activity size={16} />} color={BRAND} title="Seguimiento de signos"><Empty>Sin signos registrados en las evaluaciones.</Empty></SecCard>;
  return (
    <div className="grid grid-cols-2 gap-4">
      {metrics.map((m) => {
        const vals = serie.map(m.get).filter((v): v is number => v != null);
        const actual = vals[vals.length - 1], prev = vals[vals.length - 2];
        const delta = prev != null && actual != null ? +(actual - prev).toFixed(1) : null;
        return (
          <div key={m.key} className="bg-white border border-slate-200 rounded-[14px] p-[16px_18px] shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12.5px] font-bold text-slate-600">{m.label}</span>
              {delta != null && delta !== 0 && <span className="text-[12px] font-bold" style={{ color: delta > 0 ? '#a01f2a' : '#0a6b3b' }}>{delta > 0 ? '+' : ''}{delta}</span>}
            </div>
            <div className="flex items-baseline gap-1 mb-2.5"><span className="text-[30px] font-extrabold tracking-tight font-mono">{actual ?? '—'}</span><span className="text-[13px] text-slate-400">{m.unidad}</span></div>
            <BigSpark serie={vals} color={m.color} />
          </div>
        );
      })}
    </div>
  );
}

// ── Tab Consultas ────────────────────────────────────────────────────────────
function Consultas({ atenciones }: { atenciones: any[] }) {
  return <SecCard icon={<Stethoscope size={16} />} color="#1d4fad" title="Atenciones médicas" n={atenciones.length} pad={false}>
    {atenciones.length === 0 ? <div className="p-4"><Empty>Sin consultas registradas.</Empty></div> : atenciones.map((a, i) => <AtRow key={a.id} a={a} border={i > 0} full />)}
  </SecCard>;
}

// ── Tab Exámenes ─────────────────────────────────────────────────────────────
function Examenes(p: FichaLayoutProps) {
  const now = new Date();
  const futuros = p.ordenes.filter((o) => toDate(o.fechaProgramada) >= now);
  const pasados = p.ordenes.filter((o) => toDate(o.fechaProgramada) < now);
  const Orden = ({ o, hist }: { o: OrdenExamen; hist?: boolean }) => (
    <div className="flex items-center justify-between gap-2 p-[12px_18px]" style={{ borderTop: '1px solid #f4f6f9', opacity: hist ? 0.85 : 1 }}>
      <div className="flex-1 min-w-0">
        <p className="m-0 text-[13.5px] font-semibold text-slate-700">{o.tipoEvaluacion} · {o.examenes.length} examen{o.examenes.length !== 1 ? 'es' : ''}</p>
        <p className="m-0 text-[12px] text-slate-400 mt-0.5">{fmtPF(o.fechaProgramada)} · {o.examenes.filter((e) => e.realizado).length}/{o.examenes.length} realizados</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button onClick={() => p.onVerOrden(o)} className="text-[11.5px] px-2.5 py-1 rounded-lg font-semibold cursor-pointer border-none" style={hist ? { background: '#eef1f5', color: '#5a6a7a' } : { background: '#e0f2fa', color: '#0e7490' }}>{hist ? 'Ver' : 'Ver / Editar'}</button>
        <button onClick={() => p.onDeleteOrden(o.id!)} className="text-[11.5px] px-2.5 py-1 bg-red-100 text-red-600 rounded-lg font-semibold cursor-pointer border-none"><X size={12} /></button>
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <SecCard icon={<CalendarDays size={16} />} color="#0e7490" title="Exámenes programados" n={p.ordenes.length} pad={false}>
        {p.ordenes.length === 0 ? <div className="p-4"><Empty>Sin exámenes programados.</Empty></div> : <>
          {futuros.length > 0 && <div className="px-[18px] py-2 text-[11px] font-bold uppercase tracking-wide text-cyan-700 bg-cyan-50">Próximos</div>}
          {futuros.map((o) => <Orden key={o.id} o={o} />)}
          {pasados.length > 0 && <div className="px-[18px] py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50">Historial</div>}
          {pasados.map((o) => <Orden key={o.id} o={o} hist />)}
        </>}
      </SecCard>
      <SecCard icon={<ClipboardList size={16} />} color="#0e7490" title="Exámenes complementarios">
        {p.examenesPanel}
      </SecCard>
    </div>
  );
}

// ── Tab Permisos ─────────────────────────────────────────────────────────────
function Permisos(p: FichaLayoutProps) {
  return (
    <SecCard icon={<CalendarDays size={16} />} color="#7c5cf2" title="Permisos médicos" n={p.permisos.length}
      action={<button onClick={p.onNuevoPermiso} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white border-none rounded-lg text-[12.5px] font-bold cursor-pointer" style={{ background: '#7c5cf2' }}><Plus size={14} /> Nuevo permiso</button>} pad={false}>
      {p.permisos.length === 0 ? <div className="p-4"><Empty>Sin permisos registrados.</Empty></div> : p.permisos.map((pm, i) => {
        const meta = TIPOS_PERMISO[pm.tipo]; const estado = estadoPermiso(pm);
        const eTone: Record<string, string> = { justificado: 'bg-green-100 text-green-700', activo: 'bg-blue-100 text-blue-700', pendiente: 'bg-amber-100 text-amber-700', vencido: 'bg-red-100 text-red-700' };
        return (
          <div key={pm.id} className="flex items-start justify-between gap-3 p-[12px_18px]" style={{ borderTop: i > 0 ? '1px solid #f4f6f9' : 'none' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${meta.color}18`, color: meta.color }}>{meta.label}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${eTone[estado] ?? 'bg-slate-100 text-slate-600'}`}>{estado.charAt(0).toUpperCase() + estado.slice(1)}</span>
                <span className="text-[11px] text-slate-500">{duracionPermiso(pm)}</span>
              </div>
              <p className="m-0 text-[12.5px] text-slate-600 mt-1">{pm.motivo || '—'}</p>
              <p className="m-0 text-[11px] text-slate-400 mt-0.5">{fmtPF(pm.desde)}{pm.hasta && pm.hasta !== pm.desde ? ` → ${fmtPF(pm.hasta)}` : ''}</p>
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              {pm.certAdjunto ? (
                (pm as any).certUrl
                  ? <button onClick={() => p.onVerPdf?.((pm as any).certUrl, pm.certNombreArchivo || 'certificado.pdf')} className="text-[11.5px] px-2.5 py-1 bg-green-100 text-green-700 rounded-lg font-semibold cursor-pointer border-none inline-flex items-center gap-1"><Check size={12} /> Ver PDF</button>
                  : <span className="text-[11.5px] px-2.5 py-1 bg-green-100 text-green-700 rounded-lg font-semibold inline-flex items-center gap-1"><Check size={12} /> Certificado</span>
              ) : meta.requiereCert ? (
                <button disabled={p.subiendoCert === pm.id} onClick={() => p.onPedirCert(pm)} className="text-[11.5px] px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg font-semibold cursor-pointer border-none disabled:opacity-50 inline-flex items-center gap-1"><Upload size={12} /> {p.subiendoCert === pm.id ? 'Subiendo…' : 'Subir PDF'}</button>
              ) : (
                <a className="text-[11.5px] px-2.5 py-1 bg-white text-slate-600 border border-slate-300 rounded-lg font-semibold inline-flex items-center gap-1 no-underline cursor-default"><FileText size={12} /> Interno</a>
              )}
              <button onClick={() => p.onEditPermiso(pm)} className="text-[11.5px] px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-semibold cursor-pointer border-none"><Pencil size={12} /></button>
              <button onClick={() => p.onDeletePermiso(pm.id!)} className="text-[11.5px] px-2 py-1 bg-red-50 text-red-500 rounded-lg font-semibold cursor-pointer border-none"><X size={12} /></button>
            </div>
          </div>
        );
      })}
    </SecCard>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────────
function num(v: any): number | null { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? null : n; }

function SignosGrid({ evaluaciones, mini }: { evaluaciones: any[]; mini?: boolean }) {
  const serie = [...evaluaciones].reverse().map((e) => e.signosVitales || {});
  const cards = [
    { label: 'Peso', unidad: 'kg', color: '#0f766e', get: (s: any) => num(s.peso) },
    { label: 'P. arterial', unidad: '', color: '#dc2e3c', get: (s: any) => num(s.presionSistolica), pa: true },
    { label: 'IMC', unidad: '', color: '#7c5cf2', get: (s: any) => num(s.imc) },
    { label: 'P. abdominal', unidad: 'cm', color: '#a01f2a', get: (s: any) => num(s.perimetroAbdominal) },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((c) => {
        const vals = serie.map(c.get).filter((v): v is number => v != null);
        const last = serie[serie.length - 1] || {};
        const display = c.pa ? `${last.presionSistolica ?? '—'}/${last.presionDiastolica ?? '—'}` : (vals[vals.length - 1] ?? '—');
        return (
          <div key={c.label} className="bg-slate-50 border border-slate-100 rounded-xl p-[12px_14px]">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">{c.label}</div>
            <div className="flex items-baseline gap-1"><span className="text-[20px] font-extrabold font-mono">{display}</span><span className="text-[11px] text-slate-400">{c.unidad}</span></div>
            <div className="mt-1.5"><Spark serie={vals} color={c.color} /></div>
          </div>
        );
      })}
    </div>
  );
}

function AtRow({ a, border, full }: { a: any; border?: boolean; full?: boolean }) {
  const dx = Array.isArray(a.diagnosticos) && a.diagnosticos[0] ? a.diagnosticos[0] : null;
  return (
    <div className="flex items-start gap-3 p-[11px_18px]" style={{ borderTop: border ? '1px solid #f4f6f9' : 'none' }}>
      <div className="text-[12px] text-slate-400 font-mono min-w-[64px] pt-0.5">{fmtF(a.fecha)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-900">{a.motivoConsulta || 'Consulta'}</div>
        <div className="text-[12px] text-slate-400">{dx ? `${dx.cie ? dx.cie + ' · ' : ''}${dx.descripcion ?? ''}` : ''}{a.medicoNombre ? ` · Dr. ${a.medicoNombre}` : ''}</div>
      </div>
    </div>
  );
}
function PermisoMini({ p }: { p: PermisoMedico }) {
  const meta = TIPOS_PERMISO[p.tipo];
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: `${meta.color}14`, color: meta.color }}>{meta.short}</span>
      <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-slate-900 truncate">{p.motivo || '—'}</div><div className="text-[11.5px] text-slate-400">{fmtPF(p.desde)} · {duracionPermiso(p)}</div></div>
    </div>
  );
}
function Spark({ serie, color, w = 70, h = 22 }: { serie: number[]; color: string; w?: number; h?: number }) {
  if (!serie || serie.length < 2) return <div style={{ height: h }} className="flex items-center text-[11px] text-slate-300">—</div>;
  const min = Math.min(...serie), max = Math.max(...serie), rng = max - min || 1;
  const pts = serie.map((v, i) => `${(i / (serie.length - 1)) * w},${(h - ((v - min) / rng) * (h - 4) - 2).toFixed(1)}`).join(' ');
  const lastY = h - ((serie[serie.length - 1] - min) / rng) * (h - 4) - 2;
  return <svg width={w} height={h} style={{ overflow: 'visible' }}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /><circle cx={w} cy={lastY} r={2.4} fill={color} /></svg>;
}
function BigSpark({ serie, color }: { serie: number[]; color: string }) {
  const w = 100, h = 56;
  if (!serie || serie.length < 2) return <div style={{ height: h }} className="grid place-items-center text-[12px] text-slate-300">Una sola medición</div>;
  const min = Math.min(...serie), max = Math.max(...serie), rng = max - min || 1;
  const pts = serie.map((v, i) => [(i / (serie.length - 1)) * w, h - ((v - min) / rng) * (h - 8) - 4]);
  const line = pts.map((p) => p.join(',')).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={`${color}14`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
