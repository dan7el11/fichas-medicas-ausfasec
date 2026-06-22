import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';

export default function Login() {
  const { empresa } = useEmpresa();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth();

  // Si el sistema detecta que el usuario ya está logueado, lo envía al Dashboard
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    try {
      setError('');
      setAviso('');
      // Envía las credenciales a Firebase
      await signInWithEmailAndPassword(auth, email, password);
      // ¡Esta es la línea mágica que faltaba para abrir la puerta!
      navigate('/');
    } catch (err) {
      setError('Error al iniciar sesión. Verifica tu correo y contraseña.');
    } finally {
      setCargando(false);
    }
  };

  const handleReset = async () => {
    setError('');
    setAviso('');
    if (!email.trim()) {
      setError('Escribe tu correo arriba y vuelve a pulsar «¿Olvidaste tu contraseña?».');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setAviso('Te enviamos un correo para restablecer tu contraseña. Revisa tu bandeja (y spam).');
    } catch {
      setError('No se pudo enviar el correo. Verifica que la dirección sea correcta.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
       <div className="text-center mb-8 flex flex-col items-center">
          <img src={empresa.logoUrl || '/logo.png'} alt={`Logo ${empresa.institucion}`} className="h-20 mb-3 object-contain drop-shadow-sm" />
          <h2 className="text-2xl font-bold text-slate-800">{empresa.institucion}</h2>
          <p className="text-slate-500 mt-2 font-medium">Sistema de Fichas Médicas</p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 text-center">
            {error}
          </div>
        )}
        {aviso && (
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-md text-sm mb-4 text-center">
            {aviso}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`medico@${empresa.emailDominio}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <div className="text-right mt-1.5">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-transparent border-none cursor-pointer p-0"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-blue-600 text-white font-medium py-2.5 px-4 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-70"
          >
            {cargando ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
