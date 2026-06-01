// Tarjeta de atención (vista Feed) y utilidades visuales compartidas.
// Archivo NUEVO.
import { Pill, Bandage, BedDouble } from 'lucide-react';
import type { AtencionMedica } from '../../types/atencion';
import { toDate } from '../../services/atenciones';

const ACCENT = '#1d4fad';

/** Hora "HH:MM" derivada del Timestamp de la atención. */
export function horaDe(a: AtencionMedica): string {
  const d = toDate(a.fecha);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function nombrePaciente(a: AtencionMedica): string {
  return `${a.pacienteApellidos.split(' ')[0]} ${a.pacienteNombres.split(' ')[0]}`.trim();
}

export function iniciales(a: AtencionMedica): string {
  const ap = a.pacienteApellidos?.[0] ?? '';
  const no = a.pacienteNombres?.[0] ?? '';
  return (ap + no).toUpperCase() || '··';
}

/** PA elevada (≥140/90) */
export function paElevada(pa?: string): boolean {
  if (!pa) return false;
  const [s, d] = pa.split('/').map(Number);
  return s >= 140 || d >= 90;
}

export function Avatar({ a, size = 40 }: { a: AtencionMedica; size?: number }) {
  const externo = a.pacienteTipo === 'externo';
  return (
    <div
      className="rounded-full grid place-items-center font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: externo ? '#eef1f5' : '#eaf3ff',
        color: externo ? '#5a6a7a' : ACCENT,
        border: externo ? '1.5px dashed #c4ccd6' : 'none',
      }}
    >
      {iniciales(a)}
    </div>
  );
}

interface CardProps {
  atencion: AtencionMedica;
  onOpen?: (a: AtencionMedica) => void;
}

export default function AtencionCard({ atencion: a, onOpen }: CardProps) {
  const externo = a.pacienteTipo === 'externo';
  return (
    <div
      onClick={() => onOpen?.(a)}
      className={`bg-white border border-slate-200 rounded-[13px] p-[13px_16px] shadow-sm flex items-center gap-[13px] ${
        onOpen ? 'cursor-pointer hover:bg-slate-50' : ''
      }`}
    >
      <div className="text-center min-w-[44px]">
        <div className="text-[13px] font-bold text-slate-900 font-mono">{horaDe(a)}</div>
        {a.estado === 'espera' && (
          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 rounded-full">espera</span>
        )}
      </div>

      <div className="w-px self-stretch bg-slate-100" />
      <Avatar a={a} size={40} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[7px]">
          <span className="text-[14.5px] font-bold text-slate-900 truncate">{nombrePaciente(a)}</span>
          {externo && (
            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 rounded-full">externo</span>
          )}
          {a.relacion === 'Ocupacional' && (
            <span className="text-[11px] font-bold px-2 rounded-full" style={{ color: ACCENT, background: '#eaf3ff' }}>
              ocupacional
            </span>
          )}
        </div>
        <div className="text-[12px] text-slate-500 truncate">
          {a.motivo}
          {!externo && a.pacienteDetalle ? ` · ${a.pacienteDetalle}` : ''}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {a.medicacion.length > 0 && (
          <span
            title="Medicación dispensada"
            className="inline-flex items-center gap-1 text-[12px] text-amber-800 bg-amber-50 px-2 py-[3px] rounded-md font-semibold"
          >
            <Pill size={13} /> {a.medicacion.length}
          </span>
        )}
        {a.procedimientos.length > 0 && (
          <span
            title="Procedimientos"
            className="inline-flex items-center gap-1 text-[12px] px-2 py-[3px] rounded-md font-semibold"
            style={{ color: '#5b3fbd', background: '#f0ebff' }}
          >
            <Bandage size={13} /> {a.procedimientos.length}
          </span>
        )}
        {a.reposoDias > 0 && (
          <span
            title="Reposo indicado"
            className="inline-flex items-center gap-1 text-[12px] text-red-800 bg-red-50 px-2 py-[3px] rounded-md font-semibold"
          >
            <BedDouble size={13} /> {a.reposoDias}d
          </span>
        )}
      </div>

      <div className="min-w-[92px] text-right">
        <div className="font-mono text-[12.5px] font-bold" style={{ color: ACCENT }}>{a.cieCodigo}</div>
        <div className={`text-[11px] ${a.tipoAtencion === 'Primera' ? 'text-green-700' : 'text-slate-400'}`}>
          {a.tipoAtencion}
        </div>
      </div>
    </div>
  );
}
