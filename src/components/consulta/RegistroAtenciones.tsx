// Registro de morbilidad estilo matriz ocupacional (formato Excel):
// N°, fecha, nombre, edad, sexo H/M, externo, diagnóstico, CIE-10,
// primera/subsecuente, común/ocupacional, procedimientos marcados con "1".
import { Download } from 'lucide-react';
import type { AtencionMedica } from '../../types/atencion';
import { PROCEDIMIENTOS_CONSULTA } from '../../types/atencion';
import { toDate } from '../../services/atenciones';

const ACCENT = '#1d4fad';
const HEAD_BG = '#eef2f8';
const MARK_BG = '#f6f9ff';

interface Props {
  atenciones: AtencionMedica[];
  tituloPeriodo: string;
}

const fmtFecha = (a: AtencionMedica) => {
  const d = toDate(a.fecha);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-EC', { day: 'numeric', month: 'numeric', year: 'numeric' });
};

const nombreCompleto = (a: AtencionMedica) =>
  `${a.pacienteNombres} ${a.pacienteApellidos}`.trim() || '—';

// Procedimiento registrado puede tener texto libre extra: comparación laxa.
const tieneProc = (a: AtencionMedica, proc: string) =>
  a.procedimientos.some((p) => p.toLowerCase().includes(proc.toLowerCase()) || proc.toLowerCase().includes(p.toLowerCase()));

export default function RegistroAtenciones({ atenciones, tituloPeriodo }: Props) {
  const exportarCSV = () => {
    const head = [
      'N°', 'FECHA', 'HORA', 'NOMBRE Y APELLIDOS', 'EDAD', 'SEXO H', 'SEXO M',
      'PERSONAL EXTERNO', 'DIAGNÓSTICO', 'CÓDIGO CIE-10', 'PRIMERA', 'SUBSECUENTE',
      'ENFERMEDAD COMÚN', 'OCUPACIONAL', ...PROCEDIMIENTOS_CONSULTA.map((p) => p.toUpperCase()),
      'REPOSO (DÍAS)', 'MEDICACIÓN',
    ];
    const rows = atenciones.map((a, i) => {
      const d = toDate(a.fecha);
      return [
        String(i + 1),
        fmtFecha(a),
        isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        nombreCompleto(a),
        a.edad != null ? String(a.edad) : '',
        a.sexo === 'M' ? '1' : '',
        a.sexo === 'F' ? '1' : '',
        a.pacienteTipo === 'externo' ? '1' : '',
        a.cieDescripcion || a.motivo,
        a.cieCodigo,
        a.tipoAtencion === 'Primera' ? '1' : '',
        a.tipoAtencion === 'Subsecuente' ? '1' : '',
        a.relacion === 'Común' ? '1' : '',
        a.relacion === 'Ocupacional' ? '1' : '',
        ...PROCEDIMIENTOS_CONSULTA.map((p) => (tieneProc(a, p) ? '1' : '')),
        a.reposoDias > 0 ? String(a.reposoDias) : '',
        a.medicacion.map((m) => `${m.nombre}${m.cantidad > 1 ? ` x${m.cantidad}` : ''}`).join(', '),
      ];
    });
    const csv = '﻿' + [head, ...rows]
      .map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Registro_morbilidad_${tituloPeriodo.replace(/[\s/]+/g, '_')}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[14px] overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="border-collapse w-full" style={{ minWidth: 1100 }}>
          <thead>
            {/* Fila 1: grupos */}
            <tr style={{ background: HEAD_BG }}>
              <ThV rowSpan={2} className="w-[34px]">N°</ThV>
              <ThV rowSpan={2} className="w-[74px]">Fecha</ThV>
              <ThV rowSpan={2}>Nombre y apellidos</ThV>
              <ThV rowSpan={2} className="w-[40px]">Edad</ThV>
              <ThH colSpan={2}>Sexo</ThH>
              <ThV rowSpan={2} vertical>Personal externo</ThV>
              <ThV rowSpan={2} className="min-w-[180px]">Diagnóstico</ThV>
              <ThV rowSpan={2} className="w-[64px]">CIE-10</ThV>
              <ThH colSpan={2}>Tipo</ThH>
              <ThH colSpan={2}>Relación</ThH>
              <ThH colSpan={PROCEDIMIENTOS_CONSULTA.length}>Procedimientos</ThH>
              <ThV rowSpan={2} vertical>Reposo (días)</ThV>
            </tr>
            {/* Fila 2: subcolumnas verticales */}
            <tr style={{ background: HEAD_BG }}>
              <ThV vertical>H</ThV>
              <ThV vertical>M</ThV>
              <ThV vertical>Primera</ThV>
              <ThV vertical>Subsecuente</ThV>
              <ThV vertical>Enf. común</ThV>
              <ThV vertical>Ocupacional</ThV>
              {PROCEDIMIENTOS_CONSULTA.map((p) => <ThV key={p} vertical>{p}</ThV>)}
            </tr>
          </thead>
          <tbody>
            {atenciones.map((a, i) => (
              <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <Td className="text-center font-mono text-slate-400">{i + 1}</Td>
                <Td className="font-mono whitespace-nowrap">{fmtFecha(a)}</Td>
                <Td className="font-semibold text-slate-900">
                  {nombreCompleto(a)}
                  {a.estado === 'espera' && (
                    <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-px rounded-full">espera</span>
                  )}
                </Td>
                <Td className="text-center font-mono">{a.edad ?? ''}</Td>
                <Mark on={a.sexo === 'M'} />
                <Mark on={a.sexo === 'F'} />
                <Mark on={a.pacienteTipo === 'externo'} />
                <Td>
                  {a.cieDescripcion || a.motivo || '—'}
                  {a.pacienteDetalle && <span className="block text-[11px] text-slate-400">{a.pacienteDetalle}</span>}
                </Td>
                <Td className="font-mono font-bold text-center" style={{ color: ACCENT }}>{a.cieCodigo || ''}</Td>
                <Mark on={a.tipoAtencion === 'Primera'} />
                <Mark on={a.tipoAtencion === 'Subsecuente'} />
                <Mark on={a.relacion === 'Común'} />
                <Mark on={a.relacion === 'Ocupacional'} />
                {PROCEDIMIENTOS_CONSULTA.map((p) => <Mark key={p} on={tieneProc(a, p)} />)}
                <Td className="text-center font-mono">{a.reposoDias > 0 ? a.reposoDias : ''}</Td>
              </tr>
            ))}
            {atenciones.length === 0 && (
              <tr>
                <td colSpan={14 + PROCEDIMIENTOS_CONSULTA.length} className="p-10 text-center text-slate-400 text-[13px]">
                  No hay atenciones registradas en este período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-[14px] py-2.5 border-t border-slate-100 flex items-center gap-2.5 bg-slate-50">
        <span className="text-[12px] text-slate-400">{atenciones.length} atenciones · {tituloPeriodo}</span>
        <button
          onClick={exportarCSV}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-[7px] bg-white text-slate-700 border border-slate-300 rounded-lg text-[12.5px] font-semibold cursor-pointer hover:bg-slate-50"
        >
          <Download size={13} /> Exportar registro (CSV)
        </button>
      </div>
    </div>
  );
}

// ── Celdas ───────────────────────────────────────────────────────────────────
function ThV({ children, vertical = false, rowSpan, className = '' }: {
  children: React.ReactNode; vertical?: boolean; rowSpan?: number; className?: string;
}) {
  return (
    <th
      rowSpan={rowSpan}
      className={`border border-slate-200 px-1.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.3px] text-slate-500 ${vertical ? 'align-bottom' : 'text-left align-middle'} ${className}`}
    >
      {vertical ? (
        <span
          className="inline-block whitespace-nowrap"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: 110 }}
        >
          {children}
        </span>
      ) : children}
    </th>
  );
}

function ThH({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return (
    <th colSpan={colSpan} className="border border-slate-200 px-1.5 py-1 text-[10px] font-bold uppercase tracking-[0.3px] text-slate-500 text-center">
      {children}
    </th>
  );
}

function Td({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <td className={`border border-slate-100 px-2 py-[7px] text-[12.5px] text-slate-700 align-middle ${className}`} style={style}>{children}</td>;
}

function Mark({ on }: { on: boolean }) {
  return (
    <td className="border border-slate-100 px-1 py-[7px] text-center font-mono text-[12px] font-bold w-[28px]" style={{ background: on ? MARK_BG : undefined, color: ACCENT }}>
      {on ? '1' : ''}
    </td>
  );
}
