import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function DetalleTrabajador() {
  const { trabajadorId } = useParams();
  const navigate = useNavigate();
  const [trabajador, setTrabajador] = useState<any>(null);
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pestañaActiva, setPestañaActiva] = useState(0);
  const [exportando, setExportando] = useState(false);
  
  // Referencia al contenedor que se convertirá en PDF
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cargarDatos = async () => {
      if (!trabajadorId) return;
      try {
        // 1. Cargar datos del trabajador
        const docRef = doc(db, 'trabajadores', trabajadorId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTrabajador({ id: docSnap.id, ...docSnap.data() });
        }

        // 2. Cargar todas sus evaluaciones ordenadas por fecha descendente
        const q = query(
          collection(db, 'evaluaciones'), 
          where('trabajadorId', '==', trabajadorId),
          orderBy('fecha', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const evals: any[] = [];
        querySnapshot.forEach((doc) => {
          evals.push({ id: doc.id, ...doc.data() });
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

  const generarPDF = async () => {
    if (!pdfRef.current) return;
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

  if (cargando) return <div className="min-h-screen p-8 text-center text-slate-500 font-bold">Cargando expediente...</div>;
  if (!trabajador) return <div className="min-h-screen p-8 text-center text-red-500 font-bold">Trabajador no encontrado</div>;

  const evaluacionActual = evaluaciones[pestañaActiva];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Cabecera del Trabajador y Botones de Acción */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Expediente: {trabajador.primerApellido} {trabajador.primerNombre}
            </h1>
            <p className="text-slate-500 font-medium">CI: {trabajador.cedula} | Puesto: {trabajador.puestoTrabajo}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200">
              Volver
            </button>
            <button 
              onClick={() => navigate(`/evaluar/${trabajador.id}`)} 
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm"
            >
              + Nueva Evaluación
            </button>
          </div>
        </div>

        {evaluaciones.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
            Este trabajador no tiene evaluaciones previas registradas.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Sistema de Pestañas */}
            <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50">
              {evaluaciones.map((ev, idx) => (
                <button
                  key={ev.id}
                  onClick={() => setPestañaActiva(idx)}
                  className={`px-6 py-4 font-semibold whitespace-nowrap transition-colors ${
                    pestañaActiva === idx 
                      ? 'border-b-2 border-blue-600 text-blue-700 bg-white' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Evaluación {new Date(ev.fecha?.seconds * 1000).toLocaleDateString()}
                </button>
              ))}
            </div>

            {/* Acciones de la Pestaña */}
            <div className="p-4 bg-white border-b border-slate-100 flex justify-end">
              <button 
                onClick={generarPDF}
                disabled={exportando}
                className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {exportando ? 'Generando...' : '📄 Exportar a PDF'}
              </button>
            </div>

            {/* Visualizador de la Evaluación (Lo que se convertirá en PDF) */}
            <div className="p-8 overflow-auto flex justify-center bg-slate-200">
              <div 
                ref={pdfRef} 
                className="bg-white shadow-lg p-10 w-[210mm] min-h-[297mm] text-xs text-slate-900 border border-slate-300"
              >
                {/* ENCABEZADO DEL DOCUMENTO PARA EL PDF */}
                <div className="text-center mb-6 pb-4 border-b-2 border-slate-800">
                  <h1 className="text-xl font-bold uppercase">CEM AUSTROGAS</h1>
                  <h2 className="text-md font-semibold">HISTORIA CLÍNICA OCUPACIONAL (SO-RE-38)</h2>
                  <p className="mt-2 font-bold">N° ARCHIVO: {evaluacionActual.numeroArchivo}</p>
                </div>

                {/* CONTENIDO RESUMIDO DE LA EVALUACIÓN */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><span className="font-bold">Nombres:</span> {trabajador.primerNombre} {trabajador.primerApellido}</div>
                    <div><span className="font-bold">Cédula:</span> {trabajador.cedula}</div>
                    <div><span className="font-bold">Tipo Examen:</span> {evaluacionActual.tipoExamen || 'PERIÓDICO'}</div>
                    <div><span className="font-bold">Fecha:</span> {new Date(evaluacionActual.fecha?.seconds * 1000).toLocaleDateString()}</div>
                  </div>

                  <div className="mt-4">
                    <h3 className="font-bold border-b border-slate-400 bg-slate-100 px-2 py-1">ANTECEDENTES</h3>
                    <p className="p-2 border border-slate-300 mt-1">{evaluacionActual.antecedentesPersonales || 'Sin registros'}</p>
                  </div>

                  <div className="mt-4">
                    <h3 className="font-bold border-b border-slate-400 bg-slate-100 px-2 py-1">SIGNOS VITALES</h3>
                    <div className="grid grid-cols-4 gap-2 border border-slate-300 p-2 mt-1">
                      <div><span className="font-bold">PA:</span> {evaluacionActual.signosVitales?.presionArterial}</div>
                      <div><span className="font-bold">FC:</span> {evaluacionActual.signosVitales?.frecuenciaCardiaca}</div>
                      <div><span className="font-bold">Peso:</span> {evaluacionActual.signosVitales?.peso} kg</div>
                      <div><span className="font-bold">IMC:</span> {evaluacionActual.signosVitales?.imc}</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h3 className="font-bold border-b border-slate-400 bg-slate-100 px-2 py-1">APTITUD Y DIAGNÓSTICO</h3>
                    <div className="border border-slate-300 p-2 mt-1">
                      <p><span className="font-bold">Aptitud:</span> {evaluacionActual.aptitud || 'Apto'}</p>
                      <p className="mt-2"><span className="font-bold">Diagnóstico:</span> {evaluacionActual.diagnosticos || 'Ninguno'}</p>
                      <p className="mt-2"><span className="font-bold">Recomendaciones:</span> {evaluacionActual.recomendaciones || 'Ninguna'}</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
