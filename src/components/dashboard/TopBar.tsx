import { useState, useEffect, useRef } from 'react';
import { Plus, UserCircle, LogOut, ChevronDown, Users, History } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEmpresa } from '../../contexts/EmpresaContext';
import { APP_VERSION } from '../../version';
import { COLORS, FONTS } from '../../theme';

interface TopBarProps {
  /** @deprecated el TopBar ahora lee useAuth() directamente */
  userInitials?: string;
  /** @deprecated */
  userName?: string;
  userRol?: string;
  /** @deprecated el botón "Nuevo trabajador" se quitó del TopBar */
  onNewWorker?: () => void;
}

const TABS = [
  { key: '/',                label: 'Inicio' },
  { key: '/trabajadores',    label: 'Trabajadores' },
  { key: '/consulta-diaria', label: 'Consulta diaria' },
  { key: '/permisos',        label: 'Permisos médicos' },
  { key: '/agenda-examenes', label: 'Exámenes' },
  { key: '/ergonomia',       label: 'Ergonomía' },
  { key: '/inventario',      label: 'Inventario' },
  { key: '/reportes',        label: 'Reportes y Estadísticas' },
];

export default function TopBar({ userRol }: TopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { displayName, initials, isAdmin, logout, perfil } = useAuth();
  const { empresa } = useEmpresa();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // El título profesional de la página de personalización (/perfil) tiene
  // prioridad sobre la etiqueta genérica.
  const rolLabel = perfil?.titulo?.trim() || userRol || (isAdmin ? 'Administrador' : 'Médico ocupacional');

  // Cerrar el menú al hacer clic fuera
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await logout();
      // ProtectedRoute redirige a /login al detectar user=null
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  return (
    <header
      className="h-[54px] flex items-center gap-5 px-5 text-[13px] text-white"
      style={{ background: COLORS.ink, fontFamily: FONTS.sans }}
    >
      <div className="flex items-center gap-3 cursor-pointer flex-shrink-0" onClick={() => navigate('/')}>
        <div className="w-[34px] h-[34px] bg-white rounded-[8px] flex items-center justify-center p-1 shadow-sm overflow-hidden">
          <img src={empresa.logoUrl || '/logo.png'} alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div className="hidden md:flex flex-col leading-[1.15]">
          <span className="font-bold tracking-[0.1px] text-[13px] max-w-[180px] truncate">{empresa.institucion}</span>
          <span className="text-[10px] text-white/60">Medicina Ocupacional</span>
        </div>
      </div>

      <nav className="flex gap-0.5 ml-4 flex-1 min-w-0 overflow-x-auto [scrollbar-width:none]">
        {TABS.map(({ key, label }) => {
          const active = location.pathname === key || (key !== '/' && location.pathname.startsWith(key));
          return (
            <button
              key={key}
              onClick={() => navigate(key)}
              className="relative px-[11px] py-1.5 rounded-md text-[13px] border-none cursor-pointer bg-transparent transition-colors whitespace-nowrap flex-shrink-0"
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

        {/* Menú de usuario */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 bg-transparent border-none cursor-pointer text-white p-0 rounded-lg hover:bg-white/5 transition-colors px-1.5 py-1"
          >
            <div className="hidden sm:block text-right leading-[1.15]">
              <div className="text-xs font-semibold">{displayName}</div>
              <div className="text-[10px] text-white/60">{rolLabel}</div>
            </div>
            <div
              className="w-[30px] h-[30px] rounded-full text-white grid place-items-center text-[11px] font-bold"
              style={{ background: COLORS.brand }}
            >
              {initials}
            </div>
            <ChevronDown size={13} className={`text-white/50 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[210px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[150]">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-[13px] font-bold text-slate-900 truncate">{displayName}</div>
                <div className="text-[11px] text-slate-400">{rolLabel}</div>
                <div className="text-[10px] text-slate-300 mt-0.5">{APP_VERSION}</div>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/perfil'); }}
                className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 bg-white border-none cursor-pointer text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <UserCircle size={16} className="text-slate-400" /> Mi perfil
              </button>
              {isAdmin && (
                <button
                  onClick={() => { setMenuOpen(false); navigate('/usuarios'); }}
                  className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 bg-white border-none border-t border-slate-100 cursor-pointer text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Users size={16} className="text-slate-400" /> Gestión de usuarios
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => { setMenuOpen(false); navigate('/auditoria'); }}
                  className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 bg-white border-none cursor-pointer text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <History size={16} className="text-slate-400" /> Bitácora de auditoría
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 bg-white border-none border-t border-slate-100 cursor-pointer text-[13px] font-semibold text-red-600 hover:bg-red-50"
              >
                <LogOut size={16} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
