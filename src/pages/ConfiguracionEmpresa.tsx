import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmpresa } from '../hooks/useEmpresa';
import { useToast } from '../components/Toast';

export default function ConfiguracionEmpresa() {
  const navigate = useNavigate();
  const { empresa, cargando, guardar } = useEmpresa();
  const toast = useToast();
  const [datos, setDatos] = useState(empresa);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setDatos(empresa); }, [empresa]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await guardar(datos);
      toast.success('Configuración guardada correctamente.');
    } catch {
      toast.error('No se pudo guardar. Intenta nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500';

  if (cargando) return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando configuración...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h1 className="text-xl font-bold text-slate-800">Configuración de la Empresa</h1>
          <button onClick={() => navigate('/')} className="text-sm text-slate-500 hover:text-slate-800 font-medium bg-slate-100 px-3 py-1.5 rounded-lg">
            Volver
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {([
            { label: 'Nombre de la institución', key: 'institucion', required: true, hint: 'Aparece en encabezados, login y formularios SO-RE.' },
            { label: 'RUC', key: 'ruc', required: true },
            { label: 'CIU (código de actividad)', key: 'ciu' },
            { label: 'Establecimiento / Área médica', key: 'establecimiento' },
            { label: 'Prefijo del N° de archivo', key: 'prefijoArchivo', hint: 'Ej: AUSTROGAS → AUSTROGAS-20260612.' },
            { label: 'Dominio de correo (para el login)', key: 'emailDominio', hint: 'Ej: empresa.com → medico@empresa.com.' },
            { label: 'URL del logo (opcional)', key: 'logoUrl', hint: 'Si se deja vacío, se usa el logo por defecto.' },
          ] as { label: string; key: keyof typeof datos; required?: boolean; hint?: string }[]).map(({ label, key, required, hint }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={datos[key]}
                required={required}
                onChange={e => setDatos(prev => ({ ...prev, [key]: e.target.value }))}
                className={inputCls}
              />
              {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
            </div>
          ))}

          <div className="pt-4 border-t flex justify-end">
            <button
              type="submit"
              disabled={guardando}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {guardando ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </form>

        <p className="text-xs text-slate-400 mt-4 text-center">
          Estos datos aparecen en el encabezado de todos los formularios SO-RE-38.
        </p>
      </div>
    </div>
  );
}
