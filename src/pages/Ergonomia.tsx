// Página: Evaluaciones Ergonómicas. Ruta /ergonomia.
// Fase A: realizar evaluaciones RULA/REBA (puntuación manual), guardarlas,
// listarlas y exportar informe PDF. La medición de ángulos sobre fotos llega
// en la Fase B.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query as fbQuery, orderBy, Timestamp } from 'firebase/firestore';
import { Activity, Plus, Search, FileText, Trash2, ArrowLeft, Camera, CloudOff, UploadCloud, Loader2 } from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import TopBar from '../components/dashboard/TopBar';
import FormularioErgo from '../components/ergonomia/FormularioErgo';
import MedidorAngulos from '../components/ergonomia/MedidorAngulos';
import { generarInformeErgo } from '../components/ergonomia/informeErgo';
import { generarInformeGlobalErgo } from '../components/ergonomia/informeGlobalErgo';
import { getEvaluacionesErgo, crearEvaluacionErgo, eliminarEvaluacionErgo } from '../services/ergonomia';
import { guardarFotoPendiente, contarFotosPendientes, sincronizarFotosPendientes } from '../services/fotosPendientes';
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
  const { user, nombreProfesional } = useAuth();
  const { empresa } = useEmpresa();
  const toast = useToast();
  const confirm = useConfirm();

  const [vista, setVista] = useState<'lista' | 'nueva'>('lista');
  const [filtroMetodo, setFiltroMetodo] = useState<'Todos' | MetodoErgo>('Todos');
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionErgonomica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [logoPdf, setLogoPdf] = useState<{ data: string; format: string }>({ data: LOGO_EMPRESA, format: 'PNG' });
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'DR';

  const refrescarPendientes = useCallback(async () => {
    setPendientes(await contarFotosPendientes());
  }, []);

  // Sube las fotos que quedaron en cola (sin conexión) y refresca la lista.
  const sincronizar = useCallback(async (silencioso = false) => {
    setSincronizando(true);
    try {
      const r = await sincronizarFotosPendientes();
      setPendientes(r.pendientes);
      if (r.subidas > 0) {
        toast.success(`${r.subidas} foto${r.subidas !== 1 ? 's' : ''} subida${r.subidas !== 1 ? 's' : ''} correctamente.`);
        cargar();
      } else if (!silencioso && r.pendientes > 0) {
        toast.error('No se pudieron subir las fotos. Revisa tu conexión e inténtalo de nuevo.');
      }
    } finally { setSincronizando(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

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

  // Fotos pendientes de subir: contar al entrar e intentar sincronizar
  // automáticamente (al montar y cada vez que vuelva la conexión).
  useEffect(() => {
    refrescarPendientes();
    sincronizar(true);
    const alVolverLaRed = () => sincronizar(true);
    window.addEventListener('online', alVolverLaRed);
    return () => window.removeEventListener('online', alVolverLaRed);
  }, [refrescarPendientes, sincronizar]);

  const filtradas = filtroMetodo === 'Todos' ? evaluaciones : evaluaciones.filter((e) => e.metodo === filtroMetodo);

  const eliminar = async (ev: EvaluacionErgonomica) => {
    if (!ev.id) return;
    if (!(await confirm({ message: `¿Eliminar la evaluación ${ev.metodo} de ${ev.apellidos} ${ev.nombres}?`, danger: true }))) return;
    try { await eliminarEvaluacionErgo(ev.id); toast.success('Evaluación eliminada.'); cargar(); }
    catch (err) { console.error(err); toast.error('No se pudo eliminar.'); }
  };

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg, fontFamily: FONTS.sans, color: COLORS.ink }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <div className="max-w-5xl mx-auto p-4 md:p-8">
        {vista === 'lista' ? (
          <>
            <div className="flex items-end justify-between gap-3 mb-6 flex-wrap">
              <div>
                <h1 className="m-0 text-[26px] font-bold tracking-tight flex items-center gap-2" style={{ fontFamily: FONTS.serif }}>
                  <Activity size={24} style={{ color: ACCENT }} /> Evaluaciones ergonómicas
                </h1>
                <p className="m-0 text-sm text-slate-500 mt-1">RULA, REBA, NIOSH y ROSA.</p>
              </div>
              <button onClick={() => setVista('nueva')} className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-white font-bold rounded-[9px] text-sm" style={{ background: ACCENT }}>
                <Plus size={16} /> Nueva evaluación
              </button>
            </div>

            {/* Fotos pendientes de subir (modo sin conexión) */}
            {pendientes > 0 && (
              <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl border" style={{ background: COLORS.warnBg, borderColor: '#ecdcc0' }}>
                <CloudOff size={20} style={{ color: COLORS.warn }} className="flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold" style={{ color: COLORS.warn }}>
                    {pendientes} foto{pendientes !== 1 ? 's' : ''} pendiente{pendientes !== 1 ? 's' : ''} de subir
                  </div>
                  <div className="text-[11.5px] text-slate-500">Se guardaron en este dispositivo. Se subirán automáticamente al recuperar la conexión.</div>
                </div>
                <button onClick={() => sincronizar(false)} disabled={sincronizando} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-bold text-white disabled:opacity-60 flex-shrink-0" style={{ background: COLORS.warn }}>
                  {sincronizando ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                  {sincronizando ? 'Subiendo…' : 'Subir ahora'}
                </button>
              </div>
            )}

            {/* Filtro por método + informe global */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {(['Todos', ...Object.keys(METODOS)] as ('Todos' | MetodoErgo)[]).map((m) => (
                <button key={m} onClick={() => setFiltroMetodo(m)}
                  className="px-3 py-1.5 rounded-full text-[12.5px] font-bold border cursor-pointer"
                  style={filtroMetodo === m ? { background: ACCENT, color: '#fff', borderColor: ACCENT } : { background: '#fff', color: COLORS.muted, borderColor: COLORS.line }}>
                  {m}{m !== 'Todos' && ` (${evaluaciones.filter((e) => e.metodo === m).length})`}
                </button>
              ))}
              {filtroMetodo !== 'Todos' && (
                <button
                  onClick={() => generarInformeGlobalErgo(filtroMetodo, filtradas, empresa, logoPdf)}
                  disabled={filtradas.length === 0}
                  title={`Informe consolidado de todas las evaluaciones ${filtroMetodo}: promedios, distribución por nivel de riesgo y detalle`}
                  className="w-full sm:w-auto sm:ml-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border rounded-lg text-[12.5px] font-semibold cursor-pointer hover:bg-slate-50 disabled:opacity-40"
                  style={{ borderColor: ACCENT, color: ACCENT }}
                >
                  <FileText size={14} /> Informe global {filtroMetodo} ({filtradas.length})
                </button>
              )}
            </div>

            <div className="bg-white border rounded-[14px] overflow-hidden shadow-sm" style={{ borderColor: COLORS.line }}>
              {cargando ? (
                <div className="p-12 text-center text-slate-400">Cargando…</div>
              ) : filtradas.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">
                  {evaluaciones.length === 0 ? 'Aún no hay evaluaciones ergonómicas. Pulsa «Nueva evaluación».' : `No hay evaluaciones ${filtroMetodo}.`}
                </div>
              ) : (
                <>
                {/* Móvil: tarjetas */}
                <div className="md:hidden divide-y" style={{ borderColor: COLORS.line }}>
                  {filtradas.map((ev) => {
                    const t = TONE_STYLE[ev.resultado.tone] ?? { fg: COLORS.muted, bg: COLORS.bg };
                    const f = toDate(ev.fecha);
                    return (
                      <div key={ev.id} className="p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[13px] font-bold" style={{ color: ACCENT }}>{ev.metodo}</span>
                          <span className="text-[11.5px] text-slate-400" style={{ fontFamily: FONTS.mono }}>{isNaN(f.getTime()) ? '—' : f.toLocaleDateString('es-EC')}</span>
                          <span className="ml-auto px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap" style={{ color: t.fg, background: t.bg }}>
                            {ev.resultado.puntajeFinal} · {ev.resultado.nivel}
                          </span>
                        </div>
                        <div className="text-[14px] font-semibold text-slate-900">{ev.apellidos} {ev.nombres}</div>
                        <div className="text-[12px] text-slate-400 mb-2.5">{ev.puesto}{ev.tarea ? ` · ${ev.tarea}` : ''}</div>
                        <div className="flex gap-2">
                          <button onClick={() => generarInformeErgo(ev, empresa, logoPdf)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold border bg-white" style={{ borderColor: COLORS.line, color: COLORS.muted }}><FileText size={14} /> PDF</button>
                          <button onClick={() => eliminar(ev)} className="inline-flex items-center justify-center px-3.5 py-2 rounded-lg border border-red-200 text-red-700 bg-white"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Escritorio: tabla */}
                <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-[13px] min-w-[640px]">
                  <thead>
                    <tr className="border-b text-left" style={{ background: COLORS.bg, borderColor: COLORS.line }}>
                      {['Fecha', 'Trabajador', 'Método', 'Resultado', 'Acciones'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.faint }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((ev) => {
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
                </div>
                </>
              )}
            </div>
          </>
        ) : (
          <NuevaEvaluacion
            trabajadores={trabajadores}
            onCancel={() => setVista('lista')}
            onSaved={() => { setVista('lista'); cargar(); refrescarPendientes(); sincronizar(true); }}
            medicoId={user?.uid ?? ''}
            medicoNombre={nombreProfesional}
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
      // Las fotos con imagen local (dataUrl) se guardan en el documento SIN la
      // imagen (es muy pesada para Firestore): solo la ruta reservada y el flag
      // `pendiente`. La imagen se retiene en IndexedDB y se sube después.
      const fotosDoc: FotoErgo[] = fotos.map(({ dataUrl, ...f }) => (dataUrl ? { ...f, url: '', pendiente: true } : f));

      const evaluacionId = await crearEvaluacionErgo({
        trabajadorId: sel.id,
        apellidos: `${sel.primerApellido} ${sel.segundoApellido || ''}`.trim(),
        nombres: `${sel.primerNombre} ${sel.segundoNombre || ''}`.trim(),
        cedula: sel.cedula,
        puesto: sel.puestoTrabajo,
        area: areaDeTrabajador(sel),
        metodo,
        fecha: Timestamp.now(),
        tarea: tarea.trim(),
        // El lado solo aplica a métodos de miembro/cuerpo (ROSA y NIOSH son globales)
        ...(metodo === 'RULA' || metodo === 'REBA' ? { lado } : {}),
        entradas: vals,
        resultado,
        fotos: fotosDoc,
        observaciones: observaciones.trim(),
        recomendaciones: recomendaciones.trim(),
        medicoId,
        medicoNombre,
      });

      // Encolar en el dispositivo cada foto anotada para subirla después.
      for (const f of fotos) {
        if (!f.dataUrl) continue;
        await guardarFotoPendiente({
          evaluacionId,
          trabajadorId: sel.id,
          path: f.path,
          nombre: f.nombre,
          dataUrl: f.dataUrl,
          mediciones: f.mediciones,
        });
      }
      // Intento inmediato de subida (si hay conexión); si no, quedan en cola.
      if (fotos.some((f) => f.dataUrl)) sincronizarFotosPendientes().catch(() => {});

      toast.success('Evaluación guardada.');
      onSaved();
    } catch (err) { console.error(err); toast.error('No se pudo guardar la evaluación.'); }
    finally { setGuardando(false); }
  };

  const tone = resultado ? (TONE_STYLE[resultado.tone] ?? { fg: COLORS.muted, bg: COLORS.bg }) : null;
  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-600/30';

  return (
    <div className="pb-24 lg:pb-0">
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
            <div className="flex gap-2 flex-wrap items-center">
              {(Object.keys(METODOS) as MetodoErgo[]).map((m) => (
                <button key={m} onClick={() => setMetodo(m)} className="flex-1 sm:flex-none px-2 sm:px-4 py-2 rounded-lg text-[13px] font-bold border" style={metodo === m ? { background: ACCENT, color: '#fff', borderColor: ACCENT } : { background: '#fff', color: COLORS.muted, borderColor: COLORS.line }}>{m}</button>
              ))}
              {(metodo === 'RULA' || metodo === 'REBA') && (
                <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-1.5 text-[12px] text-slate-500">
                  <span>Lado evaluado:</span>
                  <select value={lado} onChange={(e) => setLado(e.target.value as any)} className="px-2 py-1 border border-slate-300 rounded text-[12px] bg-white"><option value="derecho">Derecho</option><option value="izquierdo">Izquierdo</option></select>
                </div>
              )}
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
                    <img
                      src={f.dataUrl || f.url}
                      alt=""
                      title={f.mediciones?.length ? f.mediciones.map((m) => `${m.etiqueta}: ${m.valor}`).join(' · ') : 'Sin mediciones'}
                      className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                    />
                    {f.mediciones && f.mediciones.length > 0 && (
                      <span className="absolute bottom-1 left-1 px-1 py-px rounded text-[9px] font-bold text-white" style={{ background: 'rgba(13,148,136,0.9)' }}>
                        {f.mediciones.length} med.
                      </span>
                    )}
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

        {/* Panel de resultado (escritorio: columna sticky) */}
        <div className="hidden lg:block lg:sticky lg:top-4 space-y-3">
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

      {/* Móvil: barra fija inferior con el puntaje en vivo + guardar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-white px-4 py-2.5 flex items-center gap-3"
        style={{ borderColor: COLORS.line, boxShadow: '0 -4px 16px rgba(13,27,42,0.08)', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="grid place-items-center min-w-[46px] h-[46px] rounded-xl text-[20px] font-extrabold px-1" style={{ background: tone?.bg ?? COLORS.bg, color: tone?.fg ?? COLORS.ink, fontFamily: FONTS.mono }}>
            {resultado?.puntajeFinal ?? '—'}
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{metodo}</div>
            <div className="text-[13px] font-bold truncate" style={{ color: tone?.fg ?? COLORS.ink }}>{resultado?.nivel ?? '—'}</div>
          </div>
        </div>
        <button onClick={guardar} disabled={guardando || !sel} className="inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-bold rounded-[9px] text-sm disabled:opacity-50 whitespace-nowrap" style={{ background: ACCENT }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
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
