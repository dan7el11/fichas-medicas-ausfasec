import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Reposo } from '../types';

function addDays(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function NuevoReposo() {
  const { trabajadorId } = useParams<{ trabajadorId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState({
    tipo: 'reposo' as Reposo['tipo'],
    fechaInicio: new Date().toISOString().split('T')[0],
    diasReposo: 1,
    diagnostico: '',
    codigoCIE: '',
    observaciones: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const fechaFin = addDays(form.fechaInicio, form.diasReposo - 1);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'diasReposo' ? parseInt(value) || 1 : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.diagnostico.trim()) { setError('El diagnóstico es obligatorio.'); return; }
    if (!trabajadorId) return;

    setGuardando(true);
    setError('');
    try {
      await addDoc(collection(db, 'reposos'), {
        trabajadorId,
        tipo: form.tipo,
        fechaInicio: form.fechaInicio,
        diasReposo: form.diasReposo,
        fechaFin,
        diagnostico: form.diagnostico.trim(),
        codigoCIE: form.codigoCIE.trim(),
        observaciones: form.observaciones.trim(),
        emitidoPor: user?.email ?? '',
        createdAt: serverTimestamp(),
      });
      navigate('/');
    } catch {
      setError('Error al guardar. Intente nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  const tipoLabels: Record<string, string> = {
    reposo: 'Reposo médico',
    incapacidad: 'Incapacidad laboral',
    permiso: 'Permiso médico',
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center pt-10 pb-16 px-4">
      <div className="w-full max-w-lg">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 bg-transparent border-none cursor-pointer"
        >
          ← Volver
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Nuevo reposo / incapacidad</h1>
          <p className="text-xs text-slate-500 mb-6">Los datos quedarán registrados en el expediente del trabajador.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Tipo */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo</label>
              <select
                name="tipo"
                value={form.tipo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="reposo">Reposo médico</option>
                <option value="incapacidad">Incapacidad laboral</option>
                <option value="permiso">Permiso médico</option>
              </select>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de inicio</label>
                <input
                  type="date"
                  name="fechaInicio"
                  value={form.fechaInicio}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Días de reposo</label>
                <input
                  type="number"
                  name="diasReposo"
                  min={1}
                  max={365}
                  value={form.diasReposo}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Fecha fin calculada */}
            {fechaFin && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-xs text-blue-800">
                <span className="font-semibold">{tipoLabels[form.tipo]}</span> del{' '}
                <span className="font-mono">{form.fechaInicio}</span> al{' '}
                <span className="font-mono">{fechaFin}</span>{' '}
                ({form.diasReposo} día{form.diasReposo !== 1 ? 's' : ''})
              </div>
            )}

            {/* Diagnóstico */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Diagnóstico <span className="text-red-500">*</span>
              </label>
              <textarea
                name="diagnostico"
                value={form.diagnostico}
                onChange={handleChange}
                rows={2}
                placeholder="Ej: Lumbalgia aguda, hipertensión arterial..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            {/* CIE */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Código CIE-10 (opcional)</label>
              <input
                type="text"
                name="codigoCIE"
                value={form.codigoCIE}
                onChange={handleChange}
                placeholder="Ej: M54.5"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Observaciones (opcional)</label>
              <textarea
                name="observaciones"
                value={form.observaciones}
                onChange={handleChange}
                rows={2}
                placeholder="Indicaciones adicionales..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer disabled:opacity-60"
                style={{ background: '#0a6b3b' }}
              >
                {guardando ? 'Guardando...' : 'Guardar reposo'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
