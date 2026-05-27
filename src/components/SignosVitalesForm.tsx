import { useState, useEffect } from 'react';
import { calcularIMC } from '../utils/calculations';
import type { SignosVitales } from '../types';

interface SignosVitalesProps {
  onDataChange: (data: SignosVitales) => void;
  initialData?: SignosVitales;
}

export default function SignosVitalesForm({ onDataChange, initialData }: SignosVitalesProps) {
  const [datos, setDatos] = useState<SignosVitales>({
    presionSistolica: initialData?.presionSistolica || '',
    presionDiastolica: initialData?.presionDiastolica || '',
    temperatura: initialData?.temperatura || '',
    frecuenciaCardiaca: initialData?.frecuenciaCardiaca || '',
    frecuenciaRespiratoria: initialData?.frecuenciaRespiratoria || '',
    saturacion: initialData?.saturacion || '',
    peso: initialData?.peso || '',
    talla: initialData?.talla || '',
    imc: initialData?.imc || 0,
    perimetroAbdominal: initialData?.perimetroAbdominal || ''
  });

  // Precargar la talla de evaluaciones anteriores si existe
  useEffect(() => {
    if (initialData && initialData.talla) {
      setDatos(prev => ({ ...prev, talla: initialData.talla }));
    }
  }, [initialData?.talla]);

  useEffect(() => {
    const pesoNum = parseFloat(datos.peso);
    const tallaNum = parseFloat(datos.talla);
    const nuevoImc = calcularIMC(pesoNum, tallaNum);
    
    // Enviamos siempre los datos más frescos al padre
    onDataChange({ ...datos, imc: nuevoImc });
  }, [datos.peso, datos.talla, datos.presionSistolica, datos.presionDiastolica, datos.temperatura, datos.frecuenciaCardiaca, datos.frecuenciaRespiratoria, datos.saturacion, datos.perimetroAbdominal, onDataChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDatos(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">H. CONSTANTES VITALES Y ANTROPOMETRÍA</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <div>
          <label className="block font-medium text-slate-600 mb-1">Presión Sistólica</label>
          <input type="number" name="presionSistolica" value={datos.presionSistolica} onChange={handleChange} className="w-full px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-500" placeholder="120" />
        </div>
        <div>
          <label className="block font-medium text-slate-600 mb-1">Presión Diastólica</label>
          <input type="number" name="presionDiastolica" value={datos.presionDiastolica} onChange={handleChange} className="w-full px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-500" placeholder="80" />
        </div>
        <div>
          <label className="block font-medium text-slate-600 mb-1">Frec. Cardíaca</label>
          <input type="number" name="frecuenciaCardiaca" value={datos.frecuenciaCardiaca} onChange={handleChange} className="w-full px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-500" placeholder="lpm" />
        </div>
        <div>
          <label className="block font-medium text-slate-600 mb-1">Frec. Respiratoria</label>
          <input type="number" name="frecuenciaRespiratoria" value={datos.frecuenciaRespiratoria} onChange={handleChange} className="w-full px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-500" placeholder="rpm" />
        </div>
        <div>
          <label className="block font-medium text-slate-600 mb-1">Temperatura (°C)</label>
          <input type="number" step="0.1" name="temperatura" value={datos.temperatura} onChange={handleChange} className="w-full px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-500" placeholder="36.5" />
        </div>
        <div>
          <label className="block font-medium text-slate-600 mb-1">Saturación O2 (%)</label>
          <input type="number" name="saturacion" value={datos.saturacion} onChange={handleChange} className="w-full px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-500" placeholder="98" />
        </div>
        <div>
          <label className="block font-medium text-slate-600 mb-1">Peso (kg)</label>
          <input type="number" step="0.1" name="peso" value={datos.peso} onChange={handleChange} className="w-full px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-500" placeholder="70" />
        </div>
        <div>
          <label className="block font-medium text-slate-600 mb-1">Talla (cm)</label>
          <input type="number" name="talla" value={datos.talla} onChange={handleChange} className="w-full px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-500" placeholder="170" />
        </div>
        <div>
          <label className="block font-bold text-blue-700 mb-1">IMC Automático</label>
          <div className="w-full px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-md font-semibold text-blue-800 text-center">
            {datos.imc > 0 ? datos.imc : '--'}
          </div>
        </div>
        <div>
          <label className="block font-medium text-slate-600 mb-1">Perímetro Abd.</label>
          <input type="number" name="perimetroAbdominal" value={datos.perimetroAbdominal} onChange={handleChange} className="w-full px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-500" placeholder="cm" />
        </div>
      </div>
    </div>
  );
}
