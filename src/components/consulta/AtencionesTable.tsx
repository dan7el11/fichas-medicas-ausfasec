// Tabla detallada de atenciones del día: Apellidos, Nombres, Sexo, Edad, Diagnóstico, Tratamiento.
// Archivo NUEVO.
import { Search } from 'lucide-react';
import type { AtencionMedica } from '../../types/atencion';
import { tratamientoTexto } from '../../services/atenciones';
import { horaDe } from './AtencionCard';

const ACCENT = '#1d4fad';

interface Props {
  atenciones: AtencionMedica[];
  onOpen?: (a: AtencionMedica) => void;
  onExport?: () => void;
}

export default function AtencionesTable({ atenciones, onOpen, onExport }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[920px]">
          <thead>
            <tr className="bg-slate-50">
              <Th className="w-[56px]">Hora</Th>
              <Th>Apellidos</Th>
              <Th>Nombres</Th>
              <Th className="w-[56px] text-center">Sexo</Th>
              <Th className="w-[54px] text-center">Edad</Th>
              <Th className="w-[220px]">Diagnóstico (CIE-10)</Th>
              <Th>Tratamiento</Th>
            </tr>
          </thead>
          <tbody>
            {atenciones.map((a) => {
              const externo = a.pacienteTipo === 'externo';
              return (
                <tr
                  key={a.id}
                  onClick={() => onOpen?.(a)}
                  className={`border-b border-slate-100 last:border-0 ${onOpen ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                >
                  <Td className="font-mono font-bold text-slate-900 whitespace-nowrap">{horaDe(a)}</Td>
                  <Td className="font-semibold text-slate-900">
                    {a.pacienteApellidos || '—'}
                    {externo && (
                      <span className="ml-1.5 text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-px rounded-full">externo</span>
                    )}
                    {a.estado === 'espera' && (
                      <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-px rounded-full">espera</span>
                    )}
                  </Td>
                  <Td>{a.pacienteNombres || '—'}</Td>
                  <Td className="text-center">{a.sexo || '—'}</Td>
                  <Td className="text-center font-mono">{a.edad ?? '—'}</Td>
                  <Td>
                    <div className="flex items-baseline gap-[7px]">
                      <span className="font-mono text-[12px] font-bold flex-shrink-0" style={{ color: ACCENT }}>
                        {a.cieCodigo}
                      </span>
                      <span className="text-[12.5px] text-slate-700">{a.cieDescripcion}</span>
                    </div>
                    {a.relacion === 'Ocupacional' && (
                      <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-px rounded-full" style={{ color: ACCENT, background: '#eaf3ff' }}>
                        ocupacional
                      </span>
                    )}
                  </Td>
                  <Td className="text-slate-600">{tratamientoTexto(a)}</Td>
                </tr>
              );
            })}
            {atenciones.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-slate-400 text-[13px]">
                  No hay atenciones registradas para este día.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-[14px] py-2.5 border-t border-slate-100 flex items-center gap-2.5 bg-slate-50">
        <span className="text-[12px] text-slate-400">{atenciones.length} atenciones del día</span>
        <button
          onClick={onExport}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-[7px] bg-white text-slate-700 border border-slate-300 rounded-lg text-[12.5px] font-semibold cursor-pointer hover:bg-slate-50"
        >
          <Search size={13} /> Exportar tabla (CSV)
        </button>
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-[14px] py-[11px] text-[11px] font-bold tracking-[0.4px] uppercase text-slate-400 text-left whitespace-nowrap border-b border-slate-100 ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-[14px] py-[11px] text-[13px] text-slate-700 align-top ${className}`}>{children}</td>;
}
