// HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN DE REINTEGRO (SO-RE-39).
// Hoja oficial de 1 página, secciones A–K: fechas de salida/reingreso con
// conteo de días de ausencia, causa de salida, motivo/condición de reintegro,
// enfermedad actual, constantes vitales, examen físico regional, exámenes,
// diagnóstico CIE-10, aptitud (con reubicación) y recomendaciones.
// Reutiliza los componentes de los demás formularios (SO-RE-38/40/41).
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/Toast';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, updateDoc, arrayUnion, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { registrarAuditoria } from '../services/auditoria';
import { useAuth } from '../contexts/AuthContext';
import SignosVitalesForm from '../components/SignosVitalesForm';
import BuscadorCIE10 from '../components/BuscadorCIE10';
import { useEmpresa } from '../hooks/useEmpresa';
import { SeccionI } from '../components/evaluacion/SeccionesEvaluacion';
import { OPCIONES_RECOMENDACIONES, REGIONES_EXAMEN_FISICO } from '../utils/catalogosEvaluacion';
import { nombreProfesionalDe, codigoProfesionalDe } from '../utils/medicalHelpers';
import type {
  Trabajador, SignosVitales, ExamenFisicoHallazgo, ExamenComplementario, Diagnostico, Usuario,
} from '../types';

const CAUSAS_SALIDA = [
  'Enfermedad general',
  'Accidente de trabajo',
  'Enfermedad profesional',
  'Accidente no laboral',
  'Maternidad / paternidad',
  'Licencia / permiso prolongado',
  'Vacaciones',
];

/** Días de ausencia entre el último día laboral y el reingreso (sin contar ambos extremos como trabajo). */
function diasAusencia(ultimoDia: string, reingreso: string): number | null {
  if (!ultimoDia || !reingreso) return null;
  const d0 = new Date(ultimoDia + 'T12:00:00'), d1 = new Date(reingreso + 'T12:00:00');
  if (isNaN(d0.getTime()) || isNaN(d1.getTime()) || d1 < d0) return null;
  return Math.max(0, Math.round((d1.getTime() - d0.getTime()) / 86400000) - 1);
}

export default function NuevaEvaluacionReintegro() {
  const { trabajadorId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const editEvalId = searchParams.get('editId');
  const { user } = useAuth();
  const { empresa: DATOS_EMPRESA } = useEmpresa();

  const [trabajador, setTrabajador] = useState<Trabajador | null>(null);
  const [medicoData, setMedicoData] = useState<Usuario | null>(null);
  const [guardando, setGuardando] = useState(false);

  // A. Fechas de la ausencia
  const [fechaUltimoDia, setFechaUltimoDia] = useState('');
  const [fechaReingreso, setFechaReingreso] = useState(new Date().toISOString().slice(0, 10));
  const [totalDias, setTotalDias] = useState('');       // editable; se sugiere automáticamente
  const [causaSalida, setCausaSalida] = useState('');

  // B / C
  const [motivoConsulta, setMotivoConsulta] = useState('EVALUACIÓN MÉDICA DE REINTEGRO LABORAL');
  const [enfermedadActual, setEnfermedadActual] = useState('');

  // D. Constantes vitales
  const [signosVitales, setSignosVitales] = useState<SignosVitales>({
    presionSistolica: '', presionDiastolica: '', temperatura: '',
    frecuenciaCardiaca: '', frecuenciaRespiratoria: '', saturacion: '',
    peso: '', talla: '', imc: 0, perimetroAbdominal: '',
  });

  // E. Examen físico regional
  const [examenFisicoSeleccionados, setExamenFisicoSeleccionados] = useState<Set<string>>(new Set());
  const [examenFisicoHallazgos, setExamenFisicoHallazgos] = useState<ExamenFisicoHallazgo[]>([]);

  // F. Exámenes complementarios (con importación del historial)
  const [examenesComplementarios, setExamenesComplementarios] = useState<ExamenComplementario[]>([
    { nombre: '', fecha: '', resultado: '' },
  ]);
  const [mostrarModalExamenes, setMostrarModalExamenes] = useState(false);
  const [examenesDisponibles, setExamenesDisponibles] = useState<any[]>([]);
  const [examenesSeleccionadosModal, setExamenesSeleccionadosModal] = useState<string[]>([]);
  const [cargandoExamenesHist, setCargandoExamenesHist] = useState(false);

  // G. Diagnósticos
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([
    { descripcion: '', cie: '', tipo: 'definitivo' },
  ]);

  // H. Aptitud (con reubicación)
  const [aptitudMedica, setAptitudMedica] = useState<'apto' | 'aptoObservacion' | 'aptoLimitaciones' | 'noApto'>('apto');
  const [aptitudObservacion, setAptitudObservacion] = useState('');
  const [aptitudLimitaciones, setAptitudLimitaciones] = useState('');
  const [aptitudReubicacion, setAptitudReubicacion] = useState('');

  // I. Recomendaciones
  const [recomendaciones, setRecomendaciones] = useState<string[]>([]);
  const [recomendacionesOtras, setRecomendacionesOtras] = useState('');

  // Sugerir el total de días al cambiar las fechas (editable a mano).
  useEffect(() => {
    const d = diasAusencia(fechaUltimoDia, fechaReingreso);
    if (d !== null) setTotalDias(String(d));
  }, [fechaUltimoDia, fechaReingreso]);

  // ===== CARGA =====
  useEffect(() => {
    const cargar = async () => {
      if (!trabajadorId || !user) return;
      const trabDoc = await getDoc(doc(db, 'trabajadores', trabajadorId));
      if (trabDoc.exists()) setTrabajador({ id: trabDoc.id, ...trabDoc.data() } as Trabajador);
      const medicoDoc = await getDoc(doc(db, 'usuarios', user.uid));
      if (medicoDoc.exists()) setMedicoData(medicoDoc.data() as Usuario);

      if (editEvalId) {
        try {
          const evalDoc = await getDoc(doc(db, 'evaluaciones', editEvalId));
          if (evalDoc.exists()) {
            const ev = evalDoc.data();
            setFechaUltimoDia(ev.fechaUltimoDiaLaboral || '');
            setFechaReingreso(ev.fechaReingreso || '');
            setTotalDias(ev.totalDiasAusencia || '');
            setCausaSalida(ev.causaSalida || '');
            setMotivoConsulta(ev.motivoConsulta || '');
            setEnfermedadActual(ev.enfermedadActual || '');
            if (ev.signosVitales) setSignosVitales(ev.signosVitales);
            if (ev.examenFisicoHallazgos) {
              setExamenFisicoHallazgos(ev.examenFisicoHallazgos);
              const set = new Set<string>();
              ev.examenFisicoHallazgos.forEach((h: any) => {
                const num = h.codigo.match(/^\d+/)?.[0];
                const cod = h.codigo.replace(/^\d+/, '');
                if (num && cod) set.add(`${num}-${cod}`);
              });
              setExamenFisicoSeleccionados(set);
            }
            if (ev.examenesComplementarios) setExamenesComplementarios(ev.examenesComplementarios);
            if (ev.diagnosticos) setDiagnosticos(ev.diagnosticos);
            setAptitudMedica(ev.aptitudMedica || 'apto');
            setAptitudObservacion(ev.aptitudObservacion || '');
            setAptitudLimitaciones(ev.aptitudLimitaciones || '');
            setAptitudReubicacion(ev.aptitudReubicacion || '');
            if (ev.recomendaciones) setRecomendaciones(Array.isArray(ev.recomendaciones) ? ev.recomendaciones : []);
            setRecomendacionesOtras(ev.recomendacionesOtras || '');
          }
        } catch (err) { console.error('Error al cargar la evaluación para editar:', err); }
      } else {
        // Precargar la talla de la evaluación previa y los exámenes del último año
        try {
          const evalSnap = await getDocs(query(collection(db, 'evaluaciones'), where('trabajadorId', '==', trabajadorId)));
          const previas = evalSnap.docs.map(d => d.data())
            .sort((a: any, b: any) => (b.fecha?.seconds ?? 0) - (a.fecha?.seconds ?? 0));
          const conTalla = previas.find((e: any) => e.signosVitales?.talla);
          if (conTalla) setSignosVitales(prev => ({ ...prev, talla: conTalla.signosVitales.talla }));
        } catch { /* sin precarga */ }
        try {
          const exSnap = await getDocs(query(collection(db, 'examenes'), where('trabajadorId', '==', trabajadorId)));
          const unAnio = new Date(); unAnio.setFullYear(unAnio.getFullYear() - 1);
          const lista: ExamenComplementario[] = [];
          exSnap.forEach(d => {
            const data = d.data();
            const f = data.fecha?.seconds ? new Date(data.fecha.seconds * 1000) : new Date(data.fecha);
            if (f >= unAnio) {
              const interp = data.estado === 'patologico' ? `Patológico - Obs: ${data.observacion || ''}` : (data.observacion || 'Normal');
              lista.push({ nombre: data.nombreExamen || '', fecha: f.toISOString().slice(0, 10), resultado: data.resultado ? `${data.resultado} [${interp}]` : interp });
            }
          });
          lista.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
          if (lista.length > 0) setExamenesComplementarios(lista);
        } catch { /* sin precarga */ }
      }
    };
    cargar();
  }, [trabajadorId, user, editEvalId]);

  // ===== HANDLERS =====
  const toggleExamenFisico = (key: string, numero: number, codigo: string, region: string, subregion: string) => {
    const newSet = new Set(examenFisicoSeleccionados);
    if (newSet.has(key)) {
      newSet.delete(key);
      setExamenFisicoHallazgos(prev => prev.filter(h => h.codigo !== `${numero}${codigo}`));
    } else {
      newSet.add(key);
      setExamenFisicoHallazgos(prev => [...prev, { codigo: `${numero}${codigo}`, region, subregion, descripcion: '' }]);
    }
    setExamenFisicoSeleccionados(newSet);
  };
  const updateHallazgo = (codigo: string, descripcion: string) => {
    setExamenFisicoHallazgos(prev => prev.map(h => h.codigo === codigo ? { ...h, descripcion } : h));
  };
  const handleSignosChange = useCallback((d: SignosVitales) => setSignosVitales(d), []);

  const abrirModalExamenes = async () => {
    setMostrarModalExamenes(true);
    setCargandoExamenesHist(true);
    try {
      const snap = await getDocs(query(collection(db, 'examenes'), where('trabajadorId', '==', trabajadorId)));
      const docs: any[] = [];
      snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.fecha?.seconds ?? 0) - (a.fecha?.seconds ?? 0));
      setExamenesDisponibles(docs);
    } catch (error) { console.error('Error al cargar historial de exámenes:', error); }
    finally { setCargandoExamenesHist(false); }
  };
  const inyectarExamenes = () => {
    const seleccionados = examenesDisponibles.filter(ex => examenesSeleccionadosModal.includes(ex.id));
    const nuevos = seleccionados.map(data => {
      const f = data.fecha?.seconds ? new Date(data.fecha.seconds * 1000) : new Date(data.fecha);
      const interp = data.estado === 'patologico' ? `Patológico - Obs: ${data.observacion || ''}` : (data.observacion || 'Normal');
      return { nombre: data.nombreExamen || '', fecha: f.toISOString().slice(0, 10), resultado: data.resultado ? `${data.resultado} [${interp}]` : interp };
    });
    setExamenesComplementarios(prev => [...prev.filter(e => e.nombre.trim() || e.resultado.trim()), ...nuevos]);
    setMostrarModalExamenes(false);
    setExamenesSeleccionadosModal([]);
  };

  // ===== GUARDAR =====
  const handleGuardar = async () => {
    if (!trabajadorId || !user || !trabajador) return;
    const errores: string[] = [];
    if (!motivoConsulta.trim()) errores.push('Motivo / condición de reintegro es obligatorio (Sección B).');
    if (!fechaReingreso) errores.push('Indica la fecha de reingreso (Sección A).');
    if (!signosVitales.presionSistolica || !signosVitales.presionDiastolica || !signosVitales.frecuenciaCardiaca || !signosVitales.peso || !signosVitales.talla)
      errores.push('Completa los signos vitales mínimos: PA, FC, Peso y Talla (Sección D).');
    const dxValidos = diagnosticos.filter(d => d.descripcion.trim() !== '');
    if (dxValidos.length === 0) errores.push('Agrega al menos un diagnóstico (Sección G).');
    if (errores.length > 0) { errores.forEach(e => toast.warning(e)); return; }

    setGuardando(true);
    try {
      const hoy = new Date();
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      const dia = String(hoy.getDate()).padStart(2, '0');
      const numeroArchivo = `${DATOS_EMPRESA.prefijoArchivo || 'HCO'}-${hoy.getFullYear()}${mes}${dia}`;

      const evaluacionData: any = {
        trabajadorId,
        tipoEvaluacion: 'reintegro',
        medicoId: user.uid,
        medicoNombre: nombreProfesionalDe(medicoData) || '',
        medicoCedula: codigoProfesionalDe(medicoData),
        fechaUltimoDiaLaboral: fechaUltimoDia,
        fechaReingreso,
        totalDiasAusencia: totalDias,
        causaSalida: causaSalida.trim(),
        motivoConsulta,
        enfermedadActual,
        signosVitales,
        examenFisicoHallazgos,
        examenesComplementarios: examenesComplementarios.filter(e => e.nombre.trim() !== ''),
        diagnosticos: dxValidos,
        aptitudMedica,
        aptitudObservacion,
        aptitudLimitaciones,
        aptitudReubicacion,
        recomendaciones,
        recomendacionesOtras,
      };

      let idParaCertificado = editEvalId;
      if (editEvalId) {
        await updateDoc(doc(db, 'evaluaciones', editEvalId), { ...evaluacionData, updatedAt: hoy, updatedBy: user.uid });
        await registrarAuditoria('editar', 'evaluacion', editEvalId, `Editó la evaluación de reintegro de ${trabajador.primerApellido} ${trabajador.primerNombre}`);
        toast.success('Evaluación de reintegro actualizada.');
      } else {
        evaluacionData.fecha = hoy;
        evaluacionData.numeroHistoriaClinica = trabajador.cedula;
        evaluacionData.numeroArchivo = numeroArchivo;
        evaluacionData.createdAt = hoy;
        evaluacionData.createdBy = user.uid;
        const docRef = await addDoc(collection(db, 'evaluaciones'), evaluacionData);
        await updateDoc(doc(db, 'trabajadores', trabajadorId), {
          evaluaciones: arrayUnion(docRef.id),
          updatedAt: hoy,
          updatedBy: user.uid,
        });
        await registrarAuditoria('crear', 'evaluacion', docRef.id, `Evaluación de reintegro de ${trabajador.primerApellido} ${trabajador.primerNombre}`);
        toast.success('Evaluación de reintegro guardada.');
        idParaCertificado = docRef.id;
      }
      // Al terminar se ofrece el Certificado de Aptitud (SO-RE-20, tipo REINTEGRO).
      navigate(idParaCertificado ? `/trabajador/${trabajadorId}?certificado=${idParaCertificado}` : `/trabajador/${trabajadorId}`);
    } catch (error) {
      console.error('Error al guardar:', error);
      toast.error('Hubo un error al procesar la evaluación.');
    } finally {
      setGuardando(false);
    }
  };

  if (!trabajador) {
    return <div className="min-h-screen p-8 text-center text-slate-500">Cargando datos del trabajador...</div>;
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500';
  const diasCalc = diasAusencia(fechaUltimoDia, fechaReingreso);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ===== ENCABEZADO ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-slate-800 leading-tight">
                HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN DE REINTEGRO
              </h1>
              <p className="text-slate-500 text-xs md:text-sm mt-1">SO-RE-39 | {DATOS_EMPRESA.institucion} | RUC: {DATOS_EMPRESA.ruc}</p>
            </div>
            <button onClick={() => navigate(`/trabajador/${trabajadorId}`)} className="self-start md:self-auto text-slate-500 hover:text-slate-800 text-sm font-medium bg-slate-100 px-4 py-2 rounded-lg">
              Cancelar
            </button>
          </div>
        </div>

        {/* ===== A. DATOS ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">A. DATOS DEL ESTABLECIMIENTO - EMPRESA Y USUARIO</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-blue-50 p-3 rounded-lg mb-4">
            <div><span className="font-semibold text-slate-600">Trabajador:</span> <span className="text-slate-800">{trabajador.primerApellido} {trabajador.segundoApellido} {trabajador.primerNombre}</span></div>
            <div><span className="font-semibold text-slate-600">Cédula:</span> <span className="text-slate-800">{trabajador.cedula}</span></div>
            <div><span className="font-semibold text-slate-600">Sexo:</span> <span className="text-slate-800">{trabajador.sexo === 'M' ? 'Masculino' : 'Femenino'}</span></div>
            <div><span className="font-semibold text-slate-600">Puesto:</span> <span className="text-slate-800">{trabajador.puestoTrabajo}</span></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha del último día laboral</label>
              <input type="date" value={fechaUltimoDia} onChange={e => setFechaUltimoDia(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de reingreso <span className="text-red-500">*</span></label>
              <input type="date" value={fechaReingreso} onChange={e => setFechaReingreso(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Total (días de ausencia)</label>
              <input type="number" min={0} value={totalDias} onChange={e => setTotalDias(e.target.value)} className={inputCls} placeholder="—" />
              {diasCalc !== null && String(diasCalc) !== totalDias && (
                <p className="text-[11px] text-slate-400 mt-0.5">Sugerido por fechas: {diasCalc}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Causa de salida</label>
              <input list="causas-salida" value={causaSalida} onChange={e => setCausaSalida(e.target.value)} className={inputCls} placeholder="Enfermedad general…" />
              <datalist id="causas-salida">{CAUSAS_SALIDA.map(c => <option key={c} value={c} />)}</datalist>
            </div>
          </div>
        </div>

        {/* ===== B. MOTIVO / CONDICIÓN DE REINTEGRO ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">B. MOTIVO DE CONSULTA / CONDICIÓN DE REINTEGRO <span className="text-red-500">*</span></h2>
          <textarea rows={2} className={`${inputCls} ${!motivoConsulta.trim() ? 'border-red-300 bg-red-50' : ''}`} value={motivoConsulta} onChange={(e) => setMotivoConsulta(e.target.value)} placeholder="Condición clínica con la que se reintegra…" />
        </div>

        {/* ===== C. ENFERMEDAD ACTUAL ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">C. ENFERMEDAD ACTUAL</h2>
          <textarea rows={3} className={inputCls} value={enfermedadActual} onChange={(e) => setEnfermedadActual(e.target.value)} placeholder="Evolución de la condición que motivó la ausencia…" />
        </div>

        {/* ===== D. CONSTANTES VITALES ===== */}
        <SignosVitalesForm onDataChange={handleSignosChange} initialData={signosVitales} />

        {/* ===== E. EXAMEN FÍSICO REGIONAL ===== */}
        <SeccionI
          titulo="E. EXAMEN FÍSICO REGIONAL"
          REGIONES={REGIONES_EXAMEN_FISICO}
          seleccionados={examenFisicoSeleccionados}
          hallazgos={examenFisicoHallazgos}
          onToggle={toggleExamenFisico}
          onHallazgo={updateHallazgo}
        />

        {/* ===== F. EXÁMENES ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <div className="flex justify-between items-center mb-3 border-b pb-2">
            <h2 className="text-sm font-bold text-slate-800">F. RESULTADOS DE EXÁMENES (IMAGEN, LABORATORIO Y OTROS)</h2>
            <button type="button" onClick={abrirModalExamenes} className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold px-3 py-1.5 rounded-lg transition-colors">
              📦 Importar Historial
            </button>
          </div>
          {examenesComplementarios.map((ex, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input type="text" placeholder="Examen" value={ex.nombre} onChange={(e) => { const u = [...examenesComplementarios]; u[idx] = { ...u[idx], nombre: e.target.value }; setExamenesComplementarios(u); }} className="w-1/3 px-2 py-1 border rounded text-sm" />
              <input type="date" value={ex.fecha} onChange={(e) => { const u = [...examenesComplementarios]; u[idx] = { ...u[idx], fecha: e.target.value }; setExamenesComplementarios(u); }} className="w-1/6 px-2 py-1 border rounded text-sm" />
              <input type="text" placeholder="Resultado" value={ex.resultado} onChange={(e) => { const u = [...examenesComplementarios]; u[idx] = { ...u[idx], resultado: e.target.value }; setExamenesComplementarios(u); }} className="flex-1 px-2 py-1 border rounded text-sm" />
              <button type="button" onClick={() => setExamenesComplementarios(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 font-bold px-2">×</button>
            </div>
          ))}
          <button type="button" onClick={() => setExamenesComplementarios(prev => [...prev, { nombre: '', fecha: '', resultado: '' }])} className="text-blue-600 text-xs font-medium mt-2 hover:underline">+ Agregar fila vacía</button>
        </div>

        {/* ===== G. DIAGNÓSTICO ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">G. DIAGNÓSTICO <span className="text-red-500">*</span></h2>
          {diagnosticos.map((dx, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
              <div className="md:col-span-3">
                <BuscadorCIE10
                  valorActual={dx.descripcion ? `${dx.cie} - ${dx.descripcion}` : ''}
                  onSeleccionar={(codigo, descripcion) => {
                    const u = [...diagnosticos];
                    u[idx] = { ...u[idx], cie: codigo, descripcion };
                    setDiagnosticos(u);
                  }}
                />
              </div>
              <select value={dx.tipo} onChange={(e) => { const u = [...diagnosticos]; u[idx] = { ...u[idx], tipo: e.target.value as any }; setDiagnosticos(u); }} className="px-2 py-1 border rounded text-sm bg-white">
                <option value="presuntivo">Presuntivo</option>
                <option value="definitivo">Definitivo</option>
              </select>
            </div>
          ))}
          <button type="button" onClick={() => setDiagnosticos(prev => [...prev, { descripcion: '', cie: '', tipo: 'definitivo' }])} className="text-blue-600 text-xs font-medium mt-2 hover:underline">+ Agregar diagnóstico</button>
        </div>

        {/* ===== H. APTITUD (con reubicación) ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">H. APTITUD MÉDICA PARA EL TRABAJO</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { value: 'apto', label: 'APTO' },
              { value: 'aptoObservacion', label: 'APTO EN OBSERVACIÓN' },
              { value: 'aptoLimitaciones', label: 'APTO CON LIMITACIONES' },
              { value: 'noApto', label: 'NO APTO' },
            ].map((op) => (
              <label key={op.value} className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer text-xs font-semibold transition-colors ${aptitudMedica === op.value ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="aptitud" value={op.value} checked={aptitudMedica === op.value} onChange={(e) => setAptitudMedica(e.target.value as any)} className="hidden" />
                <span>{op.label}</span>
              </label>
            ))}
          </div>
          <div className="space-y-3">
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Observación:</label><textarea className={inputCls} rows={2} value={aptitudObservacion} onChange={(e) => setAptitudObservacion(e.target.value)} /></div>
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Limitación:</label><textarea className={inputCls} rows={2} value={aptitudLimitaciones} onChange={(e) => setAptitudLimitaciones(e.target.value)} /></div>
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Reubicación:</label><textarea className={inputCls} rows={2} value={aptitudReubicacion} onChange={(e) => setAptitudReubicacion(e.target.value)} placeholder="Reubicación temporal o definitiva indicada (si aplica)…" /></div>
          </div>
        </div>

        {/* ===== I. RECOMENDACIONES ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">I. RECOMENDACIONES Y/O TRATAMIENTO</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            {OPCIONES_RECOMENDACIONES.map((op) => (
              <label key={op} className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded cursor-pointer hover:bg-slate-100">
                <input type="checkbox" checked={recomendaciones.includes(op)} onChange={(e) => {
                  if (e.target.checked) setRecomendaciones(prev => [...prev, op]);
                  else setRecomendaciones(prev => prev.filter(r => r !== op));
                }} />
                <span>{op}</span>
              </label>
            ))}
          </div>
          <textarea className={inputCls} rows={2} value={recomendacionesOtras} onChange={(e) => setRecomendacionesOtras(e.target.value)} placeholder="Otras recomendaciones específicas del reintegro…" />
        </div>

        {/* ===== DECLARACIÓN Y FIRMAS ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <p className="text-xs text-slate-600 italic mb-4">CERTIFICO QUE LO ANTERIORMENTE EXPRESADO EN RELACIÓN A MI ESTADO DE SALUD ES VERDAD. SE ME HA INFORMADO LAS MEDIDAS PREVENTIVAS A TOMAR PARA DISMINUIR O MITIGAR LOS RIESGOS RELACIONADOS CON MI ACTIVIDAD LABORAL.</p>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="text-xs font-bold text-slate-700 mb-2">J. DATOS DEL PROFESIONAL</h4>
              <p><span className="font-semibold">Nombre:</span> {nombreProfesionalDe(medicoData) || 'Cargando...'}</p>
              <p><span className="font-semibold">Código:</span> {codigoProfesionalDe(medicoData) || 'Cargando...'}</p>
              <p><span className="font-semibold">Fecha:</span> {new Date().toLocaleDateString('es-EC')}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="text-xs font-bold text-slate-700 mb-2">K. FIRMA DEL USUARIO</h4>
              <p className="text-slate-500 text-xs italic">Firma del trabajador al momento de la consulta presencial</p>
            </div>
          </div>
        </div>

        {/* ===== GUARDAR ===== */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pb-8">
          <button onClick={handleGuardar} disabled={guardando} className="w-full sm:w-auto bg-blue-600 text-white font-semibold py-3 px-10 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-70 shadow-md text-sm">
            {guardando ? 'Guardando...' : editEvalId ? 'Guardar Cambios' : 'Guardar Evaluación de Reintegro'}
          </button>
        </div>

        {/* ===== MODAL IMPORTAR EXÁMENES ===== */}
        {mostrarModalExamenes && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-bold text-slate-800">Importar Exámenes del Trabajador</h3>
                  <p className="text-xs text-slate-500">Seleccione los exámenes que desea incluir en esta evaluación.</p>
                </div>
                <button onClick={() => setMostrarModalExamenes(false)} className="text-slate-400 hover:text-red-500 font-bold text-2xl leading-none">&times;</button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 bg-slate-100">
                {cargandoExamenesHist ? (
                  <p className="text-center text-sm text-slate-500 py-8 font-semibold animate-pulse">Buscando en el archivo histórico...</p>
                ) : examenesDisponibles.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-8">No hay exámenes complementarios previos registrados.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {examenesDisponibles.map(ex => {
                      const fechaEx = ex.fecha?.seconds ? new Date(ex.fecha.seconds * 1000).toLocaleDateString('es-EC') : ex.fecha;
                      const isSelected = examenesSeleccionadosModal.includes(ex.id);
                      return (
                        <label key={ex.id} className={`flex items-center gap-4 p-3 border rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white hover:bg-blue-50/50 border-slate-200'}`}>
                          <input type="checkbox" className="w-5 h-5 text-blue-600 rounded border-slate-300" checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setExamenesSeleccionadosModal(prev => [...prev, ex.id]);
                              else setExamenesSeleccionadosModal(prev => prev.filter(id => id !== ex.id));
                            }} />
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-sm text-slate-800">{ex.nombreExamen}</span>
                              <span className="text-xs font-semibold text-slate-500">{fechaEx}</span>
                            </div>
                            <span className="text-xs text-slate-600 line-clamp-1">{ex.resultado || 'Sin valor numérico'} {ex.observacion ? `— Obs: ${ex.observacion}` : ''}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-white">
                <button onClick={() => setMostrarModalExamenes(false)} className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
                <button onClick={inyectarExamenes} disabled={examenesSeleccionadosModal.length === 0} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  ⬇️ Inyectar {examenesSeleccionadosModal.length > 0 ? `(${examenesSeleccionadosModal.length})` : ''} a la Ficha
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
