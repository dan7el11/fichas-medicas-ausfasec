import { useState } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { registrarAuditoria } from '../services/auditoria';
import { validarCedula } from '../utils/calculations';
import { useAuth } from '../contexts/AuthContext';

export default function NuevoTrabajador() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [cedulaTocada, setCedulaTocada] = useState(false);
  const [datos, setDatos] = useState({
    primerNombre: '',
    segundoNombre: '',
    primerApellido: '',
    segundoApellido: '',
    cedula: '',
    sexo: 'M',
    puestoTrabajo: '',
    departamento: '',
  });

  const cedulaValida = validarCedula(datos.cedula);
  const cedulaError = cedulaTocada && !cedulaValida
    ? datos.cedula.length === 0
      ? 'La cédula es obligatoria.'
      : datos.cedula.length !== 10
      ? 'Debe tener exactamente 10 dígitos.'
      : 'Cédula inválida (dígito verificador incorrecto).'
    : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'cedula') {
      // Solo permitir dígitos, máximo 10
      if (!/^\d{0,10}$/.test(value)) return;
      setCedulaTocada(true);
    }
    setDatos(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCedulaTocada(true);

    if (!cedulaValida) {
      setError('Corrige la cédula antes de guardar.');
      return;
    }

    setGuardando(true);
    setError('');

    try {
      // Verificar cédula duplicada
      const dup = await getDocs(
        query(collection(db, 'trabajadores'), where('cedula', '==', datos.cedula)),
      );
      if (!dup.empty) {
        setError('Ya existe un trabajador registrado con esa cédula.');
        setGuardando(false);
        return;
      }

      const ref = await addDoc(collection(db, 'trabajadores'), {
        ...datos,
        evaluaciones: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: user?.uid || '',
      });
      await registrarAuditoria('crear', 'trabajador', ref.id, `Registró a ${datos.primerApellido} ${datos.primerNombre} (CI ${datos.cedula})`);
      navigate('/');
    } catch {
      setError('No se pudo registrar al trabajador. Intente nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  const inputCls = (hasError: boolean) =>
    `w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
      hasError ? 'border-red-400 bg-red-50 focus:ring-red-400' : 'border-slate-300'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold text-slate-800">Registrar Nuevo Trabajador</h1>
          <button
            onClick={() => navigate('/')}
            className="text-slate-500 hover:text-slate-800 text-sm font-medium"
          >
            Volver al Dashboard
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Primer Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="primerNombre"
                required
                value={datos.primerNombre}
                onChange={handleChange}
                className={inputCls(false)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Segundo Nombre</label>
              <input
                type="text"
                name="segundoNombre"
                value={datos.segundoNombre}
                onChange={handleChange}
                className={inputCls(false)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Primer Apellido <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="primerApellido"
                required
                value={datos.primerApellido}
                onChange={handleChange}
                className={inputCls(false)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Segundo Apellido</label>
              <input
                type="text"
                name="segundoApellido"
                value={datos.segundoApellido}
                onChange={handleChange}
                className={inputCls(false)}
              />
            </div>

            {/* Cédula con validación */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cédula <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  name="cedula"
                  value={datos.cedula}
                  onChange={handleChange}
                  onBlur={() => setCedulaTocada(true)}
                  maxLength={10}
                  placeholder="10 dígitos"
                  className={inputCls(!!cedulaError)}
                />
                {cedulaTocada && datos.cedula.length === 10 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base">
                    {cedulaValida ? '✅' : '❌'}
                  </span>
                )}
              </div>
              {cedulaError && (
                <p className="text-xs text-red-600 mt-1">{cedulaError}</p>
              )}
              {cedulaTocada && cedulaValida && (
                <p className="text-xs text-green-700 mt-1">Cédula válida</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sexo</label>
              <select
                name="sexo"
                value={datos.sexo}
                onChange={handleChange}
                className={inputCls(false) + ' bg-white'}
              >
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Puesto de Trabajo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="puestoTrabajo"
                required
                value={datos.puestoTrabajo}
                onChange={handleChange}
                className={inputCls(false)}
                placeholder="Ej: Operario de planta, Administrativo..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Área / Departamento</label>
              <input
                type="text"
                name="departamento"
                value={datos.departamento}
                onChange={handleChange}
                className={inputCls(false)}
                placeholder="Ej: Planificación, TTHH, Seguridad y Ambiente..."
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <button
              type="submit"
              disabled={guardando || (cedulaTocada && !cedulaValida)}
              className="bg-blue-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {guardando ? 'Guardando...' : 'Registrar Trabajador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
