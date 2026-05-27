import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Trabajador, EvaluacionMedica } from '../types';

export default function DetalleTrabajador() {
  const { trabajadorId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const evalIdParam = searchParams.get('evalId');

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

        const q = query(collection(db, 'evaluaciones'), where('trabajadorId', '==', trabajadorId));
        const querySnapshot = await getDocs(q);
        const evals: EvaluacionMedica[] = [];
        querySnapshot.forEach((doc) => {
          evals.push({ id: doc.id, ...doc.data() } as EvaluacionMedica);
        });

        // Ordenamiento seguro por fecha
        evals.sort((a: any, b: any) => {
          const dateA = a.fecha?.seconds ? a.fecha.seconds : new Date(a.fecha).getTime() / 1000;
          const dateB = b.fecha?.seconds ? b.fecha.seconds : new Date(b.fecha).getTime() / 1000;
          return dateB - dateA;
        });

        setEvaluaciones(evals);

        if (evalIdParam) {
          const index = evals.findIndex((e) => e.id === evalIdParam);
          if (index !== -1) setPestanaActiva(index);
        }
      } catch (error) {
        console.error("Error al cargar detalles:", error);
      } finally {
        setCargando(false);
      }
    };
    cargarDatos();
  }, [trabajadorId, evalIdParam]);

  const formatFecha = (fecha: any): string => {
    if (!fecha) return '-';
    if (fecha.seconds) return new Date(fecha.seconds * 1000).toLocaleDateString('es-EC');
    if (fecha instanceof Date) return fecha.toLocaleDateString('es-EC');
    return String(fecha);
  };

  const formatFechaHora = (fecha: any): string => {
    if (!fecha) return '-';
    if (fecha.seconds) return new Date(fecha.seconds * 1000).toLocaleString('es-EC');
    if (fecha instanceof Date) return fecha.toLocaleString('es-EC');
    return String(fecha);
  };

  // Generador PDF optimizado para multi-página
  const generarPDF = async () => {
    if (!pdfRef.current || !trabajador) return;
    setExportando(true);
    try {
      const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = 297; // A4 height in mm
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      // Si el formato es más largo que una hoja A4, añade páginas adicionales
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`SO-RE-38_${trabajador.cedula}.pdf`);
    } catch (error) {
      console.error("Error generando PDF", error);
      alert("Hubo un error al generar el PDF.");
    } finally {
      setExportando(false);
    }
  };

  const exportarExcel = () => {
    const ev: any = evaluaciones[pestanaActiva];
    if (!ev || !trabajador) return;

    const diag = Array.isArray(ev.diagnosticos) ? ev.diagnosticos.map((d: any) => d.descripcion).join('; ') : (ev.diagnosticos || 'Ninguno');
    const recom = Array.isArray(ev.recomendaciones) ? ev.recomendaciones.join('; ') : (ev.recomendaciones || 'Ninguna');

    const rows = [
      ['DATO', 'VALOR'],
      ['Nombres Completos', `${trabajador.primerApellido} ${trabajador.segundoApellido || ''} ${trabajador.primerNombre} ${trabajador.segundoNombre || ''}`],
      ['Cédula', trabajador.cedula],
      ['Puesto de Trabajo', trabajador.puestoTrabajo],
      ['Fecha de Evaluación', formatFecha(ev.fecha)],
      ['N° Historia Clínica', ev.numeroHistoriaClinica || '-'],
      ['Aptitud Médica', ev.aptitudMedica || ev.aptitud || 'Pendiente'],
      ['Diagnósticos', diag],
      ['Presión Arterial', `${ev.signosVitales?.presionSistolica || '-'}/${ev.signosVitales?.presionDiastolica || '-'} mmHg`],
      ['IMC', ev.signosVitales?.imc || '-'],
      ['Recomendaciones', recom]
    ];

    const csvContent = "\ufeff" + rows.map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Ficha_Excel_${trabajador.cedula}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (cargando) return <div className="min-h-screen p-8 text-center text-slate-500 font-bold">Cargando expediente...</div>;
  if (!trabajador) return <div className="min-h-screen p-8 text-center text-red-500 font-bold">Trabajador no encontrado</div>;

  const ev: any = evaluaciones[pestanaActiva] || null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Panel de Control del Sistema (No se exporta) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {trabajador.primerApellido} {trabajador.segundoApellido || ''} {trabajador.primerNombre} {trabajador.segundoNombre || ''}
            </h1>
            <p className="text-slate-500 text-sm mt-1">CI: {trabajador.cedula} · Puesto: {trabajador.puestoTrabajo}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 text-sm">Volver</button>
            <button onClick={() => navigate(`/evaluar/${trabajador.id}`)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm text-sm">+ Nueva Evaluación</button>
          </div>
        </div>

        {evaluaciones.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
            Este trabajador no tiene evaluaciones registradas.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50">
              {evaluaciones.map((evalItem, idx) => (
                <button
                  key={evalItem.id}
                  onClick={() => setPestanaActiva(idx)}
                  className={`px-6 py-4 font-semibold whitespace-nowrap transition-colors text-sm ${
                    pestanaActiva === idx ? 'border-b-2 border-blue-600 text-blue-700 bg-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {formatFecha(evalItem.fecha)}
                </button>
              ))}
            </div>

            {ev && (
              <>
                <div className="p-4 bg-white border-b border-slate-100 flex justify-end gap-3">
                  <button onClick={exportarExcel} className="px-4 py-2 bg-[#107c41] text-white font-semibold rounded-lg hover:bg-[#0c5c30] flex items-center gap-2 text-sm shadow-sm">
                    📊 Exportar a Excel
                  </button>
                  <button onClick={generarPDF} disabled={exportando} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm shadow-sm">
                    {exportando ? 'Generando...' : '📄 Exportar SO-RE-38 (PDF)'}
                  </button>
                </div>

                {/* EL DOCUMENTO A EXPORTAR - ESTILO EXCEL ESTRICTO */}
                <div className="p-4 md:p-8 overflow-x-auto bg-slate-200 flex justify-center">
                  
                  {/* Contenedor A4 Dinámico */}
                  <div ref={pdfRef} className="bg-white p-6 w-[210mm] text-[9px] text-black font-sans leading-tight">
                    
                    {/* CABECERA */}
                    <table className="w-full border-collapse border border-black mb-2 text-center text-[10px]">
                      <tbody>
                        <tr>
                          <td rowSpan={3} className="border border-black w-1/4 font-bold text-xs p-2 uppercase">CEM AUSTROGAS</td>
                          <td rowSpan={2} className="border border-black w-2/4 font-bold text-[11px] p-2">HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN PERIÓDICA</td>
                          <td className="border border-black w-1/4 text-left px-2 py-1 text-[9px]">Código: SO-RE-38</td>
                        </tr>
                        <tr>
                          <td className="border border-black text-left px-2 py-1 text-[9px]">Revisión: 1</td>
                        </tr>
                        <tr>
                          <td className="border border-black font-bold text-[9px] p-1">MACROPROCESO: PLANIFICACIÓN, SEGURIDAD Y AMBIENTE</td>
                          <td className="border border-black text-left px-2 py-1 text-[9px]">Página: 1 de 2</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* A. DATOS DEL ESTABLECIMIENTO */}
                    <div className="bg-slate-300 font-bold px-1 border border-black border-b-0">A. DATOS DEL ESTABLECIMIENTO - EMPRESA Y USUARIO</div>
                    <table className="w-full border-collapse border border-black mb-2 text-center">
                      <tbody>
                        <tr className="bg-slate-100 font-semibold">
                          <td className="border border-black p-1">INSTITUCIÓN DEL SISTEMA</td>
                          <td className="border border-black p-1">RUC</td>
                          <td className="border border-black p-1">CIU</td>
                          <td className="border border-black p-1">ESTABLECIMIENTO DE SALUD</td>
                          <td className="border border-black p-1">NÚMERO DE HISTORIA CLÍNICA</td>
                          <td className="border border-black p-1">NÚMERO DE ARCHIVO</td>
                        </tr>
                        <tr>
                          <td className="border border-black p-1">CEM AUSTROGAS</td>
                          <td className="border border-black p-1">190070301001</td>
                          <td className="border border-black p-1">4661.0</td>
                          <td className="border border-black p-1">MEDICINA OCUPACIONAL</td>
                          <td className="border border-black p-1">{ev.numeroHistoriaClinica || trabajador.cedula}</td>
                          <td className="border border-black p-1">{ev.numeroArchivo || '-'}</td>
                        </tr>
                        <tr className="bg-slate-100 font-semibold">
                          <td className="border border-black p-1">PRIMER APELLIDO</td>
                          <td className="border border-black p-1">SEGUNDO APELLIDO</td>
                          <td className="border border-black p-1">PRIMER NOMBRE</td>
                          <td className="border border-black p-1">SEGUNDO NOMBRE</td>
                          <td className="border border-black p-1">SEXO</td>
                          <td className="border border-black p-1">PUESTO DE TRABAJO</td>
                        </tr>
                        <tr className="uppercase">
                          <td className="border border-black p-1">{trabajador.primerApellido}</td>
                          <td className="border border-black p-1">{trabajador.segundoApellido || '-'}</td>
                          <td className="border border-black p-1">{trabajador.primerNombre}</td>
                          <td className="border border-black p-1">{trabajador.segundoNombre || '-'}</td>
                          <td className="border border-black p-1">{trabajador.sexo}</td>
                          <td className="border border-black p-1">{trabajador.puestoTrabajo}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* B. MOTIVO DE CONSULTA */}
                    <div className="bg-slate-300 font-bold px-1 border border-black border-b-0">B. MOTIVO DE CONSULTA</div>
                    <div className="border border-black p-1 mb-2 min-h-[30px]">{ev.motivoConsulta || 'EVALUACIÓN MÉDICA OCUPACIONAL PERIÓDICA'}</div>

                    {/* C. ANTECEDENTES PERSONALES */}
                    <div className="bg-slate-300 font-bold px-1 border border-black border-b-0">C. ANTECEDENTES PERSONALES</div>
                    <div className="border border-black p-1 mb-2">
                      <p className="font-bold">Clínicos y Quirúrgicos:</p>
                      <p>{ev.antecedentesClinicosQuirurgicos || ev.antecedentesPersonales || 'Sin antecedentes relevantes reportados.'}</p>
                      
                      {ev.habitosToxicos && ev.habitosToxicos.length > 0 && (
                        <div className="mt-1">
                          <p className="font-bold">Hábitos Tóxicos:</p>
                          <p>{ev.habitosToxicos.map((h:any) => `${h.tipo}: ${h.consume ? 'Consume' : 'No Consume'}`).join(' | ')}</p>
                        </div>
                      )}
                    </div>

                    {/* D. ANTECEDENTES FAMILIARES */}
                    <div className="bg-slate-300 font-bold px-1 border border-black border-b-0">D. ANTECEDENTES FAMILIARES</div>
                    <div className="border border-black p-1 mb-2">
                      {typeof ev.antecedentesFamiliares === 'string' ? <p>{ev.antecedentesFamiliares}</p> : 
                       ev.antecedentesFamiliares && ev.antecedentesFamiliares.length > 0 ? (
                        ev.antecedentesFamiliares.map((af: any, i: number) => (
                          <span key={i} className="mr-4"><span className="font-bold">{af.tipo}</span> ({af.parentesco}): {af.descripcion}</span>
                        ))
                      ) : <p>No se refieren antecedentes familiares de importancia.</p>}
                    </div>

                    {/* F. ENFERMEDAD ACTUAL */}
                    <div className="bg-slate-300 font-bold px-1 border border-black border-b-0">F. ENFERMEDAD ACTUAL</div>
                    <div className="border border-black p-1 mb-2 min-h-[25px]">{ev.enfermedadActual || 'PACIENTE ASINTOMÁTICO AL MOMENTO DE LA VALORACIÓN.'}</div>

                    {/* G. REVISIÓN DE ÓRGANOS Y SISTEMAS */}
                    <div className="bg-slate-300 font-bold px-1 border border-black border-b-0">G. REVISIÓN DE ÓRGANOS Y SISTEMAS</div>
                    <div className="border border-black p-1 mb-2">
                      {ev.revisionSistemasSeleccionados && ev.revisionSistemasSeleccionados.length > 0 ? (
                        <>
                          <span className="font-bold">Sistemas afectados: </span>{ev.revisionSistemasSeleccionados.join(', ')}<br/>
                          <span className="font-bold">Descripción: </span>{ev.revisionSistemasDescripcion}
                        </>
                      ) : (
                        "Paciente no refiere síntomas adicionales o relevantes al momento de la consulta."
                      )}
                    </div>

                    {/* H. CONSTANTES VITALES */}
                    <div className="bg-slate-300 font-bold px-1 border border-black border-b-0">H. CONSTANTES VITALES Y ANTROPOMETRÍA</div>
                    <table className="w-full border-collapse border border-black mb-2 text-center">
                      <tbody>
                        <tr className="bg-slate-100 font-semibold">
                          <td className="border border-black p-1">PRESIÓN ARTERIAL</td>
                          <td className="border border-black p-1">TEMPERATURA °C</td>
                          <td className="border border-black p-1">FRECUENCIA CARDÍACA (lpm)</td>
                          <td className="border border-black p-1">SATURACIÓN O2 (%)</td>
                          <td className="border border-black p-1">FRECUENCIA RESP. (rpm)</td>
                          <td className="border border-black p-1">PESO (Kg)</td>
                          <td className="border border-black p-1">TALLA (cm)</td>
                          <td className="border border-black p-1">IMC</td>
                          <td className="border border-black p-1">PERÍMETRO ABDOMINAL</td>
                        </tr>
                        <tr>
                          <td className="border border-black p-1">{ev.signosVitales?.presionSistolica || ev.signosVitales?.presionArterial || '-'}/{ev.signosVitales?.presionDiastolica || ''}</td>
                          <td className="border border-black p-1">{ev.signosVitales?.temperatura || '-'}</td>
                          <td className="border border-black p-1">{ev.signosVitales?.frecuenciaCardiaca || '-'}</td>
                          <td className="border border-black p-1">{ev.signosVitales?.saturacion || '-'}</td>
                          <td className="border border-black p-1">{ev.signosVitales?.frecuenciaRespiratoria || '-'}</td>
                          <td className="border border-black p-1">{ev.signosVitales?.peso || '-'}</td>
                          <td className="border border-black p-1">{ev.signosVitales?.talla || '-'}</td>
                          <td className="border border-black p-1 font-bold">{ev.signosVitales?.imc || '-'}</td>
                          <td className="border border-black p-1">{ev.signosVitales?.perimetroAbdominal || '-'}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* I. EXAMEN FÍSICO REGIONAL */}
                    <div className="bg-slate-300 font-bold px-1 border border-black border-b-0">I. EXAMEN FÍSICO REGIONAL</div>
                    <div className="border border-black p-1 mb-2">
                      {ev.examenFisicoHallazgos && ev.examenFisicoHallazgos.length > 0 ? (
                        ev.examenFisicoHallazgos.map((h: any, i: number) => (
                          <div key={i}><span className="font-bold">{h.region} ({h.subregion}):</span> {h.descripcion}</div>
                        ))
                      ) : (
                        "Sin hallazgos patológicos al examen físico regional."
                      )}
                    </div>

                    {/* K. DIAGNÓSTICO */}
                    <div className="bg-slate-300 font-bold px-1 border border-black border-b-0">K. DIAGNÓSTICO</div>
                    <table className="w-full border-collapse border border-black mb-2">
                      <tbody>
                        <tr className="bg-slate-100 text-center font-semibold">
                          <td className="border border-black p-1 w-3/5">DESCRIPCIÓN</td>
                          <td className="border border-black p-1 w-1/5">CIE-10</td>
                          <td className="border border-black p-1 w-1/5">PRE / DEF</td>
                        </tr>
                        {Array.isArray(ev.diagnosticos) && ev.diagnosticos.length > 0 ? (
                          ev.diagnosticos.map((dx: any, i: number) => (
                            <tr key={i} className="text-center">
                              <td className="border border-black p-1 text-left uppercase">{dx.descripcion}</td>
                              <td className="border border-black p-1">{dx.cie || '-'}</td>
                              <td className="border border-black p-1 uppercase">{dx.tipo === 'definitivo' ? 'DEF' : 'PRE'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="border border-black p-1 uppercase">{typeof ev.diagnosticos === 'string' ? ev.diagnosticos : 'PACIENTE SANO.'}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* L. APTITUD MÉDICA */}
                    <div className="bg-slate-300 font-bold px-1 border border-black border-b-0">L. APTITUD MÉDICA PARA EL TRABAJO</div>
                    <table className="w-full border-collapse border border-black mb-2 text-center">
                      <tbody>
                        <tr className="bg-slate-100 font-semibold">
                          <td className="border border-black p-1 w-1/4">APTO</td>
                          <td className="border border-black p-1 w-1/4">APTO EN OBSERVACIÓN</td>
                          <td className="border border-black p-1 w-1/4">APTO CON LIMITACIONES</td>
                          <td className="border border-black p-1 w-1/4">NO APTO</td>
                        </tr>
                        <tr className="text-sm">
                          <td className="border border-black p-1 font-bold">{(!ev.aptitudMedica || ev.aptitudMedica === 'apto') ? 'X' : ''}</td>
                          <td className="border border-black p-1 font-bold">{ev.aptitudMedica === 'aptoObservacion' ? 'X' : ''}</td>
                          <td className="border border-black p-1 font-bold">{ev.aptitudMedica === 'aptoLimitaciones' ? 'X' : ''}</td>
                          <td className="border border-black p-1 font-bold">{ev.aptitudMedica === 'noApto' ? 'X' : ''}</td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="border border-black p-1 text-left">
                            <strong>Observación: </strong> {ev.aptitudObservacion || '-'}<br/>
                            <strong>Limitación: </strong> {ev.aptitudLimitaciones || '-'}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* M. RECOMENDACIONES */}
                    <div className="bg-slate-300 font-bold px-1 border border-black border-b-0">M. RECOMENDACIONES Y/O TRATAMIENTO</div>
                    <div className="border border-black p-1 mb-2 min-h-[40px]">
                      {Array.isArray(ev.recomendaciones) ? ev.recomendaciones.join('; ') : (ev.recomendaciones || 'Ninguna particular al momento.')}
                      {ev.recomendacionesOtras ? `; ${ev.recomendacionesOtras}` : ''}
                    </div>

                    {/* CERTIFICADO LEGAL */}
                    <div className="border border-black p-1 font-bold text-justify mb-2 leading-tight">
                      CERTIFICO QUE LO ANTERIORMENTE EXPRESADO EN RELACIÓN A MI ESTADO DE SALUD ES VERDAD. SE ME HA INFORMADO LAS MEDIDAS PREVENTIVAS A TOMAR PARA DISMINUIR O MITIGAR LOS RIESGOS RELACIONADOS CON MI ACTIVIDAD LABORAL.
                    </div>

                    {/* N. FIRMAS */}
                    <div className="bg-slate-300 font-bold px-1 border border-black border-b-0">N. DATOS DEL PROFESIONAL</div>
                    <table className="w-full border-collapse border border-black text-center">
                      <tbody>
                        <tr className="bg-slate-100 font-semibold">
                          <td className="border border-black p-1 w-1/5">FECHA DE ATENCIÓN</td>
                          <td className="border border-black p-1 w-1/5">MÉDICO EXAMINADOR</td>
                          <td className="border border-black p-1 w-1/5">CÓDIGO MÉDICO</td>
                          <td className="border border-black p-1 w-1/5">FIRMA MÉDICO</td>
                          <td className="border border-black p-1 w-1/5">FIRMA PACIENTE</td>
                        </tr>
                        <tr>
                          <td className="border border-black p-1 h-14 align-bottom">{formatFechaHora(ev.fecha)}</td>
                          <td className="border border-black p-1 h-14 align-bottom uppercase">{ev.medicoNombre || 'MÉDICO OCUPACIONAL'}</td>
                          <td className="border border-black p-1 h-14 align-bottom">{ev.medicoCedula || '-'}</td>
                          <td className="border border-black p-1 h-14"></td>
                          <td className="border border-black p-1 h-14"></td>
                        </tr>
                      </tbody>
                    </table>

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
