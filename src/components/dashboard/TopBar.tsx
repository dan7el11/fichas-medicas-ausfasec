import { Plus } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface TopBarProps {
  userInitials?: string;
  userName?: string;
  userRol?: string;
  onNewWorker: () => void;
}

const TABS = [
  { key: '/', label: 'Trabajadores / Dashboard' },
  { key: '/consulta-diaria', label: 'Consulta diaria' },   // ← NUEVA
  { key: '/permisos', label: 'Permisos médicos' },
  { key: '/agenda-examenes', label: 'Exámenes' },
  { key: '/reportes', label: 'Reportes y Estadísticas' },
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
      className="h-[52px] flex items-center gap-5 px-5 text-[13px] text-white border-b"
      style={{ background: '#0d1b2a', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
        {/* Contenedor blanco con bordes redondeados para el logo */}
        <div className="w-[34px] h-[34px] bg-white rounded-[8px] flex items-center justify-center p-1 shadow-sm overflow-hidden">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col leading-[1.15]">
          <span className="font-bold tracking-[0.1px] text-[13px]">CEM AUSTROGAS</span>
          <span className="text-[10px] text-white/70">Medicina Ocupacional</span>
          </div>
        </div>
      </div>

      <nav className="flex gap-0.5 ml-5">
        {TABS.map(({ key, label }) => {
          const active = location.pathname === key || (key !== '/' && location.pathname.startsWith(key));
          return (
            <button
              key={key}
              onClick={() => navigate(key)}
              className={`px-3 py-1.5 rounded-md text-[13px] border-none cursor-pointer transition-colors ${
                active ? 'font-semibold text-white' : 'font-medium text-white/70 hover:text-white hover:bg-white/5'
              }`}
              style={{ background: active ? 'rgba(255,255,255,0.08)' : 'transparent' }}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2.5">
        <button
          onClick={onNewWorker}
          className="px-3 py-1.5 text-white border-none rounded-[7px] text-xs font-semibold cursor-pointer flex items-center gap-1.5"
          style={{ background: 'var(--brand-primary, #0a6b3b)' }}
        >
          <Plus size={14} strokeWidth={2.5} /> Nuevo trabajador
        </button>
        <div className="w-px h-[22px] bg-white/10" />
        <div className="flex items-center gap-2">
          <div className="text-right leading-[1.15]">
            <div className="text-xs font-semibold">{userName}</div>
            <div className="text-[10px] text-white/70">{userRol}</div>
          </div>
          <div
            className="w-[30px] h-[30px] rounded-full text-white grid place-items-center text-[11px] font-bold"
            style={{ background: 'var(--brand-primary, #0a6b3b)' }}
          >
            {userInitials}
          </div>
        </div>
      </div>
    </header>
  );
}
