// Modales: Programar exámenes (sugiere por protocolo) + Gestionar orden (marcar realizados + subir resultado).
import type { ReactNode } from 'react';
import { useState, useEffect, useRef } from 'react';
import { CalendarPlus, X, Search, Check, Layers, FileText, Upload, Trash2, Image } from 'lucide-react';
import { Timestamp, collection, addDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import type { Trabajador } from '../../types';
import type { TipoExamen, GrupoExamen, ExamenComplementarioDoc } from '../../types';
import { NOMBRES_EXAMEN_COMUNES, TIPOS_EXAMEN, GRUPOS_EXAMEN } from '../../types';
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

  const catalogo: { nombre: string; tipo: TipoExamen }[] = [...NOMBRES_EXAMEN_COMUNES].map((n) => {
    const fromProto = proto.find((p) => p.nombre === n);
    return { nombre: n, tipo: fromProto?.tipo ?? inferirTipo(n) };
  });

  return (
    <Backdrop onClose={onClose}>
      <div className="w-[620px] max-w-full max-h-[92vh] overflow-y-auto bg-white rounded-[18px] shadow-2xl">
        <Header icon={<CalendarPlus size={19} />} title="Programar exámenes" sub="Se sugieren según el protocolo del puesto" onClose={onClose} />
        <div className="p-[20px_22px]">
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

          {worker && (
            <div className="flex items-center gap-2 p-[10px_13px] rounded-[10px] mb-3.5" style={{ background: '#f0fafd', border: '1px solid #cfeaf3' }}>
              <Layers size={16} style={{ color: ACCENT }} />
              <span className="text-[12.5px]" style={{ color: ACCENT }}>
                Protocolo de <strong>{worker.puestoTrabajo}</strong>: {proto.length} exámenes sugeridos. Ajusta lo que necesites.
              </span>
            </div>
          )}

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
// SUBIR RESULTADO — sub-formulario inline dentro de OrdenDetalleModal
// ════════════════════════════════════════════════════════════════════════════
interface ResultadoForm {
  file: File | null;
  nombreExamen: string;
  grupoExamen: GrupoExamen;
  fecha: string;
  resultado: string;
  estado: 'normal' | 'patologico';
  observacion: string;
}

function SubirResultadoPanel({
  examen, trabajadorId, medicoId, medicoNombre,
  onSubido, onCancelar,
}: {
  examen: ExamenItem;
  trabajadorId: string;
  medicoId: string;
  medicoNombre: string;
  onSubido: (examenDocId: string) => void;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState<ResultadoForm>({
    file: null,
    nombreExamen: examen.nombre,
    grupoExamen: 'Particular',
    fecha: new Date().toISOString().slice(0, 10),
    resultado: '',
    estado: 'normal',
    observacion: '',
  });
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const f = <K extends keyof ResultadoForm>(k: K, v: ResultadoForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const subir = async () => {
    if (!form.file) { setError('Selecciona un archivo'); return; }
    if (!form.fecha) { setError('La fecha es obligatoria'); return; }
    if (form.estado === 'patologico' && !form.observacion.trim()) { setError('Los resultados patológicos requieren observación'); return; }
    setSubiendo(true); setError('');
    try {
      const ext = form.file.name.split('.').pop() || 'pdf';
      const path = `examenes/${trabajadorId}/${Date.now()}_${form.nombreExamen.replace(/\s+/g, '_')}.${ext}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, form.file);
      const url = await getDownloadURL(sRef);

      const docData: Omit<ExamenComplementarioDoc, 'id'> = {
        trabajadorId,
        evaluacionId: '',
        tipoExamen: examen.tipo,
        nombreExamen: form.nombreExamen,
        grupoExamen: form.grupoExamen,
        fecha: new Date(form.fecha),
        resultado: form.resultado,
        estado: form.estado,
        observacion: form.observacion,
        archivoUrl: url,
        archivoNombre: form.file.name,
        archivoTipo: form.file.type,
        archivoPath: path,
        medicoId,
        medicoNombre,
        createdAt: new Date(),
      };
      const exRef = await addDoc(collection(db, 'examenes'), docData);
      onSubido(exRef.id);
    } catch (e: any) {
      setError(e.message ?? 'Error al subir el archivo');
    }
    setSubiendo(false);
  };

  const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png';

  return (
    <div style={{ marginTop: 12, padding: '14px 16px', background: '#f0fafd', border: `1.5px solid ${ACCENT}`, borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>Subir resultado: {examen.nombre}</span>
        <button onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
      </div>

      {/* Selector de archivo */}
      <div
        onClick={() => fileRef.current?.click()}
        style={{ border: `2px dashed ${form.file ? ACCENT : '#b0d9e8'}`, borderRadius: 10, padding: '14px', textAlign: 'center', cursor: 'pointer', marginBottom: 12, background: form.file ? '#e0f2fa' : '#fff' }}>
        {form.file ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: ACCENT, fontSize: 13, fontWeight: 600 }}>
            {form.file.type.startsWith('image') ? <Image size={18} /> : <FileText size={18} />}
            {form.file.name}
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>
            <Upload size={20} style={{ margin: '0 auto 6px', color: '#b0d9e8' }} />
            Haz clic para seleccionar un PDF, JPG o PNG
          </div>
        )}
        <input ref={fileRef} type="file" accept={FILE_ACCEPT} style={{ display: 'none' }}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) f('file', file); e.target.value = ''; }} />
      </div>

      {/* Campos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>NOMBRE DEL EXAMEN</div>
          <input value={form.nombreExamen} onChange={(e) => f('nombreExamen', e.target.value)}
            style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>GRUPO</div>
          <select value={form.grupoExamen} onChange={(e) => f('grupoExamen', e.target.value as GrupoExamen)}
            style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 10px', fontSize: 13 }}>
            {GRUPOS_EXAMEN.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>FECHA DEL RESULTADO</div>
          <input type="date" value={form.fecha} onChange={(e) => f('fecha', e.target.value)}
            style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>RESULTADO (VALOR / DESCRIPCIÓN)</div>
          <input value={form.resultado} onChange={(e) => f('resultado', e.target.value)} placeholder="Ej: Normal, 98 dB, 4.5 L/s…"
            style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Estado */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {(['normal', 'patologico'] as const).map((s) => (
          <button key={s} onClick={() => f('estado', s)}
            style={{ flex: 1, padding: '7px', border: `1.5px solid ${form.estado === s ? (s === 'normal' ? '#10a05a' : '#dc2626') : '#cbd5e1'}`, borderRadius: 8, background: form.estado === s ? (s === 'normal' ? '#f3fbf6' : '#fff8f8') : '#fff', color: form.estado === s ? (s === 'normal' ? '#10a05a' : '#dc2626') : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {s === 'normal' ? '✓ Normal' : '⚠ Patológico'}
          </button>
        ))}
      </div>

      {form.estado === 'patologico' && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>OBSERVACIÓN (obligatoria)</div>
          <textarea value={form.observacion} onChange={(e) => f('observacion', e.target.value)} rows={2}
            placeholder="Descripción del hallazgo patológico…"
            style={{ width: '100%', border: '1px solid #fca5a5', borderRadius: 8, padding: '7px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
      )}

      {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{error}</div>}

      <button onClick={subir} disabled={subiendo}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: subiendo ? 'not-allowed' : 'pointer', opacity: subiendo ? 0.6 : 1 }}>
        <Upload size={14} /> {subiendo ? 'Subiendo…' : 'Subir resultado'}
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// GESTIONAR ORDEN (marcar realizados + subir resultados)
// ════════════════════════════════════════════════════════════════════════════
export function OrdenDetalleModal({ orden, onClose, onSaved, onDeleted, trabajadorId, medicoId, medicoNombre }: {
  orden: OrdenExamen;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
  /** Cuando se pasa trabajadorId se habilita la subida de resultados */
  trabajadorId?: string;
  medicoId?: string;
  medicoNombre?: string;
}) {
  const [examenes, setExamenes] = useState<ExamenItem[]>(orden.examenes);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [subiendoIdx, setSubiendoIdx] = useState<number | null>(null);
  const st = estadoOrden({ ...orden, examenes });
  const pr = progresoOrden({ ...orden, examenes });

  const toggle = (i: number) => {
    if (subiendoIdx === i) return;
    setExamenes((l) => l.map((e, idx) => idx === i
      ? { ...e, realizado: !e.realizado, fechaRealizado: !e.realizado ? Timestamp.now() : undefined }
      : e));
  };

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

  const handleSubido = async (idx: number, examenDocId: string) => {
    if (!orden.id) return;
    const updated = examenes.map((e, i) => i === idx ? { ...e, examenDocId } : e);
    setExamenes(updated);
    setSubiendoIdx(null);
    await actualizarOrden(orden.id, { examenes: updated });
  };

  const puedeSubir = !!(trabajadorId && medicoId && medicoNombre);

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
              <div key={i}>
                <button onClick={() => toggle(i)} className="flex items-center gap-3 p-[11px_13px] rounded-[11px] border text-left cursor-pointer w-full"
                  style={{ borderColor: e.realizado ? '#c3ead2' : '#eef1f5', background: e.realizado ? '#f3fbf6' : '#fff' }}>
                  <span className="grid place-items-center w-6 h-6 rounded-md flex-shrink-0 border"
                    style={{ background: e.realizado ? '#10a05a' : '#fff', borderColor: e.realizado ? '#10a05a' : '#cdd6df' }}>
                    {e.realizado && <Check size={14} className="text-white" />}
                  </span>
                  <div className="flex-1">
                    <div className="text-[13.5px] font-semibold text-slate-900">{e.nombre}</div>
                    <div className="text-[11.5px] text-slate-400">
                      {e.realizado ? `Realizado · ${fmtFecha(e.fechaRealizado)}` : `Pendiente · ${e.tipo}`}
                      {e.examenDocId && <span style={{ color: ACCENT, marginLeft: 6 }}>· Resultado adjunto</span>}
                    </div>
                  </div>
                  {/* Botón subir resultado — solo si el examen está completado y hay contexto del trabajador */}
                  {e.realizado && puedeSubir && !e.examenDocId && (
                    <button
                      onClick={(ev) => { ev.stopPropagation(); setSubiendoIdx(subiendoIdx === i ? null : i); }}
                      title="Subir resultado"
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#e0f2fa', border: `1px solid ${ACCENT}`, borderRadius: 7, color: ACCENT, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      <Upload size={12} /> Resultado
                    </button>
                  )}
                  {e.realizado && e.examenDocId && (
                    <FileText size={15} className="text-slate-400 flex-shrink-0" />
                  )}
                  {!e.realizado && (
                    <Upload size={15} className="text-slate-300 flex-shrink-0" />
                  )}
                </button>

                {/* Panel de subida de resultado */}
                {subiendoIdx === i && puedeSubir && (
                  <SubirResultadoPanel
                    examen={e}
                    trabajadorId={trabajadorId!}
                    medicoId={medicoId!}
                    medicoNombre={medicoNombre!}
                    onSubido={(docId) => handleSubido(i, docId)}
                    onCancelar={() => setSubiendoIdx(null)}
                  />
                )}
              </div>
            ))}
          </div>

          {puedeSubir && pr.hechos > 0 && (
            <p className="text-[11px] text-slate-400 mt-3">
              Usa el botón «Resultado» en cada examen completado para adjuntar el archivo. Los resultados quedarán disponibles en el panel de Exámenes Complementarios de la ficha.
            </p>
          )}
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
