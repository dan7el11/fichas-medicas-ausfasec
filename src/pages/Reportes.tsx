import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import TopBar from '../components/dashboard/TopBar';
import { useNavigate } from 'react-router-dom';
import { workerStatus, lastEval, parseDate } from '../utils/medicalHelpers';
import type { Trabajador, EvaluacionMedica } from '../types';

export default function Reportes() {
  const navigate = useNavigate();
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionMedica[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const tSnap = await getDocs(collection(db, 'trabajadores'));
      const eSnap = await getDocs(collection(db, 'evaluaciones'));
      
      setTrabajadores(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Trabajador)));
      setEvaluaciones(eSnap.docs.map(d => ({ id: d.id, ...d.data() } as EvaluacionMedica)));
      setCargando(false);
    };
    fetchData();
  }, []);

  const exportarMatrizGlobalExcel = () => {
    const rows = [['CÉDULA', 'APELLIDOS', 'NOMBRES', 'PUESTO', 'ESTADO', 'ÚLTIMA EVAL.', 'APTITUD', 'RESTRICCIONES']];
    
    trabajadores.forEach(t => {
      const evals = evaluaciones.filter(e => e.trabajadorId === t.id);
      const le = lastEval(evals);
      const ws = workerStatus(evals);
      const ultimaFecha = le ? parseDate(le.fecha).toLocaleDateString('es-EC') : 'Ninguna';
      
      rows.push([
        t.cedula,
        `${t.primerApellido} ${t.segundoApellido || ''}`,
        `${t.primerNombre} ${t.segundoNombre || ''}`,
        t.puestoTrabajo,
        ws.label,
        ultimaFecha,
        le?.aptitudMedica || '-',
        le?.aptitudLimitaciones || le?.aptitudObservacion || '-'
      ]);
    });

    const csvContent = "\ufeff" + rows.map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "Matriz_Ocupacional_Global.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (cargando) return <div className="p-10 text-center font-bold text-slate-500">Calculando estadísticas...</div>;

  const aptos = trabajadores.filter(t => workerStatus(evaluaciones.filter(e => e.trabajadorId === t.id)).tone === 'success').length;

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex flex-col">
      <TopBar onNewWorker={() => navigate('/nuevo-trabajador')} />
      <div className="p-8 max-w-6xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Módulo de Reportes</h1>
          <button onClick={exportarMatrizGlobalExcel} className="px-4 py-2 bg-[#107c41] text-white font-semibold rounded-lg hover:bg-[#0c5c30] shadow-sm flex items-center gap-2">
            📊 Descargar Matriz Consolidada (Excel)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="text-slate-500 font-semibold text-sm">Total Plantilla</h3>
            <p className="text-4xl font-bold text-slate-800 mt-2">{trabajadores.length}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="text-slate-500 font-semibold text-sm">Trabajadores Aptos</h3>
            <p className="text-4xl font-bold text-green-600 mt-2">{aptos}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="text-slate-500 font-semibold text-sm">Evaluaciones Registradas</h3>
            <p className="text-4xl font-bold text-blue-600 mt-2">{evaluaciones.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
