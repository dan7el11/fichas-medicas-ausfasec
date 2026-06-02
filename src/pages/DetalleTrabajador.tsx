import { useParams, useNavigate } from 'react-router-dom';
import FichaTrabajador from '../components/trabajador/FichaTrabajador';

export default function DetalleTrabajador() {
  const { trabajadorId } = useParams<{ trabajadorId: string }>();
  const navigate = useNavigate();

  if (!trabajadorId) {
    return <div className="min-h-screen p-8 text-center text-red-500 font-bold">Identificador de trabajador no encontrado</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-4">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 text-sm"
          >
            ← Volver al inicio
          </button>
        </div>
        <FichaTrabajador trabajadorId={trabajadorId} />
      </div>
    </div>
  );
}
