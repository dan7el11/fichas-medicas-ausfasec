import { useState, useEffect } from 'react';

interface CheckboxSelectorProps {
  titulo: string;
  opciones: string[];
  onChange: (seleccionados: string[]) => void;
}

export default function CheckboxSelector({ titulo, opciones, onChange }: CheckboxSelectorProps) {
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [mostrarOtro, setMostrarOtro] = useState(false);
  const [textoOtro, setTextoOtro] = useState('');

  const handleCheckboxChange = (opcion: string) => {
    if (opcion === 'Otra') {
      setMostrarOtro(!mostrarOtro);
      if (mostrarOtro) {
        setTextoOtro(''); // Limpiar texto si desmarca "Otra"
      }
      return;
    }

    setSeleccion(prev => {
      if (prev.includes(opcion)) {
        return prev.filter(item => item !== opcion);
      } else {
        return [...prev, opcion];
      }
    });
  };

  // Sincronizar estado interno con componente padre
  useEffect(() => {
    const resultadoFinal = [...seleccion];
    if (mostrarOtro && textoOtro.trim() !== '') {
      resultadoFinal.push(`Otra: ${textoOtro}`);
    }
    onChange(resultadoFinal);
  }, [seleccion, mostrarOtro, textoOtro, onChange]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mt-4">
      <h3 className="text-sm font-bold text-slate-800 mb-3">{titulo}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {opciones.map((opcion, index) => (
          <label key={index} className="flex items-center space-x-2 text-sm text-slate-700 hover:bg-slate-50 p-1 rounded cursor-pointer">
            <input
              type="checkbox"
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              checked={opcion === 'Otra' ? mostrarOtro : seleccion.includes(opcion)}
              onChange={() => handleCheckboxChange(opcion)}
            />
            <span>{opcion}</span>
          </label>
        ))}
      </div>
      
      {mostrarOtro && (
        <div className="mt-3">
          <input
            type="text"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Especifique..."
            value={textoOtro}
            onChange={(e) => setTextoOtro(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
