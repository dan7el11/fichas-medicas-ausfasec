// Pestaña "Fisioterapia" de la ficha del trabajador: registro de tratamientos
// de fisioterapia (zona trabajada, días y horarios indicados, sesiones),
// certificado/orden médica adjunta y generación de permisos internos para la
// asistencia (enlazados con el módulo de Permisos).
import { useState, useEffect, useCallback, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { HeartPulse, Plus, Pencil, X, Upload, FileText, CalendarDays } from 'lucide-react';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import {
  getFisioterapias, crearFisioterapia, actualizarFisioterapia, eliminarFisioterapia, subirCertificadoFisioterapia,
} from '../../services/seguimientos';
import { crearPermiso } from '../../services/permisos';
import { DIAS_SEMANA, ZONAS_FISIOTERAPIA } from '../../types/seguimiento';
import type { RegistroFisioterapia } from '../../types/seguimiento';

interface Props {
  trabajador: any;   // se usan apellidos/nombres/cedula/puesto para el permiso
  onVerPdf?: (url: string, nombre: string) => void;
}

interface FormularioFisio {
  zona: string;
  indicacion: string;
  centro: string;
  dias: string[];
  horaDesde: string;
  horaHasta: string;
  desde: string;
  sesionesTotales: string;
  sesionesCumplidas: string;
  notas: string;
  estado: 'activo' | 'finalizado';
}

const formVacio = (): FormularioFisio => ({
  zona: '', indicacion: '', centro: '', dias: [], horaDesde: '', horaHasta: '',
  desde: new Date().toISOString().slice(0, 10), sesionesTotales: '', sesionesCumplidas: '',
  notas: '', estado: 'activo',
});

export default function FisioterapiaPanel({ trabajador, onVerPdf }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const { user, nombreProfesional } = useAuth();
  const trabajadorId: string = trabajador?.id ?? '';

  const [registros, setRegistros] = useState<RegistroFisioterapia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<RegistroFisioterapia | null>(null);
  const [form, setForm] = useState<FormularioFisio>(formVacio());

  // Subida de certificado
  const certInputRef = useRef<HTMLInputElement>(null);
  const [subiendoCert, setSubiendoCert] = useState<string | null>(null);
  const [regParaCert, setRegParaCert] = useState<RegistroFisioterapia | null>(null);

  // Permiso interno
  const [permisoPara, setPermisoPara] = useState<RegistroFisioterapia | null>(null);
  const [permisoFecha, setPermisoFecha] = useState(new Date().toISOString().slice(0, 10));
  const [permisoHoras, setPermisoHoras] = useState(2);
  const [creandoPermiso, setCreandoPermiso] = useState(false);

  const cargar = useCallback(async () => {
    if (!trabajadorId) return;
    setCargando(true);
    try { setRegistros(await getFisioterapias(trabajadorId)); }
    catch (err) { console.error('Error al cargar fisioterapia:', err); }
    finally { setCargando(false); }
  }, [trabajadorId]);
  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => { setEditando(null); setForm(formVacio()); setModal(true); };
  const abrirEditar = (r: RegistroFisioterapia) => {
    setEditando(r);
    const [hd, hh] = (r.horario || '').split('–').map(s => s?.trim() ?? '');
    setForm({
      zona: r.zona || '', indicacion: r.indicacion || '', centro: r.centro || '',
      dias: r.dias || [], horaDesde: hd || '', horaHasta: hh || '',
      desde: r.desde || '', sesionesTotales: r.sesionesTotales || '', sesionesCumplidas: r.sesionesCumplidas || '',
      notas: r.notas || '', estado: r.estado || 'activo',
    });
    setModal(true);
  };

  const guardar = async () => {
    if (!form.zona.trim()) { toast.warning('Indica la zona trabajada.'); return; }
    setGuardando(true);
    try {
      const data = {
        trabajadorId,
        zona: form.zona.trim(),
        indicacion: form.indicacion.trim(),
        centro: form.centro.trim(),
        dias: form.dias,
        horario: form.horaDesde || form.horaHasta ? `${form.horaDesde} – ${form.horaHasta}` : '',
        desde: form.desde,
        sesionesTotales: form.sesionesTotales,
        sesionesCumplidas: form.sesionesCumplidas,
        notas: form.notas.trim(),
        estado: form.estado,
        medicoId: user?.uid ?? '',
        medicoNombre: nombreProfesional,
      };
      if (editando?.id) await actualizarFisioterapia(editando.id, data);
      else await crearFisioterapia(data);
      toast.success(editando ? 'Registro actualizado.' : 'Fisioterapia registrada.');
      setModal(false);
      cargar();
    } catch (err) { console.error(err); toast.error('No se pudo guardar el registro.'); }
    finally { setGuardando(false); }
  };

  const eliminar = async (r: RegistroFisioterapia) => {
    if (!(await confirm({ message: `¿Eliminar el registro de fisioterapia (${r.zona})?`, danger: true }))) return;
    try { await eliminarFisioterapia(r); toast.success('Registro eliminado.'); cargar(); }
    catch { toast.error('No se pudo eliminar.'); }
  };

  const subirCert = async (r: RegistroFisioterapia, file: File) => {
    setSubiendoCert(r.id ?? null);
    try {
      await subirCertificadoFisioterapia(r, file);
      toast.success('Certificado adjuntado.');
      cargar();
    } catch (err: any) {
      console.error('Error al subir certificado de fisioterapia:', err);
      toast.error(err?.code === 'storage/unauthorized'
        ? 'Storage rechazó la subida: publica las reglas de Storage actualizadas (ruta fisioterapia/).'
        : 'No se pudo subir el certificado.');
    } finally { setSubiendoCert(null); }
  };

  // Permiso interno para asistir a la sesión (enlace con el módulo de Permisos)
  const generarPermiso = async () => {
    if (!permisoPara || !trabajadorId) return;
    setCreandoPermiso(true);
    try {
      const d = new Date(permisoFecha + 'T08:00:00');
      const id = await crearPermiso({
        trabajadorId,
        apellidos: `${trabajador.primerApellido ?? ''} ${trabajador.segundoApellido ?? ''}`.trim(),
        nombres: `${trabajador.primerNombre ?? ''} ${trabajador.segundoNombre ?? ''}`.trim(),
        cedula: trabajador.cedula ?? '',
        puesto: trabajador.puestoTrabajo ?? '',
        area: trabajador.departamento ?? '',
        tipo: 'cita',
        desde: Timestamp.fromDate(d),
        hasta: Timestamp.fromDate(d),
        dias: 0,
        horas: permisoHoras,
        motivo: `Fisioterapia — ${permisoPara.zona}${permisoPara.centro ? ` (${permisoPara.centro})` : ''}`,
        origen: 'Interno',
        // Si el tratamiento tiene certificado adjunto, el permiso nace justificado con él.
        certAdjunto: !!permisoPara.certUrl,
        ...(permisoPara.certUrl ? { certUrl: permisoPara.certUrl, certNombreArchivo: permisoPara.certNombre ?? 'certificado' } : {}),
        medicoId: user?.uid ?? '',
        medicoNombre: nombreProfesional,
      } as any);
      if (permisoPara.id) {
        await actualizarFisioterapia(permisoPara.id, {
          permisosGenerados: [...(permisoPara.permisosGenerados ?? []), id],
        });
      }
      toast.success('Permiso interno generado. Lo verás en la pestaña Permisos.');
      setPermisoPara(null);
      cargar();
    } catch (err) { console.error(err); toast.error('No se pudo generar el permiso.'); }
    finally { setCreandoPermiso(false); }
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-600/40';
  const ACC = '#0d9488';

  return (
    <div className="bg-white border rounded-[13px] overflow-hidden" style={{ borderColor: '#e4e6ea' }}>
      <div className="flex items-center gap-2.5 px-[18px] py-[15px] border-b" style={{ borderColor: '#e4e6ea' }}>
        <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px]" style={{ background: `${ACC}16`, color: ACC }}><HeartPulse size={17} /></span>
        <h3 className="m-0 text-[17px] font-semibold tracking-tight" style={{ fontFamily: "'Spectral', Georgia, serif" }}>Fisioterapia</h3>
        <span className="text-[11px] font-bold px-2 py-px rounded-full bg-slate-100 text-slate-500">{registros.length}</span>
        <button onClick={abrirNuevo} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-white border-none rounded-lg text-[12.5px] font-bold cursor-pointer" style={{ background: ACC }}>
          <Plus size={14} /> Registrar tratamiento
        </button>
      </div>

      {cargando ? (
        <div className="p-6 text-center text-[12.5px] text-slate-400">Cargando…</div>
      ) : registros.length === 0 ? (
        <div className="p-6 text-center text-[12.5px] text-slate-400">
          Sin tratamientos de fisioterapia registrados. Registra la zona trabajada, los días y horarios indicados, adjunta el certificado y genera los permisos internos de asistencia.
        </div>
      ) : (
        <div>
          {registros.map((r, i) => (
            <div key={r.id} className="px-[18px] py-3.5" style={{ borderTop: i > 0 ? '1px solid #eef0f3' : 'none' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${ACC}14`, color: ACC }}>{r.zona}</span>
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${r.estado === 'finalizado' ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'}`}>
                  {r.estado === 'finalizado' ? 'Finalizado' : 'Activo'}
                </span>
                {r.desde && <span className="text-[12px] text-slate-500" style={{ fontFamily: 'ui-monospace, monospace' }}>desde {new Date(r.desde + 'T12:00:00').toLocaleDateString('es-EC')}</span>}
                {(r.sesionesTotales || r.sesionesCumplidas) && (
                  <span className="text-[12px] text-slate-500">Sesiones: {r.sesionesCumplidas || '0'}{r.sesionesTotales ? ` / ${r.sesionesTotales}` : ''}</span>
                )}
                <div className="ml-auto flex gap-1.5">
                  <button onClick={() => abrirEditar(r)} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg border-none cursor-pointer"><Pencil size={12} /></button>
                  <button onClick={() => eliminar(r)} className="px-2 py-1 bg-red-50 text-red-500 rounded-lg border-none cursor-pointer"><X size={12} /></button>
                </div>
              </div>
              {r.indicacion && <p className="m-0 mt-1.5 text-[13px] font-semibold text-slate-800">{r.indicacion}</p>}
              <div className="flex gap-x-4 gap-y-1 mt-1 flex-wrap text-[12px] text-slate-500">
                {r.dias?.length > 0 && <span><strong className="text-slate-600">Días:</strong> {r.dias.join(', ')}</span>}
                {r.horario && <span><strong className="text-slate-600">Horario:</strong> {r.horario}</span>}
                {r.centro && <span><strong className="text-slate-600">Centro:</strong> {r.centro}</span>}
                {(r.permisosGenerados?.length ?? 0) > 0 && <span><strong className="text-slate-600">Permisos generados:</strong> {r.permisosGenerados!.length}</span>}
              </div>
              {r.notas && <p className="m-0 mt-1 text-[12.5px] text-slate-600 whitespace-pre-wrap">{r.notas}</p>}
              <div className="flex gap-2 mt-2.5 flex-wrap">
                {r.certUrl ? (
                  <button onClick={() => onVerPdf?.(r.certUrl!, r.certNombre || 'certificado.pdf')} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-100 text-green-700 rounded-lg text-[11.5px] font-semibold border-none cursor-pointer">
                    <FileText size={12} /> Ver certificado
                  </button>
                ) : (
                  <button disabled={subiendoCert === r.id} onClick={() => { setRegParaCert(r); certInputRef.current?.click(); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-[11.5px] font-semibold border-none cursor-pointer disabled:opacity-50">
                    <Upload size={12} /> {subiendoCert === r.id ? 'Subiendo…' : 'Subir certificado'}
                  </button>
                )}
                <button onClick={() => { setPermisoPara(r); setPermisoFecha(new Date().toISOString().slice(0, 10)); setPermisoHoras(2); }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold text-white border-none cursor-pointer" style={{ background: '#6b4ba3' }}>
                  <CalendarDays size={12} /> Generar permiso interno
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <input ref={certInputRef} type="file" accept="application/pdf,image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f && regParaCert) subirCert(regParaCert, f); setRegParaCert(null); e.target.value = ''; }} />

      {/* Modal registrar / editar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-0 md:p-4">
          <div className="bg-white w-full h-full md:h-auto md:rounded-xl shadow-xl md:max-w-2xl md:max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center px-5 py-4 border-b shrink-0">
              <h2 className="m-0 text-base font-bold text-slate-800">{editando ? 'Editar tratamiento' : 'Registrar fisioterapia'}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Zona trabajada</label>
                  <input list="zonas-fisio" value={form.zona} onChange={e => setForm(p => ({ ...p, zona: e.target.value }))} className={inputCls} placeholder="Rodilla, columna lumbar…" />
                  <datalist id="zonas-fisio">{ZONAS_FISIOTERAPIA.map(z => <option key={z} value={z} />)}</datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Centro de fisioterapia</label>
                  <input type="text" value={form.centro} onChange={e => setForm(p => ({ ...p, centro: e.target.value }))} className={inputCls} placeholder="Centro / fisioterapeuta (opcional)" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Indicación médica / diagnóstico</label>
                <input type="text" value={form.indicacion} onChange={e => setForm(p => ({ ...p, indicacion: e.target.value }))} className={inputCls} placeholder="Ej. Tendinopatía rotuliana — 10 sesiones…" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Días indicados</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DIAS_SEMANA.map(d => (
                    <button key={d} type="button"
                      onClick={() => setForm(p => ({ ...p, dias: p.dias.includes(d) ? p.dias.filter(x => x !== d) : [...p.dias, d] }))}
                      className={`px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${form.dias.includes(d) ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-300'}`}
                      style={form.dias.includes(d) ? { background: ACC } : {}}>
                      {d.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Hora desde</label>
                  <input type="time" value={form.horaDesde} onChange={e => setForm(p => ({ ...p, horaDesde: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Hora hasta</label>
                  <input type="time" value={form.horaHasta} onChange={e => setForm(p => ({ ...p, horaHasta: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Inicio</label>
                  <input type="date" value={form.desde} onChange={e => setForm(p => ({ ...p, desde: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Sesiones (real./tot.)</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} value={form.sesionesCumplidas} onChange={e => setForm(p => ({ ...p, sesionesCumplidas: e.target.value }))} className={inputCls} placeholder="0" />
                    <span className="text-slate-400">/</span>
                    <input type="number" min={0} value={form.sesionesTotales} onChange={e => setForm(p => ({ ...p, sesionesTotales: e.target.value }))} className={inputCls} placeholder="10" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notas</label>
                <textarea rows={2} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className={inputCls} placeholder="Evolución, tolerancia, observaciones…" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Estado</label>
                <div className="flex gap-2">
                  {([['activo', 'Activo'], ['finalizado', 'Finalizado']] as const).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setForm(p => ({ ...p, estado: v }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border-2 transition-colors ${form.estado === v ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t bg-slate-50 shrink-0 md:rounded-b-xl">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 text-slate-700 rounded-lg">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="px-5 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50" style={{ background: ACC }}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal generar permiso interno */}
      {permisoPara && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center px-5 py-4 border-b">
              <h2 className="m-0 text-base font-bold text-slate-800">Permiso interno para fisioterapia</h2>
              <button onClick={() => setPermisoPara(null)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-5 space-y-3.5">
              <p className="m-0 text-xs text-slate-500 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                Se creará una <strong>cita médica</strong> en el módulo de Permisos con motivo «Fisioterapia — {permisoPara.zona}»{permisoPara.certUrl ? ', justificada con el certificado adjunto' : ''}.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de la sesión</label>
                <input type="date" value={permisoFecha} onChange={e => setPermisoFecha(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Duración (horas)</label>
                <input type="number" min={1} max={8} value={permisoHoras} onChange={e => setPermisoHoras(Number(e.target.value))} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t bg-slate-50 rounded-b-xl">
              <button onClick={() => setPermisoPara(null)} className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 text-slate-700 rounded-lg">Cancelar</button>
              <button onClick={generarPermiso} disabled={creandoPermiso} className="px-5 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50" style={{ background: '#6b4ba3' }}>
                {creandoPermiso ? 'Generando…' : 'Generar permiso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
