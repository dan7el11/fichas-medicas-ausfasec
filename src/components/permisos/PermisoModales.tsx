// Modal "Registrar permiso" (3 tipos) + Modal "Detalle" con correo editable.
// Archivo NUEVO.
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Calendar, X, Search, Home, Shield, Clock, Mail, FileText, Upload, Download, Check, Plus, Minus,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import {
  TIPOS_PERMISO, MOTIVOS_REPOSO_FRECUENTES, type PermisoMedico, type TipoPermiso,
} from '../../types/permiso';
import {
  crearPermiso, estadoPermiso, duracionPermiso, fmtFecha,
  asuntoCorreo, cuerpoCorreo, buildMailto,
} from '../../services/permisos';
import { TipoBadge, EstadoChip } from './PermisoCard';
import type { Trabajador } from '../../types';

const ACCENT = '#7c5cf2';

// ════════════════════════════════════════════════════════════════════════════
// NUEVO PERMISO
// ════════════════════════════════════════════════════════════════════════════
export function NuevoPermisoModal({ trabajadores, medicoId, medicoNombre, onClose, onSaved }: {
  trabajadores: Trabajador[]; medicoId: string; medicoNombre: string; onClose: () => void; onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<TipoPermiso>('reposo_interno');
  const [worker, setWorker] = useState<Trabajador | null>(null);
  const [qW, setQW] = useState('');
  const [desde, setDesde] = useState(new Date().toISOString().slice(0, 10));
  const [dias, setDias] = useState(2);
  const [horas, setHoras] = useState(3);
  const [origen, setOrigen] = useState('IESS');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const meta = TIPOS_PERMISO[tipo];

  const matches = qW
    ? trabajadores.filter((w) => `${w.primerApellido} ${w.segundoApellido} ${w.primerNombre} ${w.cedula}`.toLowerCase().includes(qW.toLowerCase())).slice(0, 6)
    : [];
  const canSave = !!worker && motivo.trim() && !guardando;

  const guardar = async () => {
    if (!worker || !canSave) return;
    setGuardando(true);
    const dDesde = new Date(desde + 'T08:00:00');
    const dHasta = new Date(dDesde);
    if (tipo !== 'cita' && dias > 1) dHasta.setDate(dHasta.getDate() + dias - 1);
    const data: Omit<PermisoMedico, 'id' | 'createdAt'> = {
      trabajadorId: worker.id ?? '',
      apellidos: `${worker.primerApellido ?? ''} ${worker.segundoApellido ?? ''}`.trim(),
      nombres: `${worker.primerNombre ?? ''} ${worker.segundoNombre ?? ''}`.trim(),
      cedula: worker.cedula ?? '',
      puesto: worker.puestoTrabajo ?? '',
      area: worker.departamento ?? '',
      tipo,
      desde: Timestamp.fromDate(dDesde),
      hasta: Timestamp.fromDate(dHasta),
      dias: tipo === 'cita' ? 0 : dias,
      horas: tipo === 'cita' ? horas : 0,
      motivo: motivo.trim(),
      origen: tipo === 'cita' ? origen : (tipo === 'reposo_iess' ? 'IESS' : 'Interno'),
      certAdjunto: !meta.requiereCert,
      medicoId, medicoNombre,
    };
    try { await crearPermiso(data); onSaved(); }
    catch (err) { console.error(err); alert('No se pudo guardar el permiso.'); setGuardando(false); }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="w-[560px] max-w-full max-h-[92vh] overflow-y-auto bg-white rounded-[18px] shadow-2xl">
        <Header icon={<Calendar size={19} />} title="Registrar permiso" sub="Reposo o cita médica" onClose={onClose} />
        <div className="p-[20px_22px]">
          {/* Tipo */}
          <Label>Tipo de permiso</Label>
          <div className="grid grid-cols-3 gap-2 mb-[18px]">
            {(Object.keys(TIPOS_PERMISO) as TipoPermiso[]).map((key) => {
              const m = TIPOS_PERMISO[key]; const on = tipo === key;
              const Ic = key === 'reposo_interno' ? Home : key === 'reposo_iess' ? Shield : Clock;
              return (
                <button key={key} onClick={() => setTipo(key)} className="flex flex-col items-start gap-1.5 p-[12px_13px] rounded-[11px] cursor-pointer text-left border"
                  style={{ borderColor: on ? m.color : '#e3e8ee', background: on ? `${m.color}0d` : '#fff' }}>
                  <span className="grid place-items-center w-8 h-8 rounded-lg" style={{ background: on ? `${m.color}1a` : '#f2f5f8', color: on ? m.color : '#94a2b3' }}><Ic size={17} /></span>
                  <div>
                    <div className="text-[12.5px] font-bold text-slate-900">{m.label}</div>
                    <div className="text-[10.5px] text-slate-400">{m.requiereCert ? 'requiere certificado' : 'genera correo'}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Trabajador */}
          <Label>Trabajador</Label>
          {worker ? (
            <div className="flex items-center gap-2.5 p-[9px_12px] rounded-[9px] mb-4" style={{ border: `1.5px solid ${ACCENT}`, background: '#faf8ff' }}>
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
                    <button key={w.id} onClick={() => { setWorker(w); setQW(''); }} className="flex flex-col items-start w-full text-left p-[9px_12px] border-none border-b border-slate-100 bg-white cursor-pointer hover:bg-violet-50">
                      <span className="text-[13px] font-semibold">{w.primerApellido} {w.segundoApellido} {w.primerNombre}</span>
                      <span className="text-[11px] text-slate-400">{w.puestoTrabajo} · CI {w.cedula}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fechas / duración */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <Label>{tipo === 'cita' ? 'Fecha' : 'Desde'}</Label>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inpCls} />
            </div>
            <div>
              <Label>{meta.unidad === 'horas' ? 'Horas' : 'Días de reposo'}</Label>
              <div className="flex items-center border border-slate-300 rounded-[9px] overflow-hidden">
                <button onClick={() => meta.unidad === 'horas' ? setHoras((h) => Math.max(1, h - 1)) : setDias((d) => Math.max(1, d - 1))} className="w-8 h-[38px] border-none bg-slate-100 cursor-pointer"><Minus size={14} className="mx-auto text-slate-600" /></button>
                <span className="flex-1 text-center text-[14px] font-bold font-mono">{meta.unidad === 'horas' ? `${horas} h` : `${dias} d`}</span>
                <button onClick={() => meta.unidad === 'horas' ? setHoras((h) => h + 1) : setDias((d) => d + 1)} className="w-8 h-[38px] border-none bg-slate-100 cursor-pointer"><Plus size={14} className="mx-auto text-slate-600" /></button>
              </div>
            </div>
          </div>

          {tipo === 'cita' && (
            <div className="mb-4">
              <Label>Origen de la cita</Label>
              <div className="flex gap-1.5">
                {['IESS', 'Particular'].map((o) => (
                  <button key={o} onClick={() => setOrigen(o)} className="flex-1 py-2.5 rounded-lg cursor-pointer text-[13px] font-semibold border"
                    style={{ borderColor: origen === o ? ACCENT : '#dde4ec', background: origen === o ? '#f0ebff' : '#fff', color: origen === o ? ACCENT : '#5a6a7a' }}>{o}</button>
                ))}
              </div>
            </div>
          )}

          {/* Motivo */}
          <Label>Motivo / diagnóstico</Label>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} list="motivos-reposo" placeholder={tipo === 'cita' ? 'Ej: control con especialista' : 'Ej: lumbalgia mecánica'} className={`${inpCls} mb-4`} />
          <datalist id="motivos-reposo">{MOTIVOS_REPOSO_FRECUENTES.map((m) => <option key={m} value={m} />)}</datalist>

          {/* Nota */}
          <div className="flex gap-2.5 p-[11px_13px] rounded-[10px]" style={{ background: meta.requiereCert ? '#eaf3ff' : '#e6f6ee', border: `1px solid ${meta.requiereCert ? '#d6e4fb' : '#c3ead2'}` }}>
            {meta.requiereCert ? <FileText size={16} className="text-blue-700 flex-shrink-0" /> : <Mail size={16} className="text-green-700 flex-shrink-0" />}
            <span className="text-[12.5px]" style={{ color: meta.requiereCert ? '#1d4fad' : '#0a6b3b' }}>
              {meta.requiereCert ? 'Quedará pendiente de justificativo hasta adjuntar el certificado PDF.' : 'Podrás generar el correo de notificación de reposo automáticamente.'}
            </span>
          </div>
        </div>
        <Footer onClose={onClose}>
          <button onClick={guardar} disabled={!canSave} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white border-none rounded-[9px] text-[13px] font-bold"
            style={{ background: ACCENT, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}>
            <Check size={15} /> {guardando ? 'Guardando…' : 'Guardar permiso'}
          </button>
        </Footer>
      </div>
    </Backdrop>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DETALLE + CORREO EDITABLE
// ════════════════════════════════════════════════════════════════════════════
export function PermisoDetalleModal({ permiso: p, onClose }: { permiso: PermisoMedico; onClose: () => void }) {
  const meta = TIPOS_PERMISO[p.tipo];
  const estado = estadoPermiso(p);
  const [showMail, setShowMail] = useState(false);

  return (
    <Backdrop onClose={onClose}>
      <div className={`max-w-full max-h-[92vh] overflow-y-auto bg-white rounded-[18px] shadow-2xl transition-all ${showMail ? 'w-[640px]' : 'w-[540px]'}`}>
        <div className="flex items-center gap-[13px] p-[18px_22px] border-b border-slate-100" style={{ background: 'linear-gradient(135deg,#f0ebff 0%,#fff 80%)' }}>
          <div className="w-11 h-11 rounded-full grid place-items-center font-bold text-[15px]" style={{ background: '#eef1f5', color: '#5a6a7a' }}>
            {(p.apellidos?.[0] ?? '') + (p.nombres?.[0] ?? '')}
          </div>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold tracking-tight">{p.apellidos} {p.nombres}</div>
            <div className="text-[12.5px] text-slate-500">{p.puesto} · CI {p.cedula}</div>
          </div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-slate-400 p-1"><X size={20} /></button>
        </div>

        <div className="p-[18px_22px]">
          <div className="flex items-center gap-2.5 mb-4">
            <TipoBadge tipo={p.tipo} /><EstadoChip estado={estado} small />
            <span className="ml-auto font-mono text-[13px] font-bold">{duracionPermiso(p)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <KV label={p.tipo === 'cita' ? 'Fecha' : 'Desde'} value={fmtFecha(p.desde)} />
            {p.tipo !== 'cita' && <KV label="Hasta" value={fmtFecha(p.hasta)} />}
            <KV label="Motivo" value={p.motivo} />
            {p.origen && <KV label="Origen" value={p.origen} />}
          </div>

          {meta.requiereCert ? (
            <div className="p-[14px_16px] rounded-[11px]" style={{ border: `1px solid ${p.certAdjunto ? '#c3ead2' : '#f5d4a0'}`, background: p.certAdjunto ? '#f3fbf6' : '#fffaf0' }}>
              <div className="flex items-center gap-2.5">
                {p.certAdjunto ? <FileText size={18} className="text-green-700" /> : <Upload size={18} className="text-amber-700" />}
                <div className="flex-1">
                  <div className="text-[13px] font-bold" style={{ color: p.certAdjunto ? '#0a6b3b' : '#8a4a0a' }}>{p.certAdjunto ? 'Certificado adjunto' : 'Falta el certificado'}</div>
                  <div className="text-[11.5px] text-slate-500">{p.certAdjunto ? p.certNombreArchivo ?? 'certificado.pdf' : 'Sube el PDF para justificar este permiso'}</div>
                </div>
                <button className="inline-flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[12px] font-semibold cursor-pointer border"
                  style={p.certAdjunto ? { background: '#fff', color: '#3a4a5e', borderColor: '#d8dee6' } : { background: '#fff4e3', color: '#8a4a0a', borderColor: '#f5d4a0' }}>
                  {p.certAdjunto ? <><Download size={13} /> Descargar</> : <><Upload size={13} /> Subir PDF</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-[14px_16px] rounded-[11px] border border-green-200 bg-green-50/40">
              <div className="flex items-center gap-2.5">
                <Mail size={18} className="text-green-700" />
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-green-800">Notificación de reposo interno</div>
                  <div className="text-[11.5px] text-slate-500">Genera el correo para informar a jefatura / RRHH</div>
                </div>
                <button onClick={() => setShowMail((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-white text-slate-700 border border-slate-300 rounded-lg text-[12px] font-semibold cursor-pointer">
                  <Mail size={13} /> {showMail ? 'Ocultar' : 'Previsualizar'}
                </button>
              </div>
              {showMail && <MailEditor p={p} />}
            </div>
          )}
        </div>
      </div>
    </Backdrop>
  );
}

function MailEditor({ p }: { p: PermisoMedico }) {
  const [asunto, setAsunto] = useState(() => asuntoCorreo(p));
  const [cuerpo, setCuerpo] = useState(() => cuerpoCorreo(p));
  const [editando, setEditando] = useState(false);
  const dirty = asunto !== asuntoCorreo(p) || cuerpo !== cuerpoCorreo(p);
  return (
    <div className="mt-3 border border-slate-200 rounded-[10px] overflow-hidden bg-white">
      <div className="flex items-center gap-2 p-[9px_14px] border-b border-slate-100 bg-slate-50">
        <span className="text-[11.5px] font-bold text-slate-600 tracking-wide">VISTA PREVIA DEL CORREO</span>
        <div className="ml-auto flex gap-1.5">
          {dirty && <button onClick={() => { setAsunto(asuntoCorreo(p)); setCuerpo(cuerpoCorreo(p)); }} className="px-2.5 py-[5px] text-[11.5px] font-semibold bg-white border border-slate-300 rounded-lg cursor-pointer text-slate-700">Restaurar</button>}
          <button onClick={() => setEditando((v) => !v)} className="inline-flex items-center gap-1.5 px-2.5 py-[5px] text-[11.5px] font-semibold rounded-lg cursor-pointer border"
            style={editando ? { background: ACCENT, color: '#fff', borderColor: ACCENT } : { background: '#fff', color: '#3a4a5e', borderColor: '#d8dee6' }}>
            {editando ? <Check size={13} /> : <FileText size={13} />} {editando ? 'Listo' : 'Editar texto'}
          </button>
        </div>
      </div>
      <div className="p-[10px_14px] border-b border-slate-100">
        <div className="text-[10.5px] font-bold tracking-wide uppercase text-slate-400 mb-1">Asunto</div>
        {editando
          ? <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className="w-full border border-slate-300 rounded-md p-[7px_10px] text-[13px] font-semibold outline-none" />
          : <div className="text-[13px] font-semibold text-slate-900">{asunto}</div>}
      </div>
      <div className="p-[12px_14px]">
        <div className="text-[10.5px] font-bold tracking-wide uppercase text-slate-400 mb-1.5">Mensaje</div>
        {editando
          ? <textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={16} className="w-full border border-slate-300 rounded-lg p-[10px_12px] text-[12.5px] text-slate-700 leading-relaxed resize-y outline-none" />
          : <div className="text-[12.5px] text-slate-700 leading-relaxed whitespace-pre-line max-h-[260px] overflow-y-auto">{cuerpo}</div>}
      </div>
      <div className="p-[12px_14px] border-t border-slate-100 flex items-center gap-2.5">
        <span className="text-[11px] text-slate-400">{dirty ? 'Texto personalizado' : 'Plantilla estándar'}</span>
        <a href={buildMailto(asunto, cuerpo)} className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 text-white rounded-[9px] text-[13px] font-bold no-underline" style={{ background: ACCENT }}>
          <Mail size={15} /> Abrir en correo
        </a>
      </div>
    </div>
  );
}

// ── Subcomponentes compartidos ───────────────────────────────────────────────
function Backdrop({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div onClick={onClose} className="fixed inset-0 z-[100] grid place-items-center p-6" style={{ background: 'rgba(13,27,42,0.5)' }}>
    <div onClick={(e) => e.stopPropagation()}>{children}</div>
  </div>;
}
function Header({ icon, title, sub, onClose }: { icon: ReactNode; title: string; sub: string; onClose: () => void }) {
  return <div className="flex items-center gap-[11px] p-[18px_22px] border-b border-slate-100">
    <span className="grid place-items-center w-9 h-9 rounded-[10px]" style={{ background: '#f0ebff', color: ACCENT }}>{icon}</span>
    <div className="flex-1"><h3 className="m-0 text-[16px] font-extrabold tracking-tight">{title}</h3><p className="mt-px mb-0 text-[12px] text-slate-500">{sub}</p></div>
    <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-slate-400 p-1"><X size={20} /></button>
  </div>;
}
function Footer({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="p-[16px_22px] border-t border-slate-100 flex justify-end gap-2">
    <button onClick={onClose} className="px-3.5 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-[9px] text-[13px] font-semibold cursor-pointer">Cancelar</button>
    {children}
  </div>;
}
function Label({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-bold tracking-[0.4px] uppercase text-slate-400 mb-[7px]">{children}</div>;
}
function KV({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] font-bold tracking-[0.4px] uppercase text-slate-400 mb-[3px]">{label}</div><div className="text-[13.5px] font-semibold text-slate-900">{value}</div></div>;
}

const inpCls = 'w-full p-[10px_12px] rounded-[9px] border border-slate-300 text-[13px] text-slate-900 bg-white outline-none focus:border-violet-400';
