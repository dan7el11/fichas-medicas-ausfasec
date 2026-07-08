// Página: Resumen 360° de Expediente. Archivo NUEVO (src/pages/ExpedienteResumen.tsx).
// Ruta sugerida: /expediente/:id. Consolida signos, consultas, exámenes y permisos.
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Weight, HeartPulse, Activity, Droplet, Stethoscope,
  ClipboardList, CalendarDays, FileText, Calendar, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/dashboard/TopBar';
import {
  cargarExpediente, fmtFecha, ultimoConDelta, APTITUD_LABEL,
  type ExpedienteData, type SignoPunto,
} from '../services/expediente';
import type { AtencionMedica } from '../types/atencion';
import { estadoOrden } from '../services/examenesPlan';
import { estadoPermiso, duracionPermiso } from '../services/permisos';
import { TIPOS_PERMISO } from '../types/permiso';

const BRAND = '#0a6b3b';
const TONE: Record<string, { fg: string; bg: string }> = {
  success: { fg: '#0a6b3b', bg: '#e6f6ee' }, warning: { fg: '#8a4a0a', bg: '#fff4e3' },
  danger: { fg: '#a01f2a', bg: '#fce8eb' }, info: { fg: '#1d4fad', bg: '#eaf3ff' }, muted: { fg: '#3a4a5e', bg: '#eef1f5' },
};

export default function ExpedienteResumen() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<ExpedienteData | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    setCargando(true);
    cargarExpediente(id).then((d) => { setData(d); setCargando(false); });
  }, [id]);

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'DR';
  const t = data?.trabajador;
  const ultEval = data?.evaluaciones[0];
  const apt = ultEval ? APTITUD_LABEL[ultEval.aptitudMedica] : null;

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden text-slate-900" style={{ background: '#f5f7fa', fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto p-[20px_32px_80px]">
          <button onClick={() => navigate('/trabajadores')} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 mb-4 bg-transparent border-none cursor-pointer hover:text-slate-700">
            <ArrowLeft size={15} /> Volver a Trabajadores
          </button>

          {cargando ? (
            <div className="p-16 text-center text-slate-400 font-semibold">Cargando expediente…</div>
          ) : !t ? (
            <div className="p-16 text-center text-slate-400">No se encontró el trabajador.</div>
          ) : (
            <>
              {/* Hero */}
              <div className="bg-white border border-slate-200 rounded-[16px] shadow-sm p-[20px_24px] flex items-center gap-4 mb-5"
                style={{ background: 'linear-gradient(135deg,#e6f6ee 0%,#fff 70%)' }}>
                <div className="w-14 h-14 rounded-full grid place-items-center font-extrabold text-[18px] flex-shrink-0" style={{ background: '#fff', color: BRAND, border: `2px solid ${BRAND}22` }}>
                  {(t.primerApellido?.[0] ?? '') + (t.primerNombre?.[0] ?? '')}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="m-0 text-[22px] font-extrabold tracking-tight">{t.primerApellido} {t.segundoApellido} {t.primerNombre} {t.segundoNombre}</h1>
                  <div className="text-[13px] text-slate-500 mt-0.5">
                    {t.puestoTrabajo}{t.departamento ? ` · ${t.departamento}` : ''} · CI {t.cedula} · {t.sexo === 'M' ? 'Masculino' : 'Femenino'}
                  </div>
                </div>
                {apt && (
                  <div className="text-right">
                    <div className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400 mb-1">Aptitud vigente</div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold" style={{ background: TONE[apt.tone].bg, color: TONE[apt.tone].fg }}>
                      {apt.label}
                    </span>
                    <div className="text-[11px] text-slate-400 mt-1">{fmtFecha(ultEval!.fecha)}</div>
                  </div>
                )}
              </div>

              {/* Signos */}
              <Seccion icon={<Activity size={17} />} color={BRAND} titulo="Seguimiento de signos" sub={`${data!.signos.length} mediciones registradas`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <SignoCard icon={<Weight size={16} />} label="Peso" unidad="kg" color="#0f766e" info={ultimoConDelta(data!.signos, 'peso')} />
                  <PACard signos={data!.signos} />
                  <SignoCard icon={<Activity size={16} />} label="IMC" unidad="" color="#7c5cf2" info={ultimoConDelta(data!.signos, 'imc')} invertirColor />
                  <SignoCard icon={<Droplet size={16} />} label="Glucosa" unidad="mg/dL" color="#a01f2a" info={ultimoConDelta(data!.signos, 'glucosa')} />
                </div>
                {data!.signos.length === 0 && <Empty>Sin signos registrados en las evaluaciones.</Empty>}
              </Seccion>

              {/* Consultas recientes */}
              <Seccion icon={<Stethoscope size={17} />} color="#1d4fad" titulo="Consultas médicas recientes" sub={`${data!.atenciones.length} atenciones`}>
                {data!.atenciones.length === 0 ? <Empty>Sin consultas registradas.</Empty> : (
                  <div className="bg-white border border-slate-200 rounded-[12px] overflow-hidden">
                    {data!.atenciones.slice(0, 6).map((a, i) => (
                      <div key={a.id} className={`flex items-start gap-3 p-[11px_14px] ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                        <div className="text-[12px] text-slate-400 font-mono w-[58px] flex-shrink-0 pt-0.5">{fmtFecha(a.fecha)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[12px] font-bold" style={{ color: '#1d4fad' }}>{a.cieCodigo}</span>
                            <span className="text-[13px] font-semibold text-slate-800 truncate">{a.cieDescripcion}</span>
                            {a.relacion === 'Ocupacional' && <span className="text-[10px] font-bold px-1.5 py-px rounded-full" style={{ color: '#1d4fad', background: '#eaf3ff' }}>ocup.</span>}
                          </div>
                          <div className="text-[12px] text-slate-500">{a.motivo}</div>
                          <div className="text-[12px] text-slate-400 mt-0.5">Tratamiento: {tratamiento(a)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Seccion>

              {/* Exámenes */}
              <Seccion icon={<ClipboardList size={17} />} color="#0e7490" titulo="Exámenes ocupacionales" sub={`${data!.examenes.length} realizados · ${ordenesActivas(data!).length} programados`}>
                <div className="grid grid-cols-2 gap-3">
                  {/* Programados */}
                  <div className="bg-white border border-slate-200 rounded-[12px] p-[14px_16px]">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2.5">Programados</div>
                    {ordenesActivas(data!).length === 0 ? <div className="text-[12.5px] text-slate-400">Ninguno pendiente.</div> : (
                      <div className="flex flex-col gap-2">
                        {ordenesActivas(data!).slice(0, 3).map((o) => {
                          const st = estadoOrden(o);
                          return (
                            <div key={o.id} className="flex items-center gap-2">
                              <Calendar size={13} className="text-slate-400 flex-shrink-0" />
                              <span className="text-[12.5px] text-slate-700 flex-1 truncate">{o.tipoEvaluacion} · {o.examenes.length} exám.</span>
                              <span className="text-[11px] font-bold px-2 py-px rounded-full" style={{ background: TONE[st.tone].bg, color: TONE[st.tone].fg }}>{st.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Realizados */}
                  <div className="bg-white border border-slate-200 rounded-[12px] p-[14px_16px]">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2.5">Realizados (recientes)</div>
                    {data!.examenes.length === 0 ? <div className="text-[12.5px] text-slate-400">Sin exámenes con archivo.</div> : (
                      <div className="flex flex-col gap-2">
                        {data!.examenes.slice(0, 3).map((ex) => (
                          <div key={ex.id} className="flex items-center gap-2">
                            <FileText size={13} className="text-slate-400 flex-shrink-0" />
                            <span className="text-[12.5px] text-slate-700 flex-1 truncate">{ex.nombreExamen}</span>
                            <span className="text-[11px] text-slate-400">{fmtFecha(ex.fecha)}</span>
                            <span className="text-[11px] font-bold px-2 py-px rounded-full" style={{ background: ex.estado === 'patologico' ? TONE.danger.bg : TONE.success.bg, color: ex.estado === 'patologico' ? TONE.danger.fg : TONE.success.fg }}>
                              {ex.estado === 'patologico' ? 'Patológico' : 'Normal'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Seccion>

              {/* Permisos */}
              <Seccion icon={<CalendarDays size={17} />} color="#7c5cf2" titulo="Permisos médicos" sub={`${data!.permisos.length} en total`}>
                {data!.permisos.length === 0 ? <Empty>Sin permisos registrados.</Empty> : (
                  <div className="bg-white border border-slate-200 rounded-[12px] overflow-hidden">
                    {data!.permisos.slice(0, 5).map((p, i) => {
                      const est = estadoPermiso(p);
                      const meta = TIPOS_PERMISO[p.tipo];
                      const estTone = est === 'justificado' || est === 'activo' ? 'success' : est === 'pendiente' ? 'warning' : 'danger';
                      return (
                        <div key={p.id} className={`flex items-center gap-3 p-[11px_14px] ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                          <span className="text-[12px] font-bold px-2 py-px rounded-md" style={{ background: `${meta.color}14`, color: meta.color }}>{meta.short}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-slate-800 truncate">{p.motivo}</div>
                            <div className="text-[12px] text-slate-400">{fmtFecha(p.desde)} · {duracionPermiso(p)}</div>
                          </div>
                          <span className="text-[11px] font-bold px-2 py-px rounded-full" style={{ background: TONE[estTone].bg, color: TONE[estTone].fg }}>{est}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Seccion>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Tratamiento legible de una atención ──────────────────────────────────────
function tratamiento(a: AtencionMedica): string {
  const meds = (a.medicacion ?? []).map((m) => `${m.nombre}${m.cantidad > 1 ? ` ×${m.cantidad}` : ''}`);
  const partes = [...meds, ...(a.procedimientos ?? [])];
  if (a.reposoDias > 0) partes.push(`Reposo ${a.reposoDias}d`);
  return partes.length ? partes.join(' · ') : '—';
}
function ordenesActivas(d: ExpedienteData) {
  return d.ordenes.filter((o) => estadoOrden(o).key !== 'completado');
}

// ── Sección contenedora ──────────────────────────────────────────────────────
function Seccion({ icon, color, titulo, sub, children }: { icon: ReactNode; color: string; titulo: string; sub: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="grid place-items-center w-[30px] h-[30px] rounded-lg" style={{ background: `${color}14`, color }}>{icon}</span>
        <h2 className="m-0 text-[16px] font-bold tracking-tight">{titulo}</h2>
        <span className="text-[12px] text-slate-400">{sub}</span>
      </div>
      {children}
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="p-5 text-center text-slate-400 text-[13px] bg-white rounded-[12px] border border-slate-200">{children}</div>;
}

// ── Tarjeta de signo con sparkline ───────────────────────────────────────────
function SignoCard({ icon, label, unidad, color, info, invertirColor }: {
  icon: ReactNode; label: string; unidad: string; color: string;
  info: { actual: number | null; delta: number | null; fecha: Date | null; serie: number[] }; invertirColor?: boolean;
}) {
  const sube = (info.delta ?? 0) > 0;
  const deltaColor = info.delta == null ? '#94a2b3' : (sube === !invertirColor ? '#a01f2a' : '#0a6b3b');
  return (
    <div className="bg-white border border-slate-200 rounded-[12px] p-[14px_16px] shadow-sm">
      <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-400 uppercase tracking-wide mb-2">
        <span style={{ color }}>{icon}</span> {label}
      </div>
      {info.actual == null ? (
        <div className="text-[13px] text-slate-300">Sin dato</div>
      ) : (
        <>
          <div className="flex items-baseline gap-1">
            <span className="text-[24px] font-extrabold tracking-tight font-mono">{info.actual}</span>
            <span className="text-[12px] text-slate-400">{unidad}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Sparkline serie={info.serie} color={color} />
            {info.delta != null && info.delta !== 0 && (
              <span className="text-[11px] font-bold" style={{ color: deltaColor }}>{info.delta > 0 ? '+' : ''}{info.delta}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
function PACard({ signos }: { signos: SignoPunto[] }) {
  const sis = ultimoConDelta(signos, 'sistolica');
  const dia = ultimoConDelta(signos, 'diastolica');
  const alta = (sis.actual ?? 0) >= 140 || (dia.actual ?? 0) >= 90;
  return (
    <div className="bg-white border border-slate-200 rounded-[12px] p-[14px_16px] shadow-sm">
      <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-400 uppercase tracking-wide mb-2">
        <span style={{ color: alta ? '#a01f2a' : '#dc2e3c' }}><HeartPulse size={16} /></span> Presión arterial
      </div>
      {sis.actual == null ? <div className="text-[13px] text-slate-300">Sin dato</div> : (
        <>
          <div className="flex items-baseline gap-1">
            <span className="text-[24px] font-extrabold tracking-tight font-mono" style={{ color: alta ? '#a01f2a' : undefined }}>{sis.actual}/{dia.actual ?? '—'}</span>
            <span className="text-[12px] text-slate-400">mmHg</span>
          </div>
          <div className="mt-1"><Sparkline serie={sis.serie} color={alta ? '#dc2e3c' : '#0e9bbf'} /></div>
        </>
      )}
    </div>
  );
}

function Sparkline({ serie, color }: { serie: number[]; color: string }) {
  if (serie.length < 2) return <div className="h-[22px] flex items-center text-[11px] text-slate-300">—</div>;
  const w = 90, h = 22, min = Math.min(...serie), max = Math.max(...serie);
  const rng = max - min || 1;
  const pts = serie.map((v, i) => {
    const x = (i / (serie.length - 1)) * w;
    const y = h - ((v - min) / rng) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      {serie.length > 0 && (() => {
        const lastX = w, lastY = h - ((serie[serie.length - 1] - min) / rng) * (h - 4) - 2;
        return <circle cx={lastX} cy={lastY} r={2.4} fill={color} />;
      })()}
    </svg>
  );
}
