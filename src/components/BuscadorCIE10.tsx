import React, { useState, useRef, useEffect } from 'react';
import { catalogoCIE10, DiagnosticoCIE10 } from '../data/cie10';

interface BuscadorCIE10Props {
  valorActual: string;
  onSeleccionar: (codigo: string, descripcion: string) => void;
  placeholder?: string;
}

export default function BuscadorCIE10({ valorActual, onSeleccionar, placeholder = "Buscar diagnóstico (ej. Lumbago o M54)" }: BuscadorCIE10Props) {
  const [textoBusqueda, setTextoBusqueda] = useState(valorActual);
  const [sugerencias, setSugerencias] = useState<DiagnosticoCIE10[]>([]);
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Si el valor externo cambia, actualizamos el texto de la caja
  useEffect(() => {
    setTextoBusqueda(valorActual);
  }, [valorActual]);

  // Cerrar el menú si hacemos clic afuera de la caja
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setMostrarMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBuscar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const texto = e.target.value;
    setTextoBusqueda(texto);
    
    if (texto.length > 2) { // Solo busca si hay más de 2 letras

  // 1. Limpiamos lo que el usuario teclea (le quitamos los puntos y lo hacemos minúscula)
      const textoLimpio = texto.toLowerCase().replace(/\./g, '');
      
      const resultados = catalogoCIE10.filter(item => {
        // 2. Limpiamos el código del catálogo para que compita en igualdad de condiciones
        const codigoLimpio = item.codigo.toLowerCase().replace(/\./g, '');
        const descLimpia = item.descripcion.toLowerCase();
       // 3. ¿Coincide la descripción normal? ¿O coincide el código limpio con el texto limpio?
        return descLimpia.includes(texto.toLowerCase()) || codigoLimpio.includes(textoLimpio);
      });
      setSugerencias(resultados.slice(0, 5)); // Máximo 15 resultados para no trabar la PC
      setMostrarMenu(true);
    } else {
      setMostrarMenu(false);
    }
  };

  const handleElegirSugerencia = (item: DiagnosticoCIE10) => {
    setTextoBusqueda(`${item.codigo} - ${item.descripcion}`);
    setMostrarMenu(false);
    // Le avisamos a la NuevaEvaluacion qué elegimos
    onSeleccionar(item.codigo, item.descripcion);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        className="w-full px-2 py-1 border rounded text-sm bg-white"
        placeholder={placeholder}
        value={textoBusqueda}
        onChange={handleBuscar}
        onFocus={() => { if (textoBusqueda.length > 2) setMostrarMenu(true); }}
      />
      
      {mostrarMenu && sugerencias.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded shadow-lg max-h-48 overflow-y-auto">
          {sugerencias.map((item) => (
            <li 
              key={item.codigo}
              onClick={() => handleElegirSugerencia(item)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 border-b border-slate-100 last:border-0"
            >
              <span className="font-bold text-blue-700">{item.codigo}</span> - {item.descripcion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
