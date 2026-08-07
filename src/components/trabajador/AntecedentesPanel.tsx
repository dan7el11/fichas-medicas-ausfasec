// Pestaña "Antecedentes" de la ficha del trabajador: administra el expediente
// de antecedentes secuencial (colección `antecedentes`). Permite editar o
// eliminar de forma simplificada la información que se autocompleta en cada
// evaluación. Fuente única: lo que se edite aquí es lo que se precargará.
import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Save, Trash2, Plus, X, Pencil } from 'lucide-react';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { getExpedienteAntecedentes, guardarExpedienteAntecedentes, eliminarExpedienteAntecedentes } from '../../services/antecedentes';
import { GRUPOS_SANGUINEOS, LATERALIDADES, emptyAntecedenteEmpleo, emptyDatosPersonales } from '../../utils/catalogosEvaluacion';
import type { ExpedienteAntecedentes, AntecedenteEmpleo } from '../../types';

const BRAND = '#0d6b5f';
const input = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-600/30';
const inputXs = 'w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs';

const fmt = (f: any): string => {
  if (!f) return '—';
  const d = f?.seconds ? new Date(f.seconds * 1000) : f instanceof Date ? f : new Date(f);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function AntecedentesPanel({ trabajadorId, sexo }: { trabajadorId: string; sexo?: 'M' | 'F' }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();

  const [exp, setExp] = useState<ExpedienteAntecedentes | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [borrador, setBorrador] = useState<ExpedienteAntecedentes | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setExp(await getExpedienteAntecedentes(trabajadorId)); }
    catch (err) { console.error('Error al cargar antecedentes:', err); }
    finally { setCargando(false); }
  }, [trabajadorId]);
  useEffect(() => { cargar(); }, [cargar]);

  const empezarEdicion = () => {
    setBorrador(exp ? JSON.parse(JSON.stringify(exp)) : { trabajadorId, datosPersonales: emptyDatosPersonales(), habitosToxicos: [
      { tipo: 'tabaco', consume: false, tiempoConsumo: '', cantidad: '', exConsumidor: false, tiempoAbstinencia: '' },
      { tipo: 'alcohol', consume: false, tiempoConsumo: '', cantidad: '', exConsumidor: false, tiempoAbstinencia: '' },
      { tipo: 'drogas', consume: false, tiempoConsumo: '', cantidad: '', exConsumidor: false, tiempoAbstinencia: '' },
    ] });
    setEditando(true);
  };

  const guardar = async () => {
    if (!borrador) return;
    setGuardando(true);
    try {
      await guardarExpedienteAntecedentes({ ...borrador, trabajadorId }, user?.uid ?? '');
      toast.success('Antecedentes actualizados.');
      setEditando(false);
      cargar();
    } catch (err) { console.error(err); toast.error('No se pudieron guardar los antecedentes.'); }
    finally { setGuardando(false); }
  };

  const eliminarTodo = async () => {
    if (!(await confirm({ message: '¿Eliminar TODO el expediente de antecedentes de este trabajador? Las evaluaciones ya guardadas no se modifican.', danger: true }))) return;
    try { await eliminarExpedienteAntecedentes(trabajadorId); toast.success('Expediente de antecedentes eliminado.'); setExp(null); }
    catch { toast.error('No se pudo eliminar.'); }
  };

  // Helpers de edición del borrador
  const setB = (patch: Partial<ExpedienteAntecedentes>) => setBorrador(prev => ({ ...(prev as ExpedienteAntecedentes), ...patch }));
  const setDP = (patch: any) => setBorrador(prev => ({ ...(prev as any), datosPersonales: { ...(prev?.datosPersonales ?? {}), ...patch } }));
  const setCE = (patch: any) => setBorrador(prev => ({ ...(prev as any), condicionEspecial: { ...(prev?.condicionEspecial ?? {}), ...patch } }));
  const setHab = (i: number, f: string, v: any) => setBorrador(prev => { const h = [...(prev?.habitosToxicos ?? [])]; h[i] = { ...h[i], [f]: v }; return { ...(prev as any), habitosToxicos: h }; });
  const setEmp = (i: number, f: keyof AntecedenteEmpleo, v: any) => setBorrador(prev => { const e = [...(prev?.antecedentesEmpleos ?? [])]; e[i] = { ...e[i], [f]: v }; return { ...(prev as any), antecedentesEmpleos: e }; });

  return (
    <div className="bg-white border rounded-[13px] overflow-hidden" style={{ borderColor: '#e4e6ea' }}>
      <div className="flex items-center gap-2.5 px-[18px] py-[15px] border-b" style={{ borderColor: '#e4e6ea' }}>
        <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px]" style={{ background: `${BRAND}16`, color: BRAND }}><ClipboardList size={17} /></span>
        <h3 className="m-0 text-[17px] font-semibold tracking-tight" style={{ fontFamily: "'Spectral', Georgia, serif" }}>Antecedentes del trabajador</h3>
        {exp?.actualizadoEn && <span className="text-[11px] text-slate-400">actualizado {fmt(exp.actualizadoEn)}</span>}
        <div className="ml-auto flex gap-1.5">
          {!editando ? (
            <>
              <button onClick={empezarEdicion} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white border-none rounded-lg text-[12.5px] font-bold cursor-pointer" style={{ background: BRAND }}>
                <Pencil size={13} /> {exp ? 'Editar' : 'Crear'}
              </button>
              {exp && <button onClick={eliminarTodo} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-[12.5px] font-semibold border-none cursor-pointer"><Trash2 size={13} /></button>}
            </>
          ) : (
            <>
              <button onClick={() => setEditando(false)} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 rounded-lg text-[12.5px] font-semibold cursor-pointer">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg text-[12.5px] font-bold border-none cursor-pointer disabled:opacity-50" style={{ background: BRAND }}><Save size={13} /> {guardando ? 'Guardando…' : 'Guardar'}</button>
            </>
          )}
        </div>
      </div>

      <p className="px-[18px] pt-3 m-0 text-[11.5px] text-slate-400">
        Este expediente se autocompleta en cada nueva evaluación. Edítalo aquí para corregir o depurar la información que se arrastra.
      </p>

      {cargando ? (
        <div className="p-6 text-center text-[12.5px] text-slate-400">Cargando…</div>
      ) : !editando ? (
        // ── VISTA (solo lectura) ──
        !exp ? (
          <div className="p-6 text-center text-[12.5px] text-slate-400">Aún no hay antecedentes registrados. Se crearán con la primera evaluación, o pulsa «Crear».</div>
        ) : (
          <div className="p-[18px] pt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Bloque titulo="Datos personales">{[
              exp.datosPersonales?.grupoSanguineo && `Grupo sanguíneo: ${exp.datosPersonales.grupoSanguineo}`,
              exp.datosPersonales?.lateralidad && `Lateralidad: ${exp.datosPersonales.lateralidad}`,
              exp.datosPersonales?.gruposPrioritarios?.length ? `Prioritario: ${exp.datosPersonales.gruposPrioritarios.join(', ')}` : '',
            ].filter(Boolean) as string[]}</Bloque>
            <Bloque titulo="Condición especial (urgencias)">{[
              exp.condicionEspecial?.autorizaTransfusiones != null && `Transfusiones: ${exp.condicionEspecial.autorizaTransfusiones ? 'autoriza' : 'no autoriza'}`,
              exp.condicionEspecial?.tratamientoHormonal === true && `Tratamiento hormonal: ${exp.condicionEspecial.tratamientoHormonalCual || 'sí'}`,
              exp.condicionEspecial?.condicionPreexistente && `Preexistente: ${exp.condicionEspecial.condicionPreexistente}`,
            ].filter(Boolean) as string[]}</Bloque>
            <BloqueTexto titulo="Clínicos, quirúrgicos y alergias" texto={exp.antecedentesClinicosTexto} />
            <Bloque titulo="Detalle registrado">{[
              exp.antecedentesClinicosQ != null && `Clínicos: ${exp.antecedentesClinicosQ ? `${exp.antecedentesClinicosLista?.length ?? 0} registrado(s)` : 'no refiere'}`,
              exp.alergiasTiene != null && `Alergias: ${exp.alergiasTiene ? `${exp.alergias?.length ?? 0} registrada(s)` : 'no refiere'}`,
              exp.antecedentesQuirurgicosQ != null && `Quirúrgicos: ${exp.antecedentesQuirurgicosQ ? `${exp.antecedentesQuirurgicosLista?.length ?? 0} registrado(s)` : 'no refiere'}`,
            ].filter(Boolean) as string[]}</Bloque>
            <BloqueTexto titulo="Familiares" texto={exp.antecedentesFamiliaresTexto} />
            <Bloque titulo="Hábitos / estilo de vida">{[
              ...(exp.habitosToxicos ?? []).filter(h => h.consume || h.exConsumidor).map(h => `${h.tipo === 'drogas' ? 'otras' : h.tipo}${h.consume ? ` (${h.cantidad || 'consume'})` : ' (ex)'}`),
              exp.estiloVida?.actividadFisica && `Actividad física: ${exp.estiloVida.tipoActividad || 'sí'}`,
              exp.estiloVida?.medicacionHabitual && `Medicación: ${exp.estiloVida.medicacionHabitual}`,
            ].filter(Boolean) as string[]}</Bloque>
            {sexo === 'F' && exp.antecedentesGineco && (
              <Bloque titulo="Gineco-obstétricos">{[
                `G${exp.antecedentesGineco.gestas || 0} P${exp.antecedentesGineco.partos || 0} C${exp.antecedentesGineco.cesareas || 0} A${exp.antecedentesGineco.abortos || 0}`,
                exp.antecedentesGineco.papanicolaou?.realizado === true && `PAP: ${exp.antecedentesGineco.papanicolaou.resultado || 'realizado'}`,
              ].filter(Boolean) as string[]}</Bloque>
            )}
            <Bloque titulo="Empleos anteriores / actual">{(exp.antecedentesEmpleos ?? []).map(e => `${e.empresa || '?'} — ${e.puesto || '?'}${e.esActual ? ' (actual)' : ''}`)}</Bloque>
          </div>
        )
      ) : (
        // ── EDICIÓN ──
        <div className="p-[18px] pt-3 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Grupo sanguíneo</label>
              <select value={borrador?.datosPersonales?.grupoSanguineo ?? ''} onChange={e => setDP({ grupoSanguineo: e.target.value })} className={input}><option value="">—</option>{GRUPOS_SANGUINEOS.map(o => <option key={o}>{o}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Lateralidad</label>
              <select value={borrador?.datosPersonales?.lateralidad ?? ''} onChange={e => setDP({ lateralidad: e.target.value })} className={input}><option value="">—</option>{LATERALIDADES.map(o => <option key={o}>{o}</option>)}</select></div>
          </div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Resumen de clínicos, quirúrgicos y alergias</label>
            <textarea rows={2} value={borrador?.antecedentesClinicosTexto ?? ''} onChange={e => setB({ antecedentesClinicosTexto: e.target.value })} className={input} />
            <p className="m-0 mt-1 text-[11px] text-slate-400">
              Es la línea que se imprime en el formato. El detalle (Sí/No y cada antecedente) se captura en la evaluación y vuelve a generar este resumen al guardarla.
            </p></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Antecedentes familiares</label>
            <textarea rows={2} value={borrador?.antecedentesFamiliaresTexto ?? ''} onChange={e => setB({ antecedentesFamiliaresTexto: e.target.value })} className={input} /></div>
          <div className="border border-slate-200 rounded-lg p-3 space-y-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase m-0">Condición especial (urgencias)</p>
            <input type="text" placeholder="Condición preexistente" value={borrador?.condicionEspecial?.condicionPreexistente ?? ''} onChange={e => setCE({ condicionPreexistente: e.target.value })} className={inputXs} />
            <div className="flex gap-4 flex-wrap text-xs">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={borrador?.condicionEspecial?.autorizaTransfusiones === true} onChange={e => setCE({ autorizaTransfusiones: e.target.checked ? true : false })} /> Autoriza transfusiones</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={borrador?.condicionEspecial?.tratamientoHormonal === true} onChange={e => setCE({ tratamientoHormonal: e.target.checked ? true : false })} /> Tratamiento hormonal</label>
              {borrador?.condicionEspecial?.tratamientoHormonal === true && <input type="text" placeholder="¿Cuál?" value={borrador?.condicionEspecial?.tratamientoHormonalCual ?? ''} onChange={e => setCE({ tratamientoHormonalCual: e.target.value })} className={inputXs + ' w-40'} />}
            </div>
          </div>
          {/* Hábitos */}
          <div>
            <p className="text-xs font-bold text-slate-700 mb-1.5">Consumo de sustancias</p>
            <div className="space-y-1.5">
              {(borrador?.habitosToxicos ?? []).map((h, i) => (
                <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-1.5 items-center bg-slate-50 p-2 rounded-lg text-xs">
                  <span className="font-semibold capitalize">{h.tipo === 'drogas' ? 'Otras' : h.tipo}</span>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={h.consume} onChange={e => setHab(i, 'consume', e.target.checked)} /> Consume</label>
                  <input type="text" placeholder="Tiempo" value={h.tiempoConsumo} onChange={e => setHab(i, 'tiempoConsumo', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  <label className="flex items-center gap-1"><input type="checkbox" checked={h.exConsumidor} onChange={e => setHab(i, 'exConsumidor', e.target.checked)} /> Ex</label>
                  <input type="text" placeholder="Abstinencia" value={h.tiempoAbstinencia} onChange={e => setHab(i, 'tiempoAbstinencia', e.target.value)} className="px-2 py-1 border rounded text-xs" />
                </div>
              ))}
            </div>
          </div>
          {/* Empleos */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-bold text-slate-700 m-0">Empleos anteriores / actual</p>
              <button onClick={() => setB({ antecedentesEmpleos: [...(borrador?.antecedentesEmpleos ?? []), emptyAntecedenteEmpleo()] })} className="text-teal-700 text-xs font-bold hover:underline">+ Agregar</button>
            </div>
            <div className="space-y-1.5">
              {(borrador?.antecedentesEmpleos ?? []).map((e, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input type="text" placeholder="Centro/empresa" value={e.empresa} onChange={ev => setEmp(i, 'empresa', ev.target.value)} className={inputXs} />
                  <input type="text" placeholder="Puesto" value={e.puesto} onChange={ev => setEmp(i, 'puesto', ev.target.value)} className={inputXs} />
                  <input type="text" placeholder="Actividades" value={e.actividades} onChange={ev => setEmp(i, 'actividades', ev.target.value)} className={inputXs} />
                  <label className="flex items-center gap-1 text-[11px] whitespace-nowrap"><input type="checkbox" checked={!!e.esActual} onChange={ev => setEmp(i, 'esActual', ev.target.checked)} /> Actual</label>
                  <button onClick={() => setB({ antecedentesEmpleos: (borrador?.antecedentesEmpleos ?? []).filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600 px-1"><X size={14} /></button>
                </div>
              ))}
              {(borrador?.antecedentesEmpleos ?? []).length === 0 && <p className="text-xs text-slate-400 italic m-0">Sin empleos. <button onClick={() => setB({ antecedentesEmpleos: [emptyAntecedenteEmpleo()] })} className="text-teal-700 font-semibold inline-flex items-center gap-0.5"><Plus size={11} /> Agregar</button></p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: string[] }) {
  return (
    <div className="border rounded-[11px] p-[12px_14px]" style={{ background: '#f6f7f9', borderColor: '#e4e6ea' }}>
      <div className="text-[11px] font-bold uppercase mb-1.5" style={{ color: '#98a0ab' }}>{titulo}</div>
      {children.length === 0 ? <div className="text-[12px]" style={{ color: '#98a0ab' }}>—</div>
        : <ul className="m-0 pl-4 space-y-0.5">{children.map((it, i) => <li key={i} className="text-[12.5px]" style={{ color: '#3a4250' }}>{it}</li>)}</ul>}
    </div>
  );
}
function BloqueTexto({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="border rounded-[11px] p-[12px_14px]" style={{ background: '#f6f7f9', borderColor: '#e4e6ea' }}>
      <div className="text-[11px] font-bold uppercase mb-1.5" style={{ color: '#98a0ab' }}>{titulo}</div>
      <div className="text-[12.5px] whitespace-pre-wrap" style={{ color: texto ? '#3a4250' : '#98a0ab' }}>{texto || '—'}</div>
    </div>
  );
}
