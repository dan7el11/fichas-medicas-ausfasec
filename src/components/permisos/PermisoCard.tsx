// Tarjeta de permiso (vista agrupada por estado) + chips reutilizables.
// Archivo NUEVO.
import { Home, Shield, Clock, Mail, FileText, Upload } from 'lucide-react';
import {
  TIPOS_PERMISO, type PermisoMedico, type EstadoPermiso, type TipoPermiso,
} from '../../types/permiso';
import {
  estadoPermiso, duracionPermiso, fmtFecha, asuntoCorreo, cuerpoCorreo, buildMailto,
} from '../../services/permisos';
import { useEmpresa } from '../../contexts/EmpresaContext';

const ESTADO_TONE: Record<EstadoPermiso, { fg: string; bg: string; label: string }> = {
  justificado: { fg: '#0a6b3b', bg: '#e6f6ee', label: 'Justificado' },
  pendiente:   { fg: '#8a4a0a', bg: '#fff4e3', label: 'Pendiente' },
  vencido:     { fg: '#a01f2a', bg: '#fce8eb', label: 'Vencido' },
  activo:      { fg: '#1d4fad', bg: '#eaf3ff', label: 'Activo' },
};

function IconTipo({ tipo, size = 13 }: { tipo: TipoPermiso; size?: number }) {
  if (tipo === 'reposo_interno') return <Home size={size} />;
  if (tipo === 'reposo_iess') return <Shield size={size} />;
  return <Clock size={size} />;
}

export function TipoBadge({ tipo, small }: { tipo: TipoPermiso; small?: boolean }) {
  const m = TIPOS_PERMISO[tipo];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md font-bold whitespace-nowrap ${small ? 'px-2 py-px text-[11px]' : 'px-2.5 py-[3px] text-[12px]'}`}
      style={{ background: `${m.color}14`, color: m.color }}>
      <IconTipo tipo={tipo} size={small ? 12 : 13} /> {m.short}
    </span>
  );
}

export function EstadoChip({ estado, small }: { estado: EstadoPermiso; small?: boolean }) {
  const t = ESTADO_TONE[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap ${small ? 'px-2 py-px text-[11px]' : 'px-2.5 py-[3px] text-[12px]'}`}
      style={{ background: t.bg, color: t.fg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.fg }} /> {t.label}
    </span>
  );
}

/** Acción de justificativo según tipo/estado */
export function CertAction({ p, compact }: { p: PermisoMedico; compact?: boolean }) {
  const { empresa } = useEmpresa();
  const meta = TIPOS_PERMISO[p.tipo];
  const cls = `inline-flex items-center gap-1.5 rounded-lg text-[12px] font-semibold cursor-pointer whitespace-nowrap ${compact ? 'px-2.5 py-1.5' : 'px-3 py-[7px]'}`;
  if (!meta.requiereCert) {
    return (
      <a href={buildMailto(asuntoCorreo(p), cuerpoCorreo(p, empresa.institucion))} onClick={(e) => e.stopPropagation()}
        className={`${cls} bg-white text-slate-700 border border-slate-300 no-underline`}>
        <Mail size={13} /> {compact ? 'Correo' : 'Generar correo'}
      </a>
    );
  }
  if (p.certAdjunto) {
    return <button onClick={(e) => e.stopPropagation()} className={`${cls} bg-white text-slate-700 border border-slate-300`}><FileText size={13} /> Ver PDF</button>;
  }
  return <button onClick={(e) => e.stopPropagation()} className={`${cls} bg-amber-50 text-amber-800 border border-amber-300`}><Upload size={13} /> Subir cert.</button>;
}

export default function PermisoCard({ permiso: p, onOpen }: { permiso: PermisoMedico; onOpen?: (p: PermisoMedico) => void }) {
  return (
    <div onClick={() => onOpen?.(p)} className="bg-white border border-slate-200 rounded-xl p-[12px_15px] shadow-sm flex items-center gap-[13px] cursor-pointer hover:bg-slate-50">
      <div className="w-[38px] h-[38px] rounded-full grid place-items-center font-bold flex-shrink-0 text-[13px]" style={{ background: '#eef1f5', color: '#5a6a7a' }}>
        {(p.apellidos?.[0] ?? '') + (p.nombres?.[0] ?? '')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[7px]">
          <span className="text-[14px] font-bold text-slate-900 truncate">{p.apellidos.split(' ')[0]} {p.nombres.split(' ')[0]}</span>
          <TipoBadge tipo={p.tipo} small />
        </div>
        <div className="text-[12px] text-slate-500 truncate">
          {fmtFecha(p.desde)}{p.tipo !== 'cita' && p.dias > 1 ? ` – ${fmtFecha(p.hasta)}` : ''} · {p.motivo}
        </div>
      </div>
      <div className="font-mono text-[13px] font-bold text-slate-900 min-w-[56px] text-right">{duracionPermiso(p)}</div>
      <CertAction p={p} compact />
    </div>
  );
}

export { ESTADO_TONE, estadoPermiso };
