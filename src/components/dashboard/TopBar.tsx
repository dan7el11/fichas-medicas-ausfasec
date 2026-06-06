import { Plus } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { COLORS, FONTS } from '../../theme';

interface TopBarProps {
  userInitials?: string;
  userName?: string;
  userRol?: string;
  onNewWorker: () => void;
}

const TABS = [
  { key: '/',                label: 'Inicio' },
  { key: '/trabajadores',    label: 'Trabajadores' },
  { key: '/consulta-diaria', label: 'Consulta diaria' },
  { key: '/permisos',        label: 'Permisos médicos' },
  { key: '/agenda-examenes', label: 'Exámenes' },
  { key: '/inventario',      label: 'Inventario' },
  { key: '/reportes',        label: 'Reportes y Estadísticas' },
];

export default function TopBar({
  userInitials = 'DD',
  userName = 'Dr. Donoso',
  userRol = 'Médico ocupacional',
  onNewWorker,
}: TopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header
      className="h-[54px] flex items-center gap-5 px-5 text-[13px] text-white"
      style={{ background: COLORS.ink, fontFamily: FONTS.sans }}
    >
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
        <div className="w-[34px] h-[34px] bg-white rounded-[8px] flex items-center justify-center p-1 shadow-sm overflow-hidden">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex flex-col leading-[1.15]">
          <span className="font-bold tracking-[0.1px] text-[13px]">CEM AUSTROGAS</span>
          <span className="text-[10px] text-white/60">Medicina Ocupacional</span>
        </div>
      </div>

      <nav className="flex gap-0.5 ml-4">
        {TABS.map(({ key, label }) => {
          const active = location.pathname === key || (key !== '/' && location.pathname.startsWith(key));
          return (
            <button
              key={key}
              onClick={() => navigate(key)}
              className="relative px-[11px] py-1.5 rounded-md text-[13px] border-none cursor-pointer bg-transparent transition-colors"
              style={{
                color: active ? '#fff' : 'rgba(255,255,255,0.62)',
                fontWeight: active ? 600 : 500,
              }}
            >
              {label}
              {active && (
                <span
                  className="absolute left-[11px] right-[11px] rounded-full"
                  style={{ bottom: '-15px', height: '2.5px', background: COLORS.brand }}
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2.5">
        <button
          onClick={onNewWorker}
          className="px-3 py-1.5 text-white border-none rounded-[8px] text-xs font-bold cursor-pointer flex items-center gap-1.5"
          style={{ background: COLORS.brand }}
        >
          <Plus size={14} strokeWidth={2.5} /> Nuevo trabajador
        </button>
        <div className="w-px h-[22px] bg-white/10" />
        <div className="flex items-center gap-2">
          <div className="text-right leading-[1.15]">
            <div className="text-xs font-semibold">{userName}</div>
            <div className="text-[10px] text-white/60">{userRol}</div>
          </div>
          <div
            className="w-[30px] h-[30px] rounded-full text-white grid place-items-center text-[11px] font-bold"
            style={{ background: COLORS.brand }}
          >
            {userInitials}
          </div>
        </div>
      </div>
    </header>
  );
}
