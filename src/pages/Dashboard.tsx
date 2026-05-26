import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { Trabajador } from '../types';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [cargando, setCargando] = useState(true);

  // Este efecto descarga la lista de trabajadores de Firebase al cargar la página
  useEffect(() => {
    const fetchTrabajadores = async () => {
      try {
        const q = query(collection(db, 'trabajadores'), orderBy('primerApellido'));
        const querySnapshot = await getDocs(q);
        const data: Trabajador[] = [];
        querySnapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as Trabajador);
        });
        setTrabajadores(data);
      } catch (error) {
        console.error("Error al cargar trabajadores:", error);
      } finally {
        setCargando(false);
      }
    };

    fetchTrabajadores();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow p-6">
        {/* Cabecera del Dashboard */}
        <div className="flex justify-between items-center mb-8 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Dashboard - Fichas Médicas</h1>
            <p className="text-slate-500">CEM AUSTROGAS</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => navigate('/perfil')} className="text-blue-600 font-medium hover:underline text-sm">
              Mi Perfil
            </button>
            <button onClick={handleLogout} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors font-medium text-sm">
              Cerrar Sesión
            </button>
          </div>
        </div>
        
        {/* Controles de la Tabla */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-700">Lista de Trabajadores</h2>
          <button onClick={() => navigate('/nuevo-trabajador')} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
            + Nuevo Trabajador
          </button>
        </div>

        {/* Tabla de Datos */}
        {cargando ? (
          <div className="text-center py-10 text-slate-500">Cargando trabajadores...</div>
        ) : trabajadores.length === 0 ? (
          <div className="text-center py-10 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
            No hay trabajadores registrados aún. Haz clic en "+ Nuevo Trabajador" para comenzar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                  <th className="p-3 font-semibold">Apellidos y Nombres</th>
                  <th className="p-3 font-semibold">Cédula</th>
                  <th className="p-3 font-semibold">Puesto</th>
                  <th className="p-3 font-semibold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {trabajadores.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-slate-800 font-medium">
                      {t.primerApellido} {t.segundoApellido} {t.primerNombre} {t.segundoNombre}
                    </td>
                    <td className="p-3 text-slate-600">{t.cedula}</td>
                    <td className="p-3 text-slate-600">{t.puestoTrabajo}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => navigate(`/evaluar/${t.id}`)} className="text-blue-600 hover:text-blue-800 font-medium text-sm border border-blue-200 px-3 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
