import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserProfile from './pages/UserProfile';
import NuevoTrabajador from './pages/NuevoTrabajador';
import NuevaEvaluacion from './pages/NuevaEvaluacion'; // <-- IMPORT NUEVO

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando sistema...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/perfil" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          <Route path="/nuevo-trabajador" element={<ProtectedRoute><NuevoTrabajador /></ProtectedRoute>} />
          
          {/* RUTA NUEVA PARA LA EVALUACIÓN */}
          <Route path="/evaluar/:trabajadorId" element={<ProtectedRoute><NuevaEvaluacion /></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
