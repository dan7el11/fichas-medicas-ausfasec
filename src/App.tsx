import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Dashboard from './pages/Dashboard';
import UserProfile from './pages/UserProfile';
import NuevoTrabajador from './pages/NuevoTrabajador';
import NuevaEvaluacion from './pages/NuevaEvaluacion';
import DetalleTrabajador from './pages/DetalleTrabajador';
import Reportes from './pages/Reportes';
import NuevoReposo from './pages/NuevoReposo';
import ConsultaDiaria from './pages/ConsultaDiaria';
import Permisos from './pages/Permisos';
import AgendaExamenes from './pages/AgendaExamenes';
import ExpedienteResumen from './pages/ExpedienteResumen';
import { ToastProvider } from './components/Toast';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500 font-bold">
        Cargando sistema...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Routes>
            {/* Pública */}
            <Route path="/login" element={<Login />} />

            {/* Hub principal */}
            <Route path="/" element={<ProtectedRoute><Inicio /></ProtectedRoute>} />

            {/* Trabajadores */}
            <Route path="/trabajadores" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/nuevo-trabajador" element={<ProtectedRoute><NuevoTrabajador /></ProtectedRoute>} />
            <Route path="/trabajador/:trabajadorId" element={<ProtectedRoute><DetalleTrabajador /></ProtectedRoute>} />
            <Route path="/expediente/:id" element={<ProtectedRoute><ExpedienteResumen /></ProtectedRoute>} />

            {/* Evaluaciones */}
            <Route path="/evaluar/:trabajadorId" element={<ProtectedRoute><NuevaEvaluacion /></ProtectedRoute>} />

            {/* Consulta diaria */}
            <Route path="/consulta-diaria" element={<ProtectedRoute><ConsultaDiaria /></ProtectedRoute>} />

            {/* Reposos y permisos */}
            <Route path="/reposo/:trabajadorId" element={<ProtectedRoute><NuevoReposo /></ProtectedRoute>} />
            <Route path="/permisos" element={<ProtectedRoute><Permisos /></ProtectedRoute>} />

            {/* Exámenes */}
            <Route path="/agenda-examenes" element={<ProtectedRoute><AgendaExamenes /></ProtectedRoute>} />

            {/* Reportes y perfil */}
            <Route path="/reportes" element={<ProtectedRoute><Reportes /></ProtectedRoute>} />
            <Route path="/perfil" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
