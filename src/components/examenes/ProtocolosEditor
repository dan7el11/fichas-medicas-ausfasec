// Editor de protocolos por puesto (batería editable). Archivo NUEVO.
import { useState, useMemo } from 'react';
import { Layers, Check, Save, Users } from 'lucide-react';
import type { TipoExamen } from '../../types';
import { NOMBRES_EXAMEN_COMUNES } from '../../types';
import { guardarProtocolo } from '../../services/protocolos';

const ACCENT = '#0e7490';

function inferirTipo(nombre: string): TipoExamen {
  const n = nombre.toLowerCase();
  if (n.includes('rx') || n.includes('ecograf')) return 'Imagen';
  if (n.includes('audiomet')) return 'Audiometría';
  if (n.includes('espiromet')) return 'Espirometría';
  if (n.includes('electrocardio')) return 'Electrocardiograma';
  if (n.includes('optomet') || n.includes('visual')) return 'Optometría';
  if (n.includes('psicol')) return 'Psicología';
  if (n.includes('oftalm')) return 'Oftalmología';
  return 'Laboratorio';
}

interface Props {
  protocolos: Record<string, { nombre: string; tipo: TipoExamen }[]>;
  puestos: { nombre: string; nTrabajadores: number }[];
  onSaved: () => void;
}

export default function ProtocolosEditor({ protocolos, puestos, onSaved }: Props) {
  const lista = useMemo(() => {
    // puestos reales + cualquiera con protocolo definido
    const set = new Map<string, number>();
    puestos.forEach((p) => set.set(p.nombre, p.nTrabajadores));
    Object.keys(protocolos).forEach((p) => { if (!set.has(p)) set.set(p, 0); });
    return [...set.entries()].map(([nombre, n]) => ({ nombre, nTrabajadores: n })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [protocolos, puestos]);

  const [sel, setSel] = useState<string>(lista[0]?.nombre ?? '');
  const [draft, setDraft] = useState<Set<string>>(() => new Set((protocolos[lista[0]?.nombre] ?? []).map((e) => e.nombre)));
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const elegir = (puesto: string) => {
    setSel(puesto);
    setDraft(new Set((protocolos[puesto] ?? []).map((e) => e.nombre)));
    setGuardado(false);
  };
  const toggle = (nombre: string) => { setDraft((s) => { const n = new Set(s); n.has(nombre) ? n.delete(nombre) : n.add(nombre); return n; }); setGuardado(false); };

  const guardar = async () => {
    setGuardando(true);
    const examenes = [...draft].map((nombre) => ({ nombre, tipo: inferirTipo(nombre) }));
    try { await guardarProtocolo(sel, examenes); setGuardado(true); onSaved(); }
    catch (err) { console.error(err); alert('No se pudo guardar el protocolo.'); }
    finally { setGuardando(false); }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="m-0 text-[18px] font-extrabold tracking-tight">Protocolos por puesto</h2>
        <p className="mt-0.5 mb-0 text-[13px] text-slate-500 max-w-[640px]">
          La batería de exámenes que exige cada puesto según sus riesgos. Al programar una evaluación, estos exámenes se sugieren automáticamente.
        </p>
      </div>

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
            <div className="grid grid-cols-2 gap-2.5">
              {NOMBRES_EXAMEN_COMUNES.map((nombre) => {
                const on = draft.has(nombre);
                return (
                  <button key={nombre} onClick={() => toggle(nombre)} className="flex items-center gap-2.5 p-[11px_13px] rounded-[11px] cursor-pointer text-left border"
                    style={{ borderColor: on ? ACCENT : '#e3e8ee', background: on ? '#f0fafd' : '#fff' }}>
                    <span className="grid place-items-center w-[22px] h-[22px] rounded-md flex-shrink-0 border"
                      style={{ background: on ? ACCENT : '#fff', borderColor: on ? ACCENT : '#cdd6df' }}>
                      {on && <Check size={14} className="text-white" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-900">{nombre}</div>
                      <div className="text-[10.5px] text-slate-400">{inferirTipo(nombre)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
