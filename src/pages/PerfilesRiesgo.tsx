// PERFILES DE RIESGO POR CARGO
//
// Dos vistas: la cobertura (qué cargos tienen análisis de funciones y riesgos,
// cuáles faltan y cuántos trabajadores dependen de cada uno) y el detalle de un
// cargo, donde se puede ver y editar la matriz actividad × factor de riesgo que
// después autocompleta la Sección G de cada evaluación.
import { useState, useEffect, useCallback, Fragment, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Search, Save, RotateCcw, Plus, X, Pencil } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/dashboard/TopBar';
import { MATRIZ_RIESGOS } from '../utils/catalogosEvaluacion';
import { MAX_ACTIVIDADES, funcionesDeCargo, normalizarBusqueda } from '../constants/funcionesCargo';
import {
  getPerfilesGuardados, calcularCobertura, getPerfilRiesgo, guardarPerfilRiesgo,
  restaurarPerfilRiesgo, perfilBaseDeCargo,
} from '../services/perfilesRiesgo';
import type { CoberturaCargo, PerfilRiesgoCargo, PerfilRiesgoGuardado } from '../types/perfilRiesgo';

const BRAND = '#9a3036';
const TONO_ESTADO: Record<string, { label: string; bg: string; fg: string }> = {
  'con-analisis': { label: 'Con análisis', bg: '#e7f3ec', fg: '#1f7a4d' },
  personalizado: { label: 'Editado', bg: '#eaf0f9', fg: '#2a4d8f' },
  'sin-analisis': { label: 'Falta analizar', bg: '#f9e6e8', fg: '#a3142a' },
};

export default function PerfilesRiesgo() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();

  const [cobertura, setCobertura] = useState<CoberturaCargo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [cargoAbierto, setCargoAbierto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [trabSnap, guardados] = await Promise.all([
        getDocs(collection(db, 'trabajadores')),
        getPerfilesGuardados(),
      ]);
      const cargos = trabSnap.docs.map(d => String((d.data() as any).puestoTrabajo ?? ''));
      setCobertura(calcularCobertura(cargos, guardados));
    } catch (err) {
      console.error('Error al cargar la cobertura de perfiles:', err);
      toast.error('No se pudo cargar la cobertura de perfiles.');
    } finally {
      setCargando(false);
    }
    // toast es estable; incluirlo re-dispararía la carga en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    return cobertura.filter(c =>
      (!soloPendientes || c.estado === 'sin-analisis') &&
      (!q || normalizarBusqueda(c.cargo).includes(q) || normalizarBusqueda(c.departamento).includes(q)));
  }, [cobertura, busqueda, soloPendientes]);

  const resumen = useMemo(() => ({
    total: cobertura.length,
    conAnalisis: cobertura.filter(c => c.estado !== 'sin-analisis').length,
    pendientes: cobertura.filter(c => c.estado === 'sin-analisis').length,
    trabajadoresSinPerfil: cobertura.filter(c => c.estado === 'sin-analisis').reduce((s, c) => s + c.trabajadores, 0),
  }), [cobertura]);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden text-slate-900" style={{ background: '#f5f7fa', fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <TopBar userRol="Medicina Ocupacional" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1180px] mx-auto px-4 md:px-8 py-6">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-[12.5px] font-semibold mb-3 p-0" style={{ color: '#646b75' }}>
            <ArrowLeft size={15} /> Volver
          </button>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="grid place-items-center w-[34px] h-[34px] rounded-[10px]" style={{ background: `${BRAND}16`, color: BRAND }}><ShieldAlert size={19} /></span>
            <h1 className="m-0 text-[24px] font-bold tracking-tight">Perfiles de riesgo por cargo</h1>
          </div>
          <p className="text-[13px] text-slate-500 mt-0 mb-5">
            Análisis de funciones y factores de riesgo que autocompleta la Sección G de cada evaluación médica ocupacional.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Kpi valor={String(resumen.total)} etiqueta="Cargos" />
            <Kpi valor={String(resumen.conAnalisis)} etiqueta="Con análisis" color="#1f7a4d" />
            <Kpi valor={String(resumen.pendientes)} etiqueta="Faltan analizar" color={resumen.pendientes ? '#a3142a' : '#1f7a4d'} />
            <Kpi valor={String(resumen.trabajadoresSinPerfil)} etiqueta="Trabajadores sin perfil" color={resumen.trabajadoresSinPerfil ? '#a3142a' : '#1f7a4d'} />
          </div>

          <div className="bg-white border rounded-[13px] overflow-hidden" style={{ borderColor: '#e4e6ea' }}>
            <div className="flex items-center gap-2 p-[12px_18px] border-b flex-wrap" style={{ borderColor: '#e4e6ea' }}>
              <div className="flex items-center gap-2 p-[7px_11px] rounded-[9px] border flex-1 min-w-[220px]" style={{ borderColor: '#d8d2c9', background: '#f6f7f9' }}>
                <Search size={15} style={{ color: '#98a0ab' }} />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por cargo o departamento…" className="flex-1 border-none outline-none text-[13px] bg-transparent" />
              </div>
              <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-600">
                <input type="checkbox" checked={soloPendientes} onChange={e => setSoloPendientes(e.target.checked)} />
                Solo los que faltan
              </label>
            </div>

            {cargando ? (
              <div className="p-8 text-center text-[13px] text-slate-400">Cargando…</div>
            ) : filtradas.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-slate-400">Sin cargos que coincidan.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-[18px] py-2 font-bold text-slate-500">Cargo</th>
                      <th className="px-3 py-2 font-bold text-slate-500">Departamento</th>
                      <th className="px-3 py-2 font-bold text-slate-500 text-center">Trabajadores</th>
                      <th className="px-3 py-2 font-bold text-slate-500 text-center">Actividades</th>
                      <th className="px-3 py-2 font-bold text-slate-500 text-center">Factores</th>
                      <th className="px-3 py-2 font-bold text-slate-500">Estado</th>
                      <th className="px-[18px] py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((c, i) => {
                      const t = TONO_ESTADO[c.estado];
                      return (
                        <tr key={c.cargo} style={{ borderTop: i > 0 ? '1px solid #eef0f3' : 'none' }} className="hover:bg-slate-50">
                          <td className="px-[18px] py-2 font-semibold">
                            {c.cargo}
                            {c.fueraDeCatalogo && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-px rounded bg-amber-100 text-amber-700">fuera del catálogo</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{c.departamento}</td>
                          <td className="px-3 py-2 text-center">{c.trabajadores || '—'}</td>
                          <td className="px-3 py-2 text-center">{c.actividades || '—'}</td>
                          <td className="px-3 py-2 text-center">{c.factores || '—'}</td>
                          <td className="px-3 py-2">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.bg, color: t.fg }}>{t.label}</span>
                          </td>
                          <td className="px-[18px] py-2 text-right">
                            <button onClick={() => setCargoAbierto(c.cargo)} className="inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-lg font-semibold cursor-pointer border-none" style={{ background: '#eef0f3', color: '#3a4250' }}>
                              <Pencil size={12} /> {c.estado === 'sin-analisis' ? 'Crear' : 'Ver / editar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {cargoAbierto && (
        <EditorPerfil
          cargo={cargoAbierto}
          onCerrar={() => setCargoAbierto(null)}
          onGuardado={() => { setCargoAbierto(null); cargar(); }}
          toast={toast}
          confirm={confirm}
          usuarioId={user?.uid ?? ''}
        />
      )}
    </div>
  );
}

function Kpi({ valor, etiqueta, color }: { valor: string; etiqueta: string; color?: string }) {
  return (
    <div className="bg-white border rounded-xl p-[14px_16px]" style={{ borderColor: '#e4e6ea' }}>
      <div className="text-[22px] font-bold tracking-tight" style={{ color: color ?? '#20242b' }}>{valor}</div>
      <div className="text-[11px] font-semibold mt-1 uppercase text-slate-400" style={{ letterSpacing: '.4px' }}>{etiqueta}</div>
    </div>
  );
}

// ── Editor del perfil de un cargo ────────────────────────────────────────────
function EditorPerfil({ cargo, onCerrar, onGuardado, toast, confirm, usuarioId }: {
  cargo: string;
  onCerrar: () => void;
  onGuardado: () => void;
  toast: ReturnType<typeof useToast>;
  confirm: ReturnType<typeof useConfirm>;
  usuarioId: string;
}) {
  const [actividades, setActividades] = useState<string[]>([]);
  const [riesgos, setRiesgos] = useState<Record<string, number[]>>({});
  const [departamento, setDepartamento] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const hayBase = !!perfilBaseDeCargo(cargo);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCargando(true);
      const p = await getPerfilRiesgo(cargo);
      if (!vivo) return;
      if (p) {
        setActividades(p.actividades.slice(0, MAX_ACTIVIDADES));
        setRiesgos(p.riesgoActividades);
        setDepartamento(p.departamento);
      } else {
        // Cargo sin análisis: se parte de sus funciones del catálogo, si las hay.
        setActividades(funcionesDeCargo(cargo, MAX_ACTIVIDADES));
        setRiesgos({});
      }
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, [cargo]);

  const alternar = (factor: string, idx: number) => {
    setRiesgos(prev => {
      const actuales = prev[factor] ?? [];
      const nuevos = actuales.includes(idx) ? actuales.filter(i => i !== idx) : [...actuales, idx].sort((a, b) => a - b);
      const out = { ...prev };
      if (nuevos.length) out[factor] = nuevos; else delete out[factor];
      return out;
    });
  };

  const quitarActividad = (i: number) => {
    setActividades(arr => arr.filter((_, j) => j !== i));
    setRiesgos(prev => {
      const out: Record<string, number[]> = {};
      Object.entries(prev).forEach(([f, idxs]) => {
        const v = idxs.filter(k => k !== i).map(k => (k > i ? k - 1 : k));
        if (v.length) out[f] = v;
      });
      return out;
    });
  };

  const guardar = async () => {
    const limpias = actividades.map(a => a.trim()).filter(Boolean);
    if (limpias.length === 0) { toast.warning('Añade al menos una actividad de la jornada.'); return; }
    setGuardando(true);
    try {
      const perfil: PerfilRiesgoCargo = {
        cargo, departamento: departamento || '—',
        actividades: limpias,
        riesgoActividades: Object.fromEntries(
          Object.entries(riesgos).map(([f, idxs]) => [f, idxs.filter(i => i < limpias.length)]).filter(([, v]) => (v as number[]).length),
        ),
      };
      await guardarPerfilRiesgo(perfil, usuarioId);
      toast.success('Perfil de riesgo guardado.');
      onGuardado();
    } catch (err) {
      console.error(err);
      toast.error('No se pudo guardar el perfil.');
    } finally { setGuardando(false); }
  };

  const restaurar = async () => {
    if (!(await confirm({ message: `¿Descartar los ajustes de «${cargo}» y volver al análisis auditado?`, danger: true }))) return;
    try {
      await restaurarPerfilRiesgo(cargo);
      toast.success('Perfil restaurado al análisis auditado.');
      onGuardado();
    } catch { toast.error('No se pudo restaurar.'); }
  };

  const nCols = Math.max(1, actividades.length);
  const totalMarcados = Object.keys(riesgos).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col" style={{ maxHeight: '92vh' }}>
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-slate-800 m-0">{cargo}</h2>
            <p className="text-[12px] text-slate-500 m-0 mt-0.5">
              {departamento || 'Sin departamento'} · {actividades.length} actividades · {totalMarcados} factores marcados
            </p>
          </div>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-700 text-2xl leading-none bg-transparent border-none cursor-pointer">&times;</button>
        </div>

        {cargando ? (
          <div className="p-10 text-center text-[13px] text-slate-400">Cargando perfil…</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="rounded-lg border p-3" style={{ borderColor: '#e4e6ea', background: '#f9fafb' }}>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <label className="text-xs font-bold text-slate-700">Actividades importantes de la jornada ({actividades.length}/{MAX_ACTIVIDADES})</label>
                {actividades.length < MAX_ACTIVIDADES && (
                  <button type="button" onClick={() => setActividades(a => [...a, ''])} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-blue-600 bg-transparent border-none cursor-pointer">
                    <Plus size={12} /> Añadir actividad
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {actividades.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-6 h-6 grid place-items-center rounded bg-slate-200 text-[11px] font-bold text-slate-600 flex-shrink-0">{i + 1}</span>
                    <input type="text" value={a} onChange={e => setActividades(arr => arr.map((x, j) => j === i ? e.target.value : x))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs" placeholder={`Actividad ${i + 1}`} />
                    <button type="button" onClick={() => quitarActividad(i)} className="text-red-400 hover:text-red-600 px-1 bg-transparent border-none cursor-pointer"><X size={14} /></button>
                  </div>
                ))}
                {actividades.length === 0 && <p className="m-0 text-[11.5px] text-slate-400 italic">Sin actividades: añade al menos una para poder marcar riesgos.</p>}
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-slate-100" style={{ minWidth: 220 }}>FACTOR DE RIESGO</th>
                    {Array.from({ length: nCols }, (_, i) => (
                      <th key={i} className="px-1 py-1.5 font-bold text-slate-600 text-center" style={{ width: 34 }} title={actividades[i] || `Actividad ${i + 1}`}>{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MATRIZ_RIESGOS.map(cat => (
                    <Fragment key={cat.clave}>
                      <tr><td colSpan={nCols + 1} className={`${cat.color} text-white font-bold px-2 py-1 text-[11px]`}>{cat.categoria}</td></tr>
                      {cat.subgrupos.map(g => (
                        <Fragment key={(g.subcategoria ?? '') + cat.clave}>
                          {g.subcategoria && <tr><td colSpan={nCols + 1} className="bg-slate-50 px-2 py-0.5 text-[10.5px] font-bold text-slate-500">{g.subcategoria}</td></tr>}
                          {g.items.map(item => {
                            const sel = riesgos[item] ?? [];
                            return (
                              <tr key={item} className={sel.length ? 'bg-blue-50/60' : 'hover:bg-slate-50'}>
                                <td className={`px-2 py-1 border-t border-slate-100 sticky left-0 ${sel.length ? 'bg-blue-50/60 font-semibold text-blue-900' : 'bg-white'}`}>{item}</td>
                                {Array.from({ length: nCols }, (_, i) => (
                                  <td key={i} className="text-center border-t border-l border-slate-100 py-1">
                                    <input type="checkbox" checked={sel.includes(i)} onChange={() => alternar(item, i)}
                                      title={actividades[i] ? `${item} — ${actividades[i]}` : `Actividad ${i + 1}`} />
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center gap-3 p-4 border-t shrink-0 flex-wrap">
          <span className="text-[11.5px] text-slate-400">
            {hayBase ? 'Los cambios se guardan sobre el análisis auditado y se pueden revertir.' : 'Este cargo aún no tenía análisis: lo estás creando.'}
          </span>
          <div className="flex gap-2">
            {hayBase && (
              <button onClick={restaurar} className="inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold bg-white border border-slate-300 text-slate-600 rounded-lg cursor-pointer">
                <RotateCcw size={13} /> Restaurar auditado
              </button>
            )}
            <button onClick={onCerrar} className="px-4 py-2 text-[12.5px] font-medium bg-slate-100 text-slate-700 rounded-lg border-none cursor-pointer">Cancelar</button>
            <button onClick={guardar} disabled={guardando || cargando} className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-bold text-white rounded-lg border-none cursor-pointer disabled:opacity-50" style={{ background: BRAND }}>
              <Save size={13} /> {guardando ? 'Guardando…' : 'Guardar perfil'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { PerfilRiesgoGuardado };
