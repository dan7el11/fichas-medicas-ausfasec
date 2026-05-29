import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { ExamenComplementarioDoc, EvaluacionMedica, TipoExamen, GrupoExamen } from '../../types';
import { TIPOS_EXAMEN, GRUPOS_EXAMEN, NOMBRES_EXAMEN_COMUNES } from '../../types';

interface ExamenesPanelProps {
  trabajadorId: string;
  trabajadorNombre: string;
  evaluaciones: EvaluacionMedica[];
}

// Archivos en cola para carga masiva
interface ArchivoEnCola {
  file: File;
  nombreExamen: string;
  tipoExamen: TipoExamen;
  grupoExamen: GrupoExamen;
  fecha: string;
  resultado: string;
  estado: 'normal' | 'patologico';
  observacion: string;
  evaluacionId: string;
  preview?: string;
}

const fmtF = (fecha: any): string => {
  if (!fecha) return '-';
  if (fecha.seconds) return new Date(fecha.seconds * 1000).toLocaleDateString('es-EC');
  if (fecha instanceof Date) return fecha.toLocaleDateString('es-EC');
  return String(fecha);
};

const fmtFISO = (fecha: any): string => {
  if (!fecha) return '';
  const d = fecha.seconds ? new Date(fecha.seconds * 1000) : fecha instanceof Date ? fecha : new Date(fecha);
  return d.toISOString().split('T')[0];
};

export default function ExamenesPanel({ trabajadorId, trabajadorNombre, evaluaciones }: ExamenesPanelProps) {
  const { user } = useAuth();
  const [examenes, setExamenes] = useState<ExamenComplementarioDoc[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>('Todos');
  const [filtroGrupo, setFiltroGrupo] = useState<string>('Todos');
  const [filtroNombre, setFiltroNombre] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('Todos');

  // Modal de carga
  const [mostrarUpload, setMostrarUpload] = useState(false);
  const [cola, setCola] = useState<ArchivoEnCola[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal evolución
  const [evolucionNombre, setEvolucionNombre] = useState<string | null>(null);

  // Cargar exámenes
  const cargarExamenes = useCallback(async () => {
    if (!trabajadorId) return;
    setCargando(true);
    try {
      const q = query(
        collection(db, 'examenes'),
        where('trabajadorId', '==', trabajadorId),
        orderBy('fecha', 'desc')
      );
      const snap = await getDocs(q);
      const docs: ExamenComplementarioDoc[] = [];
      snap.forEach(d => docs.push({ id: d.id, ...d.data() } as ExamenComplementarioDoc));
      setExamenes(docs);
    } catch (err) {
      console.error('Error cargando exámenes:', err);
    } finally {
      setCargando(false);
    }
  }, [trabajadorId]);

  useEffect(() => { cargarExamenes(); }, [cargarExamenes]);

  // Filtrado
  const examenesFiltrados = examenes.filter(ex => {
    if (filtroTipo !== 'Todos' && ex.tipoExamen !== filtroTipo) return false;
    if (filtroGrupo !== 'Todos' && ex.grupoExamen !== filtroGrupo) return false;
    if (filtroEstado !== 'Todos' && ex.estado !== filtroEstado) return false;
    if (filtroNombre && !ex.nombreExamen.toLowerCase().includes(filtroNombre.toLowerCase())) return false;
    return true;
  });

  // Stats
  const totalPatologicos = examenes.filter(e => e.estado === 'patologico').length;
  const totalNormales = examenes.filter(e => e.estado === 'normal').length;

  // Nombres únicos para evolución
  const nombresUnicos = [...new Set(examenes.map(e => e.nombreExamen))].sort();

  // ===== DRAG AND DROP =====
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type === 'application/pdf' || f.type === 'image/jpeg' || f.type === 'image/png'
    );
    agregarArchivosACola(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).filter(f =>
      f.type === 'application/pdf' || f.type === 'image/jpeg' || f.type === 'image/png'
    );
    agregarArchivosACola(files);
    e.target.value = '';
  };

  const agregarArchivosACola = (files: File[]) => {
    const nuevos: ArchivoEnCola[] = files.map(file => ({
      file,
      nombreExamen: '',
      tipoExamen: 'Laboratorio' as TipoExamen,
      grupoExamen: 'Periódico' as GrupoExamen,
      fecha: new Date().toISOString().split('T')[0],
      resultado: '',
      estado: 'normal' as const,
      observacion: '',
      evaluacionId: '',
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setCola(prev => [...prev, ...nuevos]);
    if (!mostrarUpload) setMostrarUpload(true);
  };

  const actualizarCola = (index: number, campo: string, valor: any) => {
    setCola(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [campo]: valor };
      return next;
    });
  };

  const eliminarDeCola = (index: number) => {
    setCola(prev => {
      const next = [...prev];
      if (next[index].preview) URL.revokeObjectURL(next[index].preview!);
      next.splice(index, 1);
      return next;
    });
  };

  // Validación de fecha contra evaluación vinculada
  const validarFecha = (item: ArchivoEnCola): string | null => {
    if (!item.evaluacionId || !item.fecha) return null;
    const eval_ = evaluaciones.find(e => e.id === item.evaluacionId);
    if (!eval_) return null;
    const fechaExamen = new Date(item.fecha);
    const fechaEval = eval_.fecha?.seconds ? new Date(eval_.fecha.seconds * 1000) : new Date(eval_.fecha);
    if (fechaExamen > fechaEval) {
      return `La fecha del examen no puede ser posterior a la evaluación (${fmtF(eval_.fecha)})`;
    }
    return null;
  };

  // ===== SUBIR EXÁMENES =====
  const subirExamenes = async () => {
    if (!user) return;

    // Validaciones
    for (let i = 0; i < cola.length; i++) {
      const item = cola[i];
      if (!item.nombreExamen.trim()) { alert(`Archivo ${i + 1}: Ingrese el nombre del examen`); return; }
      if (!item.fecha) { alert(`Archivo ${i + 1}: Ingrese la fecha`); return; }
      if (item.estado === 'patologico' && !item.observacion.trim()) {
        alert(`Archivo ${i + 1} (${item.nombreExamen}): Los exámenes patológicos requieren observación obligatoria`);
        return;
      }
      const errorFecha = validarFecha(item);
      if (errorFecha) { alert(`Archivo ${i + 1}: ${errorFecha}`); return; }
    }

    setSubiendo(true);
    try {
      for (const item of cola) {
        // 1. Subir archivo a Storage
        const ext = item.file.name.split('.').pop() || 'pdf';
        const storagePath = `examenes/${trabajadorId}/${Date.now()}_${item.nombreExamen.replace(/\s+/g, '_')}.${ext}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, item.file);
        const url = await getDownloadURL(storageRef);

       // 2. Guardar documento en Firestore
        const docData: Omit<ExamenComplementarioDoc, 'id'> = {
          trabajadorId,
          evaluacionId: item.evaluacionId || "", // <--- AQUÍ ESTÁ LA MAGIA (quitamos el undefined)
          tipoExamen: item.tipoExamen,
          nombreExamen: item.nombreExamen,
          grupoExamen: item.grupoExamen,
          fecha: new Date(item.fecha),
          resultado: item.resultado,
          estado: item.estado,
          observacion: item.observacion,
          archivoUrl: url,
          archivoNombre: item.file.name,
          archivoTipo: item.file.type,
          archivoPath: storagePath,
          medicoId: user.uid,
          medicoNombre: user.email || '',
          createdAt: new Date(),
        };
        const exRef = await addDoc(collection(db, 'examenes'), docData);

        // 3. Si tiene evaluación vinculada, agregar referencia
        if (item.evaluacionId) {
          const evalRef = doc(db, 'evaluaciones', item.evaluacionId);
          const evalDoc = evaluaciones.find(e => e.id === item.evaluacionId);
          const existing = evalDoc?.examenesVinculados || [];
          await updateDoc(evalRef, { examenesVinculados: [...existing, exRef.id] });
        }
      }

      // Limpiar
      cola.forEach(item => { if (item.preview) URL.revokeObjectURL(item.preview); });
      setCola([]);
      setMostrarUpload(false);
      await cargarExamenes();
      alert('Exámenes cargados exitosamente');
    } catch (err) {
      console.error('Error subiendo exámenes:', err);
      alert('Error al subir los exámenes. Verifique su conexión.');
    } finally {
      setSubiendo(false);
    }
  };

  // ===== ELIMINAR EXAMEN =====
  const eliminarExamen = async (examen: ExamenComplementarioDoc) => {
    if (!confirm(`¿Eliminar "${examen.nombreExamen}" del ${fmtF(examen.fecha)}?`)) return;
    try {
      // Eliminar archivo de Storage
      if (examen.archivoPath) {
        try { await deleteObject(ref(storage, examen.archivoPath)); } catch {}
      }
      // Eliminar documento de Firestore
      if (examen.id) await deleteDoc(doc(db, 'examenes', examen.id));
      await cargarExamenes();
    } catch (err) {
      console.error('Error eliminando examen:', err);
      alert('Error al eliminar el examen.');
    }
  };

  // ===== EVOLUCIÓN HISTÓRICA =====
  const examenesEvolucion = evolucionNombre
    ? examenes.filter(e => e.nombreExamen === evolucionNombre).sort((a, b) => {
        const dA = a.fecha?.seconds ? a.fecha.seconds : new Date(a.fecha).getTime() / 1000;
        const dB = b.fecha?.seconds ? b.fecha.seconds : new Date(b.fecha).getTime() / 1000;
        return dA - dB; // cronológico ascendente
      })
    : [];

  // ===== RENDER =====
  return (
    <div className="space-y-4">

      {/* ====== HEADER + STATS ====== */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Exámenes Complementarios</h2>
          <p className="text-xs text-slate-500">{examenes.length} exámenes registrados para {trabajadorNombre}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 font-semibold">{totalNormales} Normal</span>
            {totalPatologicos > 0 && (
              <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 font-semibold animate-pulse">{totalPatologicos} Patológico</span>
            )}
          </div>
          <button
            onClick={() => setMostrarUpload(true)}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2"
          >
            📎 Cargar Exámenes
          </button>
        </div>
      </div>

      {/* ====== FILTROS ====== */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo</label>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs">
              <option>Todos</option>
              {TIPOS_EXAMEN.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Grupo</label>
            <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs">
              <option>Todos</option>
              {GRUPOS_EXAMEN.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estado</label>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs">
              <option>Todos</option>
              <option value="normal">Normal</option>
              <option value="patologico">Patológico</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Buscar examen</label>
            <input type="text" value={filtroNombre} onChange={e => setFiltroNombre(e.target.value)} placeholder="Nombre..." className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Evolución</label>
            <select value={evolucionNombre || ''} onChange={e => setEvolucionNombre(e.target.value || null)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs">
              <option value="">Seleccionar examen...</option>
              {nombresUnicos.map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ====== EVOLUCIÓN HISTÓRICA ====== */}
      {evolucionNombre && examenesEvolucion.length > 0 && (
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-blue-800">Evolución: {evolucionNombre}</h3>
            <button onClick={() => setEvolucionNombre(null)} className="text-xs text-slate-500 hover:text-slate-700">Cerrar ×</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-blue-50 border-b border-blue-200">
                  <th className="text-left p-2 font-semibold text-blue-800">Fecha</th>
                  <th className="text-left p-2 font-semibold text-blue-800">Grupo</th>
                  <th className="text-left p-2 font-semibold text-blue-800">Resultado</th>
                  <th className="text-center p-2 font-semibold text-blue-800">Estado</th>
                  <th className="text-left p-2 font-semibold text-blue-800">Observación</th>
                  <th className="text-left p-2 font-semibold text-blue-800">Evaluación</th>
                </tr>
              </thead>
              <tbody>
                {examenesEvolucion.map((ex, i) => {
                  const evalVinc = evaluaciones.find(e => e.id === ex.evaluacionId);
                  return (
                    <tr key={ex.id} className={`border-b border-slate-100 ${ex.estado === 'patologico' ? 'bg-red-50' : ''}`}>
                      <td className="p-2 font-medium">{fmtF(ex.fecha)}</td>
                      <td className="p-2">{ex.grupoExamen}</td>
                      <td className="p-2">{ex.resultado || '-'}</td>
                      <td className="p-2 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ex.estado === 'patologico' ? 'bg-red-200 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {ex.estado === 'patologico' ? '⚠ PATOLÓGICO' : '✓ NORMAL'}
                        </span>
                      </td>
                      <td className="p-2 text-slate-600">{ex.observacion || '-'}</td>
                      <td className="p-2 text-slate-500">{evalVinc ? fmtF(evalVinc.fecha) : 'Sin vincular'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {examenesEvolucion.length >= 2 && (
            <div className="mt-2 text-xs text-slate-500 italic">
              {examenesEvolucion.filter(e => e.estado === 'patologico').length} de {examenesEvolucion.length} resultados patológicos en el historial
            </div>
          )}
        </div>
      )}

      {/* ====== LISTA DE EXÁMENES ====== */}
      {cargando ? (
        <div className="text-center py-10 text-slate-400 text-sm">Cargando exámenes...</div>
      ) : examenesFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <p className="text-slate-400 text-lg mb-1">📋</p>
          <p className="text-slate-500 text-sm">{examenes.length === 0 ? 'Sin exámenes registrados' : 'Sin resultados para los filtros aplicados'}</p>
          <button onClick={() => setMostrarUpload(true)} className="mt-3 text-blue-600 text-sm font-medium hover:underline">Cargar primer examen</button>
        </div>
      ) : (
        <div className="space-y-2">
          {examenesFiltrados.map(ex => {
            const evalVinc = evaluaciones.find(e => e.id === ex.evaluacionId);
            return (
              <div key={ex.id} className={`bg-white rounded-xl border p-4 flex items-start gap-4 transition-all hover:shadow-md ${
                ex.estado === 'patologico' ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
              }`}>
                {/* Icono tipo */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                  ex.archivoTipo === 'application/pdf' ? 'bg-red-100' : 'bg-blue-100'
                }`}>
                  {ex.archivoTipo === 'application/pdf' ? '📄' : '🖼️'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-sm text-slate-800">{ex.nombreExamen}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ex.estado === 'patologico' ? 'bg-red-200 text-red-800' : 'bg-green-100 text-green-700'
                    }`}>
                      {ex.estado === 'patologico' ? '⚠ PATOLÓGICO' : '✓ Normal'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{ex.tipoExamen}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{ex.grupoExamen}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                    <span>📅 {fmtF(ex.fecha)}</span>
                    <span>📎 {ex.archivoNombre}</span>
                    {evalVinc && <span className="text-blue-600">🔗 Eval: {fmtF(evalVinc.fecha)}</span>}
                  </div>
                  {ex.resultado && <p className="text-xs text-slate-700 mt-1">Resultado: {ex.resultado}</p>}
                  {ex.observacion && <p className="text-xs text-red-700 mt-1 italic">Obs: {ex.observacion}</p>}
                </div>

                {/* Acciones */}
                <div className="flex gap-1.5 flex-shrink-0">
                  <a href={ex.archivoUrl} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200">
                    Ver
                  </a>
                  <button onClick={() => eliminarExamen(ex)}
                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ====== MODAL DE CARGA MASIVA ====== */}
      {mostrarUpload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Cargar Exámenes Complementarios</h3>
                <p className="text-xs text-slate-500">{cola.length} archivo{cola.length !== 1 ? 's' : ''} en cola</p>
              </div>
              <button onClick={() => { setMostrarUpload(false); cola.forEach(item => { if (item.preview) URL.revokeObjectURL(item.preview); }); setCola([]); }}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Zona de drop */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                }`}
              >
                <p className="text-3xl mb-2">{dragging ? '📥' : '📎'}</p>
                <p className="text-sm font-medium text-slate-700">Arrastra y suelta archivos aquí</p>
                <p className="text-xs text-slate-400 mt-1">PDF, JPG o PNG · Máx. 10 MB por archivo</p>
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} className="hidden" />
              </div>

              {/* Cola de archivos */}
              {cola.map((item, idx) => {
                const errorFecha = validarFecha(item);
                return (
                  <div key={idx} className={`border rounded-xl p-4 space-y-3 ${errorFecha ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{item.file.type === 'application/pdf' ? '📄' : '🖼️'}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{item.file.name}</p>
                          <p className="text-[10px] text-slate-400">{(item.file.size / 1024).toFixed(0)} KB</p>
                        </div>
                      </div>
                      <button onClick={() => eliminarDeCola(idx)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Nombre del examen */}
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre del examen *</label>
                        <input
                          list={`exnames-${idx}`}
                          type="text"
                          value={item.nombreExamen}
                          onChange={e => actualizarCola(idx, 'nombreExamen', e.target.value)}
                          placeholder="Ej: Biometría hemática"
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                        <datalist id={`exnames-${idx}`}>
                          {NOMBRES_EXAMEN_COMUNES.map(n => <option key={n} value={n} />)}
                        </datalist>
                      </div>

                      {/* Tipo */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo</label>
                        <select value={item.tipoExamen} onChange={e => actualizarCola(idx, 'tipoExamen', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs">
                          {TIPOS_EXAMEN.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>

                      {/* Grupo */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Grupo</label>
                        <select value={item.grupoExamen} onChange={e => actualizarCola(idx, 'grupoExamen', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs">
                          {GRUPOS_EXAMEN.map(g => <option key={g}>{g}</option>)}
                        </select>
                      </div>

                      {/* Fecha */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha del examen *</label>
                        <input type="date" value={item.fecha} onChange={e => actualizarCola(idx, 'fecha', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
                        {errorFecha && <p className="text-[10px] text-red-600 mt-0.5">{errorFecha}</p>}
                      </div>

                      {/* Resultado */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Resultado</label>
                        <input type="text" value={item.resultado} onChange={e => actualizarCola(idx, 'resultado', e.target.value)} placeholder="Valor/Descripción" className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
                      </div>

                      {/* Estado (Semáforo) */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estado *</label>
                        <div className="flex gap-2">
                          <label className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-2 transition-all ${
                            item.estado === 'normal' ? 'border-green-500 bg-green-50 text-green-800' : 'border-slate-200 text-slate-400'
                          }`}>
                            <input type="radio" className="hidden" checked={item.estado === 'normal'} onChange={() => actualizarCola(idx, 'estado', 'normal')} />
                            ✓ Normal
                          </label>
                          <label className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-2 transition-all ${
                            item.estado === 'patologico' ? 'border-red-500 bg-red-50 text-red-800' : 'border-slate-200 text-slate-400'
                          }`}>
                            <input type="radio" className="hidden" checked={item.estado === 'patologico'} onChange={() => actualizarCola(idx, 'estado', 'patologico')} />
                            ⚠ Patológico
                          </label>
                        </div>
                      </div>

                      {/* Vincular a evaluación */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vincular a evaluación</label>
                        <select value={item.evaluacionId} onChange={e => actualizarCola(idx, 'evaluacionId', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs">
                          <option value="">Sin vincular</option>
                          {evaluaciones.map(ev => (
                            <option key={ev.id} value={ev.id}>{fmtF(ev.fecha)} — HC {ev.numeroHistoriaClinica}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Observación (obligatoria si patológico) */}
                    {item.estado === 'patologico' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <label className="block text-[10px] font-bold text-red-700 uppercase mb-1">⚠ Observación / Interpretación (OBLIGATORIA)</label>
                        <textarea
                          value={item.observacion}
                          onChange={e => actualizarCola(idx, 'observacion', e.target.value)}
                          placeholder="Describa la interpretación del resultado patológico..."
                          className="w-full px-2 py-1.5 border border-red-300 rounded-lg text-xs bg-white"
                          rows={2}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Botón de subida */}
              {cola.length > 0 && (
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                  <button onClick={() => { setMostrarUpload(false); cola.forEach(item => { if (item.preview) URL.revokeObjectURL(item.preview); }); setCola([]); }}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
                    Cancelar
                  </button>
                  <button onClick={subirExamenes} disabled={subiendo}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                    {subiendo ? 'Subiendo...' : `Subir ${cola.length} examen${cola.length !== 1 ? 'es' : ''}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
