import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { useToast } from '../components/Toast';

export default function UserProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [cedula, setCedula] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setGuardando(true);
    try {
      // Guarda los datos en Firestore bajo el ID único del usuario
      await setDoc(doc(db, 'usuarios', user.uid), {
        email: user.email,
        nombreCompleto,
        cedula,
        rol: 'medico',
        createdAt: new Date()
      });
      navigate('/'); // Redirige al Dashboard tras guardar
    } catch (error) {
      console.error("Error al guardar el perfil", error);
      toast.error("Hubo un error al guardar los datos.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Completar Perfil</h2>
        <p className="text-slate-500 mb-6 text-sm">Por favor, ingresa tus datos profesionales. Estos aparecerán en las evaluaciones médicas.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo (con título)</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              placeholder="Ej: Dr. Juan Pérez"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cédula / Código Médico</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="Número de registro"
            />
          </div>
          
          <button
            type="submit"
            disabled={guardando}
            className="w-full bg-blue-600 text-white font-medium py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-70 mt-4"
          >
            {guardando ? 'Guardando...' : 'Guardar y Continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}
