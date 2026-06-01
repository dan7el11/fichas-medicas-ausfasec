// Tarjeta de orden de exámenes (vista Agenda) + chips reutilizables. Archivo NUEVO.
import { Calendar, Check, ArrowRight, FlaskConical } from 'lucide-react';
import type { OrdenExamen, ExamenItem, EstadoOrdenInfo } from '../../types/examenPlan';
import { estadoOrden, progresoOrden, fmtFecha } from '../../services/examenesPlan';

const ACCENT = '#0e7490'; // cian del módulo

const TONE: Record<string, { fg: string; bg: string; bar: string }> = {
  success: { fg: '#0a6b3b', bg: '#e6f6ee', bar: '#10a05a' },
  warning: { fg: '#8a4a0a', bg: '#fff4e3', bar: '#e08a2c' },
  danger:  { fg: '#a01f2a', bg: '#fce8eb', bar: '#dc2e3c' },
  info:    { fg: '#0e7490', bg: '#e0f2fa', bar: '#0e9bbf' },
  muted:   { fg: '#3a4a5e', bg: '#eef1f5', bar: '#94a2b3' },
};

export function EstadoChip({ info, small }: { info: EstadoOrdenInfo; small?: boolean }) {
  const t = TONE[info.tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap ${small ? 'px-2 py-px text-[11px]' : 'px-2.5 py-[3px] text-[12px]'}`}
      style={{ background: t.bg, color: t.fg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.bar }} /> {info.label}
    </span>
  );
}

export function ExamenPill({ ex }: { ex: ExamenItem }) {
  const done = ex.realizado;
  return (
    <span title={ex.nombre + (done ? ' · realizado' : ' · pendiente')}
      className="inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-lg text-[12px] font-semibold border"
      style={done
        ? { background: '#e6f6ee', borderColor: '#e6f6ee', color: '#0a6b3b' }
        : { background: '#fff', borderColor: '#dde4ec', color: '#5a6a7a' }}>
      {ex.nombre}
      {done
        ? <Check size={12} className="text-green-600" />
        : <span className="w-1.5 h-1.5 rounded-full border-[1.5px] border-slate-300" />}
    </span>
  );
}

export default function OrdenCard({ orden: o, onOpen }: { orden: OrdenExamen; onOpen?: (o: OrdenExamen) => void }) {
  const st = estadoOrden(o);
  const pr = progresoOrden(o);
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-[14px_18px] shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full grid place-items-center font-bold flex-shrink-0 text-[13px]" style={{ background: '#e0f2fa', color: ACCENT }}>
          {(o.apellidos?.[0] ?? '') + (o.nombres?.[0] ?? '')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-bold text-slate-900 truncate">{o.apellidos.split(' ')[0]} {o.nombres.split(' ')[0]}</div>
          <div className="text-[12px] text-slate-500 truncate">{o.puesto}{o.departamento ? ` · ${o.departamento}` : ''}</div>
        </div>
        <span className="text-[11px] font-bold rounded-full px-2.5 py-[3px]" style={{ color: ACCENT, background: '#e0f2fa' }}>{o.tipoEvaluacion}</span>
        <EstadoChip info={st} small />
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {o.examenes.map((ex, i) => <ExamenPill key={i} ex={ex} />)}
      </div>

      <div className="flex items-center gap-3.5 mt-3">
        <div className="flex-1 flex items-center gap-2.5">
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden max-w-[180px]">
            <div className="h-full rounded-full" style={{ width: `${pr.pct}%`, background: pr.pct === 100 ? '#10a05a' : ACCENT }} />
          </div>
          <span className="text-[12px] text-slate-500 font-semibold">{pr.hechos}/{pr.total} exámenes</span>
        </div>
        <div className="text-[12px] text-slate-500 flex items-center gap-1.5">
          <Calendar size={14} className="text-slate-400" />
          {st.key === 'atrasado'
            ? <span className="text-red-700 font-semibold">Atrasado {Math.abs(st.dias ?? 0)} d</span>
            : st.key === 'completado'
              ? <>Completado · {fmtFecha(o.fechaProgramada)}</>
              : <>{st.dias === 0 ? 'Hoy' : (st.dias ?? 0) > 0 ? `En ${st.dias} d` : ''} · {fmtFecha(o.fechaProgramada)}</>}
        </div>
        {onOpen && (
          <button onClick={() => onOpen(o)} className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-white text-slate-700 border border-slate-300 rounded-lg text-[12.5px] font-semibold cursor-pointer hover:bg-slate-50">
            Gestionar <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export { FlaskConical };
