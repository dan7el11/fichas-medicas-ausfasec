// Barra de búsqueda de cargos con autocompletado, con las mismas comodidades
// que el buscador CIE-10: tolera tildes, mayúsculas, espacios y guiones, y
// admite tanto el código del cargo (ENV-03) como su nombre o su departamento.
import React, { useState, useRef, useEffect } from 'react';
import { buscarCargos, type CargoCatalogo } from '../constants/funcionesCargo';

interface BuscadorCargoProps {
  /** Nombre del cargo ya seleccionado (el que se guarda en el trabajador). */
  valorActual: string;
  onSeleccionar: (cargo: CargoCatalogo) => void;
  /** Texto libre: permite registrar un cargo que no está en el catálogo. */
  onTextoLibre?: (texto: string) => void;
  placeholder?: string;
  className?: string;
}

export default function BuscadorCargo({
  valorActual, onSeleccionar, onTextoLibre,
  placeholder = 'Buscar cargo por nombre o código (ej. Operador o ENV-03)',
  className = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500',
}: BuscadorCargoProps) {
  const [texto, setTexto] = useState(valorActual);
  const [sugerencias, setSugerencias] = useState<CargoCatalogo[]>([]);
  const [menu, setMenu] = useState(false);
  const [resaltada, setResaltada] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTexto(valorActual); }, [valorActual]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  const buscar = (valor: string) => {
    setTexto(valor);
    onTextoLibre?.(valor);
    // Basta con 2 caracteres: los códigos son cortos (ENV, TIC…).
    const res = valor.trim().length >= 2 ? buscarCargos(valor) : [];
    setSugerencias(res);
    setResaltada(0);
    setMenu(res.length > 0);
  };

  const elegir = (c: CargoCatalogo) => {
    setTexto(c.cargo);
    setMenu(false);
    onSeleccionar(c);
  };

  const teclas = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!menu || sugerencias.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setResaltada(i => (i + 1) % sugerencias.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setResaltada(i => (i - 1 + sugerencias.length) % sugerencias.length); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(sugerencias[resaltada]); }
    else if (e.key === 'Escape') setMenu(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        value={texto}
        onChange={e => buscar(e.target.value)}
        onKeyDown={teclas}
        onFocus={() => { if (sugerencias.length > 0) setMenu(true); }}
        autoComplete="off"
      />
      {menu && sugerencias.length > 0 && (
        <ul className="absolute z-20 w-full mt-1 bg-white border border-slate-300 rounded shadow-lg max-h-72 overflow-y-auto list-none m-0 p-0">
          {sugerencias.map((c, i) => (
            <li
              key={c.codigo}
              onMouseEnter={() => setResaltada(i)}
              onClick={() => elegir(c)}
              className={`px-3 py-2 text-sm cursor-pointer border-b border-slate-100 last:border-0 ${i === resaltada ? 'bg-blue-50' : ''}`}
            >
              <span className="font-bold text-blue-700">{c.codigo}</span> — {c.cargo}
              <span className="block text-[11px] text-slate-400">{c.departamento} · {c.funciones.length} funciones</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
