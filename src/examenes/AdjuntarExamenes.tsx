import { useState, useRef } from 'react';
import type { TipoExamen, GrupoExamen } from '../../types';
import { TIPOS_EXAMEN, GRUPOS_EXAMEN, NOMBRES_EXAMEN_COMUNES } from '../../types';

export interface ExamenAdjunto {
  file: File;
  nombreExamen: string;
  tipoExamen: TipoExamen;
  grupoExamen: GrupoExamen;
  fecha: string;
  resultado: string;
  estado: 'normal' | 'patologico';
  observacion: string;
}

interface AdjuntarExamenesProps {
  examenes: ExamenAdjunto[];
  onChange: (examenes: ExamenAdjunto[]) => void;
  fechaEvaluacion: Date;
}

export default function AdjuntarExamenes({ examenes, onChange, fechaEvaluacion }: AdjuntarExamenesProps) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fechaEvalISO = fechaEvaluacion.toISOString().split('T')[0];

  const agregarArchivos = (files: File[]) => {
    const validos = files.filter(f =>
      f.type === 'application/pdf' || f.type === 'image/jpeg' || f.type === 'image/png'
    );
    const nuevos: ExamenAdjunto[] = validos.map(file => ({
      file,
      nombreExamen: '',
      tipoExamen: 'Laboratorio',
      grupoExamen: 'Periódico',
      fecha: fechaEvalISO,
      resultado: '',
      estado: 'normal',
      observacion: '',
    }));
    onChange([...examenes, ...nuevos]);
  };

  const actualizar = (idx: number, campo: string, valor: any) => {
    const next = [...examenes];
    next[idx] = { ...next[idx], [campo]: valor };
    onChange(next);
  };

  const eliminar = (idx: number) => {
    const next = [...examenes];
    next.splice(idx, 1);
    onChange(next);
  };

  const validarFecha = (fecha: string): string | null => {
    if (!fecha) return null;
    const f = new Date(fecha);
    if (f > fechaEvaluacion) return `No puede ser posterior a la evaluación (${fechaEvalISO})`;
    return null;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-sm font-bold text-slate-800 mb-1 border-b pb-2">
        📎 ADJUNTAR EXÁMENES COMPLEMENTARIOS
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        Los archivos se subirán al guardar la evaluación y quedarán vinculados a esta consulta.
      </p>

      {/* Zona de drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); agregarArchivos(Array.from(e.dataTransfer.files)); }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-4 ${
          dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
        }`}
      >
        <p className="text-2xl mb-1">{dragging ? '📥' : '📎'}</p>
        <p className="text-sm font-medium text-slate-700">Arrastra archivos aquí o haz clic para seleccionar</p>
        <p className="text-xs text-slate-400">PDF, JPG o PNG</p>
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={e => { if (e.target.files) agregarArchivos(Array.from(e.target.files)); e.target.value = ''; }} className="hidden" />
      </div>

      {/* Lista de exámenes en cola */}
      {examenes.length > 0 && (
        <div className="space-y-3">
          {examenes.map((item, idx) => {
            const errorFecha = validarFecha(item.fecha);
            return (
              <div key={idx} className={`border rounded-lg p-3 ${errorFecha ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{item.file.type === 'application/pdf' ? '📄' : '🖼️'}</span>
                    <span className="text-xs font-medium text-slate-700">{item.file.name}</span>
                    <span className="text-[10px] text-slate-400">({(item.file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <button onClick={() => eliminar(idx)} className="text-red-400 hover:text-red-600">×</button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Nombre *</label>
                    <input list={`adj-names-${idx}`} type="text" value={item.nombreExamen} onChange={e => actualizar(idx, 'nombreExamen', e.target.value)} placeholder="Ej: Biometría hemática" className="w-full px-2 py-1 border rounded text-xs" />
                    <datalist id={`adj-names-${idx}`}>{NOMBRES_EXAMEN_COMUNES.map(n => <option key={n} value={n} />)}</datalist>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Tipo</label>
                    <select value={item.tipoExamen} onChange={e => actualizar(idx, 'tipoExamen', e.target.value)} className="w-full px-2 py-1 border rounded text-xs">{TIPOS_EXAMEN.map(t => <option key={t}>{t}</option>)}</select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Grupo</label>
                    <select value={item.grupoExamen} onChange={e => actualizar(idx, 'grupoExamen', e.target.value)} className="w-full px-2 py-1 border rounded text-xs">{GRUPOS_EXAMEN.map(g => <option key={g}>{g}</option>)}</select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Fecha *</label>
                    <input type="date" value={item.fecha} max={fechaEvalISO} onChange={e => actualizar(idx, 'fecha', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" />
                    {errorFecha && <p className="text-[9px] text-red-600 mt-0.5">{errorFecha}</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Resultado</label>
                    <input type="text" value={item.resultado} onChange={e => actualizar(idx, 'resultado', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" placeholder="Valor" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Estado</label>
                    <div className="flex gap-2">
                      <label className={`flex-1 text-center py-1 rounded text-xs font-semibold cursor-pointer border-2 ${item.estado === 'normal' ? 'border-green-500 bg-green-50 text-green-800' : 'border-slate-200 text-slate-400'}`}>
                        <input type="radio" className="hidden" checked={item.estado === 'normal'} onChange={() => actualizar(idx, 'estado', 'normal')} /> ✓ Normal
                      </label>
                      <label className={`flex-1 text-center py-1 rounded text-xs font-semibold cursor-pointer border-2 ${item.estado === 'patologico' ? 'border-red-500 bg-red-50 text-red-800' : 'border-slate-200 text-slate-400'}`}>
                        <input type="radio" className="hidden" checked={item.estado === 'patologico'} onChange={() => actualizar(idx, 'estado', 'patologico')} /> ⚠ Patológico
                      </label>
                    </div>
                  </div>
                </div>

                {item.estado === 'patologico' && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded p-2">
                    <label className="block text-[10px] font-bold text-red-700 uppercase mb-0.5">⚠ Observación (OBLIGATORIA)</label>
                    <textarea value={item.observacion} onChange={e => actualizar(idx, 'observacion', e.target.value)} placeholder="Interpretación del resultado patológico..." className="w-full px-2 py-1 border border-red-300 rounded text-xs bg-white" rows={2} />
                  </div>
                )}
              </div>
            );
          })}

          <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded-lg">
            {examenes.length} archivo{examenes.length !== 1 ? 's' : ''} adjunto{examenes.length !== 1 ? 's' : ''}. Se subirán al guardar la evaluación.
          </div>
        </div>
      )}
    </div>
  );
}
