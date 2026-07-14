// REDISEÑO de la ficha — capa de PRESENTACIÓN con pestañas.
// Archivo: src/components/trabajador/FichaLayout.tsx
// NO contiene lógica: recibe datos + callbacks por props. Tu FichaTrabajador.tsx
// conserva TODO (carga de datos, generadores de PDF SO-RE-38/40, modales, ExamenesPanel).
//
// ESTÉTICA v2: color institucional atenuado (vino), serif Spectral en titulares, datos en
// mono, fondo neutro. Para la serif, agrega en index.html (si no está):
//   <link href="https://fonts.googleapis.com/css2?family=Spectral:wght@500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
// Si la fuente no carga, cae a Georgia (serif) sin romper nada.
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  ArrowLeft, ClipboardList, Activity, Stethoscope, CalendarDays, HeartPulse,
  ChevronDown, ChevronRight, Search, Plus, FileText, Upload, Pencil, X, Check, ArrowRight,
} from 'lucide-react';
import { estadoPermiso, duracionPermiso, fmtFecha as fmtPF, toDate } from '../../services/permisos';
import { tipoEvaluacionLabel } from '../../utils/medicalHelpers';
import { TIPOS_PERMISO } from '../../types/permiso';
import type { PermisoMedico } from '../../types/permiso';
import type { OrdenExamen } from '../../types/examenPlan';
import SeguimientoSignos from './SeguimientoSignos';
import SeguimientoEspecialistas from './SeguimientoEspecialistas';
import FisioterapiaPanel from './FisioterapiaPanel';

const BRAND = '#9a3036';          // color institucional atenuado (vino/ladrillo)
const BRAND_SOFT = '#f4e8e9';
const SERIF = "'Spectral', Georgia, 'Times New Roman', serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const INK = '#20242b';

// Acentos por sección
const C_SIGNOS = BRAND, C_EVAL = '#2a4d8f', C_PERMISO = '#6b4ba3', C_CONSULTA = '#0e6b7c', C_EXAMEN = '#0e6b7c';

// Mapeo aptitud (enum Firestore → label + tono). El verde se mantiene como "ok".
const APT: Record<string, { label: string; fg: string; bg: string; bar: string }> = {
  apto: { label: 'Apto', fg: '#1f7a4d', bg: '#e7f3ec', bar: '#1f7a4d' },
  aptoObservacion: { label: 'Apto en observación', fg: '#9a5b12', bg: '#f8eddc', bar: '#cf8a2e' },
  aptoLimitaciones: { label: 'Apto con limitaciones', fg: '#9a5b12', bg: '#f8eddc', bar: '#cf8a2e' },
  noApto: { label: 'No apto', fg: '#a3142a', bg: '#f9e6e8', bar: '#c0303f' },
};
function aptInfo(a: string) { return APT[a] ?? { label: a || 'Pendiente', fg: '#646b75', bg: '#eef0f3', bar: '#98a0ab' }; }

// Estilo del distintivo por tipo de evaluación
const TIPO_BADGE: Record<string, { bg: string; fg: string }> = {
  'Retiro': { bg: '#f8eddc', fg: '#9a4a07' },
  'Pre-ocupacional': { bg: '#d8f3ee', fg: '#0d6b5f' },
  'Periódica': { bg: '#eaf0f9', fg: '#2a4d8f' },
};
function tipoBadge(ev: any) {
  const label = tipoEvaluacionLabel(ev);
  return { label, ...(TIPO_BADGE[label] ?? TIPO_BADGE['Periódica']) };
}

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
  onNuevaPreocupacional?: () => void;
  onNuevoPermiso: () => void;
  onEditPermiso: (p: PermisoMedico) => void;
  onDeletePermiso: (id: string) => void;
  onPedirCert: (p: PermisoMedico) => void;
  subiendoCert: string | null;
  onVerOrden: (o: OrdenExamen) => void;
  onDeleteOrden: (id: string) => void;
  onVerPdf?: (url: string, nombre: string) => void;
  /** Sección opcional de evaluaciones ergonómicas (se muestra en Resumen). */
  ergonomia?: ReactNode;
}

type Tab = 'resumen' | 'evaluaciones' | 'signos' | 'consultas' | 'examenes' | 'permisos' | 'especialistas' | 'fisioterapia';

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

  const tabs: { key: Tab; label: string; n?: number }[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'evaluaciones', label: 'Evaluaciones', n: evaluaciones.length },
    { key: 'signos', label: 'Signos' },
    { key: 'consultas', label: 'Consultas', n: atenciones.length },
    { key: 'examenes', label: 'Exámenes', n: ordenes.length },
    { key: 'permisos', label: 'Permisos', n: permisos.length },
    { key: 'especialistas', label: 'Especialistas' },
    { key: 'fisioterapia', label: 'Fisioterapia' },
  ];

  return (
    <div style={{ fontFamily: "'Public Sans', system-ui, sans-serif", color: INK }}>
      {/* HERO — papel blanco + barra de acento roja (sin gradiente) */}
      <div className="border-b" style={{ background: '#fff', borderColor: '#e4e6ea', borderTop: `3px solid ${BRAND}` }}>
        <div className="max-w-[1080px] mx-auto px-4 md:px-8 pt-4">
          {props.onBack && (
            <button onClick={props.onBack} className="inline-flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-[12.5px] font-semibold mb-3.5 p-0" style={{ color: '#646b75' }}>
              <ArrowLeft size={15} /> Volver
            </button>
          )}
          <div className="flex items-start gap-4 pb-4 flex-wrap">
            <div className="flex items-start gap-4 flex-1 min-w-0 sm:min-w-[360px]">
              <div className="w-16 h-16 grid place-items-center font-bold text-[22px] flex-shrink-0" style={{ background: BRAND_SOFT, color: BRAND, border: '1px solid #eccdd1', borderRadius: 14, fontFamily: SERIF }}>{ini}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold uppercase mb-1" style={{ color: BRAND, letterSpacing: '1.4px' }}>Expediente médico-ocupacional</div>
                <h1 className="m-0 text-[27px] font-bold tracking-tight leading-tight" style={{ fontFamily: SERIF }}>{nombreCompleto}</h1>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap text-[12.5px]" style={{ color: '#646b75' }}>
                  <span>{t.puestoTrabajo}</span>
                  {t.departamento && <><span style={{ color: '#cdc6bd' }}>·</span><span>{t.departamento}</span></>}
                  <span style={{ color: '#cdc6bd' }}>·</span><span style={{ fontFamily: MONO, fontSize: 12 }}>CI {t.cedula}</span>
                  <span style={{ color: '#cdc6bd' }}>·</span><span>{t.sexo === 'M' ? 'Masculino' : 'Femenino'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
              {apt && <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-bold" style={{ background: apt.bg, color: apt.fg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: apt.bar }} />{apt.label}</span>}
              <button onClick={props.onEditarDatos} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border rounded-[9px] text-[13px] font-semibold cursor-pointer whitespace-nowrap" style={{ color: '#46423d', borderColor: '#d8d2c9' }}><Pencil size={14} /> Editar datos</button>
              <div className="relative">
                <button onClick={() => setMenuEval((o) => !o)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-white border-none rounded-[9px] text-[13px] font-bold cursor-pointer whitespace-nowrap" style={{ background: BRAND }}><Plus size={15} /> Nueva evaluación <ChevronDown size={14} /></button>
                {menuEval && (
                  <>
                    <div onClick={() => setMenuEval(false)} className="fixed inset-0 z-30" />
                    <div className="absolute right-0 mt-1.5 z-40 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden min-w-[240px]">
                      {props.onNuevaPreocupacional && (
                        <button onClick={() => { setMenuEval(false); props.onNuevaPreocupacional!(); }} className="flex items-center gap-2 w-full text-left px-3.5 py-3 text-[13px] font-semibold hover:bg-teal-50 border-none bg-white cursor-pointer">
                          <span className="text-[10px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">PREOCUPACIONAL</span> SO-RE-41
                        </button>
                      )}
                      <button onClick={() => { setMenuEval(false); props.onNuevaPeriodica(); }} className="flex items-center gap-2 w-full text-left px-3.5 py-3 text-[13px] font-semibold hover:bg-blue-50 border-t border-slate-100 border-x-0 border-b-0 bg-white cursor-pointer">
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">PERIÓDICA</span> SO-RE-38
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
          {/* MINI-KPIS — tarjetas separadas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-4">
            <HeroKpi v={`${evaluaciones.length}`} l="Evaluaciones" />
            <HeroKpi v={proximoExamen ? fmtPF(proximoExamen.fechaProgramada) : '—'} l="Próximo examen" color={C_CONSULTA} />
            <HeroKpi v={`${diasReposoAnio} d`} l="Reposo (año)" color={C_PERMISO} />
            <HeroKpi v={apt ? apt.label : '—'} l="Aptitud actual" color={apt ? apt.fg : undefined} />
          </div>
          {/* TABS */}
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] whitespace-nowrap">
            {tabs.map((tb) => {
              const on = tab === tb.key;
              return (
                <button key={tb.key} onClick={() => setTab(tb.key)} className="inline-flex items-center gap-1.5 px-[14px] py-3 border-none bg-transparent cursor-pointer text-[13.5px] -mb-px"
                  style={{ fontWeight: on ? 700 : 600, color: on ? BRAND : '#646b75', borderBottom: `2.5px solid ${on ? BRAND : 'transparent'}` }}>
                  {tb.label}
                  {tb.n != null && <span className="text-[10.5px] font-bold px-[7px] py-px rounded-full" style={{ fontFamily: MONO, background: on ? BRAND_SOFT : '#eef0f3', color: on ? BRAND : '#98a0ab' }}>{tb.n}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="max-w-[1080px] mx-auto px-4 md:px-8 py-6">
        {tab === 'resumen' && (
          <>
            <Resumen {...props} ultEval={ultEval} apt={apt} futuros={futuros.length} setTab={setTab} />
            {props.ergonomia}
          </>
        )}
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
        {tab === 'especialistas' && <SeguimientoEspecialistas trabajadorId={t.id} />}
        {tab === 'fisioterapia' && <FisioterapiaPanel trabajador={t} onVerPdf={props.onVerPdf} />}
      </div>
    </div>
  );
}

// ── SecCard ──────────────────────────────────────────────────────────────────
export function SecCard({ icon, color, title, n, action, children, pad = true }: { icon: ReactNode; color: string; title: string; n?: number; action?: ReactNode; children: ReactNode; pad?: boolean }) {
  return (
    <div className="bg-white border rounded-[13px] overflow-hidden" style={{ borderColor: '#e4e6ea', boxShadow: '0 1px 2px rgba(28,29,34,.03)' }}>
      <div className="flex items-center gap-2.5 px-[18px] py-[15px] border-b" style={{ borderColor: '#e4e6ea' }}>
        <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px]" style={{ background: `${color}16`, color }}>{icon}</span>
        <h3 className="m-0 text-[17px] font-semibold tracking-tight" style={{ fontFamily: SERIF }}>{title}</h3>
        {n != null && <span className="text-[11px] font-bold px-2 py-px rounded-full" style={{ fontFamily: MONO, background: '#eef0f3', color: '#646b75' }}>{n}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className={pad ? 'p-[16px_18px]' : ''}>{children}</div>
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) { return <div className="p-4 text-center text-[12.5px] rounded-[10px]" style={{ color: '#98a0ab', background: '#f6f7f9' }}>{children}</div>; }
function Link({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button onClick={onClick} className="inline-flex items-center gap-1 bg-transparent border-none cursor-pointer text-[12.5px] font-bold p-0" style={{ color: BRAND }}>{children} <ArrowRight size={13} /></button>; }
function HeroKpi({ v, l, color }: { v: string; l: string; color?: string }) {
  return (
    <div className="bg-white border rounded-xl p-[14px_16px]" style={{ borderColor: '#e4e6ea', boxShadow: '0 1px 2px rgba(28,29,34,.03)' }}>
      <div className="text-[19px] font-bold tracking-tight" style={{ fontFamily: MONO, color: color ?? INK }}>{v}</div>
      <div className="text-[11px] font-semibold mt-1 uppercase" style={{ color: '#98a0ab', letterSpacing: '.4px' }}>{l}</div>
    </div>
  );
}

// ── Tab Resumen ──────────────────────────────────────────────────────────────
function Resumen(p: FichaLayoutProps & { ultEval: any; apt: any; futuros: number; setTab: (t: Tab) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <SecCard icon={<HeartPulse size={17} />} color={C_SIGNOS} title="Seguimiento de signos" action={<Link onClick={() => p.setTab('signos')}>Ver detalle</Link>}>
        <SignosGrid evaluaciones={p.evaluaciones} trabajador={p.trabajador} />
      </SecCard>
      <AntecedentesCard evaluaciones={p.evaluaciones} onVerEval={p.onOpenEval} />
      <div className="grid grid-cols-2 gap-4">
        <SecCard icon={<ClipboardList size={17} />} color={C_EVAL} title="Última evaluación" action={<Link onClick={() => p.setTab('evaluaciones')}>Todas</Link>}>
          {p.ultEval ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                {(() => { const tb = tipoBadge(p.ultEval); return (
                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded" style={{ color: tb.fg, background: tb.bg, letterSpacing: '.4px' }}>{tb.label}</span>
                ); })()}
                <span className="text-[14px] font-bold">{p.apt?.label}</span>
              </div>
              <div className="text-[12.5px]" style={{ color: '#646b75' }}>Realizada <span style={{ fontFamily: MONO, fontSize: 12 }}>{fmtF(p.ultEval.fecha)}</span></div>
            </div>
          ) : <Empty>Sin evaluaciones.</Empty>}
        </SecCard>
        <SecCard icon={<CalendarDays size={17} />} color={C_PERMISO} title="Permisos" n={p.permisos.length} action={<Link onClick={() => p.setTab('permisos')}>Ver</Link>}>
          {p.permisos.length === 0 ? <Empty>Sin permisos.</Empty> : <div className="flex flex-col gap-2">{p.permisos.slice(0, 3).map((pm) => <PermisoMini key={pm.id} p={pm} />)}</div>}
        </SecCard>
      </div>
      <SecCard icon={<Stethoscope size={17} />} color={C_CONSULTA} title="Últimas atenciones" n={p.atenciones.length} action={<Link onClick={() => p.setTab('consultas')}>Ver</Link>} pad={false}>
        {p.atenciones.length === 0 ? <div className="p-4"><Empty>Sin consultas.</Empty></div> : p.atenciones.slice(0, 4).map((a, i) => <AtRow key={a.id} a={a} border={i > 0} />)}
      </SecCard>
      <SecCard icon={<ClipboardList size={17} />} color={C_EXAMEN} title="Exámenes ocupacionales" action={<Link onClick={() => p.setTab('examenes')}>Ver</Link>}>
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded-[11px] p-[12px_14px]" style={{ background: '#f6f7f9', borderColor: '#e4e6ea' }}><div className="text-[11px] font-bold uppercase mb-1.5" style={{ color: '#98a0ab' }}>Programados</div><div className="text-[13px]"><strong className="text-[20px]" style={{ fontFamily: MONO, color: C_EXAMEN }}>{p.futuros}</strong> próximos</div></div>
          <div className="border rounded-[11px] p-[12px_14px]" style={{ background: '#f6f7f9', borderColor: '#e4e6ea' }}><div className="text-[11px] font-bold uppercase mb-1.5" style={{ color: '#98a0ab' }}>Complementarios</div><div className="text-[13px]">{p.totalPatologicos > 0 ? <span className="font-bold" style={{ color: '#a3142a' }}>{p.totalPatologicos} patológico{p.totalPatologicos !== 1 ? 's' : ''}</span> : 'Sin patológicos'}</div></div>
        </div>
      </SecCard>
    </div>
  );
}

// ── Tab Evaluaciones ─────────────────────────────────────────────────────────
function Evaluaciones(p: FichaLayoutProps) {
  const list = p.evaluaciones.filter((e) => !p.busquedaEval || `${e.tipo} ${e.aptitudMedica} ${fmtF(e.fecha)} ${e.motivoConsulta ?? ''}`.toLowerCase().includes(p.busquedaEval.toLowerCase()));
  return (
    <SecCard icon={<ClipboardList size={17} />} color={C_EVAL} title="Evaluaciones" n={p.evaluaciones.length} pad={false}>
      <div className="p-[12px_18px] border-b" style={{ borderColor: '#e4e6ea' }}>
        <div className="flex items-center gap-2 p-[8px_12px] rounded-[9px] border" style={{ borderColor: '#d8d2c9', background: '#f6f7f9' }}>
          <Search size={15} style={{ color: '#98a0ab' }} />
          <input value={p.busquedaEval} onChange={(e) => p.setBusquedaEval(e.target.value)} placeholder="Buscar por fecha, motivo, diagnóstico o aptitud…" className="flex-1 border-none outline-none text-[13px] bg-transparent" />
        </div>
      </div>
      {list.length === 0 ? <div className="p-4"><Empty>Sin evaluaciones.</Empty></div> : list.map((ev, i) => {
        const a = aptInfo(ev.aptitudMedica); const retiro = ev.tipo === 'RETIRO';
        const tb = tipoBadge(ev);
        const dxCount = Array.isArray(ev.diagnosticos) ? ev.diagnosticos.length : 0;
        return (
          <button key={ev.id} onClick={() => p.onOpenEval(ev)} className="flex items-center gap-3.5 w-full text-left p-[13px_18px] bg-white cursor-pointer hover:bg-slate-50" style={{ border: 'none', borderTop: i > 0 ? '1px solid #eef0f3' : 'none' }}>
            <div className="text-center min-w-[54px]">
              <div className="text-[21px] font-bold leading-none" style={{ fontFamily: SERIF }}>{fmtF(ev.fecha).split(' ')[0]}</div>
              <div className="text-[10.5px] uppercase mt-0.5" style={{ fontFamily: MONO, color: '#98a0ab' }}>{fmtF(ev.fecha).split(' ').slice(1).join(' ')}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold">{retiro ? 'Evaluación de retiro' : (ev.motivoConsulta || `Evaluación ${tb.label.toLowerCase()}`)}</div>
              <div className="text-[12px]" style={{ color: '#98a0ab' }}>{dxCount > 0 ? `${dxCount} diagnóstico${dxCount > 1 ? 's' : ''}` : 'Sin diagnósticos'}{ev.medicoNombre ? ` · ${ev.medicoNombre}` : ''}</div>
            </div>
            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded" style={{ background: tb.bg, color: tb.fg, letterSpacing: '.4px' }}>{tb.label}</span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: a.bg, color: a.fg }}>{a.label}</span>
            <ChevronRight size={16} style={{ color: '#cabfb4' }} />
          </button>
        );
      })}
    </SecCard>
  );
}

// ── Tab Consultas ────────────────────────────────────────────────────────────
function Consultas({ atenciones }: { atenciones: any[] }) {
  // Diagnósticos frecuentes (conteo por código CIE-10 en todas las atenciones)
  const frecuentes = (() => {
    const mapa = new Map<string, { cie: string; desc: string; n: number }>();
    atenciones.forEach((a) => {
      const dx = cieDeAtencion(a);
      if (!dx?.cie) return;
      const e = mapa.get(dx.cie) ?? { cie: dx.cie, desc: dx.desc, n: 0 };
      e.n++; if (!e.desc && dx.desc) e.desc = dx.desc;
      mapa.set(dx.cie, e);
    });
    return [...mapa.values()].sort((a, b) => b.n - a.n).slice(0, 6);
  })();

  return (
    <div className="flex flex-col gap-4">
      {frecuentes.length > 0 && (
        <SecCard icon={<Stethoscope size={17} />} color={C_CONSULTA} title="Diagnósticos frecuentes">
          <div className="flex flex-col gap-1.5">
            {frecuentes.map((f) => (
              <div key={f.cie} className="flex items-center gap-2.5 text-[12.5px]">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded min-w-[52px] text-center" style={{ fontFamily: MONO, background: '#e3f0f2', color: '#0e6b7c' }}>{f.cie}</span>
                <span className="flex-1 min-w-0 truncate" style={{ color: '#3a4250' }}>{f.desc || '—'}</span>
                <span className="text-[11.5px] font-bold whitespace-nowrap" style={{ fontFamily: MONO, color: '#646b75' }}>{f.n} consulta{f.n !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </SecCard>
      )}
      <SecCard icon={<Stethoscope size={17} />} color={C_CONSULTA} title="Atenciones médicas" n={atenciones.length} pad={false}>
        {atenciones.length === 0 ? <div className="p-4"><Empty>Sin consultas registradas.</Empty></div> : atenciones.map((a, i) => <AtRow key={a.id} a={a} border={i > 0} full />)}
      </SecCard>
    </div>
  );
}

// ── Tab Exámenes ─────────────────────────────────────────────────────────────
function Examenes(p: FichaLayoutProps) {
  const now = new Date();
  const futuros = p.ordenes.filter((o) => toDate(o.fechaProgramada) >= now);
  const pasados = p.ordenes.filter((o) => toDate(o.fechaProgramada) < now);
  const Orden = ({ o, hist }: { o: OrdenExamen; hist?: boolean }) => (
    <div className="flex items-center justify-between gap-2 p-[12px_18px]" style={{ borderTop: '1px solid #eef0f3', opacity: hist ? 0.85 : 1 }}>
      <div className="flex-1 min-w-0">
        <p className="m-0 text-[13.5px] font-semibold" style={{ color: '#3a4250' }}>{o.tipoEvaluacion} · {o.examenes.length} examen{o.examenes.length !== 1 ? 'es' : ''}</p>
        <p className="m-0 text-[12px] mt-0.5" style={{ color: '#98a0ab' }}>{fmtPF(o.fechaProgramada)} · {o.examenes.filter((e) => e.realizado).length}/{o.examenes.length} realizados</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button onClick={() => p.onVerOrden(o)} className="text-[11.5px] px-2.5 py-1 rounded-lg font-semibold cursor-pointer border-none" style={hist ? { background: '#eef0f3', color: '#646b75' } : { background: '#e3f0f2', color: C_EXAMEN }}>{hist ? 'Ver' : 'Ver / Editar'}</button>
        <button onClick={() => p.onDeleteOrden(o.id!)} className="text-[11.5px] px-2.5 py-1 rounded-lg font-semibold cursor-pointer border-none" style={{ background: '#f9e6e8', color: '#a3142a' }}><X size={12} /></button>
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <SecCard icon={<CalendarDays size={17} />} color={C_EXAMEN} title="Exámenes programados" n={p.ordenes.length} pad={false}>
        {p.ordenes.length === 0 ? <div className="p-4"><Empty>Sin exámenes programados.</Empty></div> : <>
          {futuros.length > 0 && <div className="px-[18px] py-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: C_EXAMEN, background: '#e3f0f2' }}>Próximos</div>}
          {futuros.map((o) => <Orden key={o.id} o={o} />)}
          {pasados.length > 0 && <div className="px-[18px] py-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: '#646b75', background: '#f6f7f9' }}>Historial</div>}
          {pasados.map((o) => <Orden key={o.id} o={o} hist />)}
        </>}
      </SecCard>
      <SecCard icon={<ClipboardList size={17} />} color={C_EXAMEN} title="Exámenes complementarios">
        {p.examenesPanel}
      </SecCard>
    </div>
  );
}

// ── Tab Permisos ─────────────────────────────────────────────────────────────
function Permisos(p: FichaLayoutProps) {
  return (
    <SecCard icon={<CalendarDays size={17} />} color={C_PERMISO} title="Permisos médicos" n={p.permisos.length}
      action={<button onClick={p.onNuevoPermiso} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white border-none rounded-lg text-[12.5px] font-bold cursor-pointer" style={{ background: C_PERMISO }}><Plus size={14} /> Nuevo permiso</button>} pad={false}>
      {p.permisos.length === 0 ? <div className="p-4"><Empty>Sin permisos registrados.</Empty></div> : p.permisos.map((pm, i) => {
        const meta = TIPOS_PERMISO[pm.tipo]; const estado = estadoPermiso(pm);
        const eTone: Record<string, string> = { justificado: 'bg-green-100 text-green-700', activo: 'bg-blue-100 text-blue-700', pendiente: 'bg-amber-100 text-amber-700', vencido: 'bg-red-100 text-red-700' };
        return (
          <div key={pm.id} className="flex items-start justify-between gap-3 p-[12px_18px]" style={{ borderTop: i > 0 ? '1px solid #eef0f3' : 'none' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${meta.color}18`, color: meta.color }}>{meta.label}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${eTone[estado] ?? 'bg-slate-100 text-slate-600'}`}>{estado.charAt(0).toUpperCase() + estado.slice(1)}</span>
                <span className="text-[11px]" style={{ color: '#646b75' }}>{duracionPermiso(pm)}</span>
              </div>
              <p className="m-0 text-[12.5px] mt-1" style={{ color: '#646b75' }}>{pm.motivo || '—'}</p>
              <p className="m-0 text-[11px] mt-0.5" style={{ color: '#98a0ab' }}>{fmtPF(pm.desde)}{pm.hasta && pm.hasta !== pm.desde ? ` → ${fmtPF(pm.hasta)}` : ''}</p>
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              {pm.certAdjunto ? (
                (pm as any).certUrl
                  ? <button onClick={() => p.onVerPdf?.((pm as any).certUrl, pm.certNombreArchivo || 'certificado.pdf')} className="text-[11.5px] px-2.5 py-1 bg-green-100 text-green-700 rounded-lg font-semibold cursor-pointer border-none inline-flex items-center gap-1"><Check size={12} /> Ver PDF</button>
                  : <span className="text-[11.5px] px-2.5 py-1 bg-green-100 text-green-700 rounded-lg font-semibold inline-flex items-center gap-1"><Check size={12} /> Certificado</span>
              ) : meta.requiereCert ? (
                <button disabled={p.subiendoCert === pm.id} onClick={() => p.onPedirCert(pm)} className="text-[11.5px] px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg font-semibold cursor-pointer border-none disabled:opacity-50 inline-flex items-center gap-1"><Upload size={12} /> {p.subiendoCert === pm.id ? 'Subiendo…' : 'Subir PDF'}</button>
              ) : (
                <a className="text-[11.5px] px-2.5 py-1 bg-white border rounded-lg font-semibold inline-flex items-center gap-1 no-underline cursor-default" style={{ color: '#646b75', borderColor: '#d8d2c9' }}><FileText size={12} /> Interno</a>
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

// ── Antecedentes consolidados ────────────────────────────────────────────────
// Los antecedentes se registran extensamente en la evaluación preocupacional
// (SO-RE-41) y se actualizan en las posteriores. Este recuadro muestra la
// versión más reciente de cada bloque para consultarlos de un vistazo.
function AntecedentesCard({ evaluaciones, onVerEval }: { evaluaciones: any[]; onVerEval: (ev: any) => void }) {
  // Primera evaluación (más reciente) que traiga datos de antecedentes.
  const fuente = evaluaciones.find((e) =>
    e.antecedentesClinicosQ !== undefined || (e.antecedentesClinicosLista?.length ?? 0) > 0 ||
    (e.antecedentesFamiliares?.length ?? 0) > 0 || (e.habitosToxicos?.length ?? 0) > 0 ||
    (e.antecedentesEmpleos?.length ?? 0) > 0 || e.antecedentesGineco || e.antecedentesReproductivos,
  );

  if (!fuente) {
    return (
      <SecCard icon={<ClipboardList size={17} />} color="#0d6b5f" title="Antecedentes">
        <Empty>Sin antecedentes registrados. Se llenan en la evaluación preocupacional (SO-RE-41) y quedan disponibles para las siguientes evaluaciones.</Empty>
      </SecCard>
    );
  }

  const tb = tipoBadge(fuente);
  const clinicos: string[] = fuente.antecedentesClinicosQ === true
    ? (fuente.antecedentesClinicosLista ?? []).map((a: any) => `${a.enfermedad || '?'}${a.desdeCuando ? ` (desde ${a.desdeCuando})` : ''}${a.tomaMedicacion && a.medicacionNombre ? ` · Med: ${a.medicacionNombre}` : ''}`)
    : [];
  const quirurgicos: string[] = fuente.antecedentesQuirurgicosQ === true
    ? (fuente.antecedentesQuirurgicosLista ?? []).map((a: any) => `${a.procedimiento || '?'}${a.fechaAproximada ? ` (${a.fechaAproximada})` : ''}${a.secuelas ? ` · Secuelas: ${a.secuelas}` : ''}`)
    : [];
  const alergias: string[] = fuente.alergiasTiene === true
    ? (fuente.alergias ?? []).map((a: any) => `${a.alergeno || '?'}${a.intensidadReaccion ? ` — ${a.intensidadReaccion}` : ''}`)
    : [];
  const habitos: string[] = (fuente.habitosToxicos ?? [])
    .filter((h: any) => h.consume || h.exConsumidor)
    .map((h: any) => `${h.tipo}${h.consume ? ` (${h.cantidad || 'consume'})` : ' (ex consumidor)'}`);
  const familiares: string[] = (fuente.antecedentesFamiliares ?? [])
    .map((a: any) => `${a.tipo}${a.parentesco ? `: ${a.parentesco}` : ''}${a.descripcion ? ` (${a.descripcion})` : ''}`);
  const empleos: string[] = (fuente.antecedentesEmpleos ?? [])
    .map((e: any) => `${e.empresa || '?'} — ${e.puesto || '?'}${e.tiempoMeses ? ` (${e.tiempoMeses} meses)` : ''}${e.riesgos?.length ? ` · ${e.riesgos.join(', ')}` : ''}`);

  const gineco = fuente.antecedentesGineco;
  const repro = fuente.antecedentesReproductivos;
  const ginecoResumen: string[] = gineco ? [
    gineco.gestas !== '' ? `G${gineco.gestas || 0} P${gineco.partos || 0} C${gineco.cesareas || 0} A${gineco.abortos || 0}` : '',
    gineco.papanicolaou?.realizado === true ? `PAP: ${gineco.papanicolaou.resultado || 'realizado'}` : '',
    gineco.mamografia?.realizado === true ? `Mamografía: ${gineco.mamografia.resultado || 'realizada'}` : '',
    gineco.planificacionFamiliar === true ? `Planificación: ${gineco.planificacionTipo || 'sí'}` : '',
  ].filter(Boolean) : [];
  const reproResumen: string[] = repro ? [
    repro.antigenoProstatico?.realizado === true ? `PSA: ${repro.antigenoProstatico.resultado || 'realizado'}` : '',
    repro.ecoProstatico?.realizado === true ? `Eco prostático: ${repro.ecoProstatico.resultado || 'realizado'}` : '',
  ].filter(Boolean) : [];

  const Bloque = ({ titulo, items, vacio }: { titulo: string; items: string[]; vacio: string }) => (
    <div className="border rounded-[11px] p-[12px_14px]" style={{ background: '#f6f7f9', borderColor: '#e4e6ea' }}>
      <div className="text-[11px] font-bold uppercase mb-1.5" style={{ color: '#98a0ab' }}>{titulo}</div>
      {items.length === 0
        ? <div className="text-[12px]" style={{ color: '#98a0ab' }}>{vacio}</div>
        : <ul className="m-0 pl-4 space-y-0.5">{items.map((it, i) => <li key={i} className="text-[12.5px]" style={{ color: '#3a4250' }}>{it}</li>)}</ul>}
    </div>
  );

  return (
    <SecCard icon={<ClipboardList size={17} />} color="#0d6b5f" title="Antecedentes"
      action={<Link onClick={() => onVerEval(fuente)}>Ver ficha origen</Link>}>
      <div className="mb-3 text-[11.5px]" style={{ color: '#98a0ab' }}>
        Fuente: <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: tb.bg, color: tb.fg }}>{tb.label}</span>
        {' '}del <span style={{ fontFamily: MONO }}>{fmtF(fuente.fecha)}</span>
        {fuente.edadInicioLaboral ? <> · Inició actividad laboral a los <span style={{ fontFamily: MONO }}>{fuente.edadInicioLaboral}</span> años</> : null}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Bloque titulo="Clínicos" items={clinicos} vacio={fuente.antecedentesClinicosQ === false ? 'Sin antecedentes clínicos.' : 'No registrados.'} />
        <Bloque titulo="Quirúrgicos" items={quirurgicos} vacio={fuente.antecedentesQuirurgicosQ === false ? 'Sin antecedentes quirúrgicos.' : 'No registrados.'} />
        <Bloque titulo="Alergias" items={alergias} vacio={fuente.alergiasTiene === false ? 'Sin alergias conocidas.' : 'No registradas.'} />
        <Bloque titulo="Hábitos tóxicos" items={habitos} vacio="Sin consumos nocivos reportados." />
        <Bloque titulo="Familiares" items={familiares} vacio="Sin antecedentes familiares de importancia." />
        {gineco && <Bloque titulo="Gineco-obstétricos" items={ginecoResumen} vacio="No registrados." />}
        {repro && <Bloque titulo="Reproductivos" items={reproResumen} vacio="No registrados." />}
        <Bloque titulo="Empleos anteriores" items={empleos} vacio="Sin empleos anteriores registrados." />
      </div>
    </SecCard>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────────
function num(v: any): number | null { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? null : n; }

/** Edad en años a partir de la fecha de nacimiento del trabajador. */
function edadDe(fechaNacimiento: any): number | null {
  if (!fechaNacimiento) return null;
  const d = new Date(String(fechaNacimiento) + (String(fechaNacimiento).length === 10 ? 'T12:00:00' : ''));
  if (isNaN(d.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - d.getFullYear();
  const m = hoy.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) edad--;
  return edad >= 0 && edad < 130 ? edad : null;
}

function SignosGrid({ evaluaciones, trabajador }: { evaluaciones: any[]; trabajador?: any }) {
  // Serie cronológica (más antigua → más reciente); el último valor es el vigente.
  const serie = [...evaluaciones].reverse().map((e) => e.signosVitales || {});

  // PA: última medición + promedio de las últimas mediciones registradas.
  const pas = serie.map((s) => ({ sis: num(s.presionSistolica), dia: num(s.presionDiastolica) }))
    .filter((p): p is { sis: number; dia: number } => p.sis != null && p.dia != null);
  const ultimasPA = pas.slice(-5);
  const promPA = ultimasPA.length > 0
    ? `${Math.round(ultimasPA.reduce((s, p) => s + p.sis, 0) / ultimasPA.length)}/${Math.round(ultimasPA.reduce((s, p) => s + p.dia, 0) / ultimasPA.length)}`
    : null;
  const ultimaPA = pas.length > 0 ? `${pas[pas.length - 1].sis}/${pas[pas.length - 1].dia}` : '—';

  const edad = edadDe(trabajador?.fechaNacimiento);

  const cards: { label: string; unidad: string; color: string; get?: (s: any) => number | null; display?: string; sub?: string; sinSpark?: boolean }[] = [
    { label: 'P. arterial', unidad: '', color: BRAND, get: (s: any) => num(s.presionSistolica), display: ultimaPA, sub: promPA ? `Prom. últ. ${ultimasPA.length}: ${promPA}` : undefined },
    { label: 'Peso', unidad: 'kg', color: '#1f7a4d', get: (s: any) => num(s.peso), sub: 'Último medido' },
    { label: 'IMC', unidad: '', color: '#6b4ba3', get: (s: any) => num(s.imc), sub: 'Más reciente' },
    { label: 'P. abdominal', unidad: 'cm', color: '#9a5b12', get: (s: any) => num(s.perimetroAbdominal), sub: 'Último medido' },
    { label: 'Edad', unidad: 'años', color: '#0e6b7c', display: edad != null ? String(edad) : '—', sub: trabajador?.fechaNacimiento ? `Nac. ${new Date(String(trabajador.fechaNacimiento) + 'T12:00:00').toLocaleDateString('es-EC')}` : 'Sin fecha de nacimiento', sinSpark: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((c) => {
        const vals = c.get ? serie.map(c.get).filter((v): v is number => v != null) : [];
        const display = c.display ?? (vals.length > 0 ? String(vals[vals.length - 1]) : '—');
        return (
          <div key={c.label} className="border rounded-xl p-[13px_15px]" style={{ background: '#f6f7f9', borderColor: '#e4e6ea' }}>
            <div className="text-[10.5px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#98a0ab' }}>{c.label}</div>
            <div className="flex items-baseline gap-1"><span className="text-[23px] font-bold" style={{ fontFamily: MONO }}>{display}</span><span className="text-[11px]" style={{ color: '#98a0ab' }}>{c.unidad}</span></div>
            {c.sub && <div className="text-[10.5px] mt-0.5" style={{ color: '#98a0ab' }}>{c.sub}</div>}
            {!c.sinSpark && <div className="mt-1.5"><Spark serie={vals} color={c.color} /></div>}
          </div>
        );
      })}
    </div>
  );
}

/** CIE-10 de una atención de consulta diaria (cieCodigo) o de una evaluación (diagnosticos[]). */
function cieDeAtencion(a: any): { cie: string; desc: string } | null {
  if (a.cieCodigo) return { cie: a.cieCodigo, desc: a.cieDescripcion || '' };
  const dx = Array.isArray(a.diagnosticos) && a.diagnosticos[0] ? a.diagnosticos[0] : null;
  if (dx) return { cie: dx.cie || '', desc: dx.descripcion || '' };
  return null;
}

function AtRow({ a, border, full }: { a: any; border?: boolean; full?: boolean }) {
  const dx = cieDeAtencion(a);
  return (
    <div className="flex items-start gap-3 p-[11px_18px]" style={{ borderTop: border ? '1px solid #eef0f3' : 'none' }}>
      <div className="text-[12px] min-w-[64px] pt-0.5" style={{ fontFamily: MONO, color: '#98a0ab' }}>{fmtF(a.fecha)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold flex items-center gap-1.5 flex-wrap">
          {a.motivoConsulta || a.motivo || 'Consulta'}
          {dx?.cie && <span className="text-[10.5px] font-bold px-1.5 py-px rounded" style={{ fontFamily: MONO, background: '#e3f0f2', color: '#0e6b7c' }}>{dx.cie}</span>}
        </div>
        <div className="text-[12px]" style={{ color: '#98a0ab' }}>{dx ? (dx.desc || '') : ''}{a.medicoNombre ? `${dx?.desc ? ' · ' : ''}${a.medicoNombre}` : ''}</div>
      </div>
    </div>
  );
}
function PermisoMini({ p }: { p: PermisoMedico }) {
  const meta = TIPOS_PERMISO[p.tipo];
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: `${meta.color}14`, color: meta.color }}>{meta.short}</span>
      <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold truncate">{p.motivo || '—'}</div><div className="text-[11.5px]" style={{ color: '#98a0ab' }}>{fmtPF(p.desde)} · {duracionPermiso(p)}</div></div>
    </div>
  );
}
function Spark({ serie, color, w = 70, h = 22 }: { serie: number[]; color: string; w?: number; h?: number }) {
  if (!serie || serie.length < 2) return <div style={{ height: h }} className="flex items-center text-[11px]" >—</div>;
  const min = Math.min(...serie), max = Math.max(...serie), rng = max - min || 1;
  const pts = serie.map((v, i) => `${(i / (serie.length - 1)) * w},${(h - ((v - min) / rng) * (h - 4) - 2).toFixed(1)}`).join(' ');
  const lastY = h - ((serie[serie.length - 1] - min) / rng) * (h - 4) - 2;
  return <svg width={w} height={h} style={{ overflow: 'visible' }}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /><circle cx={w} cy={lastY} r={2.4} fill={color} /></svg>;
}
