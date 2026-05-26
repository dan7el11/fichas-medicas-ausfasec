import { useState, useEffect, useRef } from 'react';
import { calcularIMC } from '../utils/calculations';
import type { SignosVitales } from '../types';

interface SignosVitalesProps {
  onDataChange: (data: SignosVitales) => void;
  initialData?: SignosVitales;
}

export default function SignosVitalesForm({ onDataChange, initialData }: SignosVitalesProps) {
  const [datos, setDatos] = useState<SignosVitales>({
    presionSistolica: '',
    presionDiastolica: '',
    temperatura: '',
    frecuenciaCardiaca: '',
    frecuenciaRespiratoria: '',
    saturacion: '',
    peso: '',
    talla: '',
    imc: 0,
    perimetroAbdominal: ''
  });

  // Flag para cargar initialData solo una vez
  const initialized = useRef(false);

  useEffect(() => {
    if (initialData && !initialized.current) {
      // Solo pre-cargar si hay talla de evaluación previa
      if (initialData.talla) {
        setDatos(prev => ({ ...prev, talla: initialData.talla }));
        initialized.current = true;
      }
    }
  }, [initialData]);

  // Recalcular IMC solo cuando cambian peso o talla
  useEffect(() => {
    const pesoNum = parseFloat(datos.peso);
    const tallaNum = parseFloat(datos.talla);
    const nuevoImc = calcularIMC(pesoNum, tallaNum);

    // Solo actualizar si el IMC cambió para evitar loops
    if (nuevoImc !== datos.imc) {
      const datosActualizados = { ...datos, imc: nuevoImc };
      setDatos(datosActualizados);
      onDataChange(datosActualizados);
    }
  }, [datos.peso, datos.talla]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nuevosDatos = { ...datos, [name]: value };
    setDatos(nuevosDatos);
    onDataChange(nuevosDatos);
  };

  // Interpretación visual del IMC
  const getImcInfo = (imc: number) => {
    if (imc <= 0) return { texto: '--', color: 'text-slate-400', bg: 'bg-slate-50' };
    if (imc < 18.5) return { texto: `${imc} — Bajo peso`, color: 'text-amber-700', bg: 'bg-amber-50' };
    if (imc < 25) return { texto: `${imc} — Normal`, color: 'text-green-700', bg: 'bg-green-50' };
    if (imc < 30) return { texto: `${imc} — Sobrepeso`, color: 'text-orange-700', bg: 'bg-orange-50' };
    if (imc < 35) return { texto: `${imc} — Obesidad I`, color: 'text-red-600', bg: 'bg-red-50' };
    if (imc < 40) return { texto: `${imc} — Obesidad II`, color: 'text-red-700', bg: 'bg-red-50' };
    return { texto: `${imc} — Obesidad III`, color: 'text-red-800', bg: 'bg-red-100' };
  };

  const imcInfo = getImcInfo(datos.imc);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">
        H. CONSTANTES VITALES Y ANTROPOMETRÍA
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Presión Arterial */}
        <div className="lg:col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1">
            PRESIÓN ARTERIAL (mmHg)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              name="presionSistolica"
              value={datos.presionSistolica}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="120"
            />
            <span className="text-slate-400 font-bold text-lg">/</span>
            <input
              type="number"
              name="presionDiastolica"
              value={datos.presionDiastolica}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="80"
            />
          </div>
          {datos.presionSistolica && datos.presionDiastolica && (
            <p className="text-xs text-blue-600 font-medium mt-1">
              {datos.presionSistolica}/{datos.presionDiastolica} mmHg
            </p>
          )}
        </div>

        {/* Temperatura */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            TEMPERATURA (°C)
          </label>
          <input
            type="number"
            step="0.1"
            name="temperatura"
            value={datos.temperatura}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="36.5"
          />
        </div>

        {/* Frecuencia Cardíaca */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            FREC. CARDÍACA (lat/min)
          </label>
          <input
            type="number"
            name="frecuenciaCardiaca"
            value={datos.frecuenciaCardiaca}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="75"
          />
        </div>

        {/* Saturación O2 */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            SATURACIÓN O₂ (%)
          </label>
          <input
            type="number"
            name="saturacion"
            value={datos.saturacion}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="98"
          />
        </div>

        {/* Frecuencia Respiratoria (NUEVO) */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            FREC. RESPIRATORIA (fr/min)
          </label>
          <input
            type="number"
            name="frecuenciaRespiratoria"
            value={datos.frecuenciaRespiratoria}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="16"
          />
        </div>

        {/* Peso */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            PESO (Kg)
          </label>
          <input
            type="number"
            step="0.1"
            name="peso"
            value={datos.peso}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="70"
          />
        </div>

        {/* Talla */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            TALLA (cm)
            {initialData?.talla && <span className="text-blue-500 ml-1">(precargada)</span>}
          </label>
          <input
            type="number"
            step="0.1"
            name="talla"
            value={datos.talla}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="170"
          />
        </div>

        {/* IMC Automático */}
        <div>
          <label className="block text-xs font-bold text-blue-700 mb-1">
            IMC (Kg/m²)
          </label>
          <div className={`w-full px-3 py-2 border border-blue-200 rounded-md text-sm font-bold ${imcInfo.color} ${imcInfo.bg}`}>
            {imcInfo.texto}
          </div>
        </div>

        {/* Perímetro Abdominal */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            PERÍMETRO ABD. (cm)
          </label>
          <input
            type="number"
            step="0.1"
            name="perimetroAbdominal"
            value={datos.perimetroAbdominal}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="90"
          />
        </div>
      </div>
    </div>
  );
}
