// Página: Evaluaciones Ergonómicas. Ruta /ergonomia.
// Fase A: realizar evaluaciones RULA/REBA (puntuación manual), guardarlas,
// listarlas y exportar informe PDF. La medición de ángulos sobre fotos llega
// en la Fase B.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query as fbQuery, orderBy, Timestamp } from 'firebase/firestore';
import { Activity, Plus, Search, FileText, Trash2, ArrowLeft, Camera } from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import TopBar from '../components/dashboard/TopBar';
import FormularioErgo from '../components/ergonomia/FormularioErgo';
import MedidorAngulos from '../components/ergonomia/MedidorAngulos';
import { generarInformeErgo } from '../components/ergonomia/informeErgo';
import { getEvaluacionesErgo, crearEvaluacionErgo, eliminarEvaluacionErgo } from '../services/ergonomia';
import { getTrabajadores } from '../services/trabajadores';
import { valoresIniciales, METODOS } from '../utils/ergonomia/definiciones';
import { matchTrabajador, areaDeTrabajador, nombreCompleto } from '../utils/medicalHelpers';
import { cargarLogoParaPdf } from '../utils/logoPdf';
import { LOGO_EMPRESA } from '../assets/logoEmpresa';
import { toDate } from '../services/atenciones';
import type { Trabajador } from '../types';
import type { MetodoErgo, ResultadoErgo, EvaluacionErgonomica, FotoErgo } from '../types/ergonomia';
import { COLORS, FONTS } from '../theme';

const ACCENT = '#0d9488';

const TONE_STYLE: Record<string, { fg: string; bg: string }> = {
  success: { fg: COLORS.ok, bg: COLORS.okBg },
  warning: { fg: COLORS.warn, bg: COLORS.warnBg },
  danger: { fg: COLORS.bad, bg: COLORS.badBg },
};

export default function Ergonomia() {
  const navigate = useNavigate();
  const { user, displayName } = useAuth();
  const { empresa } = useEmpresa();
  const toast = useToast();
  const confirm = useConfirm();

  const [vista, setVista] = useState<'lista' | 'nueva'>('lista');
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionErgonomica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [logoPdf, setLogoPdf] = useState<{ data: string; format: string }>({ data: LOGO_EMPRESA, format: 'PNG' });

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'DR';

  const cargar = async () => {
    setCargando(true);
    try {
      const [ts, evs] = await Promise.all([
        getTrabajadores(),
        getEvaluacionesErgo(),
      ]);
      setTrabajadores(ts);
      setEvaluaciones(evs);
    } catch (err) { console.error('Error al cargar ergonomía:', err); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    let cancel = false;
    if (empresa.logoUrl) cargarLogoParaPdf(empresa.logoUrl).then((r) => { if (!cancel && r) setLogoPdf(r); });
    return () => { cancel = true; };
  }, [empresa.logoUrl]);

  const eliminar = async (ev: EvaluacionErgonomica) => {
    if (!ev.id) return;
    if (!(await confirm({ message: `¿Eliminar la evaluación ${ev.metodo} de ${ev.apellidos} ${ev.nombres}?`, danger: true }))) return;
    try { await eliminarEvaluacionErgo(ev.id); toast.success('Evaluación eliminada.'); cargar(); }
    catch (err) { console.error(err); toast.error('No se pudo eliminar.'); }
  };

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg, fontFamily: FONTS.sans, color: COLORS.ink }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <div className="max-w-5xl mx-auto p-6 md:p-8">
        {vista === 'lista' ? (
          <>
            <div className="flex items-end justify-between gap-3 mb-6 flex-wrap">
              <div>
                <h1 className="m-0 text-[26px] font-bold tracking-tight flex items-center gap-2" style={{ fontFamily: FONTS.serif }}>
                  <Activity size={24} style={{ color: ACCENT }} /> Evaluaciones ergonómicas
                </h1>
                <p className="m-0 text-sm text-slate-500 mt-1">Métodos RULA y REBA para carga postural.</p>
              </div>
              <button onClick={() => setVista('nueva')} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white font-bold rounded-[9px] text-sm" style={{ background: ACCENT }}>
                <Plus size={16} /> Nueva evaluación
              </button>
            </div>

            <div className="bg-white border rounded-[14px] overflow-hidden shadow-sm" style={{ borderColor: COLORS.line }}>
              {cargando ? (
                <div className="p-12 text-center text-slate-400">Cargando…</div>
              ) : evaluaciones.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">Aún no hay evaluaciones ergonómicas. Pulsa «Nueva evaluación».</div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b text-left" style={{ background: COLORS.bg, borderColor: COLORS.line }}>
                      {['Fecha', 'Trabajador', 'Método', 'Resultado', 'Acciones'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.faint }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {evaluaciones.map((ev) => {
                      const t = TONE_STYLE[ev.resultado.tone] ?? { fg: COLORS.muted, bg: COLORS.bg };
                      const f = toDate(ev.fecha);
                      return (
                        <tr key={ev.id} className="border-t hover:bg-slate-50" style={{ borderColor: COLORS.line }}>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ fontFamily: FONTS.mono, color: COLORS.muted }}>{isNaN(f.getTime()) ? '—' : f.toLocaleDateString('es-EC')}</td>
                          <td className="px-4 py-3"><div className="font-semibold">{ev.apellidos} {ev.nombres}</div><div className="text-[11px] text-slate-400">{ev.puesto}</div></td>
                          <td className="px-4 py-3 font-bold" style={{ color: ACCENT }}>{ev.metodo}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ color: t.fg, background: t.bg }}>
                              {ev.resultado.puntajeFinal} · {ev.resultado.nivel}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              <button onClick={() => generarInformeErgo(ev, empresa, logoPdf)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border bg-white hover:bg-slate-50" style={{ borderColor: COLORS.line, color: COLORS.muted }}><FileText size={13} /> PDF</button>
                              <button onClick={() => eliminar(ev)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-red-200 text-red-700 bg-white hover:bg-red-50"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          <NuevaEvaluacion
            trabajadores={trabajadores}
            onCancel={() => setVista('lista')}
            onSaved={() => { setVista('lista'); cargar(); }}
            medicoId={user?.uid ?? ''}
            medicoNombre={displayName}
          />
        )}
      </div>
    </div>
  );
}

// ── Flujo de nueva evaluación ─────────────────────────────────────────────────
function NuevaEvaluacion({ trabajadores, onCancel, onSaved, medicoId, medicoNombre }: {
  trabajadores: Trabajador[]; onCancel: () => void; onSaved: () => void; medicoId: string; medicoNombre: string;
}) {
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [sel, setSel] = useState<Trabajador | null>(null);
  const [metodo, setMetodo] = useState<MetodoErgo>('RULA');
  const [tarea, setTarea] = useState('');
  const [lado, setLado] = useState<'izquierdo' | 'derecho'>('derecho');
  const [observaciones, setObservaciones] = useState('');
  const [recomendaciones, setRecomendaciones] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [base, setBase] = useState<Record<string, number>>(() => valoresIniciales('RULA'));
  const [adj, setAdj] = useState<Record<string, boolean>>({});
  const [fotos, setFotos] = useState<FotoErgo[]>([]);
  const [medidor, setMedidor] = useState(false);

  const [vals, setVals] = useState<Record<string, number>>({});
  const [resultado, setResultado] = useState<ResultadoErgo | null>(null);
  const onChange = useCallback((v: Record<string, number>, r: ResultadoErgo) => { setVals(v); setResultado(r); }, []);

  // Reiniciar puntajes al cambiar de método
  useEffect(() => { setBase(valoresIniciales(metodo)); setAdj({}); }, [metodo]);

  const filtrados = useMemo(() => (busqueda ? trabajadores.filter((t) => matchTrabajador(t, busqueda)).slice(0, 8) : []), [trabajadores, busqueda]);

  const guardar = async () => {
    if (!sel || !sel.id) { toast.error('Selecciona un trabajador.'); return; }
    if (!resultado) return;
    setGuardando(true);
    try {
      await crearEvaluacionErgo({
        trabajadorId: sel.id,
        apellidos: `${sel.primerApellido} ${sel.segundoApellido || ''}`.trim(),
        nombres: `${sel.primerNombre} ${sel.segundoNombre || ''}`.trim(),
        cedula: sel.cedula,
        puesto: sel.puestoTrabajo,
        area: areaDeTrabajador(sel),
        metodo,
        fecha: Timestamp.now(),
        tarea: tarea.trim(),
        lado,
        entradas: vals,
        resultado,
        fotos,
        observaciones: observaciones.trim(),
        recomendaciones: recomendaciones.trim(),
        medicoId,
        medicoNombre,
      });
      toast.success('Evaluación guardada.');
      onSaved();
    } catch (err) { console.error(err); toast.error('No se pudo guardar la evaluación.'); }
    finally { setGuardando(false); }
  };

  const tone = resultado ? (TONE_STYLE[resultado.tone] ?? { fg: COLORS.muted, bg: COLORS.bg }) : null;
  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-600/30';

  return (
    <div>
      <button onClick={onCancel} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-4"><ArrowLeft size={15} /> Volver a la lista</button>
      <h1 className="m-0 text-[24px] font-bold tracking-tight mb-5" style={{ fontFamily: FONTS.serif }}>Nueva evaluación ergonómica</h1>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
        <div className="space-y-4">
          {/* Trabajador */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Trabajador</label>
            {sel ? (
              <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                <div><div className="font-semibold text-[13px]">{nombreCompleto(sel)}</div><div className="text-[11px] text-slate-500">{sel.puestoTrabajo} · CI {sel.cedula}</div></div>
                <button onClick={() => { setSel(null); setBusqueda(''); }} className="text-[12px] font-semibold text-teal-700">Cambiar</button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, cédula o puesto…" className={inputCls + ' pl-8'} />
                {filtrados.length > 0 && (
                  <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                    {filtrados.map((t) => (
                      <button key={t.id} onClick={() => { setSel(t); setBusqueda(''); }} className="block w-full text-left px-3 py-2 text-[13px] hover:bg-slate-50 border-b border-slate-50 last:border-0">
                        <span className="font-semibold">{nombreCompleto(t)}</span> <span className="text-slate-400 text-[11px]">· {t.puestoTrabajo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Método + tarea */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex gap-2">
              {(Object.keys(METODOS) as MetodoErgo[]).map((m) => (
                <button key={m} onClick={() => setMetodo(m)} className="px-4 py-2 rounded-lg text-[13px] font-bold border" style={metodo === m ? { background: ACCENT, color: '#fff', borderColor: ACCENT } : { background: '#fff', color: COLORS.muted, borderColor: COLORS.line }}>{m}</button>
              ))}
              <div className="ml-auto flex items-center gap-1.5 text-[12px] text-slate-500">
                <span>Lado:</span>
                <select value={lado} onChange={(e) => setLado(e.target.value as any)} className="px-2 py-1 border border-slate-300 rounded text-[12px] bg-white"><option value="derecho">Derecho</option><option value="izquierdo">Izquierdo</option></select>
              </div>
            </div>
            <input value={tarea} onChange={(e) => setTarea(e.target.value)} placeholder="Tarea / actividad evaluada (ej. levantamiento de cajas en bodega)" className={inputCls} />
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => { if (!sel) { toast.error('Selecciona primero un trabajador.'); return; } setMedidor(true); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold border" style={{ borderColor: ACCENT, color: ACCENT }}>
                <Camera size={14} /> Medir sobre foto
              </button>
              <span className="text-[11.5px] text-slate-400">Mide ángulos en una foto y sugiere los puntajes.</span>
            </div>
            {fotos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {fotos.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={f.url} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                    <button onClick={() => setFotos((arr) => arr.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 grid place-items-center rounded-full bg-white border border-slate-300 text-slate-500 text-xs">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formulario de puntuación */}
          <FormularioErgo metodo={metodo} base={base} setBase={setBase} adj={adj} setAdj={setAdj} onChange={onChange} />

          {/* Observaciones */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div><label className="block text-[13px] font-semibold text-slate-700 mb-1">Observaciones</label><textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className={inputCls} /></div>
            <div><label className="block text-[13px] font-semibold text-slate-700 mb-1">Recomendaciones</label><textarea value={recomendaciones} onChange={(e) => setRecomendaciones(e.target.value)} rows={2} className={inputCls} /></div>
          </div>
        </div>

        {/* Panel de resultado (sticky) */}
        <div className="lg:sticky lg:top-4 space-y-3">
          <div className="rounded-xl border p-5 text-center" style={{ background: tone?.bg ?? COLORS.bg, borderColor: COLORS.line }}>
            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: tone?.fg ?? COLORS.muted }}>{metodo} · puntaje final</div>
            <div className="text-[44px] font-extrabold leading-none my-1.5" style={{ color: tone?.fg ?? COLORS.ink, fontFamily: FONTS.mono }}>{resultado?.puntajeFinal ?? '—'}</div>
            <div className="text-[14px] font-bold" style={{ color: tone?.fg ?? COLORS.ink }}>{resultado?.nivel ?? ''}</div>
            <div className="text-[12px] mt-1.5 text-slate-600">{resultado?.accion ?? ''}</div>
          </div>
          <button onClick={guardar} disabled={guardando || !sel} className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 text-white font-bold rounded-[9px] text-sm disabled:opacity-50" style={{ background: ACCENT }}>
            {guardando ? 'Guardando…' : 'Guardar evaluación'}
          </button>
        </div>
      </div>

      {medidor && sel && (
        <MedidorAngulos
          trabajadorId={sel.id ?? ''}
          metodo={metodo}
          onAplicarPuntaje={(seg, puntaje) => { setBase((p) => ({ ...p, [seg]: puntaje })); toast.success(`Puntaje sugerido aplicado a ${seg}.`); }}
          onFotoGuardada={(f) => setFotos((arr) => [...arr, f])}
          onClose={() => setMedidor(false)}
        />
      )}
    </div>
  );
}
