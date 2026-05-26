import { useState, useEffect } from 'react';
import { calcularIMC } from '../utils/calculations';

interface SignosVitalesProps {
  onDataChange: (data: any) => void;
}

export default function SignosVitalesForm({ onDataChange }: SignosVitalesProps) {
  const [datos, setDatos] = useState({
    presionSistolica: '',
    presionDiastolica: '',
    temperatura: '',
    frecuenciaCardiaca: '',
    saturacion: '',
    peso: '',
    talla: '',
    perimetroAbdominal: ''
  });

  const [imc, setImc] = useState<number>(0);

  // Efecto que recalcula el IMC cada vez que cambian el peso o la talla
  useEffect(() => {
    const pesoNum = parseFloat(datos.peso);
    const tallaNum = parseFloat(datos.talla);
    
    const nuevoImc = calcularIMC(pesoNum, tallaNum);
    setImc(nuevoImc);
    
    // Enviamos los datos actualizados al componente padre
    onDataChange({ ...datos, imc: nuevoImc });
  }, [datos.peso, datos.talla, datos, onDataChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDatos(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Signos Vitales y Antropometría</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Presión Arterial */}
        <div className="flex gap-2 lg:col-span-1">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">P. Sistólica</label>
            <input type="number" name="presionSistolica" value={datos.presionSistolica} onChange={handleChange} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="120" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">P. Diastólica</label>
            <input type="number" name="presionDiastolica" value={datos.presionDiastolica} onChange={handleChange} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="80" />
          </div>
        </div>

        {/* Otros Signos */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Frecuencia Cardíaca (lpm)</label>
          <input type="number" name="frecuenciaCardiaca" value={datos.frecuenciaCardiaca} onChange={handleChange} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="75" />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Temperatura (°C)</label>
          <input type="number" step="0.1" name="temperatura" value={datos.temperatura} onChange={handleChange} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="36.5" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Saturación O2 (%)</label>
          <input type="number" name="saturacion" value={datos.saturacion} onChange={handleChange} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="98" />
        </div>

        {/* Antropometría */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Peso (kg)</label>
          <input type="number" step="0.1" name="peso" value={datos.peso} onChange={handleChange} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="70" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Talla (cm)</label>
          <input type="number" name="talla" value={datos.talla} onChange={handleChange} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="170" />
        </div>

        {/* IMC Autocalculado */}
        <div>
          <label className="block text-xs font-bold text-blue-700 mb-1">IMC Automático</label>
          <div className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm font-semibold text-blue-800">
            {imc > 0 ? imc : '--'}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Perímetro Abd. (cm)</label>
          <input type="number" name="perimetroAbdominal" value={datos.perimetroAbdominal} onChange={handleChange} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="90" />
        </div>
      </div>
    </div>
  );
}
