// Modal "Nueva atención" — registro rápido + sección expandible.
// Reutiliza el componente existente BuscadorCIE10. Archivo NUEVO.
import { useState } from 'react';
import {
  Stethoscope, X, Search, ChevronDown, Pill, Plus, Minus, Check, AlertTriangle,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import BuscadorCIE10 from '../BuscadorCIE10';
import { crearAtencion } from '../../services/atenciones';
import {
  PROCEDIMIENTOS_CONSULTA, MEDICAMENTOS_DISPENSARIO,
} from '../../types/atencion';
import type { AtencionMedica } from '../../types/atencion';
import type { Trabajador } from '../../types';

const ACCENT = '#1d4fad';

interface Props {
  trabajadores: Trabajador[];
  medicoId: string;
  medicoNombre: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function NuevaAtencionModal({ trabajadores, medicoId, medicoNombre, onClose, onSaved }: Props) {
  const [pacienteTipo, setPacienteTipo] = useState<'trabajador' | 'externo'>('trabajador');
  const [worker, setWorker] = useState<Trabajador | null>(null);
  const [qWorker, setQWorker] = useState('');
  const [extApellidos, setExtApellidos] = useState('');
  const [extNombres, setExtNombres] = useState('');
  const [extDetalle, setExtDetalle] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F' | ''>('');
  const [edad, setEdad] = useState('');

  const [motivo, setMotivo] = useState('');
  const [cie, setCie] = useState<{ codigo: string; desc: string } | null>(null);
  const [tipoAt, setTipoAt] = useState<'Primera' | 'Subsecuente'>('Primera');
  const [relacion, setRelacion] = useState<'Común' | 'Ocupacional'>('Común');

  const [expanded, setExpanded] = useState(false);
  const [pa, setPa] = useState(''); const [fc, setFc] = useState(''); const [temp, setTemp] = useState(''); const [spo2, setSpo2] = useState('');
  const [procs, setProcs] = useState<Set<string>>(new Set());
  const [meds, setMeds] = useState<{ nombre: string; cantidad: number }[]>([]);
  const [medQ, setMedQ] = useState('');
  const [reposo, setReposo] = useState(0);
  const [obs, setObs] = useState('');
  const [guardando, setGuardando] = useState(false);

  const matches = qWorker
    ? trabajadores.filter((w) =>
        `${w.primerApellido} ${w.segundoApellido} ${w.primerNombre} ${w.segundoNombre} ${w.cedula}`
          .toLowerCase().includes(qWorker.toLowerCase()),
      ).slice(0, 6)
    : [];
  const medMatches = medQ
    ? MEDICAMENTOS_DISPENSARIO.filter((m) => m.toLowerCase().includes(medQ.toLowerCase()) && !meds.find((x) => x.nombre === m)).slice(0, 6)
    : [];

  const elegirWorker = (w: Trabajador) => {
    setWorker(w); setQWorker(''); setSexo(w.sexo ?? '');
  };
  const toggleProc = (p: string) => setProcs((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const addMed = (m: string) => { setMeds((l) => [...l, { nombre: m, cantidad: 1 }]); setMedQ(''); };
  const setCant = (nombre: string, d: number) => setMeds((l) => l.map((x) => x.nombre === nombre ? { ...x, cantidad: Math.max(1, x.cantidad + d) } : x));
  const rmMed = (nombre: string) => setMeds((l) => l.filter((x) => x.nombre !== nombre));

  const pacienteOk = pacienteTipo === 'trabajador' ? !!worker : extApellidos.trim() || extNombres.trim();
  const canSave = !!pacienteOk && motivo.trim() && cie && !guardando;

  const guardar = async () => {
    if (!canSave || !cie) return;
    setGuardando(true);
    const data: Omit<AtencionMedica, 'id' | 'createdAt'> = {
      pacienteTipo,
      trabajadorId: pacienteTipo === 'trabajador' ? worker?.id : undefined,
      pacienteApellidos: pacienteTipo === 'trabajador' ? `${worker?.primerApellido ?? ''} ${worker?.segundoApellido ?? ''}`.trim() : extApellidos.trim(),
      pacienteNombres: pacienteTipo === 'trabajador' ? `${worker?.primerNombre ?? ''} ${worker?.segundoNombre ?? ''}`.trim() : extNombres.trim(),
      pacienteDetalle: pacienteTipo === 'trabajador' ? worker?.puestoTrabajo : extDetalle.trim(),
      sexo,
      edad: edad ? parseInt(edad, 10) : null,
      fecha: Timestamp.now(),
      motivo: motivo.trim(),
      cieCodigo: cie.codigo,
      cieDescripcion: cie.desc,
      tipoAtencion: tipoAt,
      relacion,
      signosVitales: { pa, fc, temp, spo2 },
      procedimientos: [...procs],
      medicacion: meds,
      reposoDias: reposo,
      observaciones: obs.trim(),
      estado: 'atendido',
      medicoId,
      medicoNombre,
    };
    try {
      await crearAtencion(data);
      onSaved();
    } catch (err) {
      console.error('Error al guardar la atención:', err);
      alert('No se pudo guardar la atención. Revisa la conexión.');
      setGuardando(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] grid place-items-center p-6" style={{ background: 'rgba(13,27,42,0.5)' }}>
      <div onClick={(e) => e.stopPropagation()} className="w-[580px] max-w-full max-h-[92vh] overflow-y-auto bg-white rounded-[18px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-[11px] p-[18px_22px] border-b border-slate-100">
          <span className="grid place-items-center w-9 h-9 rounded-[10px]" style={{ background: '#eaf3ff', color: ACCENT }}>
            <Stethoscope size={19} />
          </span>
          <div className="flex-1">
            <h3 className="m-0 text-[16px] font-extrabold tracking-tight text-slate-900">Nueva atención</h3>
            <p className="mt-px mb-0 text-[12px] text-slate-500">Consulta médica diaria</p>
          </div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-slate-400 p-1"><X size={20} /></button>
        </div>

        <div className="p-[20px_22px]">
          {/* Paciente */}
          <Label>Paciente</Label>
          <div className="flex gap-1.5 mb-2.5">
            <Seg active={pacienteTipo === 'trabajador'} onClick={() => setPacienteTipo('trabajador')}>Trabajador</Seg>
            <Seg active={pacienteTipo === 'externo'} onClick={() => setPacienteTipo('externo')}>Externo / visitante</Seg>
          </div>

          {pacienteTipo === 'trabajador' ? (
            worker ? (
              <div className="flex items-center gap-2.5 p-[9px_12px] rounded-[9px] mb-4" style={{ border: `1.5px solid ${ACCENT}`, background: '#f7fafe' }}>
                <div className="flex-1">
                  <div className="text-[13.5px] font-bold">{worker.primerApellido} {worker.segundoApellido} {worker.primerNombre}</div>
                  <div className="text-[11.5px] text-slate-500">{worker.puestoTrabajo} · CI {worker.cedula}</div>
                </div>
                <button onClick={() => setWorker(null)} className="bg-transparent border-none cursor-pointer text-slate-400"><X size={16} /></button>
              </div>
            ) : (
              <div className="relative mb-4">
                <div className="flex items-center gap-2 p-[10px_12px] rounded-[9px] border border-slate-300 bg-white">
                  <Search size={16} className="text-slate-400" />
                  <input value={qWorker} onChange={(e) => setQWorker(e.target.value)} placeholder="Buscar por nombre o cédula…" className="flex-1 border-none outline-none text-[13px] bg-transparent" />
                </div>
                {matches.length > 0 && (
                  <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-slate-200 rounded-[10px] shadow-xl z-20 overflow-hidden">
                    {matches.map((w) => (
                      <button key={w.id} onClick={() => elegirWorker(w)} className="flex items-center gap-2.5 w-full text-left p-[9px_12px] border-none border-b border-slate-100 bg-white cursor-pointer hover:bg-slate-50">
                        <div>
                          <div className="text-[13px] font-semibold">{w.primerApellido} {w.segundoApellido} {w.primerNombre}</div>
                          <div className="text-[11px] text-slate-400">{w.puestoTrabajo} · CI {w.cedula}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <input value={extApellidos} onChange={(e) => setExtApellidos(e.target.value)} placeholder="Apellidos" className={inpCls} />
              <input value={extNombres} onChange={(e) => setExtNombres(e.target.value)} placeholder="Nombres" className={inpCls} />
              <input value={extDetalle} onChange={(e) => setExtDetalle(e.target.value)} placeholder="Detalle (contratista, visitante…)" className={`${inpCls} col-span-2`} />
            </div>
          )}

          {/* Sexo + edad */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <Label>Sexo</Label>
              <div className="flex gap-1.5">
                <Seg active={sexo === 'M'} onClick={() => setSexo('M')} small>M</Seg>
                <Seg active={sexo === 'F'} onClick={() => setSexo('F')} small>F</Seg>
              </div>
            </div>
            <div>
              <Label>Edad</Label>
              <input value={edad} onChange={(e) => setEdad(e.target.value.replace(/\D/g, ''))} placeholder="años" className={inpCls} />
            </div>
          </div>

          {/* Motivo */}
          <Label>Motivo de consulta</Label>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: cefalea desde anoche, dolor lumbar…" className={`${inpCls} mb-4`} />

          {/* Diagnóstico — reutiliza BuscadorCIE10 */}
          <Label>Diagnóstico (CIE-10)</Label>
          <div className="mb-4">
            <BuscadorCIE10
              valorActual={cie ? `${cie.codigo} - ${cie.desc}` : ''}
              onSeleccionar={(codigo, descripcion) => setCie({ codigo, desc: descripcion })}
            />
          </div>

          {/* Tipo + relación */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <div className="flex gap-1.5">
                <Seg active={tipoAt === 'Primera'} onClick={() => setTipoAt('Primera')} small>Primera</Seg>
                <Seg active={tipoAt === 'Subsecuente'} onClick={() => setTipoAt('Subsecuente')} small>Subsec.</Seg>
              </div>
            </div>
            <div>
              <Label>Relación</Label>
              <div className="flex gap-1.5">
                <Seg active={relacion === 'Común'} onClick={() => setRelacion('Común')} small>Común</Seg>
                <Seg active={relacion === 'Ocupacional'} onClick={() => setRelacion('Ocupacional')} small>Ocupac.</Seg>
              </div>
            </div>
          </div>

          {/* Toggle expandir */}
          <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2 w-full justify-center p-2.5 mt-3.5 border border-dashed border-slate-300 rounded-[9px] bg-slate-50 cursor-pointer text-slate-500 text-[13px] font-semibold">
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Ocultar detalle clínico' : 'Agregar signos, procedimientos y medicación'}
          </button>

          {expanded && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              {/* Signos */}
              <Label>Signos vitales</Label>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <Vital label="PA" value={pa} onChange={setPa} placeholder="120/80" />
                <Vital label="FC" value={fc} onChange={setFc} placeholder="72" />
                <Vital label="T°" value={temp} onChange={setTemp} placeholder="36.5" />
                <Vital label="SpO₂" value={spo2} onChange={setSpo2} placeholder="98" />
              </div>

              {/* Procedimientos */}
              <Label>Procedimientos</Label>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {PROCEDIMIENTOS_CONSULTA.map((p) => {
                  const on = procs.has(p);
                  return (
                    <button key={p} onClick={() => toggleProc(p)} className="px-[11px] py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer border"
                      style={{ borderColor: on ? '#7c5cf2' : '#dde4ec', background: on ? '#f0ebff' : '#fff', color: on ? '#5b3fbd' : '#5a6a7a' }}>
                      {p}
                    </button>
                  );
                })}
              </div>

              {/* Medicación */}
              <Label>Medicación administrada</Label>
              <div className="relative mb-2.5">
                <div className="flex items-center gap-2 p-[9px_12px] rounded-[9px] border border-slate-300 bg-white">
                  <Pill size={15} className="text-slate-400" />
                  <input value={medQ} onChange={(e) => setMedQ(e.target.value)} placeholder="Buscar medicamento…" className="flex-1 border-none outline-none text-[13px] bg-transparent" />
                </div>
                {medMatches.length > 0 && (
                  <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-slate-200 rounded-[10px] shadow-xl z-20 overflow-hidden">
                    {medMatches.map((m) => (
                      <button key={m} onClick={() => addMed(m)} className="flex items-center w-full text-left p-[9px_12px] border-none border-b border-slate-100 bg-white cursor-pointer hover:bg-slate-50 text-[13px] font-semibold">
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {meds.map((x) => (
                <div key={x.nombre} className="flex items-center gap-2.5 p-[8px_12px] rounded-[9px] bg-slate-50 border border-slate-100 mb-1.5">
                  <div className="flex-1 text-[13px] font-semibold">{x.nombre}</div>
                  <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden">
                    <button onClick={() => setCant(x.nombre, -1)} className="w-7 h-[30px] border-none bg-slate-100 cursor-pointer text-slate-600"><Minus size={13} className="mx-auto" /></button>
                    <span className="min-w-[28px] text-center text-[13px] font-bold">{x.cantidad}</span>
                    <button onClick={() => setCant(x.nombre, 1)} className="w-7 h-[30px] border-none bg-slate-100 cursor-pointer text-slate-600"><Plus size={13} className="mx-auto" /></button>
                  </div>
                  <button onClick={() => rmMed(x.nombre)} className="bg-transparent border-none cursor-pointer text-slate-300"><X size={15} /></button>
                </div>
              ))}

              {/* Reposo */}
              <div className="flex items-center gap-3 my-4">
                <Label>Reposo</Label>
                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden">
                  <button onClick={() => setReposo((r) => Math.max(0, r - 1))} className="w-7 h-[30px] border-none bg-slate-100 cursor-pointer text-slate-600"><Minus size={13} className="mx-auto" /></button>
                  <span className="min-w-[54px] text-center text-[13px] font-bold">{reposo} día{reposo !== 1 ? 's' : ''}</span>
                  <button onClick={() => setReposo((r) => r + 1)} className="w-7 h-[30px] border-none bg-slate-100 cursor-pointer text-slate-600"><Plus size={13} className="mx-auto" /></button>
                </div>
              </div>

              {/* Observaciones */}
              <Label>Observaciones</Label>
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Indicaciones, evolución, recomendaciones…" className={`${inpCls} resize-y`} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-[16px_22px] border-t border-slate-100 flex items-center gap-2.5 bg-white">
          {meds.length > 0 && (
            <span className="text-[12px] text-amber-800 inline-flex items-center gap-1.5">
              <AlertTriangle size={13} /> {meds.reduce((s, x) => s + x.cantidad, 0)} u. dispensadas
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="px-3.5 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-[9px] text-[13px] font-semibold cursor-pointer">Cancelar</button>
            <button onClick={guardar} disabled={!canSave}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white border-none rounded-[9px] text-[13px] font-bold"
              style={{ background: ACCENT, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}>
              <Check size={15} /> {guardando ? 'Guardando…' : 'Guardar atención'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inpCls = 'w-full p-[10px_12px] rounded-[9px] border border-slate-300 text-[13px] text-slate-900 bg-white outline-none focus:border-blue-400';

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold tracking-[0.4px] uppercase text-slate-400 mb-[7px]">{children}</div>;
}
function Seg({ active, onClick, children, small }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button onClick={onClick} className={`flex-1 rounded-lg cursor-pointer font-semibold border ${small ? 'py-[7px] px-2 text-[12px]' : 'py-[9px] px-3 text-[13px]'}`}
      style={{ borderColor: active ? ACCENT : '#dde4ec', background: active ? '#eaf3ff' : '#fff', color: active ? ACCENT : '#5a6a7a' }}>
      {children}
    </button>
  );
}
function Vital({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="border border-slate-300 rounded-[9px] p-[7px_9px] bg-white">
      <div className="text-[10px] text-slate-400 font-bold mb-0.5">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full border-none outline-none text-[13px] font-semibold font-mono text-slate-900 bg-transparent" />
    </div>
  );
}
