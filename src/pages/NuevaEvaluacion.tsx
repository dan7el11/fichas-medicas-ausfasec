import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import SignosVitalesForm from '../components/SignosVitalesForm';
import CheckboxSelector from '../components/CheckboxSelector';

export default function NuevaEvaluacion() {
  const { trabajadorId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trabajador, setTrabajador] = useState<any>(null);
  const [guardando, setGuardando] = useState(false);

  // Estados para los datos médicos
  const [signosVitales, setSignosVitales] = useState<any>({});
  const [examenFisico, setExamenFisico] = useState<string[]>([]);
  const [recomendaciones, setRecomendaciones] = useState<string[]>([]);
  const [antecedentes, setAntecedentes] = useState('');

  // Opciones predefinidas
  const opcionesExamenFisico = [
    '1. Cabeza y Cuello - Normal', 
    '2. Tórax - Normal', 
    '3. Abdomen - Normal', 
    '4. Columna - Normal',
    '5. Extremidades - Normal', 
    'Otra'
  ];

  const opcionesRecomendaciones = [
    'Dieta balanceada', 
    'Actividad física diaria', 
    'Ergonomía laboral',
    'Uso de EPP', 
    'Pausas activas', 
    'Otra'
  ];

  // Descarga los datos del paciente al cargar la página
  useEffect(() => {
    const cargarTrabajador = async () => {
      if (!trabajadorId) return;
      const docRef = doc(db, 'trabajadores', trabajadorId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setTrabajador(docSnap.data());
      }
    };
    cargarTrabajador();
  }, [trabajadorId]);

  const handleGuardar = async () => {
    if (!trabajadorId || !user) return;
    setGuardando(true);
    
    try {
      // Generación del código de serie usando Fecha y el Centro (AUSTROGAS)
      const hoy = new Date();
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      const dia = String(hoy.getDate()).padStart(2, '0');
      const fechaFormato = `${hoy.getFullYear()}${mes}${dia}`;
      
      const centro = "AUSTROGAS";
      const numeroArchivo = `${centro}-${fechaFormato}`; 

      const nuevaEvaluacion = {
        trabajadorId,
        medicoId: user.uid,
        fecha: hoy,
        numeroHistoriaClinica: trabajador.cedula,
        numeroArchivo: numeroArchivo,
        antecedentesPersonales: antecedentes,
        signosVitales,
        examenFisico,
        recomendaciones,
        createdAt: hoy
      };

      // 1. Guarda la ficha médica en Firestore
      const evalRef = await addDoc(collection(db, 'evaluaciones'), nuevaEvaluacion);
      
      // 2. Le avisa al perfil del trabajador que tiene una nueva evaluación
      const trabajadorRef = doc(db, 'trabajadores', trabajadorId);
      await updateDoc(trabajadorRef, {
        evaluaciones: arrayUnion(evalRef.id)
      });

      alert("Ficha médica guardada con éxito");
      navigate('/');
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Hubo un error al guardar la evaluación.");
    } finally {
      setGuardando(false);
    }
  };

  if (!trabajador) return <div className="p-8 text-center text-slate-500">Cargando historia clínica del paciente...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 border-b pb-4 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Evaluación Médica Ocupacional</h1>
            <p className="text-blue-700 font-medium mt-1">
              Paciente: {trabajador.primerNombre} {trabajador.primerApellido} - CI: {trabajador.cedula}
            </p>
          </div>
          <button onClick={() => navigate('/')} className="text-slate-500 hover:text-slate-800 text-sm font-medium bg-slate-100 px-4 py-2 rounded-lg transition-colors">
            Cancelar
          </button>
        </div>

        <div className="space-y-8">
          {/* Antecedentes */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-2">Antecedentes Personales y Quirúrgicos</h3>
            <textarea 
              className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              rows={3}
              value={antecedentes}
              onChange={(e) => setAntecedentes(e.target.value)}
              placeholder="Describa los antecedentes médicos relevantes..."
            />
          </div>

          {/* Formulario Inteligente de Signos Vitales (IMC Automático) */}
          <SignosVitalesForm onDataChange={setSignosVitales} />

          {/* Selectores Inteligentes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CheckboxSelector 
              titulo="Examen Físico Regional" 
              opciones={opcionesExamenFisico} 
              onChange={setExamenFisico} 
            />
            <CheckboxSelector 
              titulo="Recomendaciones y Tratamiento" 
              opciones={opcionesRecomendaciones} 
              onChange={setRecomendaciones} 
            />
          </div>

          {/* Botón de Guardado */}
          <div className="flex justify-end pt-6 border-t mt-8">
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="bg-blue-600 text-white font-medium py-3 px-8 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-70 shadow-sm"
            >
              {guardando ? 'Firmando y Guardando...' : 'Guardar Evaluación Definitiva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
