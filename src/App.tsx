import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EmpresaProvider } from './contexts/EmpresaContext';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';

// Code splitting: cada página se carga bajo demanda (Login e Inicio quedan estáticas)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const NuevoTrabajador = lazy(() => import('./pages/NuevoTrabajador'));
const NuevaEvaluacion = lazy(() => import('./pages/NuevaEvaluacion'));
const NuevaEvaluacionRetiro = lazy(() => import('./pages/NuevaEvaluacionRetiro'));
const DetalleTrabajador = lazy(() => import('./pages/DetalleTrabajador'));
const Reportes = lazy(() => import('./pages/Reportes'));
const NuevoReposo = lazy(() => import('./pages/NuevoReposo'));
const ConsultaDiaria = lazy(() => import('./pages/ConsultaDiaria'));
const Permisos = lazy(() => import('./pages/Permisos'));
const AgendaExamenes = lazy(() => import('./pages/AgendaExamenes'));
const ExpedienteResumen = lazy(() => import('./pages/ExpedienteResumen'));
const ConfiguracionEmpresa = lazy(() => import('./pages/ConfiguracionEmpresa'));
const Inventario = lazy(() => import('./pages/Inventario'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500 font-bold">
      Cargando sistema...
    </div>
  );
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EmpresaProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Router>
              <Suspense fallback={<PageLoader />}>
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
                  <Route path="/evaluar-retiro/:trabajadorId" element={<ProtectedRoute><NuevaEvaluacionRetiro /></ProtectedRoute>} />

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

                  {/* Inventario */}
                  <Route path="/inventario" element={<ProtectedRoute><Inventario /></ProtectedRoute>} />

                  {/* Configuración */}
                  <Route path="/configuracion" element={<ProtectedRoute><ConfiguracionEmpresa /></ProtectedRoute>} />

                  {/* Admin */}
                  <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />

                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Suspense>
            </Router>
          </ConfirmProvider>
        </ToastProvider>
        </EmpresaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
