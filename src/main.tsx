import { useAuth } from '../contexts/AuthContext';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';

export default function Dashboard() {
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-center mb-8 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Dashboard de Fichas Médicas</h1>
            <p className="text-slate-500">CEM AUSTROGAS</p>
          </div>
          <button 
            onClick={handleLogout}
            className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors font-medium text-sm"
          >
            Cerrar Sesión
          </button>
        </div>
        
        <div className="bg-blue-50 text-blue-800 p-4 rounded-lg">
          <p>Bienvenido al sistema. Has iniciado sesión como: <strong>{user?.email}</strong></p>
        </div>
      </div>
    </div>
  );
}
