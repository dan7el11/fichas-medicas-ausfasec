// CAMBIO DE CARGO de un trabajador.
//
// Además de cambiar el puesto, muestra qué implica el cambio en términos de
// exposición (qué factores de riesgo entran, cuáles salen, qué medidas
// preventivas se suman) y permite refrescar con el cargo nuevo la Sección G de
// las evaluaciones que se elijan.
import { useState, useEffect, useMemo } from 'react';
import { ArrowRight, Briefcase, AlertTriangle, Save } from 'lucide-react';
import BuscadorCargo from '../BuscadorCargo';
import { useToast } from '../Toast';
import { getPerfilRiesgo } from '../../services/perfilesRiesgo';
import { cambiarCargo } from '../../services/cambioCargo';
import { compararPerfiles, medidasDePerfil } from '../../utils/cambioCargo';
import { medidaCompleta } from '../../constants/medidasPreventivas';
import { tipoEvaluacionLabel } from '../../utils/medicalHelpers';
import type { PerfilRiesgoCargo } from '../../types/perfilRiesgo';

const BRAND = '#9a3036';

const fmt = (f: any): string => {
  if (!f) return '—';
  const d = f?.seconds ? new Date(f.seconds * 1000) : f instanceof Date ? f : new Date(f);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
};

export interface CambioCargoModalProps {
  trabajador: any;
  nombreCompleto: string;
  evaluaciones: any[];
  usuarioId: string;
  onCerrar: () => void;
  /** Se llama tras guardar, para recargar la ficha. */
  onCambiado: () => void;
}

export default function CambioCargoModal(p: CambioCargoModalProps) {
  const toast = useToast();
  const cargoActual: string = p.trabajador.puestoTrabajo || '';

  const [cargoNuevo, setCargoNuevo] = useState('');
  const [departamentoNuevo, setDepartamentoNuevo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [perfilActual, setPerfilActual] = useState<PerfilRiesgoCargo | null>(null);
  const [perfilNuevo, setPerfilNuevo] = useState<PerfilRiesgoCargo | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    getPerfilRiesgo(cargoActual).then(x => { if (vivo) setPerfilActual(x); });
    return () => { vivo = false; };
  }, [cargoActual]);

  // El perfil del cargo nuevo se lee al elegirlo, para poder mostrar el
  // contraste antes de guardar nada.
  useEffect(() => {
    if (!cargoNuevo.trim()) { setPerfilNuevo(null); return; }
    let vivo = true;
    setCargandoPerfil(true);
    getPerfilRiesgo(cargoNuevo)
      .then(x => { if (vivo) setPerfilNuevo(x); })
      .finally(() => { if (vivo) setCargandoPerfil(false); });
    return () => { vivo = false; };
  }, [cargoNuevo]);

  const comparacion = useMemo(() => compararPerfiles(perfilActual, perfilNuevo), [perfilActual, perfilNuevo]);
  const mismoCargo = cargoNuevo.trim() !== '' && cargoNuevo.trim().toLowerCase() === cargoActual.trim().toLowerCase();
  const puedeGuardar = cargoNuevo.trim() !== '' && !mismoCargo && !guardando;

  const alternar = (id: string) => setSeleccionadas(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      const r = await cambiarCargo({
        trabajadorId: p.trabajador.id,
        cargoAnterior: cargoActual,
        cargoNuevo: cargoNuevo.trim(),
        departamentoAnterior: p.trabajador.departamento || '',
        departamentoNuevo: departamentoNuevo.trim() || undefined,
        motivo: motivo.trim(),
        usuarioId: p.usuarioId,
        nombreTrabajador: p.nombreCompleto,
        evaluacionesAActualizar: p.evaluaciones
          .filter(e => seleccionadas.has(e.id))
          .map(e => ({ id: e.id, factoresRiesgo: e.factoresRiesgo })),
      });
      toast.success(r.evaluacionesActualizadas
        ? `Cargo actualizado y ${r.evaluacionesActualizadas} evaluación(es) refrescada(s).`
        : 'Cargo actualizado.');
      r.fallidas.forEach(f => toast.warning(`No se pudo actualizar una evaluación: ${f.motivo}`));
      p.onCambiado();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el cargo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '92vh' }}>
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-[32px] h-[32px] rounded-[9px]" style={{ background: `${BRAND}16`, color: BRAND }}><Briefcase size={17} /></span>
            <div>
              <h2 className="text-[17px] font-bold text-slate-800 m-0">Cambio de cargo</h2>
              <p className="text-[12px] text-slate-500 m-0 mt-0.5">{p.nombreCompleto}</p>
            </div>
          </div>
          <button onClick={p.onCerrar} className="text-slate-400 hover:text-slate-700 text-2xl leading-none bg-transparent border-none cursor-pointer">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Cargo actual → cargo nuevo */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Cargo actual</label>
              <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700">
                {cargoActual || '—'}
              </div>
            </div>
            <ArrowRight size={18} className="hidden md:block mb-2.5 text-slate-300" />
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Cargo nuevo <span className="text-red-500">*</span></label>
              <BuscadorCargo
                valorActual={cargoNuevo}
                onTextoLibre={setCargoNuevo}
                onSeleccionar={(c) => { setCargoNuevo(c.cargo); setDepartamentoNuevo(c.departamento); }}
              />
            </div>
          </div>

          {mismoCargo && (
            <p className="m-0 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Es el mismo cargo que ya tiene registrado.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Área / departamento</label>
              <input type="text" value={departamentoNuevo} onChange={e => setDepartamentoNuevo(e.target.value)}
                placeholder={p.trabajador.departamento || 'Sin cambios'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Motivo del cambio</label>
              <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)}
                placeholder="Promoción, reubicación por salud, rotación…"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          {/* Qué cambia en la exposición */}
          {cargoNuevo.trim() !== '' && !mismoCargo && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                Cambio en la exposición
              </div>
              {cargandoPerfil ? (
                <p className="m-0 p-4 text-center text-[12.5px] text-slate-400">Comparando perfiles…</p>
              ) : !perfilNuevo ? (
                <p className="m-0 p-3 text-[12px] text-amber-800 bg-amber-50">
                  El cargo «{cargoNuevo}» no tiene perfil de riesgo analizado. El cambio se registra igual,
                  pero la Sección G habrá que marcarla a mano en la próxima evaluación.
                </p>
              ) : comparacion.sinCambios ? (
                <p className="m-0 p-3 text-[12.5px] text-slate-600">
                  Los dos cargos exponen a los mismos factores y exigen las mismas medidas.
                </p>
              ) : (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ListaCambio titulo="Factores que se suman" items={comparacion.factoresNuevos} tono="alta" />
                  <ListaCambio titulo="Factores que dejan de aplicar" items={comparacion.factoresQueSalen} tono="baja" />
                  <ListaCambio titulo="Medidas preventivas nuevas" items={comparacion.medidasNuevas} tono="alta" descripcion={medidaCompleta} />
                  <ListaCambio titulo="Medidas que dejan de aplicar" items={comparacion.medidasQueSalen} tono="baja" descripcion={medidaCompleta} />
                  <p className="m-0 md:col-span-2 text-[11.5px] text-slate-400">
                    El cargo nuevo trae {comparacion.actividadesNuevas} actividades de jornada
                    (antes {comparacion.actividadesAnteriores}) y {medidasDePerfil(perfilNuevo).length} medidas en total.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Evaluaciones a refrescar */}
          {perfilNuevo && p.evaluaciones.length > 0 && !mismoCargo && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase text-slate-500">Actualizar evaluaciones con el cargo nuevo</span>
                <span className="text-[11px] font-semibold text-slate-400">{seleccionadas.size} de {p.evaluaciones.length}</span>
              </div>
              <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="m-0 text-[11.5px] text-amber-800">
                  Una evaluación es un registro clínico con fecha: rehacer su Sección G reescribe lo que se
                  valoró ese día. Marca solo las que deban reflejar el cargo nuevo. Queda anotado quién y
                  cuándo lo hizo. Las evaluaciones que hagas de aquí en adelante ya toman el cargo nuevo solas.
                </p>
              </div>
              <div style={{ maxHeight: 190, overflowY: 'auto' }}>
                {p.evaluaciones.map((ev, i) => (
                  <label key={ev.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50"
                    style={{ borderTop: i > 0 ? '1px solid #eef0f3' : 'none' }}>
                    <input type="checkbox" checked={seleccionadas.has(ev.id)} onChange={() => alternar(ev.id)} />
                    <span className="text-[12.5px] font-semibold text-slate-700 min-w-[86px]">{fmt(ev.fecha)}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{tipoEvaluacionLabel(ev)}</span>
                    <span className="text-[12px] text-slate-400 truncate flex-1">
                      {ev.factoresRiesgo?.puestoArea || 'sin puesto registrado'}
                    </span>
                    {ev.perfilCargoActualizado && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">ya actualizada</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center gap-3 p-4 border-t shrink-0 flex-wrap">
          <span className="text-[11.5px] text-slate-400">
            El cambio queda en el historial de cargos de la ficha.
          </span>
          <div className="flex gap-2">
            <button onClick={p.onCerrar} className="px-4 py-2 text-[12.5px] font-medium bg-slate-100 text-slate-700 rounded-lg border-none cursor-pointer">Cancelar</button>
            <button onClick={guardar} disabled={!puedeGuardar}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-bold text-white rounded-lg border-none cursor-pointer disabled:opacity-50"
              style={{ background: BRAND }}>
              <Save size={13} /> {guardando ? 'Guardando…' : 'Cambiar cargo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListaCambio({ titulo, items, tono, descripcion }: {
  titulo: string;
  items: string[];
  tono: 'alta' | 'baja';
  descripcion?: (x: string) => string;
}) {
  const color = tono === 'alta'
    ? { bg: '#f9e6e8', fg: '#a3142a', borde: '#f0c9cf' }
    : { bg: '#e7f3ec', fg: '#1f7a4d', borde: '#c9e4d4' };
  return (
    <div className="rounded-[10px] border p-[10px_12px]" style={{ background: color.bg, borderColor: color.borde }}>
      <div className="text-[10.5px] font-bold uppercase mb-1.5" style={{ color: color.fg }}>
        {titulo} {items.length > 0 && `(${items.length})`}
      </div>
      {items.length === 0 ? (
        <div className="text-[11.5px] text-slate-400">Ninguno.</div>
      ) : (
        <ul className="m-0 pl-4 space-y-0.5">
          {items.map(x => (
            <li key={x} className="text-[11.5px] text-slate-700" title={descripcion?.(x)}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
