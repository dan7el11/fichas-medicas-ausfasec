/**
 * Sub-componentes de NuevaEvaluacion para las secciones E, G e I.
 * Cada uno recibe únicamente las props necesarias para reducir el tamaño
 * del archivo principal y mejorar legibilidad.
 */
import type { FactorRiesgoPuesto, ExamenFisicoHallazgo } from '../../types';

// ── Tipos compartidos ──────────────────────────────────────────────────────

interface RiesgoCheckboxGroupProps {
  titulo: string;
  color: string;
  opciones: string[];
  seleccionados: string[];
  onToggle: (v: string) => void;
}

function RiesgoCheckboxGroup({ titulo, color, opciones, seleccionados, onToggle }: RiesgoCheckboxGroupProps) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className={`${color} px-3 py-1.5 text-xs font-bold text-white`}>{titulo}</div>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
        {opciones.map(op => (
          <label key={op} className={`flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded transition-colors ${seleccionados.includes(op) ? 'bg-blue-50 font-semibold text-blue-800' : 'hover:bg-slate-50'}`}>
            <input type="checkbox" checked={seleccionados.includes(op)} onChange={() => onToggle(op)} />
            {op}
          </label>
        ))}
      </div>
    </div>
  );
}

// ── SeccionE — Factores de Riesgo ──────────────────────────────────────────

interface SeccionEProps {
  factoresRiesgo: FactorRiesgoPuesto;
  setFactoresRiesgo: React.Dispatch<React.SetStateAction<FactorRiesgoPuesto>>;
  toggleRiesgo: (cat: keyof Pick<FactorRiesgoPuesto, 'fisicos' | 'mecanicos' | 'quimicos' | 'biologicos' | 'ergonomicos' | 'psicosociales'>, v: string) => void;
  totalRiesgos: number;
  puestoPlaceholder: string;
  RIESGOS_FISICOS: string[];
  RIESGOS_MECANICOS: string[];
  RIESGOS_QUIMICOS: string[];
  RIESGOS_BIOLOGICOS: string[];
  RIESGOS_ERGONOMICOS: string[];
  RIESGOS_PSICOSOCIALES: string[];
}

export function SeccionE({ factoresRiesgo, setFactoresRiesgo, toggleRiesgo, totalRiesgos, puestoPlaceholder, RIESGOS_FISICOS, RIESGOS_MECANICOS, RIESGOS_QUIMICOS, RIESGOS_BIOLOGICOS, RIESGOS_ERGONOMICOS, RIESGOS_PSICOSOCIALES }: SeccionEProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
      <h2 className="text-sm font-bold text-slate-800 mb-1 border-b pb-2">E. FACTORES DE RIESGOS DEL PUESTO DE TRABAJO</h2>
      <p className="text-xs text-slate-500 mb-4">Seleccione los factores de riesgo a los que está expuesto el trabajador, según el catálogo del formato SO-RE-38.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">PUESTO DE TRABAJO / ÁREA</label>
          <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" value={factoresRiesgo.puestoArea} onChange={e => setFactoresRiesgo(prev => ({ ...prev, puestoArea: e.target.value }))} placeholder={puestoPlaceholder} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">ACTIVIDADES</label>
          <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" value={factoresRiesgo.actividades} onChange={e => setFactoresRiesgo(prev => ({ ...prev, actividades: e.target.value }))} placeholder="Descripción de actividades..." />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">TIEMPO DE TRABAJO (MESES)</label>
          <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" value={factoresRiesgo.tiempoTrabajoMeses} onChange={e => setFactoresRiesgo(prev => ({ ...prev, tiempoTrabajoMeses: e.target.value }))} placeholder="Ej: 24" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <RiesgoCheckboxGroup titulo="FÍSICO" color="bg-blue-600" opciones={RIESGOS_FISICOS} seleccionados={factoresRiesgo.fisicos} onToggle={v => toggleRiesgo('fisicos', v)} />
        <RiesgoCheckboxGroup titulo="MECÁNICO" color="bg-red-600" opciones={RIESGOS_MECANICOS} seleccionados={factoresRiesgo.mecanicos} onToggle={v => toggleRiesgo('mecanicos', v)} />
        <RiesgoCheckboxGroup titulo="QUÍMICO" color="bg-amber-600" opciones={RIESGOS_QUIMICOS} seleccionados={factoresRiesgo.quimicos} onToggle={v => toggleRiesgo('quimicos', v)} />
        <RiesgoCheckboxGroup titulo="BIOLÓGICO" color="bg-green-600" opciones={RIESGOS_BIOLOGICOS} seleccionados={factoresRiesgo.biologicos} onToggle={v => toggleRiesgo('biologicos', v)} />
        <RiesgoCheckboxGroup titulo="ERGONÓMICO" color="bg-purple-600" opciones={RIESGOS_ERGONOMICOS} seleccionados={factoresRiesgo.ergonomicos} onToggle={v => toggleRiesgo('ergonomicos', v)} />
        <RiesgoCheckboxGroup titulo="PSICOSOCIAL" color="bg-pink-600" opciones={RIESGOS_PSICOSOCIALES} seleccionados={factoresRiesgo.psicosociales} onToggle={v => toggleRiesgo('psicosociales', v)} />
      </div>

      <div className="mb-4">
        <label className="block text-xs font-bold text-slate-700 mb-1">MEDIDAS PREVENTIVAS</label>
        <textarea className="w-full p-3 border border-slate-300 rounded-lg text-sm" rows={2} value={factoresRiesgo.medidasPreventivas} onChange={e => setFactoresRiesgo(prev => ({ ...prev, medidasPreventivas: e.target.value }))} placeholder="Medidas preventivas aplicadas para mitigar los riesgos identificados..." />
      </div>

      {totalRiesgos > 0 && (
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h4 className="text-xs font-bold text-slate-700 mb-2">Resumen de riesgos seleccionados ({totalRiesgos}):</h4>
          <div className="flex flex-wrap gap-1.5">
            {factoresRiesgo.fisicos.map(r => <span key={r} className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">{r}</span>)}
            {factoresRiesgo.mecanicos.map(r => <span key={r} className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">{r}</span>)}
            {factoresRiesgo.quimicos.map(r => <span key={r} className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">{r}</span>)}
            {factoresRiesgo.biologicos.map(r => <span key={r} className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">{r}</span>)}
            {factoresRiesgo.ergonomicos.map(r => <span key={r} className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-medium">{r}</span>)}
            {factoresRiesgo.psicosociales.map(r => <span key={r} className="text-[10px] bg-pink-100 text-pink-800 px-2 py-0.5 rounded-full font-medium">{r}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SeccionG — Revisión de Órganos y Sistemas ──────────────────────────────

interface Sistema { numero: number; nombre: string; }

interface SeccionGProps {
  SISTEMAS: Sistema[];
  seleccionados: string[];
  descripciones: Record<string, string>;
  onToggle: (nombre: string, checked: boolean) => void;
  onDescripcion: (nombre: string, valor: string) => void;
}

export function SeccionG({ SISTEMAS, seleccionados, descripciones, onToggle, onDescripcion }: SeccionGProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
      <h2 className="text-sm font-bold text-slate-800 mb-1 border-b pb-2">G. REVISIÓN DE ÓRGANOS Y SISTEMAS</h2>
      <p className="text-xs text-slate-500 mb-3">En caso de existir patología, marcar con "X" y describir por sistema</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        {SISTEMAS.map(s => (
          <label key={s.numero} className={`flex items-center gap-2 text-xs p-2 rounded cursor-pointer transition-colors ${seleccionados.includes(s.nombre) ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 hover:bg-slate-100'}`}>
            <input type="checkbox" checked={seleccionados.includes(s.nombre)} onChange={e => onToggle(s.nombre, e.target.checked)} />
            <span className={seleccionados.includes(s.nombre) ? 'font-semibold text-blue-800' : ''}>{s.numero}. {s.nombre}</span>
          </label>
        ))}
      </div>
      {seleccionados.length > 0 ? (
        <div className="space-y-2 border-t pt-4">
          <h4 className="text-xs font-bold text-slate-700">Hallazgos por sistema:</h4>
          {seleccionados.map(sysNombre => {
            const sysNum = SISTEMAS.find(s => s.nombre === sysNombre)?.numero;
            return (
              <div key={sysNombre} className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-700 whitespace-nowrap w-40 shrink-0">{sysNum}. {sysNombre}:</span>
                <input type="text" className="flex-1 px-3 py-1.5 border rounded-lg text-sm" placeholder={`Hallazgo en ${sysNombre}...`} value={descripciones[sysNombre] || ''} onChange={e => onDescripcion(sysNombre, e.target.value)} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-green-50 text-green-800 p-3 rounded-lg text-sm">Sin hallazgos patológicos al momento de la consulta</div>
      )}
    </div>
  );
}

// ── SeccionI — Examen Físico Regional ─────────────────────────────────────

interface Subregion { codigo: string; nombre: string; }
interface RegionExamenFisico { numero: number; region: string; subregiones: Subregion[]; }

interface SeccionIProps {
  REGIONES: RegionExamenFisico[];
  seleccionados: Set<string>;
  hallazgos: ExamenFisicoHallazgo[];
  onToggle: (key: string, numRegion: number, codigo: string, region: string, subregion: string) => void;
  onHallazgo: (codigo: string, descripcion: string) => void;
}

export function SeccionI({ REGIONES, seleccionados, hallazgos, onToggle, onHallazgo }: SeccionIProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
      <h2 className="text-sm font-bold text-slate-800 mb-1 border-b pb-2">I. EXAMEN FÍSICO REGIONAL</h2>
      <p className="text-xs text-slate-500 mb-3">Marcar si existe evidencia de patología y describir</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {REGIONES.map(region => (
          <div key={region.numero} className="bg-slate-50 p-3 rounded-lg">
            <p className="text-xs font-bold text-slate-700 mb-2">{region.numero}. {region.region}</p>
            <div className="space-y-1">
              {region.subregiones.map(sub => {
                const key = `${region.numero}-${sub.codigo}`;
                return (
                  <label key={key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-100 p-1 rounded">
                    <input type="checkbox" checked={seleccionados.has(key)} onChange={() => onToggle(key, region.numero, sub.codigo, region.region, sub.nombre)} />
                    <span>{sub.codigo}. {sub.nombre}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {hallazgos.length > 0 ? (
        <div className="space-y-2 border-t pt-4">
          <h4 className="text-xs font-bold text-slate-700">Observaciones:</h4>
          {hallazgos.map(h => (
            <div key={h.codigo} className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-700 whitespace-nowrap">{h.codigo}:</span>
              <input type="text" className="flex-1 px-3 py-1 border rounded text-sm" placeholder={`Hallazgo en ${h.region} - ${h.subregion}`} value={h.descripcion} onChange={e => onHallazgo(h.codigo, e.target.value)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-green-50 text-green-800 p-3 rounded-lg text-sm">Sin signos relevantes al momento de la consulta</div>
      )}
    </div>
  );
}
