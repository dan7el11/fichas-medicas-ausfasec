// Modales: Programar exámenes (sugiere por protocolo) + Gestionar orden (marcar realizados).
// Archivo NUEVO.
import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { CalendarPlus, X, Search, Check, Layers, FileText, Upload, Trash2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { Trabajador } from '../../types';
import type { TipoExamen } from '../../types';
import { NOMBRES_EXAMEN_COMUNES, TIPOS_EXAMEN } from '../../types';
import type { OrdenExamen, ExamenItem, TipoEvaluacionExamen } from '../../types/examenPlan';
import { TIPOS_EVALUACION_EXAMEN } from '../../types/examenPlan';
import { crearOrden, actualizarOrden, eliminarOrden, estadoOrden, fmtFecha, progresoOrden } from '../../services/examenesPlan';
import { protocoloDePuesto } from '../../services/protocolos';
import { EstadoChip } from './OrdenCard';

const ACCENT = '#0e7490';

// ════════════════════════════════════════════════════════════════════════════
// PROGRAMAR
// ════════════════════════════════════════════════════════════════════════════
export function ProgramarExamenModal({ trabajadores, protocolos, medicoId, medicoNombre, onClose, onSaved }: {
  trabajadores: Trabajador[];
  protocolos: Record<string, { nombre: string; tipo: TipoExamen }[]>;
  medicoId: string; medicoNombre: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [worker, setWorker] = useState<Trabajador | null>(null);
  const [qW, setQW] = useState('');
  const [tipoEval, setTipoEval] = useState<TipoEvaluacionExamen>('Periódico');
  const [fecha, setFecha] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); });
  const [seleccion, setSeleccion] = useState<Map<string, TipoExamen>>(new Map());
  const [guardando, setGuardando] = useState(false);

  const matches = qW
    ? trabajadores.filter((w) => `${w.primerApellido} ${w.segundoApellido} ${w.primerNombre} ${w.cedula}`.toLowerCase().includes(qW.toLowerCase())).slice(0, 6)
    : [];

  // Al elegir trabajador, precargar la batería del protocolo de su puesto
  useEffect(() => {
    if (!worker) return;
    const proto = protocoloDePuesto(protocolos, worker.puestoTrabajo);
    setSeleccion(new Map(proto.map((e) => [e.nombre, e.tipo])));
  }, [worker]);

  const proto = worker ? protocoloDePuesto(protocolos, worker.puestoTrabajo) : [];
  const sugeridos = new Set(proto.map((e) => e.nombre));

  const toggle = (nombre: string, tipo: TipoExamen) => {
    setSeleccion((m) => { const n = new Map(m); n.has(nombre) ? n.delete(nombre) : n.set(nombre, tipo); return n; });
  };

  const canSave = !!worker && seleccion.size > 0 && !guardando;
  const guardar = async () => {
    if (!worker || !canSave) return;
    setGuardando(true);
    const examenes: ExamenItem[] = [...seleccion.entries()].map(([nombre, tipo]) => ({ nombre, tipo, realizado: false }));
    const data: Omit<OrdenExamen, 'id' | 'createdAt'> = {
      trabajadorId: worker.id ?? '',
      apellidos: `${worker.primerApellido ?? ''} ${worker.segundoApellido ?? ''}`.trim(),
      nombres: `${worker.primerNombre ?? ''} ${worker.segundoNombre ?? ''}`.trim(),
      cedula: worker.cedula ?? '',
      puesto: worker.puestoTrabajo ?? '',
      departamento: worker.departamento ?? '',
      tipoEvaluacion: tipoEval,
      fechaProgramada: Timestamp.fromDate(new Date(fecha + 'T08:00:00')),
      examenes,
      medicoId, medicoNombre,
    };
    try { await crearOrden(data); onSaved(); }
    catch (err) { console.error(err); alert('No se pudo guardar la orden.'); setGuardando(false); }
  };

  // catálogo a mostrar: nombres comunes + cualquiera del protocolo
  const catalogo: { nombre: string; tipo: TipoExamen }[] = [...NOMBRES_EXAMEN_COMUNES].map((n) => {
    const fromProto = proto.find((p) => p.nombre === n);
    return { nombre: n, tipo: fromProto?.tipo ?? inferirTipo(n) };
  });

  return (
    <Backdrop onClose={onClose}>
      <div className="w-[620px] max-w-full max-h-[92vh] overflow-y-auto bg-white rounded-[18px] shadow-2xl">
        <Header icon={<CalendarPlus size={19} />} title="Programar exámenes" sub="Se sugieren según el protocolo del puesto" onClose={onClose} />
        <div className="p-[20px_22px]">
          {/* Trabajador */}
          <Label>Trabajador</Label>
          {worker ? (
            <div className="flex items-center gap-2.5 p-[9px_12px] rounded-[9px] mb-4" style={{ border: `1.5px solid ${ACCENT}`, background: '#f0fafd' }}>
              <div className="flex-1">
                <div className="text-[13.5px] font-bold">{worker.primerApellido} {worker.segundoApellido} {worker.primerNombre}</div>
                <div className="text-[11.5px] text-slate-500">{worker.puestoTrabajo} · CI {worker.cedula}</div>
              </div>
              <button onClick={() => setWorker(null)} className="bg-transparent border-none cursor-pointer text-slate-400"><X size={16} /></button>
            </div>
          ) : (
            <div className="relative mb-4">
              <div className="flex items-center gap-2 p-[10px_12px] rounded-[9px] border border-slate-300">
                <Search size={16} className="text-slate-400" />
                <input value={qW} onChange={(e) => setQW(e.target.value)} placeholder="Buscar por nombre o cédula…" className="flex-1 border-none outline-none text-[13px] bg-transparent" />
              </div>
              {matches.length > 0 && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-slate-200 rounded-[10px] shadow-xl z-20 overflow-hidden">
                  {matches.map((w) => (
                    <button key={w.id} onClick={() => { setWorker(w); setQW(''); }} className="flex flex-col items-start w-full text-left p-[9px_12px] border-none border-b border-slate-100 bg-white cursor-pointer hover:bg-cyan-50/50">
                      <span className="text-[13px] font-semibold">{w.primerApellido} {w.segundoApellido} {w.primerNombre}</span>
                      <span className="text-[11px] text-slate-400">{w.puestoTrabajo} · CI {w.cedula}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tipo eval + fecha */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <Label>Tipo de evaluación</Label>
              <select value={tipoEval} onChange={(e) => setTipoEval(e.target.value as TipoEvaluacionExamen)} className={inpCls}>
                {TIPOS_EVALUACION_EXAMEN.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Fecha programada</Label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inpCls} />
            </div>
          </div>

          {/* Nota protocolo */}
          {worker && (
            <div className="flex items-center gap-2 p-[10px_13px] rounded-[10px] mb-3.5" style={{ background: '#f0fafd', border: '1px solid #cfeaf3' }}>
              <Layers size={16} style={{ color: ACCENT }} />
              <span className="text-[12.5px]" style={{ color: ACCENT }}>
                Protocolo de <strong>{worker.puestoTrabajo}</strong>: {proto.length} exámenes sugeridos. Ajusta lo que necesites.
              </span>
            </div>
          )}

          {/* Catálogo seleccionable */}
          <Label>Exámenes a programar</Label>
          <div className="grid grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
            {catalogo.map((ex) => {
              const on = seleccion.has(ex.nombre);
              const sug = sugeridos.has(ex.nombre);
              return (
                <button key={ex.nombre} onClick={() => toggle(ex.nombre, ex.tipo)} className="flex items-center gap-2.5 p-[10px_12px] rounded-[10px] cursor-pointer text-left border"
                  style={{ borderColor: on ? ACCENT : '#e3e8ee', background: on ? '#f0fafd' : '#fff' }}>
                  <span className="grid place-items-center w-5 h-5 rounded-md flex-shrink-0 border"
                    style={{ background: on ? ACCENT : '#fff', borderColor: on ? ACCENT : '#cdd6df' }}>
                    {on && <Check size={13} className="text-white" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-slate-900 truncate">{ex.nombre}</div>
                    <div className="text-[10.5px] text-slate-400">{sug ? 'Sugerido · ' : ''}{ex.tipo}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <Footer onClose={onClose}>
          <span className="text-[12.5px] text-slate-500 mr-auto"><strong style={{ color: ACCENT }}>{seleccion.size}</strong> seleccionados</span>
          <button onClick={guardar} disabled={!canSave} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white border-none rounded-[9px] text-[13px] font-bold"
            style={{ background: ACCENT, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}>
            <Check size={15} /> {guardando ? 'Guardando…' : `Programar ${seleccion.size}`}
          </button>
        </Footer>
      </div>
    </Backdrop>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// GESTIONAR ORDEN (marcar realizados)
// ════════════════════════════════════════════════════════════════════════════
export function OrdenDetalleModal({ orden, onClose, onSaved, onDeleted }: {
  orden: OrdenExamen; onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const [examenes, setExamenes] = useState<ExamenItem[]>(orden.examenes);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const st = estadoOrden({ ...orden, examenes });
  const pr = progresoOrden({ ...orden, examenes });

  const toggle = (i: number) => setExamenes((l) => l.map((e, idx) => idx === i
    ? { ...e, realizado: !e.realizado, fechaRealizado: !e.realizado ? Timestamp.now() : undefined }
    : e));

  const guardar = async () => {
    if (!orden.id) return;
    setGuardando(true);
    try { await actualizarOrden(orden.id, { examenes }); onSaved(); }
    catch (err) { console.error(err); alert('No se pudo actualizar.'); setGuardando(false); }
  };

  const eliminar = async () => {
    if (!orden.id || !window.confirm('¿Eliminar este examen programado? Esta acción no se puede deshacer.')) return;
    setEliminando(true);
    try { await eliminarOrden(orden.id); onDeleted ? onDeleted() : onSaved(); }
    catch (err) { console.error(err); alert('No se pudo eliminar.'); setEliminando(false); }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="w-[560px] max-w-full max-h-[92vh] overflow-y-auto bg-white rounded-[18px] shadow-2xl">
        <div className="flex items-center gap-[13px] p-[18px_22px] border-b border-slate-100" style={{ background: 'linear-gradient(135deg,#e0f2fa 0%,#fff 80%)' }}>
          <div className="w-11 h-11 rounded-full grid place-items-center font-bold text-[15px]" style={{ background: '#e0f2fa', color: ACCENT }}>
            {(orden.apellidos?.[0] ?? '') + (orden.nombres?.[0] ?? '')}
          </div>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold tracking-tight">{orden.apellidos} {orden.nombres}</div>
            <div className="text-[12.5px] text-slate-500">{orden.puesto}</div>
          </div>
          <button onClick={eliminar} disabled={eliminando} title="Eliminar orden" className="bg-transparent border-none cursor-pointer text-red-400 hover:text-red-600 p-1 disabled:opacity-50">
            <Trash2 size={17} />
          </button>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-slate-400 p-1"><X size={20} /></button>
        </div>

        <div className="p-[18px_22px]">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="text-[12px] font-bold rounded-full px-2.5 py-[3px]" style={{ color: ACCENT, background: '#e0f2fa' }}>{orden.tipoEvaluacion}</span>
            <EstadoChip info={st} small />
            <span className="ml-auto text-[12.5px] text-slate-500">{fmtFecha(orden.fechaProgramada)}</span>
          </div>

          <div className="flex flex-col gap-2">
            {examenes.map((e, i) => (
              <button key={i} onClick={() => toggle(i)} className="flex items-center gap-3 p-[11px_13px] rounded-[11px] border text-left cursor-pointer"
                style={{ borderColor: e.realizado ? '#c3ead2' : '#eef1f5', background: e.realizado ? '#f3fbf6' : '#fff' }}>
                <span className="grid place-items-center w-6 h-6 rounded-md flex-shrink-0 border"
                  style={{ background: e.realizado ? '#10a05a' : '#fff', borderColor: e.realizado ? '#10a05a' : '#cdd6df' }}>
                  {e.realizado && <Check size={14} className="text-white" />}
                </span>
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold text-slate-900">{e.nombre}</div>
                  <div className="text-[11.5px] text-slate-400">{e.realizado ? `Realizado · ${fmtFecha(e.fechaRealizado)}` : `Pendiente · ${e.tipo}`}</div>
                </div>
                {e.realizado
                  ? <FileText size={15} className="text-slate-400" />
                  : <Upload size={15} className="text-slate-300" />}
              </button>
            ))}
          </div>
        </div>

        <Footer onClose={onClose}>
          <span className="text-[12.5px] text-slate-500 mr-auto">{pr.hechos}/{pr.total} realizados</span>
          <button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white border-none rounded-[9px] text-[13px] font-bold" style={{ background: ACCENT, opacity: guardando ? 0.5 : 1 }}>
            <Check size={15} /> {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </Footer>
      </div>
    </Backdrop>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
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

function Backdrop({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div onClick={onClose} className="fixed inset-0 z-[100] grid place-items-center p-6" style={{ background: 'rgba(13,27,42,0.5)' }}>
    <div onClick={(e) => e.stopPropagation()}>{children}</div>
  </div>;
}
function Header({ icon, title, sub, onClose }: { icon: ReactNode; title: string; sub: string; onClose: () => void }) {
  return <div className="flex items-center gap-[11px] p-[18px_22px] border-b border-slate-100">
    <span className="grid place-items-center w-9 h-9 rounded-[10px]" style={{ background: '#e0f2fa', color: ACCENT }}>{icon}</span>
    <div className="flex-1"><h3 className="m-0 text-[16px] font-extrabold tracking-tight">{title}</h3><p className="mt-px mb-0 text-[12px] text-slate-500">{sub}</p></div>
    <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-slate-400 p-1"><X size={20} /></button>
  </div>;
}
function Footer({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="p-[16px_22px] border-t border-slate-100 flex items-center gap-2">
    <button onClick={onClose} className="px-3.5 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-[9px] text-[13px] font-semibold cursor-pointer">Cancelar</button>
    {children}
  </div>;
}
function Label({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-bold tracking-[0.4px] uppercase text-slate-400 mb-[7px]">{children}</div>;
}
const inpCls = 'w-full p-[10px_12px] rounded-[9px] border border-slate-300 text-[13px] text-slate-900 bg-white outline-none focus:border-cyan-400';
