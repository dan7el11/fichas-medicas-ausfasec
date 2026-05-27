import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Trabajador, EvaluacionMedica } from '../types';

export default function DetalleTrabajador() {
  const { trabajadorId } = useParams();
  const navigate = useNavigate();
  const [trabajador, setTrabajador] = useState<Trabajador | null>(null);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionMedica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pestanaActiva, setPestanaActiva] = useState(0);
  const [exportando, setExportando] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cargarDatos = async () => {
      if (!trabajadorId) return;
      try {
        const docRef = doc(db, 'trabajadores', trabajadorId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTrabajador({ id: docSnap.id, ...docSnap.data() } as Trabajador);
        }

        const q = query(
          collection(db, 'evaluaciones'),
          where('trabajadorId', '==', trabajadorId),
          orderBy('fecha', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const evals: EvaluacionMedica[] = [];
        querySnapshot.forEach((doc) => {
          evals.push({ id: doc.id, ...doc.data() } as EvaluacionMedica);
        });
        setEvaluaciones(evals);
      } catch (error) {
        console.error("Error al cargar detalles:", error);
      } finally {
        setCargando(false);
      }
    };
    cargarDatos();
  }, [trabajadorId]);

  const formatFecha = (fecha: any): string => {
    if (!fecha) return 'Sin fecha';
    if (fecha.seconds) return new Date(fecha.seconds * 1000).toLocaleDateString('es-EC');
    if (fecha instanceof Date) return fecha.toLocaleDateString('es-EC');
    return String(fecha);
  };

  const formatFechaHora = (fecha: any): string => {
    if (!fecha) return 'Sin fecha';
    if (fecha.seconds) return new Date(fecha.seconds * 1000).toLocaleString('es-EC');
    if (fecha instanceof Date) return fecha.toLocaleString('es-EC');
    return String(fecha);
  };

  const generarPDF = async () => {
    if (!pdfRef.current || !trabajador) return;
    setExportando(true);
    try {
      const canvas = await html2canvas(pdfRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Ficha_${trabajador.primerApellido}_${trabajador.primerNombre}.pdf`);
    } catch (error) {
      console.error("Error generando PDF", error);
      alert("Hubo un error al generar el PDF.");
    } finally {
      setExportando(false);
    }
  };

  // NUEVA FUNCIÓN: Exportar pestaña actual a Excel (CSV)
  const exportarExcel = () => {
    const ev = evaluaciones[pestanaActiva];
    if (!ev || !trabajador) return;

    const rows = [
      ['DATO', 'VALOR'],
      ['Nombres Completos', `${trabajador.primerApellido} ${trabajador.segundoApellido} ${trabajador.primerNombre} ${trabajador.segundoNombre}`],
      ['Cédula', trabajador.cedula],
      ['Puesto de Trabajo', trabajador.puestoTrabajo],
      ['Fecha de Evaluación', formatFecha(ev.fecha)],
      ['N° Historia Clínica', ev.numeroHistoriaClinica || '-'],
      ['Aptitud Médica', ev.aptitudMedica || 'Pendiente'],
      ['Diagnósticos', ev.diagnosticos?.map(d => d.descripcion).join('; ') || 'Ninguno'],
      ['Presión Arterial', `${ev.signosVitales?.presionSistolica || '-'}/${ev.signosVitales?.presionDiastolica || '-'} mmHg`],
      ['IMC', ev.signosVitales?.imc || '-'],
      ['Recomendaciones', ev.recomendaciones?.join('; ') || 'Ninguna']
    ];

    const csvContent = "\ufeff" + rows.map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Ficha_Excel_${trabajador.cedula}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (cargando) return <div className="min-h-screen p-8 text-center text-slate-500 font-bold">Cargando expediente...</div>;
  if (!trabajador) return <div className="min-h-screen p-8 text-center text-red-500 font-bold">Trabajador no encontrado</div>;

  const ev = evaluaciones[pestanaActiva] || null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Cabecera del Trabajador */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {trabajador.primerApellido} {trabajador.segundoApellido} {trabajador.primerNombre} {trabajador.segundoNombre}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              CI: {trabajador.cedula} · Sexo: {trabajador.sexo === 'M' ? 'Masculino' : 'Femenino'} · Puesto: {trabajador.puestoTrabajo}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 text-sm">
              Volver
            </button>
            <button
              onClick={() => navigate(`/evaluar/${trabajador.id}`)}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm text-sm"
            >
              + Nueva Evaluación
            </button>
          </div>
        </div>

        {evaluaciones.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
            Este trabajador no tiene evaluaciones registradas.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Pestañas */}
            <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50">
              {evaluaciones.map((evalItem, idx) => (
                <button
                  key={evalItem.id}
                  onClick={() => setPestanaActiva(idx)}
                  className={`px-6 py-4 font-semibold whitespace-nowrap transition-colors text-sm ${
                    pestanaActiva === idx
                      ? 'border-b-2 border-blue-600 text-blue-700 bg-white'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {formatFecha(evalItem.fecha)}
                </button>
              ))}
            </div>

            {ev && (
              <>
                {/* NUEVOS BOTONES DE EXPORTACIÓN */}
                <div className="p-4 bg-white border-b border-slate-100 flex justify-end gap-3">
                  <button 
                    onClick={exportarExcel}
                    className="px-4 py-2 bg-[#107c41] text-white font-semibold rounded-lg hover:bg-[#0c5c30] transition-colors flex items-center gap-2 text-sm shadow-sm"
                  >
                    📊 Exportar a Excel
                  </button>
                  <button 
                    onClick={generarPDF}
                    disabled={exportando}
                    className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm shadow-sm"
                  >
                    {exportando ? 'Generando...' : '📄 Exportar a PDF'}
                  </button>
                </div>

                {/* Contenido de la evaluación (El documento a renderizar) */}
                <div className="p-6 md:p-8" ref={pdfRef}>
                  <div className="text-center mb-6 pb-4 border-b-2 border-slate-300">
                    <h2 className="text-xl font-bold uppercase text-slate-800">CEM AUSTROGAS</h2>
                    <p className="text-sm font-semibold text-slate-600">HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN PERIÓDICA (SO-RE-38)</p>
                    <div className="flex justify-center gap-8 mt-2 text-xs text-slate-500">
                      <span>N° Historia: {ev.numeroHistoriaClinica}</span>
                      <span>N° Archivo: {ev.numeroArchivo}</span>
                      <span>Fecha: {formatFechaHora(ev.fecha)}</span>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <section>
                      <h3 className="text-xs font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">A. DATOS DEL ESTABLECIMIENTO Y USUARIO</h3>
                      <div className="border border-slate-300 border-t-0 rounded-b p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div><span className="font-semibold">Institución:</span> CEM AUSTROGAS</div>
                        <div><span className="font-semibold">RUC:</span> 190070301001</div>
                        <div><span className="font-semibold">Nombres:</span> {trabajador.primerNombre} {trabajador.segundoNombre}</div>
                        <div><span className="font-semibold">Apellidos:</span> {trabajador.primerApellido} {trabajador.segundoApellido}</div>
                        <div><span className="font-semibold">Cédula:</span> {trabajador.cedula}</div>
                        <div><span className="font-semibold">Sexo:</span> {trabajador.sexo}</div>
                        <div className="col-span-2"><span className="font-semibold">Puesto:</span> {trabajador.puestoTrabajo}</div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">B. MOTIVO DE CONSULTA</h3>
                      <div className="border border-slate-300 border-t-0 rounded-b p-3 text-xs">
                        {ev.motivoConsulta || 'No especificado'}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">C. ANTECEDENTES PERSONALES</h3>
                      <div className="border border-slate-300 border-t-0 rounded-b p-3 space-y-3 text-xs">
                        <div>
                          <p className="font-bold text-slate-700 mb-1">Antecedentes Clínicos y Quirúrgicos:</p>
                          <p>{ev.antecedentesClinicosQuirurgicos || 'Sin registros'}</p>
                        </div>

                        {ev.habitosToxicos && ev.habitosToxicos.length > 0 && (
                          <div>
                            <p className="font-bold text-slate-700 mb-1">Hábitos Tóxicos:</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              {ev.habitosToxicos.map((h, i) => (
                                <div key={i} className="bg-slate-50 p-2 rounded">
                                  <span className="font-semibold capitalize">{h.tipo}: </span>
                                  {h.consume ? `Consume (${h.tiempoConsumo || '?'} meses, ${h.cantidad || '?'})` :
                                   h.exConsumidor ? `Ex consumidor (${h.tiempoAbstinencia || '?'} meses abstinencia)` :
                                   'No consume'}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {ev.estiloVida && (
                          <div>
                            <p className="font-bold text-slate-700 mb-1">Estilo de Vida:</p>
                            <p>
                              Actividad física: {ev.estiloVida.actividadFisica ? `Sí — ${ev.estiloVida.tipoActividad || ''} (${ev.estiloVida.tiempoCantidad || ''})` : 'No'}
                              {ev.estiloVida.medicacionHabitual && ` · Medicación: ${ev.estiloVida.medicacionHabitual} (${ev.estiloVida.medicacionCantidad || ''})`}
                            </p>
                          </div>
                        )}

                        <div>
                          <p className="font-bold text-slate-700 mb-1">Incidentes:</p>
                          <p>{ev.incidentes || 'NINGUNO'}</p>
                        </div>

                        {ev.accidentesTrabajo?.descripcion && (
                          <div>
                            <p className="font-bold text-slate-700 mb-1">Accidentes de Trabajo:</p>
                            <p>{ev.accidentesTrabajo.descripcion}</p>
                            {ev.accidentesTrabajo.calificado && <p>Calificado IESS: {ev.accidentesTrabajo.especificacion}</p>}
                            {ev.accidentesTrabajo.observaciones && <p>Obs: {ev.accidentesTrabajo.observaciones}</p>}
                          </div>
                        )}

                        {ev.enfermedadesProfesionales?.descripcion && (
                          <div>
                            <p className="font-bold text-slate-700 mb-1">Enfermedades Profesionales:</p>
                            <p>{ev.enfermedadesProfesionales.descripcion}</p>
                            {ev.enfermedadesProfesionales.calificada && <p>Calificada IESS: {ev.enfermedadesProfesionales.especificacion}</p>}
                            {ev.enfermedadesProfesionales.observaciones && <p>Obs: {ev.enfermedadesProfesionales.observaciones}</p>}
                          </div>
                        )}
                      </div>
                    </section>

                    {ev.antecedentesFamiliares && ev.antecedentesFamiliares.length > 0 && (
                      <section>
                        <h3 className="text-xs font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">D. ANTECEDENTES FAMILIARES</h3>
                        <div className="border border-slate-300 border-t-0 rounded-b p-3 text-xs space-y-1">
                          {ev.antecedentesFamiliares.map((af, i) => (
                            <p key={i}><span className="font-semibold">{af.tipo}:</span> {af.parentesco} — {af.descripcion}</p>
                          ))}
                        </div>
                      </section>
                    )}

                    <section>
                      <h3 className="text-xs font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">F. ENFERMEDAD ACTUAL</h3>
                      <div className="border border-slate-300 border-t-0 rounded-b p-3 text-xs">
                        {ev.enfermedadActual || 'Sin novedad'}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">G. REVISIÓN DE ÓRGANOS Y SISTEMAS</h3>
                      <div className="border border-slate-300 border-t-0 rounded-b p-3 text-xs">
                        {ev.revisionSistemasSeleccionados && ev.revisionSistemasSeleccionados.length > 0 ? (
                          <>
                            <p className="font-semibold mb-1">Sistemas afectados: {ev.revisionSistemasSeleccionados.join(', ')}</p>
                            <p>{ev.revisionSistemasDescripcion}</p>
                          </>
                        ) : (
                          <p className="text-green-700">Paciente no refiere síntomas adicionales o relevantes al momento de la consulta</p>
                        )}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">H. CONSTANTES VITALES Y ANTROPOMETRÍA</h3>
                      <div className="border border-slate-300 border-t-0 rounded-b p-3">
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 text-xs">
                          <div className="bg-slate-50 p-2 rounded">
                            <p className="text-slate-500">Presión Arterial</p>
                            <p className="font-bold">{ev.signosVitales?.presionSistolica || '-'}/{ev.signosVitales?.presionDiastolica || '-'} mmHg</p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded">
                            <p className="text-slate-500">Temperatura</p>
                            <p className="font-bold">{ev.signosVitales?.temperatura || '-'} °C</p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded">
                            <p className="text-slate-500">Frec. Cardíaca</p>
                            <p className="font-bold">{ev.signosVitales?.frecuenciaCardiaca || '-'} lat/min</p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded">
                            <p className="text-slate-500">Saturación O₂</p>
                            <p className="font-bold">{ev.signosVitales?.saturacion || '-'} %</p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded">
                            <p className="text-slate-500">Frec. Respiratoria</p>
                            <p className="font-bold">{ev.signosVitales?.frecuenciaRespiratoria || '-'} fr/min</p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded">
                            <p className="text-slate-500">Peso</p>
                            <p className="font-bold">{ev.signosVitales?.peso || '-'} Kg</p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded">
                            <p className="text-slate-500">Talla</p>
                            <p className="font-bold">{ev.signosVitales?.talla || '-'} cm</p>
                          </div>
                          <div className="bg-blue-50 p-2 rounded border border-blue-200">
                            <p className="text-blue-600">IMC</p>
                            <p className="font-bold text-blue-800">{ev.signosVitales?.imc || '-'} Kg/m²</p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded">
                            <p className="text-slate-500">Perímetro Abd.</p>
                            <p className="font-bold">{ev.signosVitales?.perimetroAbdominal || '-'} cm</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">I. EXAMEN FÍSICO REGIONAL</h3>
                      <div className="border border-slate-300 border-t-0 rounded-b p-3 text-xs">
                        {ev.examenFisicoHallazgos && ev.examenFisicoHallazgos.length > 0 ? (
                          <div className="space-y-1">
                            {ev.examenFisicoHallazgos.map((h, i) => (
                              <p key={i}><span className="font-bold text-blue-700">{h.codigo}:</span> {h.region} — {h.subregion}: {h.descripcion}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-green-700">Sin signos relevantes al momento de la consulta</p>
                        )}
                      </div>
                    </section>

                    {ev.examenesComplementarios && ev.examenesComplementarios.length > 0 && (
                      <section>
                        <h3 className="text-xs font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">J. RESULTADOS DE EXÁMENES</h3>
                        <div className="border border-slate-300 border-t-0 rounded-b p-3 text-xs">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b text-left">
                                <th className="pb-1 font-semibold">Examen</th>
                                <th className="pb-1 font-semibold">Fecha</th>
                                <th className="pb-1 font-semibold">Resultado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ev.examenesComplementarios.map((ex, i) => (
                                <tr key={i} className="border-b border-slate-100">
                                  <td className="py-1">{ex.nombre}</td>
                                  <td className="py-1">{ex.fecha}</td>
                                  <td className="py-1">{ex.resultado}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}

                    {ev.diagnosticos && ev.diagnosticos.length > 0 && (
                      <section>
                        <h3 className="text-xs font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">K. DIAGNÓSTICO</h3>
                        <div className="border border-slate-300 border-t-0 rounded-b p-3 text-xs space-y-1">
                          {ev.diagnosticos.map((dx, i) => (
                            <p key={i}>
                              <span className="font-semibold">{i + 1}.</span> {dx.descripcion}
                              {dx.cie && <span className="ml-2 text-slate-500">(CIE: {dx.cie})</span>}
                              <span className={`ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                dx.tipo === 'definitivo' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {dx.tipo === 'definitivo' ? 'DEF' : 'PRE'}
                              </span>
                            </p>
                          ))}
                        </div>
                      </section>
                    )}

                    <section>
                      <h3 className="text-xs font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">L. APTITUD MÉDICA PARA EL TRABAJO</h3>
                      <div className="border border-slate-300 border-t-0 rounded-b p-3 text-xs">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${
                          ev.aptitudMedica === 'apto' ? 'bg-green-100 text-green-800' :
                          ev.aptitudMedica === 'aptoObservacion' ? 'bg-amber-100 text-amber-800' :
                          ev.aptitudMedica === 'aptoLimitaciones' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {ev.aptitudMedica === 'apto' ? 'APTO' :
                           ev.aptitudMedica === 'aptoObservacion' ? 'APTO EN OBSERVACIÓN' :
                           ev.aptitudMedica === 'aptoLimitaciones' ? 'APTO CON LIMITACIONES' :
                           'NO APTO'}
                        </span>
                        {ev.aptitudObservacion && <p className="mt-2"><span className="font-semibold">Observación:</span> {ev.aptitudObservacion}</p>}
                        {ev.aptitudLimitaciones && <p className="mt-2"><span className="font-semibold">Limitaciones:</span> {ev.aptitudLimitaciones}</p>}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">M. RECOMENDACIONES Y/O TRATAMIENTO</h3>
                      <div className="border border-slate-300 border-t-0 rounded-b p-3 text-xs">
                        {ev.recomendaciones && ev.recomendaciones.length > 0 ? (
                          <p>
                            {ev.recomendaciones.join(', ')}
                            {ev.recomendacionesOtras && `, ${ev.recomendacionesOtras}`}
                          </p>
                        ) : (
                          <p className="text-slate-500">Sin recomendaciones específicas</p>
                        )}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">N. DATOS DEL PROFESIONAL</h3>
                      <div className="border border-slate-300 border-t-0 rounded-b p-3 text-xs grid grid-cols-2 gap-4">
                        <div>
                          <p><span className="font-semibold">Nombre:</span> {ev.medicoNombre || 'No registrado'}</p>
                          <p><span className="font-semibold">Código:</span> {ev.medicoCedula || 'No registrado'}</p>
                          <p><span className="font-semibold">Fecha:</span> {formatFechaHora(ev.fecha)}</p>
                        </div>
                        <div className="flex items-center justify-center text-slate-400 italic">
                          Firma del usuario
                        </div>
                      </div>
                    </section>

                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
