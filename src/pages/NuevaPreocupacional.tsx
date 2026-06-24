import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { registrarAuditoria } from '../services/auditoria';
import SignosVitalesForm from '../components/SignosVitalesForm';
import BuscadorCIE10 from '../components/BuscadorCIE10';

export default function NuevaPreocupacional() {
  const { trabajadorId } = useParams();
  const navigate = useNavigate();
  const [trabajador, setTrabajador] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // ===== ESTADOS DEL FORMULARIO SO-RE-41 =====
  const [fechaEvaluacion, setFechaEvaluacion] = useState(new Date().toISOString().split('T')[0]);
  const [motivoConsulta, setMotivoConsulta] = useState('');
  
  // Antecedentes de Trabajo (Tabla Preocupacional)
  const [antecedentesLaborales, setAntecedentesLaborales] = useState<any[]>([
    { empresa: '', puesto: '', actividades: '', tiempoMeses: '', riesgos: '', observaciones: '' }
  ]);
  const [accidentesTrabajo, setAccidentesTrabajo] = useState('');
  const [calificadoIess, setCalificadoIess] = useState('NO');
  const [fechaCalificacionIess, setFechaCalificacionIess] = useState('');

  // Antecedentes Familiares (Nuevos Checkboxes y Textos)
  const [antecedentesFamiliares, setAntecedentesFamiliares] = useState({
    cardiovascular: { seleccionado: false, descripcion: '' },
    metabolica: { seleccionado: false, descripcion: '' },
    neurologica: { seleccionado: false, descripcion: '' },
    oncologica: { seleccionado: false, descripcion: '' },
    infecciosa: { seleccionado: false, descripcion: '' },
    hereditaria: { seleccionado: false, descripcion: '' },
    discapacidades: { seleccionado: false, descripcion: '' },
    otros: { seleccionado: false, descripcion: '' },
  });

  // Hábitos Tóxicos y Estilo de Vida
  const [habitos, setHabitos] = useState({
    tabaco: { consume: 'NO', tiempoMeses: '', cantidad: '', exConsumidor: 'NO', tiempoAbstinencia: '' },
    alcohol: { consume: 'NO', tiempoMeses: '', cantidad: '', exConsumidor: 'NO', tiempoAbstinencia: '' },
    drogas: { consume: 'NO', tipo: '', tiempoMeses: '', cantidad: '', exConsumidor: 'NO', tiempoAbstinencia: '' }
  });
  const [estiloVida, setEstiloVida] = useState({
    actividadFisica: { practica: 'NO', tiempoDia: '' },
    medicacionHabitual: { toma: 'NO', cual: '' }
  });

  // Campos heredados (Similares a Periódica)
  const [signosVitales, setSignosVitales] = useState({});
  const [organosSistemas, setOrganosSistemas] = useState<any[]>([]);
  const [examenFisicoRegional, setExamenFisicoRegional] = useState<any[]>([]);
  const [diagnosticos, setDiagnosticos] = useState<any[]>([]);
  const [aptitudMedica, setAptitudMedica] = useState('APTO');
  const [observacionesAptitud, setObservacionesAptitud] = useState('');
  const [recomendaciones, setRecomendaciones] = useState('');

  // Carga de datos del paciente
  useEffect(() => {
    const cargarTrabajador = async () => {
      if (!trabajadorId) return;
      try {
        const docRef = doc(db, 'trabajadores', trabajadorId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTrabajador({ id: docSnap.id, ...docSnap.data() });
        } else {
          alert('No se encontró el trabajador.');
          navigate('/');
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setCargando(false);
      }
    };
    cargarTrabajador();
  }, [trabajadorId, navigate]);

  const handleFamiliarChange = (campo: string, clave: 'seleccionado' | 'descripcion', valor: any) => {
    setAntecedentesFamiliares(prev => ({
      ...prev,
      [campo]: { ...prev[campo as keyof typeof prev], [clave]: valor }
    }));
  };

  const guardarEvaluacionPreocupacional = async () => {
    if (!trabajadorId) return;
    setGuardando(true);
    try {
      const nuevaEvaluacion = {
        trabajadorId,
        tipoEvaluacion: 'preocupacional', // <--- LA ETIQUETA CLAVE
        fecha: new Date(fechaEvaluacion),
        motivoConsulta,
        antecedentesLaborales,
        accidentesTrabajo,
        calificadoIess,
        fechaCalificacionIess,
        antecedentesFamiliares,
        habitos,
        estiloVida,
        signosVitales,
        organosSistemas,
        examenFisicoRegional,
        diagnosticos,
        aptitudMedica,
        observacionesAptitud,
        recomendaciones,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const refPreoc = await addDoc(collection(db, 'evaluaciones'), nuevaEvaluacion);
      await registrarAuditoria('crear', 'evaluacion', refPreoc.id, `Evaluación preocupacional de ${trabajador?.primerApellido ?? ''} ${trabajador?.primerNombre ?? ''}`.trim());

      // Actualizar fecha en el trabajador
      await updateDoc(doc(db, 'trabajadores', trabajadorId), {
        ultimaEvaluacionPreocupacional: new Date(fechaEvaluacion)
      });

      alert('Evaluación Preocupacional SO-RE-41 guardada con éxito.');
      navigate(`/trabajador/${trabajadorId}`);
    } catch (error) {
      console.error("Error al guardar:", error);
      alert('Hubo un error al guardar la evaluación.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="p-8 text-center font-bold text-slate-500">Preparando Consultorio...</div>;

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6">
      <div className="bg-slate-800 rounded-xl p-6 text-white shadow-lg flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Evaluación Preocupacional (SO-RE-41)</h1>
          <p className="text-slate-300 mt-1">Paciente: {trabajador?.primerNombre} {trabajador?.primerApellido} | C.I: {trabajador?.identificacion}</p>
        </div>
        <div className="text-right">
          <label className="block text-xs text-slate-400 mb-1">Fecha de Evaluación</label>
          <input type="date" value={fechaEvaluacion} onChange={e => setFechaEvaluacion(e.target.value)} className="px-3 py-1.5 rounded bg-slate-700 border-none text-white focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <form className="space-y-6" onSubmit={e => e.preventDefault()}>
        
        {/* ===== MOTIVO DE CONSULTA ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">B. MOTIVO DE CONSULTA</h2>
          <textarea value={motivoConsulta} onChange={e => setMotivoConsulta(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Anotar la causa del problema en la versión del informante (o 'Ingreso laboral')..." />
        </div>

        {/* ===== ANTECEDENTES DE TRABAJO (SO-RE-41 EXCLUSIVO) ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">D. ANTECEDENTES DE EMPLEOS ANTERIORES</h2>
          
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm text-left border">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-600">
                <tr>
                  <th className="px-3 py-2 border">Empresa</th>
                  <th className="px-3 py-2 border">Puesto</th>
                  <th className="px-3 py-2 border">Actividades</th>
                  <th className="px-3 py-2 border w-24">Meses</th>
                  <th className="px-3 py-2 border">Riesgos (Fís/Mec/Quí/Bio/Erg/Psi)</th>
                  <th className="px-3 py-2 border w-10"></th>
                </tr>
              </thead>
              <tbody>
                {antecedentesLaborales.map((ant, idx) => (
                  <tr key={idx}>
                    <td className="p-1 border"><input type="text" value={ant.empresa} onChange={e => { const n = [...antecedentesLaborales]; n[idx].empresa = e.target.value; setAntecedentesLaborales(n); }} className="w-full p-1 border rounded" /></td>
                    <td className="p-1 border"><input type="text" value={ant.puesto} onChange={e => { const n = [...antecedentesLaborales]; n[idx].puesto = e.target.value; setAntecedentesLaborales(n); }} className="w-full p-1 border rounded" /></td>
                    <td className="p-1 border"><input type="text" value={ant.actividades} onChange={e => { const n = [...antecedentesLaborales]; n[idx].actividades = e.target.value; setAntecedentesLaborales(n); }} className="w-full p-1 border rounded" /></td>
                    <td className="p-1 border"><input type="number" value={ant.tiempoMeses} onChange={e => { const n = [...antecedentesLaborales]; n[idx].tiempoMeses = e.target.value; setAntecedentesLaborales(n); }} className="w-full p-1 border rounded" /></td>
                    <td className="p-1 border"><input type="text" value={ant.riesgos} placeholder="Ej: Físico, Ergonómico..." onChange={e => { const n = [...antecedentesLaborales]; n[idx].riesgos = e.target.value; setAntecedentesLaborales(n); }} className="w-full p-1 border rounded" /></td>
                    <td className="p-1 border text-center">
                      <button onClick={() => setAntecedentesLaborales(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 font-bold hover:text-red-700">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setAntecedentesLaborales(prev => [...prev, { empresa: '', puesto: '', actividades: '', tiempoMeses: '', riesgos: '', observaciones: '' }])} className="mt-2 text-xs text-blue-600 font-bold hover:underline">+ Agregar empleo anterior</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Accidentes de Trabajo (Descripción)</label>
              <textarea value={accidentesTrabajo} onChange={e => setAccidentesTrabajo(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Describa si existieron..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">¿Fue calificado por el IESS?</label>
              <div className="flex items-center gap-4 mb-2">
                <label className="flex items-center gap-1"><input type="radio" checked={calificadoIess === 'SI'} onChange={() => setCalificadoIess('SI')} /> SI</label>
                <label className="flex items-center gap-1"><input type="radio" checked={calificadoIess === 'NO'} onChange={() => setCalificadoIess('NO')} /> NO</label>
              </div>
              {calificadoIess === 'SI' && (
                <input type="date" value={fechaCalificacionIess} onChange={e => setFechaCalificacionIess(e.target.value)} className="px-3 py-1.5 border rounded w-full text-sm" />
              )}
            </div>
          </div>
        </div>

        {/* ===== ANTECEDENTES FAMILIARES ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">E. ANTECEDENTES FAMILIARES (Detallar parentesco)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.keys(antecedentesFamiliares).map((key) => (
              <div key={key} className="flex gap-2 items-start bg-slate-50 p-2 rounded border border-slate-100">
                <input type="checkbox" className="mt-1" checked={(antecedentesFamiliares as any)[key].seleccionado} onChange={e => handleFamiliarChange(key, 'seleccionado', e.target.checked)} />
                <div className="flex-1">
                  <span className="text-xs font-bold uppercase">{key}</span>
                  {(antecedentesFamiliares as any)[key].seleccionado && (
                    <input type="text" placeholder="Describir parentesco..." className="w-full mt-1 px-2 py-1 text-xs border rounded" value={(antecedentesFamiliares as any)[key].descripcion} onChange={e => handleFamiliarChange(key, 'descripcion', e.target.value)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== CONSTANTES VITALES ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">G. CONSTANTES VITALES Y ANTROPOMETRÍA</h2>
          <SignosVitalesForm 
            initialData={signosVitales as any} 
            onDataChange={(data) => setSignosVitales(data)} 
          />
        </div>
       {/* ===== CIE-10 ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="text-sm font-bold text-slate-800">L. DIAGNÓSTICO (CIE-10)</h2>
            <button type="button" onClick={() => setDiagnosticos([...diagnosticos, { cie: '', descripcion: '', tipo: 'PRESUNTIVO' }])} className="text-xs text-blue-600 font-bold hover:underline">
              + Agregar Diagnóstico
            </button>
          </div>
          
          <div className="space-y-3">
            {diagnosticos.map((dx, idx) => (
              <div key={idx} className="flex flex-col md:flex-row gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 relative">
                <button type="button" onClick={() => setDiagnosticos(diagnosticos.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-sm hover:bg-red-600">&times;</button>
                <div className="flex-1">
                  <BuscadorCIE10 
                    valorActual={dx.descripcion ? `${dx.cie} - ${dx.descripcion}` : ''} 
                    onSeleccionar={(codigo, descripcion) => { 
                      const n = [...diagnosticos]; 
                      n[idx] = { ...n[idx], cie: codigo, descripcion: descripcion }; 
                      setDiagnosticos(n); 
                    }} 
                  />
                </div>
                <select value={dx.tipo} onChange={(e) => { const n = [...diagnosticos]; n[idx].tipo = e.target.value; setDiagnosticos(n); }} className="px-3 py-2 border rounded-lg text-sm bg-white">
                  <option value="PRESUNTIVO">PRESUNTIVO</option>
                  <option value="DEFINITIVO">DEFINITIVO</option>
                </select>
              </div>
            ))}
            {diagnosticos.length === 0 && <p className="text-xs text-slate-500 italic text-center py-2">Ningún diagnóstico agregado aún.</p>}
          </div>
        </div>

        {/* ===== APTITUD MÉDICA ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">M. APTITUD MÉDICA PARA EL PUESTO</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            {['APTO', 'APTO EN OBSERVACION', 'APTO CON LIMITACIONES', 'NO APTO'].map(opcion => (
              <label key={opcion} className={`px-4 py-2 border rounded-lg cursor-pointer font-bold text-xs transition-colors ${aptitudMedica === opcion ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                <input type="radio" name="aptitud" value={opcion} checked={aptitudMedica === opcion} onChange={() => setAptitudMedica(opcion)} className="hidden" />
                {opcion}
              </label>
            ))}
          </div>
          <textarea value={observacionesAptitud} onChange={e => setObservacionesAptitud(e.target.value)} placeholder="Observaciones de la aptitud..." rows={2} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 mb-3" />
          <textarea value={recomendaciones} onChange={e => setRecomendaciones(e.target.value)} placeholder="N. RECOMENDACIONES..." rows={3} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <button type="button" onClick={() => navigate(`/trabajador/${trabajadorId}`)} className="px-6 py-2.5 rounded-lg border border-slate-300 font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="button" onClick={guardarEvaluacionPreocupacional} disabled={guardando} className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : '💾 Guardar Evaluación Preocupacional'}
          </button>
        </div>

      </form>
    </div>
  );
}
