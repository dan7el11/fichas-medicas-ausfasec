import { useState, useEffect } from 'react';
import { calcularIMC } from '../utils/calculations';
import { validarSigno, validarPresion, type CampoSigno } from '../utils/signosValidacion';
import type { SignosVitales } from '../types';

interface SignosVitalesProps {
  onDataChange: (data: SignosVitales) => void;
  initialData?: SignosVitales;
}

// Configuración de los campos del formulario (en orden de captura).
const CAMPOS: { name: CampoSigno; label: string; ph: string; step?: string; pa?: boolean; opcional?: boolean }[] = [
  { name: 'presionSistolica', label: 'Presión Sistólica', ph: '120', pa: true },
  { name: 'presionDiastolica', label: 'Presión Diastólica', ph: '80', pa: true },
  { name: 'frecuenciaCardiaca', label: 'Frec. Cardíaca', ph: 'lpm' },
  { name: 'frecuenciaRespiratoria', label: 'Frec. Respiratoria', ph: 'rpm' },
  { name: 'temperatura', label: 'Temperatura (°C)', ph: '36.5', step: '0.1' },
  { name: 'saturacion', label: 'Saturación O2 (%)', ph: '98' },
  { name: 'peso', label: 'Peso (kg)', ph: '70', step: '0.1' },
  { name: 'talla', label: 'Talla (cm)', ph: '170' },
  // IMC va aquí (calculado, no es input)
  { name: 'perimetroAbdominal', label: 'Perímetro Abd.', ph: 'cm' },
  { name: 'glucosaCapilar', label: 'Glucosa capilar (mg/dL)', ph: 'opcional', opcional: true },
];

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

  // Validación de coherencia de la presión (diastólica < sistólica)
  const paCoherencia = validarPresion(datos.presionSistolica, datos.presionDiastolica);

  // Recolectar mensajes para el resumen inferior
  const erroresGlobales: string[] = [];
  const alertasGlobales: string[] = [];
  if (paCoherencia.nivel === 'error') erroresGlobales.push(paCoherencia.mensaje!);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">H. CONSTANTES VITALES Y ANTROPOMETRÍA</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        {CAMPOS.flatMap((campo) => {
          const valor = (datos as any)[campo.name] as string;
          const r = validarSigno(campo.name, valor);
          if (r.nivel === 'error') erroresGlobales.push(`${campo.label}: ${r.mensaje}`);
          else if (r.nivel === 'alerta') alertasGlobales.push(`${campo.label}: ${r.mensaje}`);

          const borde = r.nivel === 'error' ? 'border-red-400 bg-red-50'
            : r.nivel === 'alerta' ? 'border-amber-400 bg-amber-50' : 'border-slate-300';
          const msgColor = r.nivel === 'error' ? 'text-red-600' : 'text-amber-600';

          const cells = [] as JSX.Element[];
          // El IMC (calculado) va justo antes del perímetro abdominal.
          if (campo.name === 'perimetroAbdominal') {
            cells.push(
              <div key="imc">
                <label className="block font-bold text-blue-700 mb-1">IMC Automático</label>
                <div className="w-full px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-md font-semibold text-blue-800 text-center">
                  {datos.imc > 0 ? datos.imc : '--'}
                </div>
              </div>,
            );
          }
          cells.push(
            <div key={campo.name}>
              <label className="block font-medium text-slate-600 mb-1">
                {campo.label}{campo.opcional && <span className="text-[10px] text-slate-400"> (opc.)</span>}
              </label>
              <input
                type={campo.pa ? 'text' : 'number'}
                inputMode="numeric"
                step={campo.step}
                name={campo.name}
                value={valor}
                onChange={handleChange}
                maxLength={campo.pa ? 3 : undefined}
                placeholder={campo.ph}
                className={`w-full px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-500 ${borde}`}
              />
              {r.mensaje && <p className={`text-[10px] mt-0.5 ${msgColor}`}>{r.nivel === 'error' ? '✕' : '⚠'} {r.mensaje}</p>}
            </div>,
          );
          return cells;
        })}
      </div>

      {erroresGlobales.length > 0 && (
        <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span className="text-base leading-none">✕</span>
          <div>
            <strong>Revisa estos valores (fuera de rango):</strong>
            <ul className="mt-0.5 list-disc list-inside">
              {erroresGlobales.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        </div>
      )}
      {erroresGlobales.length === 0 && alertasGlobales.length > 0 && (
        <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="text-base leading-none">⚠</span>
          <div>
            <strong>Valores a confirmar:</strong> {alertasGlobales.join(' · ')}
          </div>
        </div>
      )}
    </div>
  );
}
