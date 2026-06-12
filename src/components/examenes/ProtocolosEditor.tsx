// Editor de protocolos por puesto (batería editable).
// Tres modos: editar la batería de un puesto, agregar exámenes a TODOS los
// puestos de una vez, y gestionar el catálogo (agregar / quitar / fusionar).
import { useState, useMemo, useEffect } from 'react';
import { Layers, Check, Save, Users, Plus, Trash2, GitMerge, ListChecks, Wrench } from 'lucide-react';
import type { TipoExamen } from '../../types';
import {
  guardarProtocolo, getCatalogoExamenes, guardarCatalogoExamenes,
  agregarExamenesATodos, fusionarExamen, eliminarExamenDeTodos, inferirTipoExamen,
} from '../../services/protocolos';
import { useToast } from '../Toast';

const ACCENT = '#0e7490';

type Modo = 'puesto' | 'todos' | 'catalogo';

interface Props {
  protocolos: Record<string, { nombre: string; tipo: TipoExamen }[]>;
  puestos: { nombre: string; nTrabajadores: number }[];
  onSaved: () => void;
}

export default function ProtocolosEditor({ protocolos, puestos, onSaved }: Props) {
  const toast = useToast();
  const lista = useMemo(() => {
    // puestos reales + cualquiera con protocolo definido
    const set = new Map<string, number>();
    puestos.forEach((p) => set.set(p.nombre, p.nTrabajadores));
    Object.keys(protocolos).forEach((p) => { if (!set.has(p)) set.set(p, 0); });
    return [...set.entries()].map(([nombre, n]) => ({ nombre, nTrabajadores: n })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [protocolos, puestos]);

  const [modo, setModo] = useState<Modo>('puesto');
  const [catalogo, setCatalogo] = useState<string[]>([]);
  const [cargandoCat, setCargandoCat] = useState(true);

  const [sel, setSel] = useState<string>(lista[0]?.nombre ?? '');
  const [draft, setDraft] = useState<Set<string>>(() => new Set((protocolos[lista[0]?.nombre] ?? []).map((e) => e.nombre)));
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  // Modo «agregar a todos»
  const [selTodos, setSelTodos] = useState<Set<string>>(new Set());
  const [aplicando, setAplicando] = useState(false);

  // Modo «catálogo»
  const [nuevoExamen, setNuevoExamen] = useState('');
  const [fusionDe, setFusionDe] = useState<string | null>(null);
  const [fusionA, setFusionA] = useState('');
  const [trabajandoCat, setTrabajandoCat] = useState(false);

  const cargarCatalogo = async () => {
    setCargandoCat(true);
    try { setCatalogo(await getCatalogoExamenes()); }
    catch (err) { console.error(err); }
    finally { setCargandoCat(false); }
  };
  useEffect(() => { cargarCatalogo(); }, []);

  const elegir = (puesto: string) => {
    setSel(puesto);
    setDraft(new Set((protocolos[puesto] ?? []).map((e) => e.nombre)));
    setGuardado(false);
  };
  const toggle = (nombre: string) => { setDraft((s) => { const n = new Set(s); n.has(nombre) ? n.delete(nombre) : n.add(nombre); return n; }); setGuardado(false); };

  const guardar = async () => {
    setGuardando(true);
    const examenes = [...draft].map((nombre) => ({ nombre, tipo: inferirTipoExamen(nombre) }));
    try { await guardarProtocolo(sel, examenes); setGuardado(true); onSaved(); }
    catch (err) { console.error(err); toast.error('No se pudo guardar el protocolo.'); }
    finally { setGuardando(false); }
  };

  // El protocolo puede contener exámenes que ya no están en el catálogo:
  // se muestran igualmente para poder quitarlos del puesto.
  const catalogoConExtras = useMemo(() => {
    const extras = [...draft].filter((n) => !catalogo.includes(n));
    return [...catalogo, ...extras.sort((a, b) => a.localeCompare(b))];
  }, [catalogo, draft]);

  const aplicarATodos = async () => {
    if (selTodos.size === 0) return;
    setAplicando(true);
    try {
      await agregarExamenesATodos(lista.map((p) => p.nombre), [...selTodos], protocolos);
      toast.success(`${selTodos.size} examen(es) agregados a los ${lista.length} puestos.`);
      setSelTodos(new Set());
      onSaved();
    } catch (err) { console.error(err); toast.error('No se pudo aplicar a todos los puestos.'); }
    finally { setAplicando(false); }
  };

  const agregarAlCatalogo = async () => {
    const nombre = nuevoExamen.trim();
    if (!nombre) return;
    if (catalogo.some((c) => c.toLowerCase() === nombre.toLowerCase())) {
      toast.error('Ese examen ya existe en el catálogo.');
      return;
    }
    setTrabajandoCat(true);
    try {
      const nuevo = [...catalogo, nombre].sort((a, b) => a.localeCompare(b));
      await guardarCatalogoExamenes(nuevo);
      setCatalogo(nuevo);
      setNuevoExamen('');
      toast.success(`«${nombre}» agregado al catálogo.`);
    } catch (err) { console.error(err); toast.error('No se pudo guardar el catálogo.'); }
    finally { setTrabajandoCat(false); }
  };

  const quitarDelCatalogo = async (nombre: string) => {
    const afectados = Object.values(protocolos).filter((ex) => ex.some((e) => e.nombre === nombre)).length;
    const msg = afectados > 0
      ? `«${nombre}» se quitará del catálogo y de los ${afectados} protocolos donde aparece. ¿Continuar?`
      : `¿Quitar «${nombre}» del catálogo?`;
    if (!window.confirm(msg)) return;
    setTrabajandoCat(true);
    try {
      await eliminarExamenDeTodos(nombre, protocolos);
      setCatalogo((c) => c.filter((n) => n !== nombre));
      toast.success(`«${nombre}» eliminado.`);
      onSaved();
    } catch (err) { console.error(err); toast.error('No se pudo eliminar el examen.'); }
    finally { setTrabajandoCat(false); }
  };

  const confirmarFusion = async () => {
    if (!fusionDe || !fusionA || fusionDe === fusionA) return;
    if (!window.confirm(`En todos los protocolos, «${fusionDe}» se reemplazará por «${fusionA}» y se quitará del catálogo. ¿Continuar?`)) return;
    setTrabajandoCat(true);
    try {
      await fusionarExamen(fusionDe, fusionA, protocolos);
      toast.success(`«${fusionDe}» fusionado en «${fusionA}».`);
      setFusionDe(null); setFusionA('');
      await cargarCatalogo();
      onSaved();
    } catch (err) { console.error(err); toast.error('No se pudo fusionar.'); }
    finally { setTrabajandoCat(false); }
  };

  const MODOS: { key: Modo; label: string; icon: React.ReactNode }[] = [
    { key: 'puesto', label: 'Editar por puesto', icon: <Layers size={14} /> },
    { key: 'todos', label: 'Agregar a todos', icon: <ListChecks size={14} /> },
    { key: 'catalogo', label: 'Gestionar catálogo', icon: <Wrench size={14} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex items-end gap-3 flex-wrap">
        <div>
          <h2 className="m-0 text-[18px] font-extrabold tracking-tight">Protocolos por puesto</h2>
          <p className="mt-0.5 mb-0 text-[13px] text-slate-500 max-w-[640px]">
            La batería de exámenes que exige cada puesto según sus riesgos. Al programar una evaluación, estos exámenes se sugieren automáticamente.
          </p>
        </div>
        <div className="ml-auto flex gap-[3px] p-[3px] rounded-[9px] bg-slate-200">
          {MODOS.map((m) => (
            <button key={m.key} onClick={() => setModo(m.key)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[7px] border-none cursor-pointer text-[12.5px] font-semibold"
              style={{ background: modo === m.key ? '#fff' : 'transparent', color: modo === m.key ? ACCENT : '#5a6a7a', boxShadow: modo === m.key ? '0 1px 2px rgba(28,29,34,0.1)' : 'none' }}>
              {m.icon}{m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════ Modo 1: editar batería de un puesto ══════ */}
      {modo === 'puesto' && (
        <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '300px 1fr' }}>
          {/* Lista de puestos */}
          <div className="bg-white border border-slate-200 rounded-[14px] overflow-hidden shadow-sm max-h-[560px] overflow-y-auto">
            {lista.map((p) => {
              const active = p.nombre === sel;
              const n = (protocolos[p.nombre] ?? []).length;
              return (
                <button key={p.nombre} onClick={() => elegir(p.nombre)} className="flex items-center gap-2 w-full text-left p-[10px_16px] cursor-pointer border-none border-b border-slate-100"
                  style={{ background: active ? '#e0f2fa' : 'transparent', borderLeft: `3px solid ${active ? ACCENT : 'transparent'}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-slate-900 truncate" style={{ fontWeight: active ? 700 : 600 }}>{p.nombre || '(sin puesto)'}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1"><Users size={11} /> {p.nTrabajadores}</div>
                  </div>
                  <span className="text-[11px] font-bold rounded-full px-2 py-px border" style={{ color: ACCENT, background: '#fff', borderColor: '#cfeaf3' }}>{n}</span>
                </button>
              );
            })}
            {lista.length === 0 && <div className="p-6 text-center text-slate-400 text-[13px]">No hay puestos aún.</div>}
          </div>

          {/* Editor de batería */}
          <div className="bg-white border border-slate-200 rounded-[16px] shadow-sm">
            <div className="p-[18px_22px] border-b border-slate-100 flex items-center gap-3">
              <div className="flex-1">
                <h3 className="m-0 text-[17px] font-extrabold tracking-tight">{sel || '—'}</h3>
                <div className="text-[12.5px] text-slate-500 mt-0.5"><strong style={{ color: ACCENT }}>{draft.size} exámenes</strong> en la batería</div>
              </div>
              <button onClick={guardar} disabled={guardando || !sel} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white border-none rounded-[9px] text-[13px] font-bold"
                style={{ background: guardado ? '#10a05a' : ACCENT, opacity: guardando ? 0.6 : 1, cursor: sel ? 'pointer' : 'not-allowed' }}>
                {guardado ? <><Check size={15} /> Guardado</> : <><Save size={15} /> {guardando ? 'Guardando…' : 'Guardar protocolo'}</>}
              </button>
            </div>
            <div className="p-[18px_22px]">
              <div className="flex items-center gap-2 mb-3 text-[11.5px] font-bold tracking-wide uppercase text-slate-400">
                <Layers size={14} style={{ color: ACCENT }} /> Catálogo — activa los que aplican
              </div>
              {cargandoCat ? <div className="p-6 text-center text-slate-400 text-[13px]">Cargando catálogo…</div> : (
                <div className="grid grid-cols-2 gap-2.5">
                  {catalogoConExtras.map((nombre) => {
                    const on = draft.has(nombre);
                    return <ExamenTile key={nombre} nombre={nombre} on={on} onClick={() => toggle(nombre)} />;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════ Modo 2: agregar exámenes a todos los puestos ══════ */}
      {modo === 'todos' && (
        <div className="bg-white border border-slate-200 rounded-[16px] shadow-sm">
          <div className="p-[18px_22px] border-b border-slate-100 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <h3 className="m-0 text-[17px] font-extrabold tracking-tight">Agregar exámenes a todos los puestos</h3>
              <div className="text-[12.5px] text-slate-500 mt-0.5">
                Selecciona uno o varios exámenes y se añadirán a los <strong style={{ color: ACCENT }}>{lista.length} perfiles</strong> de una sola vez (sin duplicar los que ya existan).
              </div>
            </div>
            <button onClick={aplicarATodos} disabled={aplicando || selTodos.size === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white border-none rounded-[9px] text-[13px] font-bold"
              style={{ background: ACCENT, opacity: aplicando || selTodos.size === 0 ? 0.5 : 1, cursor: selTodos.size > 0 ? 'pointer' : 'not-allowed' }}>
              <Plus size={15} /> {aplicando ? 'Aplicando…' : `Agregar ${selTodos.size || ''} a todos los puestos`}
            </button>
          </div>
          <div className="p-[18px_22px]">
            {cargandoCat ? <div className="p-6 text-center text-slate-400 text-[13px]">Cargando catálogo…</div> : (
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                {catalogo.map((nombre) => {
                  const on = selTodos.has(nombre);
                  const enTodos = lista.length > 0 && lista.every((p) => (protocolos[p.nombre] ?? []).some((e) => e.nombre === nombre));
                  return (
                    <ExamenTile key={nombre} nombre={nombre} on={on}
                      nota={enTodos ? 'ya está en todos' : undefined}
                      onClick={() => setSelTodos((s) => { const n = new Set(s); n.has(nombre) ? n.delete(nombre) : n.add(nombre); return n; })} />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════ Modo 3: gestionar catálogo (agregar / quitar / fusionar) ══════ */}
      {modo === 'catalogo' && (
        <div className="bg-white border border-slate-200 rounded-[16px] shadow-sm">
          <div className="p-[18px_22px] border-b border-slate-100">
            <h3 className="m-0 text-[17px] font-extrabold tracking-tight">Catálogo de exámenes</h3>
            <div className="text-[12.5px] text-slate-500 mt-0.5">
              Define qué exámenes aparecen en la lista de selección. Quitar o fusionar un examen también lo actualiza en todos los protocolos.
            </div>
            <div className="flex gap-2 mt-3.5 max-w-[480px]">
              <input value={nuevoExamen} onChange={(e) => setNuevoExamen(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') agregarAlCatalogo(); }}
                placeholder="Nuevo examen, ej: Perfil renal…"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-[9px] text-[13px] outline-none focus:border-cyan-600" />
              <button onClick={agregarAlCatalogo} disabled={trabajandoCat || !nuevoExamen.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-white border-none rounded-[9px] text-[13px] font-bold"
                style={{ background: ACCENT, opacity: !nuevoExamen.trim() || trabajandoCat ? 0.5 : 1, cursor: nuevoExamen.trim() ? 'pointer' : 'not-allowed' }}>
                <Plus size={14} /> Agregar
              </button>
            </div>
          </div>
          <div>
            {cargandoCat ? <div className="p-6 text-center text-slate-400 text-[13px]">Cargando catálogo…</div> : catalogo.map((nombre) => {
              const usos = Object.values(protocolos).filter((ex) => ex.some((e) => e.nombre === nombre)).length;
              const fusionando = fusionDe === nombre;
              return (
                <div key={nombre} className="border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3 p-[10px_22px]">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold text-slate-900">{nombre}</div>
                      <div className="text-[11px] text-slate-400">{inferirTipoExamen(nombre)} · en {usos} protocolo{usos === 1 ? '' : 's'}</div>
                    </div>
                    <button onClick={() => { setFusionDe(fusionando ? null : nombre); setFusionA(''); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer border"
                      style={{ borderColor: fusionando ? ACCENT : '#dde4ec', color: fusionando ? '#fff' : ACCENT, background: fusionando ? ACCENT : '#fff' }}>
                      <GitMerge size={13} /> Fusionar
                    </button>
                    <button onClick={() => quitarDelCatalogo(nombre)} disabled={trabajandoCat}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer border border-red-200 text-red-700 bg-white hover:bg-red-50">
                      <Trash2 size={13} /> Quitar
                    </button>
                  </div>
                  {fusionando && (
                    <div className="flex items-center gap-2 px-[22px] pb-3 flex-wrap">
                      <span className="text-[12.5px] text-slate-500">Fusionar «{nombre}» con:</span>
                      <select value={fusionA} onChange={(e) => setFusionA(e.target.value)}
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-[12.5px] bg-white outline-none cursor-pointer min-w-[220px]">
                        <option value="">— Elegir examen destino —</option>
                        {catalogo.filter((c) => c !== nombre).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button onClick={confirmarFusion} disabled={!fusionA || trabajandoCat}
                        className="px-3 py-1.5 text-white border-none rounded-lg text-[12.5px] font-bold"
                        style={{ background: ACCENT, opacity: !fusionA || trabajandoCat ? 0.5 : 1, cursor: fusionA ? 'pointer' : 'not-allowed' }}>
                        {trabajandoCat ? 'Fusionando…' : 'Aplicar fusión'}
                      </button>
                      <button onClick={() => { setFusionDe(null); setFusionA(''); }}
                        className="px-3 py-1.5 bg-transparent border border-slate-300 rounded-lg text-[12.5px] font-semibold cursor-pointer text-slate-600">
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────────────
function ExamenTile({ nombre, on, nota, onClick }: { nombre: string; on: boolean; nota?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 p-[11px_13px] rounded-[11px] cursor-pointer text-left border"
      style={{ borderColor: on ? ACCENT : '#e3e8ee', background: on ? '#f0fafd' : '#fff' }}>
      <span className="grid place-items-center w-[22px] h-[22px] rounded-md flex-shrink-0 border"
        style={{ background: on ? ACCENT : '#fff', borderColor: on ? ACCENT : '#cdd6df' }}>
        {on && <Check size={14} className="text-white" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-900">{nombre}</div>
        <div className="text-[10.5px] text-slate-400">{inferirTipoExamen(nombre)}{nota ? ` · ${nota}` : ''}</div>
      </div>
    </button>
  );
}
