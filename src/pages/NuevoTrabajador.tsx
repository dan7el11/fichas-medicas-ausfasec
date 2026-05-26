import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';

export default function NuevoTrabajador() {
  const navigate = useNavigate();
  const [guardando, setGuardando] = useState(false);
  const [datos, setDatos] = useState({
    primerNombre: '',
    segundoNombre: '',
    primerApellido: '',
    segundoApellido: '',
    cedula: '',
    sexo: 'M',
    puestoTrabajo: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setDatos({ ...datos, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    
    try {
      await addDoc(collection(db, 'trabajadores'), {
        ...datos,
        evaluaciones: [], // Inicia con un arreglo vacío de evaluaciones
        createdAt: new Date(),
        updatedAt: new Date()
      });
      navigate('/'); // Vuelve al Dashboard tras registrar
    } catch (error) {
      console.error("Error al registrar trabajador", error);
      alert("No se pudo registrar al trabajador.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold text-slate-800">Registrar Nuevo Trabajador</h1>
          <button onClick={() => navigate('/')} className="text-slate-500 hover:text-slate-800 text-sm font-medium">
            Volver al Dashboard
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Primer Nombre</label>
              <input type="text" name="primerNombre" required value={datos.primerNombre} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Segundo Nombre</label>
              <input type="text" name="segundoNombre" value={datos.segundoNombre} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Primer Apellido</label>
              <input type="text" name="primerApellido" required value={datos.primerApellido} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Segundo Apellido</label>
              <input type="text" name="segundoApellido" value={datos.segundoApellido} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cédula</label>
              <input type="text" name="cedula" required value={datos.cedula} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sexo</label>
              <select name="sexo" value={datos.sexo} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Puesto de Trabajo</label>
              <input type="text" name="puestoTrabajo" required value={datos.puestoTrabajo} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Operario de planta, Administrativo..." />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <button
              type="submit"
              disabled={guardando}
              className="bg-blue-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-70"
            >
              {guardando ? 'Guardando...' : 'Registrar Trabajador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
