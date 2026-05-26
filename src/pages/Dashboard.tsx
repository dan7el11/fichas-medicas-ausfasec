import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import type { Trabajador } from '../types';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [filtrados, setFiltrados] = useState<Trabajador[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

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
        setFiltrados(data);
      } catch (error) {
        console.error("Error al cargar trabajadores:", error);
      } finally {
        setCargando(false);
      }
    };

    fetchTrabajadores();
  }, []);

  // Filtrar trabajadores cuando cambia la búsqueda
  useEffect(() => {
    if (busqueda.trim() === '') {
      setFiltrados(trabajadores);
      return;
    }

    const termino = busqueda.toLowerCase();
    const resultado = trabajadores.filter(t => {
      const nombreCompleto = `${t.primerApellido} ${t.segundoApellido} ${t.primerNombre} ${t.segundoNombre}`.toLowerCase();
      const cedula = t.cedula.toLowerCase();
      const puesto = t.puestoTrabajo.toLowerCase();
      return nombreCompleto.includes(termino) || cedula.includes(termino) || puesto.includes(termino);
    });
    setFiltrados(resultado);
  }, [busqueda, trabajadores]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    }
  };

  // Contar evaluaciones totales
  const totalEvaluaciones = trabajadores.reduce((sum, t) => sum + (t.evaluaciones?.length || 0), 0);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Cabecera */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Dashboard — Fichas Médicas</h1>
              <p className="text-slate-500 text-sm">CEM AUSTROGAS · Medicina Ocupacional</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/perfil')}
                className="text-blue-600 font-medium hover:underline text-sm"
              >
                Mi Perfil
              </button>
              <button
                onClick={handleLogout}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors font-medium text-sm"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>

        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
              👥
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Trabajadores</p>
              <p className="text-2xl font-bold text-slate-800">{trabajadores.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">
              📋
            </div>
            <div>
              <p className="text-sm text-slate-500">Evaluaciones Totales</p>
              <p className="text-2xl font-bold text-slate-800">{totalEvaluaciones}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">
              🔍
            </div>
            <div>
              <p className="text-sm text-slate-500">Resultados</p>
              <p className="text-2xl font-bold text-slate-800">
                {busqueda ? `${filtrados.length} de ${trabajadores.length}` : 'Todos'}
              </p>
            </div>
          </div>
        </div>

        {/* Barra de búsqueda y botón */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h2 className="text-lg font-bold text-slate-700">Lista de Trabajadores</h2>
            <button
              onClick={() => navigate('/nuevo-trabajador')}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
            >
              + Nuevo Trabajador
            </button>
          </div>

          {/* Campo de búsqueda */}
          <div className="relative mb-6">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Buscar por nombre, cédula o puesto de trabajo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Tabla */}
          {cargando ? (
            <div className="text-center py-12 text-slate-500">Cargando trabajadores...</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              {busqueda
                ? `No se encontraron resultados para "${busqueda}"`
                : 'No hay trabajadores registrados aún. Haz clic en "+ Nuevo Trabajador" para comenzar.'
              }
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
                    <th className="p-3 font-semibold">Apellidos y Nombres</th>
                    <th className="p-3 font-semibold">Cédula</th>
                    <th className="p-3 font-semibold">Sexo</th>
                    <th className="p-3 font-semibold">Puesto</th>
                    <th className="p-3 font-semibold text-center">Eval.</th>
                    <th className="p-3 font-semibold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium text-sm">
                        {t.primerApellido} {t.segundoApellido} {t.primerNombre} {t.segundoNombre}
                      </td>
                      <td className="p-3 text-slate-600 text-sm">{t.cedula}</td>
                      <td className="p-3 text-slate-600 text-sm">{t.sexo}</td>
                      <td className="p-3 text-slate-600 text-sm">{t.puestoTrabajo}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          (t.evaluaciones?.length || 0) > 0
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {t.evaluaciones?.length || 0}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => navigate(`/trabajador/${t.id}`)}
                            className="text-slate-600 hover:text-slate-800 font-medium text-xs border border-slate-200 px-3 py-1.5 rounded bg-slate-50 hover:bg-slate-100 transition-colors"
                          >
                            Ver Ficha
                          </button>
                          <button
                            onClick={() => navigate(`/evaluar/${t.id}`)}
                            className="text-blue-600 hover:text-blue-800 font-medium text-xs border border-blue-200 px-3 py-1.5 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
                          >
                            Evaluar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
}
