// Pestaña "Fisioterapia" de la ficha del trabajador.
// Un tratamiento se registra con 1 o 2 intervalos de fechas (los fines de
// semana no cuentan); el sistema calcula automáticamente las sesiones (una por
// día laborable). Por cada sesión se puede generar un permiso interno (cita) y
// subir el comprobante físico de ese día. Los permisos aparecen también en el
// módulo de Permisos.
import { useState, useEffect, useCallback, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { HeartPulse, Plus, Pencil, X, Upload, FileText, CalendarDays, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import {
  getFisioterapias, crearFisioterapia, actualizarFisioterapia, eliminarFisioterapia,
  subirCertificadoFisioterapia, subirComprobanteSesion,
} from '../../services/seguimientos';
import { crearPermiso } from '../../services/permisos';
import { ZONAS_FISIOTERAPIA } from '../../types/seguimiento';
import type { RegistroFisioterapia, SesionFisio } from '../../types/seguimiento';
import { fechasDeIntervalos, horasEntre, rangoHorarioTexto } from '../../utils/permisosHorario';

interface Props {
  trabajador: any;   // se usan apellidos/nombres/cedula/puesto para el permiso
  onVerPdf?: (url: string, nombre: string) => void;
}

interface FormularioFisio {
  zona: string;
  indicacion: string;
  centro: string;
  horaDesde: string;
  horaHasta: string;
  int1Desde: string;
  int1Hasta: string;
  usarInt2: boolean;
  int2Desde: string;
  int2Hasta: string;
  notas: string;
  estado: 'activo' | 'finalizado';
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

const formVacio = (): FormularioFisio => ({
  zona: '', indicacion: '', centro: '', horaDesde: '08:00', horaHasta: '09:00',
  int1Desde: hoyISO(), int1Hasta: hoyISO(), usarInt2: false, int2Desde: '', int2Hasta: '',
  notas: '', estado: 'activo',
});

const fmtFechaCorta = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'short', day: '2-digit', month: 'short' });

const ACC = '#0d9488';

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
  const [expandido, setExpandido] = useState<string | null>(null);
  const [generando, setGenerando] = useState<string | null>(null);

  // Subida de comprobantes (orden general o por sesión)
  const certInputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  // Objetivo de la próxima subida: orden general (sesionFecha=null) o una sesión.
  const [objetivoCert, setObjetivoCert] = useState<{ reg: RegistroFisioterapia; sesionFecha: string | null } | null>(null);

  const cargar = useCallback(async () => {
    if (!trabajadorId) return;
    setCargando(true);
    try { setRegistros(await getFisioterapias(trabajadorId)); }
    catch (err) { console.error('Error al cargar fisioterapia:', err); }
    finally { setCargando(false); }
  }, [trabajadorId]);
  useEffect(() => { cargar(); }, [cargar]);

  // Sesiones (fechas laborables) que resultan del formulario actual.
  const intervalosForm = [
    { desde: form.int1Desde, hasta: form.int1Hasta },
    ...(form.usarInt2 ? [{ desde: form.int2Desde, hasta: form.int2Hasta }] : []),
  ];
  const fechasForm = fechasDeIntervalos(intervalosForm);

  const abrirNuevo = () => { setEditando(null); setForm(formVacio()); setModal(true); };

  const abrirEditar = (r: RegistroFisioterapia) => {
    setEditando(r);
    // Intervalos nuevos o, si es un registro antiguo, uno derivado de `desde`.
    const its = r.intervalos?.length ? r.intervalos : (r.desde ? [{ desde: r.desde, hasta: r.desde }] : [{ desde: hoyISO(), hasta: hoyISO() }]);
    const [hd, hh] = r.horaDesde && r.horaHasta ? [r.horaDesde, r.horaHasta] : (r.horario || '').split('–').map(s => s?.trim() ?? '');
    setForm({
      zona: r.zona || '', indicacion: r.indicacion || '', centro: r.centro || '',
      horaDesde: hd || '08:00', horaHasta: hh || '09:00',
      int1Desde: its[0].desde, int1Hasta: its[0].hasta,
      usarInt2: its.length > 1, int2Desde: its[1]?.desde || '', int2Hasta: its[1]?.hasta || '',
      notas: r.notas || '', estado: r.estado || 'activo',
    });
    setModal(true);
  };

  const guardar = async () => {
    if (!form.zona.trim()) { toast.warning('Indica la zona trabajada.'); return; }
    if (fechasForm.length === 0) { toast.warning('El intervalo de fechas no tiene días laborables. Revisa las fechas.'); return; }
    if (horasEntre(form.horaDesde, form.horaHasta) <= 0) { toast.warning('El horario de la sesión no es válido (la hora de fin debe ser posterior).'); return; }
    setGuardando(true);
    try {
      const intervalos = intervalosForm.filter(it => it.desde && it.hasta);
      // Conserva permiso/comprobante de las sesiones que sigan existiendo.
      const previas: Record<string, SesionFisio> = {};
      (editando?.sesiones ?? []).forEach(s => { previas[s.fecha] = s; });
      const sesiones: SesionFisio[] = fechasForm.map(fecha => previas[fecha] ?? { fecha });

      const data = {
        trabajadorId,
        zona: form.zona.trim(),
        indicacion: form.indicacion.trim(),
        centro: form.centro.trim(),
        intervalos,
        horaDesde: form.horaDesde,
        horaHasta: form.horaHasta,
        sesiones,
        notas: form.notas.trim(),
        estado: form.estado,
        medicoId: user?.uid ?? '',
        medicoNombre: nombreProfesional,
        ...(editando ? {} : { certUrl: '', certPath: '', certNombre: '' }),
      };
      if (editando?.id) await actualizarFisioterapia(editando.id, data);
      else await crearFisioterapia(data);
      toast.success(editando ? 'Tratamiento actualizado.' : `Fisioterapia registrada: ${sesiones.length} sesiones.`);
      setModal(false);
      cargar();
    } catch (err) { console.error(err); toast.error('No se pudo guardar el registro.'); }
    finally { setGuardando(false); }
  };

  const eliminar = async (r: RegistroFisioterapia) => {
    if (!(await confirm({ message: `¿Eliminar el tratamiento de fisioterapia (${r.zona}) y sus ${r.sesiones?.length ?? 0} sesiones? Los permisos ya emitidos no se eliminan.`, danger: true }))) return;
    try { await eliminarFisioterapia(r); toast.success('Registro eliminado.'); cargar(); }
    catch { toast.error('No se pudo eliminar.'); }
  };

  // Comprobante: orden general del tratamiento o comprobante físico de una sesión.
  const lanzarSubida = (reg: RegistroFisioterapia, sesionFecha: string | null) => {
    setObjetivoCert({ reg, sesionFecha });
    certInputRef.current?.click();
  };
  const onArchivo = async (file: File) => {
    if (!objetivoCert) return;
    const { reg, sesionFecha } = objetivoCert;
    setObjetivoCert(null);
    setSubiendo(sesionFecha ? `${reg.id}:${sesionFecha}` : `${reg.id}:orden`);
    try {
      if (sesionFecha) await subirComprobanteSesion(reg, sesionFecha, file);
      else await subirCertificadoFisioterapia(reg, file);
      toast.success('Comprobante adjuntado.');
      cargar();
    } catch (err: any) {
      console.error('Error al subir comprobante de fisioterapia:', err);
      toast.error(err?.code === 'storage/unauthorized'
        ? 'Storage rechazó la subida: publica las reglas de Storage actualizadas (ruta fisioterapia/).'
        : 'No se pudo subir el comprobante.');
    } finally { setSubiendo(null); }
  };

  // Genera un permiso interno (cita) por cada sesión que aún no lo tenga.
  const generarPermisos = async (reg: RegistroFisioterapia) => {
    if (!reg.id) return;
    const pendientes = (reg.sesiones ?? []).filter(s => !s.permisoId);
    if (pendientes.length === 0) { toast.info?.('Todas las sesiones ya tienen permiso.'); return; }
    if (!(await confirm({ message: `Se generarán ${pendientes.length} permiso(s) interno(s) de cita (${rangoHorarioTexto(reg.horaDesde, reg.horaHasta)}), uno por sesión. ¿Continuar?` }))) return;
    setGenerando(reg.id);
    try {
      const horas = horasEntre(reg.horaDesde, reg.horaHasta) || 1;
      const nuevas = [...(reg.sesiones ?? [])];
      for (let i = 0; i < nuevas.length; i++) {
        const s = nuevas[i];
        if (s.permisoId) continue;
        const d = new Date(s.fecha + 'T08:00:00');
        const permisoId = await crearPermiso({
          trabajadorId,
          apellidos: `${trabajador.primerApellido ?? ''} ${trabajador.segundoApellido ?? ''}`.trim(),
          nombres: `${trabajador.primerNombre ?? ''} ${trabajador.segundoNombre ?? ''}`.trim(),
          cedula: trabajador.cedula ?? '',
          puesto: trabajador.puestoTrabajo ?? '',
          area: trabajador.departamento ?? '',
          tipo: 'cita',
          desde: Timestamp.fromDate(d),
          hasta: Timestamp.fromDate(d),
          unidad: 'horas',
          dias: 0,
          horas,
          horaDesde: reg.horaDesde,
          horaHasta: reg.horaHasta,
          motivo: `Fisioterapia — ${reg.zona}${reg.centro ? ` (${reg.centro})` : ''}`,
          origen: 'Interno',
          // Justificado si esa sesión ya tiene comprobante físico, o la orden general.
          certAdjunto: !!(s.certUrl || reg.certUrl),
          ...(s.certUrl ? { certUrl: s.certUrl, certNombreArchivo: s.certNombre ?? 'comprobante' }
            : reg.certUrl ? { certUrl: reg.certUrl, certNombreArchivo: reg.certNombre ?? 'orden' } : {}),
          medicoId: user?.uid ?? '',
          medicoNombre: nombreProfesional,
        } as any);
        nuevas[i] = { ...s, permisoId };
      }
      await actualizarFisioterapia(reg.id, { sesiones: nuevas });
      toast.success(`${pendientes.length} permiso(s) generados. Visibles en la pestaña Permisos.`);
      cargar();
    } catch (err) { console.error(err); toast.error('No se pudieron generar los permisos.'); }
    finally { setGenerando(null); }
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-600/40';

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
          Sin tratamientos de fisioterapia registrados. Registra la zona, el horario y uno o dos intervalos de fechas: el sistema calcula las sesiones, genera los permisos internos y guarda los comprobantes por día.
        </div>
      ) : (
        <div>
          {registros.map((r, i) => {
            const sesiones = r.sesiones ?? [];
            const conPermiso = sesiones.filter(s => s.permisoId).length;
            const conComprobante = sesiones.filter(s => s.certUrl).length;
            const abierto = expandido === r.id;
            return (
              <div key={r.id} className="px-[18px] py-3.5" style={{ borderTop: i > 0 ? '1px solid #eef0f3' : 'none' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${ACC}14`, color: ACC }}>{r.zona}</span>
                  <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${r.estado === 'finalizado' ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'}`}>
                    {r.estado === 'finalizado' ? 'Finalizado' : 'Activo'}
                  </span>
                  {sesiones.length > 0 && <span className="text-[12px] text-slate-500"><strong>{sesiones.length}</strong> sesiones</span>}
                  {(r.horaDesde && r.horaHasta) && <span className="text-[12px] text-slate-500">{rangoHorarioTexto(r.horaDesde, r.horaHasta)}</span>}
                  <div className="ml-auto flex gap-1.5">
                    <button onClick={() => abrirEditar(r)} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg border-none cursor-pointer"><Pencil size={12} /></button>
                    <button onClick={() => eliminar(r)} className="px-2 py-1 bg-red-50 text-red-500 rounded-lg border-none cursor-pointer"><X size={12} /></button>
                  </div>
                </div>
                {r.indicacion && <p className="m-0 mt-1.5 text-[13px] font-semibold text-slate-800">{r.indicacion}</p>}
                <div className="flex gap-x-4 gap-y-1 mt-1 flex-wrap text-[12px] text-slate-500">
                  {r.centro && <span><strong className="text-slate-600">Centro:</strong> {r.centro}</span>}
                  {sesiones.length > 0 && <span><strong className="text-slate-600">Permisos:</strong> {conPermiso}/{sesiones.length}</span>}
                  {sesiones.length > 0 && <span><strong className="text-slate-600">Comprobantes:</strong> {conComprobante}/{sesiones.length}</span>}
                </div>
                {r.notas && <p className="m-0 mt-1 text-[12.5px] text-slate-600 whitespace-pre-wrap">{r.notas}</p>}

                <div className="flex gap-2 mt-2.5 flex-wrap">
                  {sesiones.length > 0 && (
                    <button onClick={() => setExpandido(abierto ? null : (r.id ?? null))} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-[11.5px] font-semibold border-none cursor-pointer">
                      {abierto ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {abierto ? 'Ocultar' : 'Ver'} sesiones ({sesiones.length})
                    </button>
                  )}
                  <button onClick={() => generarPermisos(r)} disabled={generando === r.id || conPermiso === sesiones.length}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold text-white border-none cursor-pointer disabled:opacity-50" style={{ background: '#6b4ba3' }}>
                    <CalendarDays size={12} /> {generando === r.id ? 'Generando…' : conPermiso === sesiones.length && sesiones.length > 0 ? 'Permisos generados' : `Generar ${sesiones.length - conPermiso} permiso(s)`}
                  </button>
                  {r.certUrl ? (
                    <button onClick={() => onVerPdf?.(r.certUrl!, r.certNombre || 'orden.pdf')} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-100 text-green-700 rounded-lg text-[11.5px] font-semibold border-none cursor-pointer">
                      <FileText size={12} /> Orden médica
                    </button>
                  ) : (
                    <button disabled={subiendo === `${r.id}:orden`} onClick={() => lanzarSubida(r, null)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[11.5px] font-semibold border border-slate-200 cursor-pointer disabled:opacity-50">
                      <Upload size={12} /> {subiendo === `${r.id}:orden` ? 'Subiendo…' : 'Subir orden médica'}
                    </button>
                  )}
                </div>

                {/* Sesiones expandidas: cada día con su permiso y comprobante */}
                {abierto && (
                  <div className="mt-2.5 border rounded-lg overflow-hidden" style={{ borderColor: '#e4e6ea' }}>
                    {sesiones.map((s, j) => (
                      <div key={s.fecha} className="flex items-center gap-2.5 px-3 py-2 text-[12px]" style={{ borderTop: j > 0 ? '1px solid #eef0f3' : 'none', background: j % 2 ? '#fafbfc' : '#fff' }}>
                        <span className="font-semibold text-slate-700 capitalize min-w-[120px]">{fmtFechaCorta(s.fecha)}</span>
                        {s.permisoId
                          ? <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700"><Check size={11} /> Permiso</span>
                          : <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">Sin permiso</span>}
                        <div className="ml-auto">
                          {s.certUrl ? (
                            <button onClick={() => onVerPdf?.(s.certUrl!, s.certNombre || 'comprobante.pdf')} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md text-[10.5px] font-semibold border-none cursor-pointer">
                              <FileText size={11} /> Ver comprobante
                            </button>
                          ) : (
                            <button disabled={subiendo === `${r.id}:${s.fecha}`} onClick={() => lanzarSubida(r, s.fecha)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-[10.5px] font-semibold border-none cursor-pointer disabled:opacity-50">
                              <Upload size={11} /> {subiendo === `${r.id}:${s.fecha}` ? 'Subiendo…' : 'Subir comprobante'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <input ref={certInputRef} type="file" accept="application/pdf,image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onArchivo(f); e.target.value = ''; }} />

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
                <input type="text" value={form.indicacion} onChange={e => setForm(p => ({ ...p, indicacion: e.target.value }))} className={inputCls} placeholder="Ej. Tendinopatía rotuliana…" />
              </div>

              {/* Horario de cada sesión */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Horario de cada sesión (para el permiso)</label>
                <div className="flex items-center gap-1.5 max-w-xs">
                  <input type="time" value={form.horaDesde} onChange={e => setForm(p => ({ ...p, horaDesde: e.target.value }))} className={inputCls} />
                  <span className="text-slate-400 font-bold">–</span>
                  <input type="time" value={form.horaHasta} onChange={e => setForm(p => ({ ...p, horaHasta: e.target.value }))} className={inputCls} />
                </div>
              </div>

              {/* Intervalos de fechas */}
              <div className="rounded-lg border p-3.5" style={{ borderColor: '#e4e6ea', background: '#f9fafb' }}>
                <label className="block text-xs font-bold text-slate-700 mb-2">Fechas del tratamiento</label>
                <p className="m-0 mb-2.5 text-[11px] text-slate-500">Los sábados y domingos se excluyen automáticamente del conteo de sesiones.</p>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-[11px] font-semibold text-slate-500 min-w-[70px]">Intervalo 1</span>
                  <input type="date" value={form.int1Desde} onChange={e => setForm(p => ({ ...p, int1Desde: e.target.value }))} className={inputCls + ' max-w-[160px]'} />
                  <span className="text-slate-400 font-bold">→</span>
                  <input type="date" value={form.int1Hasta} onChange={e => setForm(p => ({ ...p, int1Hasta: e.target.value }))} className={inputCls + ' max-w-[160px]'} />
                </div>
                {form.usarInt2 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-500 min-w-[70px]">Intervalo 2</span>
                    <input type="date" value={form.int2Desde} onChange={e => setForm(p => ({ ...p, int2Desde: e.target.value }))} className={inputCls + ' max-w-[160px]'} />
                    <span className="text-slate-400 font-bold">→</span>
                    <input type="date" value={form.int2Hasta} onChange={e => setForm(p => ({ ...p, int2Hasta: e.target.value }))} className={inputCls + ' max-w-[160px]'} />
                    <button type="button" onClick={() => setForm(p => ({ ...p, usarInt2: false, int2Desde: '', int2Hasta: '' }))} className="text-red-400 hover:text-red-600 text-xs font-bold px-1">✕ quitar</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setForm(p => ({ ...p, usarInt2: true, int2Desde: hoyISO(), int2Hasta: hoyISO() }))} className="text-[12px] font-semibold hover:underline" style={{ color: ACC }}>
                    + Agregar segundo intervalo
                  </button>
                )}
                <div className="mt-3 pt-2.5 border-t flex items-center gap-2" style={{ borderColor: '#e4e6ea' }}>
                  <span className="text-[13px] font-bold" style={{ color: ACC }}>{fechasForm.length} sesiones</span>
                  <span className="text-[11px] text-slate-400">calculadas automáticamente (lun–vie)</span>
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
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : `Registrar ${fechasForm.length} sesiones`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
