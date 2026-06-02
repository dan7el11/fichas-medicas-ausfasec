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
    perimetroAbdominal: initialData?.perimetroAbdominal || '',
    glucosaCapilar: initialData?.glucosaCapilar || '',
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
    onDataChange({ ...datos, imc: nuevoImc });
  }, [datos.peso, datos.talla, datos.presionSistolica, datos.presionDiastolica, datos.temperatura, datos.frecuenciaCardiaca, datos.frecuenciaRespiratoria, datos.saturacion, datos.perimetroAbdominal, datos.glucosaCapilar, onDataChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // PA: solo dígitos, máximo 3
    if (name === 'presionSistolica' || name === 'presionDiastolica') {
      if (!/^\d{0,3}$/.test(value)) return;
    }
    setDatos(prev => ({ ...prev, [name]: value }));
  };

  const sist = parseInt(datos.presionSistolica || '0');
  const diast = parseInt(datos.presionDiastolica || '0');
  const bpAlerta = (sist > 0 && sist >= 140) || (diast > 0 && diast >= 90);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">H. CONSTANTES VITALES Y ANTROPOMETRÍA</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <div>
          <label className="block font-medium text-slate-600 mb-1">Presión Sistólica</label>
          <input type="text" inputMode="numeric" name="presionSistolica" value={datos.presionSistolica} onChange={handleChange} maxLength={3}
            className={`w-full px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-500 ${sist >= 140 ? 'border-amber-400 bg-amber-50' : ''}`} placeholder="120" />
          {sist >= 140 && <p className="text-[10px] text-amber-600 mt-0.5">⚠ Sistólica ≥ 140</p>}
        </div>
        <div>
          <label className="block font-medium text-slate-600 mb-1">Presión Diastólica</label>
          <input type="text" inputMode="numeric" name="presionDiastolica" value={datos.presionDiastolica} onChange={handleChange} maxLength={3}
            className={`w-full px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-500 ${diast >= 90 ? 'border-amber-400 bg-amber-50' : ''}`} placeholder="80" />
          {diast >= 90 && <p className="text-[10px] text-amber-600 mt-0.5">⚠ Diastólica ≥ 90</p>}
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
        <div>
          <label className="block font-medium text-slate-600 mb-1">Glucosa capilar <span className="text-[10px] text-slate-400">(mg/dL)</span></label>
          <input type="number" name="glucosaCapilar" value={datos.glucosaCapilar} onChange={handleChange} className="w-full px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-500" placeholder="opcional" />
        </div>
      </div>
      {bpAlerta && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="text-base">⚠</span>
          <span>Presión arterial elevada ({datos.presionSistolica || '?'}/{datos.presionDiastolica || '?'} mmHg). Verifique el dato y considere referencia.</span>
        </div>
      )}
    </div>
  );
}
