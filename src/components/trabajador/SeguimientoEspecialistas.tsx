// Pestaña "Especialistas" de la ficha del trabajador: seguimiento de las
// evaluaciones con médicos particulares/especialistas — fecha, especialidad,
// notas, plan de seguimiento y cita de control. Autocontenido: carga y guarda
// sus propios datos (colección `consultasEspecialista`).
import { useState, useEffect, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Stethoscope, Plus, Pencil, X, CalendarDays } from 'lucide-react';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import {
  getConsultasEspecialista, crearConsultaEspecialista, actualizarConsultaEspecialista, eliminarConsultaEspecialista,
} from '../../services/seguimientos';
import { ESPECIALIDADES_FRECUENTES } from '../../types/seguimiento';
import type { ConsultaEspecialista } from '../../types/seguimiento';

const fmtF = (f: any): string => {
  if (!f) return '—';
  const d = f?.seconds ? new Date(f.seconds * 1000) : f instanceof Date ? f : new Date(f);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
};

interface FormularioEsp {
  fecha: string;
  especialidad: string;
  medico: string;
  centro: string;
  motivo: string;
  notas: string;
  seguimiento: string;
  proximaCita: string;
  estado: 'en_seguimiento' | 'alta';
}

const formVacio = (): FormularioEsp => ({
  fecha: new Date().toISOString().slice(0, 10),
  especialidad: '', medico: '', centro: '', motivo: '', notas: '', seguimiento: '',
  proximaCita: '', estado: 'en_seguimiento',
});

export default function SeguimientoEspecialistas({ trabajadorId }: { trabajadorId: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { user, nombreProfesional } = useAuth();

  const [consultas, setConsultas] = useState<ConsultaEspecialista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<ConsultaEspecialista | null>(null);
  const [form, setForm] = useState<FormularioEsp>(formVacio());

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setConsultas(await getConsultasEspecialista(trabajadorId)); }
    catch (err) { console.error('Error al cargar seguimientos:', err); }
    finally { setCargando(false); }
  }, [trabajadorId]);
  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => { setEditando(null); setForm(formVacio()); setModal(true); };
  const abrirEditar = (c: ConsultaEspecialista) => {
    setEditando(c);
    const d = c.fecha?.seconds ? new Date(c.fecha.seconds * 1000) : new Date(c.fecha);
    setForm({
      fecha: isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10),
      especialidad: c.especialidad || '', medico: c.medico || '', centro: c.centro || '',
      motivo: c.motivo || '', notas: c.notas || '', seguimiento: c.seguimiento || '',
      proximaCita: c.proximaCita || '', estado: c.estado || 'en_seguimiento',
    });
    setModal(true);
  };

  const guardar = async () => {
    if (!form.especialidad.trim() && !form.motivo.trim()) { toast.warning('Indica al menos la especialidad o el motivo.'); return; }
    if (!form.fecha) { toast.warning('Indica la fecha de la consulta.'); return; }
    setGuardando(true);
    try {
      const data = {
        trabajadorId,
        fecha: Timestamp.fromDate(new Date(form.fecha + 'T12:00:00')),
        especialidad: form.especialidad.trim(),
        medico: form.medico.trim(),
        centro: form.centro.trim(),
        motivo: form.motivo.trim(),
        notas: form.notas.trim(),
        seguimiento: form.seguimiento.trim(),
        proximaCita: form.proximaCita,
        estado: form.estado,
        medicoId: user?.uid ?? '',
        medicoNombre: nombreProfesional,
      };
      if (editando?.id) await actualizarConsultaEspecialista(editando.id, data);
      else await crearConsultaEspecialista(data);
      toast.success(editando ? 'Seguimiento actualizado.' : 'Seguimiento registrado.');
      setModal(false);
      cargar();
    } catch (err) { console.error(err); toast.error('No se pudo guardar el seguimiento.'); }
    finally { setGuardando(false); }
  };

  const eliminar = async (c: ConsultaEspecialista) => {
    if (!c.id) return;
    if (!(await confirm({ message: `¿Eliminar la consulta de ${c.especialidad || 'especialista'} del ${fmtF(c.fecha)}?`, danger: true }))) return;
    try { await eliminarConsultaEspecialista(c.id); toast.success('Seguimiento eliminado.'); cargar(); }
    catch { toast.error('No se pudo eliminar.'); }
  };

  const proximas = consultas.filter(c => c.proximaCita && new Date(c.proximaCita + 'T23:59:59') >= new Date() && c.estado !== 'alta');
  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="bg-white border rounded-[13px] overflow-hidden" style={{ borderColor: '#e4e6ea' }}>
      <div className="flex items-center gap-2.5 px-[18px] py-[15px] border-b" style={{ borderColor: '#e4e6ea' }}>
        <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px]" style={{ background: '#2a4d8f16', color: '#2a4d8f' }}><Stethoscope size={17} /></span>
        <h3 className="m-0 text-[17px] font-semibold tracking-tight" style={{ fontFamily: "'Spectral', Georgia, serif" }}>Médicos particulares / especialistas</h3>
        <span className="text-[11px] font-bold px-2 py-px rounded-full bg-slate-100 text-slate-500">{consultas.length}</span>
        <button onClick={abrirNuevo} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-white border-none rounded-lg text-[12.5px] font-bold cursor-pointer" style={{ background: '#2a4d8f' }}>
          <Plus size={14} /> Registrar consulta
        </button>
      </div>

      {/* Citas de control próximas */}
      {proximas.length > 0 && (
        <div className="px-[18px] py-2.5 flex items-start gap-2 text-[12px] border-b" style={{ background: '#f0f4fb', borderColor: '#e4e6ea', color: '#2a4d8f' }}>
          <CalendarDays size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            <strong>Citas de control pendientes:</strong>{' '}
            {proximas.map(c => `${c.especialidad || 'Especialista'} — ${new Date(c.proximaCita + 'T12:00:00').toLocaleDateString('es-EC')}`).join(' · ')}
          </div>
        </div>
      )}

      {cargando ? (
        <div className="p-6 text-center text-[12.5px] text-slate-400">Cargando…</div>
      ) : consultas.length === 0 ? (
        <div className="p-6 text-center text-[12.5px] text-slate-400">
          Sin consultas con especialistas registradas. Usa «Registrar consulta» para llevar el seguimiento de las valoraciones por médicos particulares.
        </div>
      ) : (
        <div>
          {consultas.map((c, i) => (
            <div key={c.id} className="px-[18px] py-3.5" style={{ borderTop: i > 0 ? '1px solid #eef0f3' : 'none' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#eaf0f9', color: '#2a4d8f' }}>{c.especialidad || 'Especialista'}</span>
                <span className="text-[12px] text-slate-500" style={{ fontFamily: 'ui-monospace, monospace' }}>{fmtF(c.fecha)}</span>
                {c.medico && <span className="text-[12px] text-slate-500">Dr(a). {c.medico}</span>}
                {c.centro && <span className="text-[11.5px] text-slate-400">· {c.centro}</span>}
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${c.estado === 'alta' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {c.estado === 'alta' ? 'Alta' : 'En seguimiento'}
                </span>
                <div className="ml-auto flex gap-1.5">
                  <button onClick={() => abrirEditar(c)} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg border-none cursor-pointer"><Pencil size={12} /></button>
                  <button onClick={() => eliminar(c)} className="px-2 py-1 bg-red-50 text-red-500 rounded-lg border-none cursor-pointer"><X size={12} /></button>
                </div>
              </div>
              {c.motivo && <p className="m-0 mt-1.5 text-[13px] font-semibold text-slate-800">{c.motivo}</p>}
              {c.notas && <p className="m-0 mt-1 text-[12.5px] text-slate-600 whitespace-pre-wrap">{c.notas}</p>}
              <div className="flex gap-4 mt-1.5 flex-wrap text-[12px] text-slate-500">
                {c.seguimiento && <span><strong className="text-slate-600">Seguimiento:</strong> {c.seguimiento}</span>}
                {c.proximaCita && <span><strong className="text-slate-600">Cita de control:</strong> {new Date(c.proximaCita + 'T12:00:00').toLocaleDateString('es-EC')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal registrar / editar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-0 md:p-4">
          <div className="bg-white w-full h-full md:h-auto md:rounded-xl shadow-xl md:max-w-2xl md:max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center px-5 py-4 border-b shrink-0">
              <h2 className="m-0 text-base font-bold text-slate-800">{editando ? 'Editar seguimiento' : 'Registrar consulta con especialista'}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de la consulta</label>
                  <input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Especialidad</label>
                  <input list="especialidades" value={form.especialidad} onChange={e => setForm(p => ({ ...p, especialidad: e.target.value }))} className={inputCls} placeholder="Traumatología, Cardiología…" />
                  <datalist id="especialidades">{ESPECIALIDADES_FRECUENTES.map(e => <option key={e} value={e} />)}</datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Médico especialista</label>
                  <input type="text" value={form.medico} onChange={e => setForm(p => ({ ...p, medico: e.target.value }))} className={inputCls} placeholder="Nombre del especialista…" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Centro / consultorio</label>
                  <input type="text" value={form.centro} onChange={e => setForm(p => ({ ...p, centro: e.target.value }))} className={inputCls} placeholder="Hospital, clínica… (opcional)" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo / diagnóstico</label>
                <input type="text" value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} className={inputCls} placeholder="Ej. Lumbalgia crónica en estudio…" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notas / observaciones</label>
                <textarea rows={3} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className={inputCls} placeholder="Hallazgos, indicaciones, medicación indicada…" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Seguimiento posterior indicado</label>
                <input type="text" value={form.seguimiento} onChange={e => setForm(p => ({ ...p, seguimiento: e.target.value }))} className={inputCls} placeholder="Ej. control en 3 meses con resonancia…" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cita de control (si hay)</label>
                  <input type="date" value={form.proximaCita} onChange={e => setForm(p => ({ ...p, proximaCita: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Estado</label>
                  <div className="flex gap-2">
                    {([['en_seguimiento', 'En seguimiento'], ['alta', 'Alta']] as const).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setForm(p => ({ ...p, estado: v }))}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border-2 transition-colors ${form.estado === v ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t bg-slate-50 shrink-0 md:rounded-b-xl">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 text-slate-700 rounded-lg">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="px-5 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
