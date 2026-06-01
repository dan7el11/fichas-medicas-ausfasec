import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserProfile from './pages/UserProfile';
import NuevoTrabajador from './pages/NuevoTrabajador';
import NuevaEvaluacion from './pages/NuevaEvaluacion';
import DetalleTrabajador from './pages/DetalleTrabajador';
import Reportes from './pages/Reportes';
import ConsultaDiaria from './pages/ConsultaDiaria';
import Permisos from './pages/Permisos';
import AgendaExamenes from './pages/AgendaExamenes';
import Inicio from './pages/Inicio';

// Componente de seguridad para proteger el acceso a las pantallas del sistema
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
      <Router>
        <Routes>
          {/* Ruta pública de acceso */}
          <Route path="/login" element={<Login />} />
          
          {/* Panel principal de control */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Registro y configuración del perfil del médico */}
          <Route 
            path="/perfil" 
            element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            } 
          />
          
          {/* Registro inicial de datos personales del trabajador */}
          <Route 
            path="/nuevo-trabajador" 
            element={
              <ProtectedRoute>
                <NuevoTrabajador />
              </ProtectedRoute>
            } 
          />
          
          {/* Formulario clínico de evaluación ocupacional SO-RE-38 */}
          <Route 
            path="/evaluar/:trabajadorId" 
            element={
              <ProtectedRoute>
                <NuevaEvaluacion />
              </ProtectedRoute>
            } 
          />
          
          {/* Expediente del trabajador: historial de evaluaciones por pestañas y descarga PDF */}
          <Route 
            path="/trabajador/:trabajadorId" 
            element={
              <ProtectedRoute>
                <DetalleTrabajador />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/reportes" 
            element={<ProtectedRoute><Reportes /></ProtectedRoute>} 
          />
          <Route
  path="/consulta-diaria"
  element={<ProtectedRoute><ConsultaDiaria /></ProtectedRoute>}
            />
          <Route 
            path="/permisos" 
            element={<ProtectedRoute><Permisos /></ProtectedRoute>} 
            />
          <Route 
            path="/agenda-examenes" 
            element={<ProtectedRoute><AgendaExamenes /></ProtectedRoute>} 
            />

          
          {/* Redirección automática en caso de escribir una dirección inexistente */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
