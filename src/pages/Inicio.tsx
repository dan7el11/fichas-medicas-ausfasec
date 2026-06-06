// Página de Inicio (Hub). Archivo NUEVO (src/pages/Inicio.tsx). Ruta: "/".
// KPIs en vivo + tarjetas de atajo a cada módulo. Carga resiliente (Promise.allSettled).
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import {
  Users, Stethoscope, CalendarDays, ClipboardList, BarChart3,
  ArrowRight, Plus, Activity, AlertTriangle, Calendar, Package,
} from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/dashboard/TopBar';
import { getAtencionesDelDia, calcularStats as statsAtenciones } from '../services/atenciones';
import { getPermisos, permisosStats } from '../services/permisos';
import { getOrdenes, calcularStats as statsExamenes } from '../services/examenesPlan';

const BRAND = '#0a6b3b';

interface HomeStats {
  trabajadores: number;
  atencionesHoy: number;
  permisosActivos: number;
  examenesAtrasados: number;
}

export default function Inicio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<HomeStats>({ trabajadores: 0, atencionesHoy: 0, permisosActivos: 0, examenesAtrasados: 0 });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const [tRes, aRes, pRes, eRes] = await Promise.allSettled([
        getDocs(collection(db, 'trabajadores')),
        getAtencionesDelDia(new Date()),
        getPermisos(),
        getOrdenes(),
      ]);
      const next: HomeStats = { trabajadores: 0, atencionesHoy: 0, permisosActivos: 0, examenesAtrasados: 0 };
      if (tRes.status === 'fulfilled') next.trabajadores = tRes.value.size;
      if (aRes.status === 'fulfilled') next.atencionesHoy = statsAtenciones(aRes.value).total;
      if (pRes.status === 'fulfilled') next.permisosActivos = permisosStats(pRes.value).activos;
      if (eRes.status === 'fulfilled') next.examenesAtrasados = statsExamenes(eRes.value).atrasados;
      setStats(next);
      setCargando(false);
    })();
  }, []);

  const ahora = new Date();
  const hora = ahora.getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const fechaLarga = ahora.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const nombreMedico = user?.email?.split('@')[0] ?? 'Doctor';
  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'DR';

  const modulos: ModuloCard[] = [
    { key: 'trabajadores', titulo: 'Trabajadores', desc: 'Fichas y expedientes médicos', ruta: '/trabajadores', icon: <Users size={24} />, color: BRAND, stat: `${stats.trabajadores} registrados` },
    { key: 'consulta', titulo: 'Consulta diaria', desc: 'Atenciones del día y morbilidad', ruta: '/consulta-diaria', icon: <Stethoscope size={24} />, color: '#1d4fad', stat: `${stats.atencionesHoy} hoy` },
    { key: 'permisos', titulo: 'Permisos médicos', desc: 'Reposos, citas y ausentismo', ruta: '/permisos', icon: <CalendarDays size={24} />, color: '#7c5cf2', stat: `${stats.permisosActivos} activos` },
    { key: 'examenes', titulo: 'Exámenes', desc: 'Agenda, cobertura y protocolos', ruta: '/agenda-examenes', icon: <ClipboardList size={24} />, color: '#0e7490', stat: stats.examenesAtrasados > 0 ? `${stats.examenesAtrasados} atrasados` : 'Al día' },
    { key: 'reportes', titulo: 'Reportes y estadísticas', desc: 'Indicadores de salud ocupacional', ruta: '/reportes', icon: <BarChart3 size={24} />, color: '#0f766e', stat: 'Ver tableros' },
    { key: 'inventario', titulo: 'Inventario médico', desc: 'Medicamentos, consumos y movimientos', ruta: '/inventario', icon: <Package size={24} />, color: '#9a3036', stat: 'Ver stock' },
  ];

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden text-slate-900" style={{ background: '#f5f7fa', fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1180px] mx-auto p-[28px_32px_80px]">
          {/* Saludo */}
          <div className="mb-6">
            <div className="text-[13px] font-semibold tracking-[0.2px]" style={{ color: BRAND }}>
              {fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)}
            </div>
            <h1 className="mt-1.5 mb-0 text-[30px] font-extrabold tracking-tight capitalize">{saludo}, Dr. {nombreMedico}</h1>
            <p className="mt-2 mb-0 text-[15px] text-slate-500 max-w-[620px]">
              Sistema integral de salud ocupacional de CEM AUSTROGAS. Elige por dónde empezar.
            </p>
          </div>

          {/* KPIs en línea */}
          <div className="flex mb-7 bg-white border border-slate-200 rounded-[14px] overflow-hidden shadow-sm">
            <Kpi value={cargando ? '·' : stats.trabajadores} label="Trabajadores" sub="registrados" icon={<Users size={16} />} color="#0d1b2a" />
            <Kpi value={cargando ? '·' : stats.atencionesHoy} label="Atenciones" sub="hoy" icon={<Activity size={16} />} color="#1d4fad" />
            <Kpi value={cargando ? '·' : stats.permisosActivos} label="Permisos activos" sub="en reposo" icon={<Calendar size={16} />} color="#7c5cf2" />
            <Kpi value={cargando ? '·' : stats.examenesAtrasados} label="Exámenes atrasados" sub="requieren acción" icon={<AlertTriangle size={16} />} color="#a01f2a" last />
          </div>

          {/* Atajos a módulos */}
          <div className="flex items-baseline gap-2.5 mb-3.5">
            <h2 className="m-0 text-[16px] font-bold">Módulos del sistema</h2>
            <span className="text-[12px] text-slate-400">Accede directo a cada área</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {modulos.map((m) => <ModuloTarjeta key={m.key} m={m} onGo={() => navigate(m.ruta)} />)}

            {/* Tarjeta de accesos rápidos */}
            <div className="bg-white border border-slate-200 rounded-[16px] p-[22px] shadow-sm flex flex-col">
              <div className="grid place-items-center w-[46px] h-[46px] rounded-xl mb-4" style={{ background: '#eef1f5', color: '#5a6a7a' }}>
                <Plus size={24} />
              </div>
              <h3 className="m-0 mb-1 text-[17px] font-bold tracking-tight">Accesos rápidos</h3>
              <p className="m-0 text-[13px] text-slate-500 leading-snug">Crea sin entrar al módulo</p>
              <div className="mt-auto pt-4 flex flex-col gap-2">
                <Quick label="Nuevo trabajador" onClick={() => navigate('/nuevo-trabajador')} />
                <Quick label="Eval. periódica (SO-RE-38)" onClick={() => navigate('/trabajadores')} color="#1d4fad" />
                <Quick label="Eval. retiro (SO-RE-40)" onClick={() => navigate('/trabajadores')} color="#c2410c" />
                <Quick label="Nueva atención" onClick={() => navigate('/consulta-diaria')} />
                <Quick label="Registrar permiso" onClick={() => navigate('/permisos')} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

interface ModuloCard { key: string; titulo: string; desc: string; ruta: string; icon: ReactNode; color: string; stat: string; }

function ModuloTarjeta({ m, onGo }: { m: ModuloCard; onGo: () => void }) {
  return (
    <button onClick={onGo} className="group bg-white border border-slate-200 rounded-[16px] p-[22px] shadow-sm flex flex-col text-left cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ minHeight: 168 }}>
      <div className="grid place-items-center w-[46px] h-[46px] rounded-xl mb-4" style={{ background: `${m.color}14`, color: m.color }}>
        {m.icon}
      </div>
      <h3 className="m-0 mb-1 text-[17px] font-bold tracking-tight">{m.titulo}</h3>
      <p className="m-0 text-[13px] text-slate-500 leading-snug">{m.desc}</p>
      <div className="mt-auto pt-4 flex items-center justify-between">
        <span className="text-[13px] font-bold" style={{ color: m.color }}>{m.stat}</span>
        <span className="grid place-items-center w-8 h-8 rounded-full transition-colors" style={{ background: `${m.color}14`, color: m.color }}>
          <ArrowRight size={16} />
        </span>
      </div>
    </button>
  );
}

function Quick({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold cursor-pointer hover:bg-slate-50 transition-colors" style={{ color: color || '#374151' }}>
      <Plus size={14} style={{ color: color || '#9ca3af' }} /> {label}
    </button>
  );
}

function Kpi({ value, label, sub, icon, color, last }: { value: ReactNode; label: string; sub: string; icon: ReactNode; color: string; last?: boolean }) {
  return (
    <div className={`flex-1 p-[16px_20px] ${last ? '' : 'border-r border-slate-100'}`}>
      <div className="flex items-center justify-between">
        <div className="text-[26px] font-extrabold tracking-tight leading-none" style={{ color }}>{value}</div>
        <span className="grid place-items-center w-7 h-7 rounded-lg" style={{ background: `${color}14`, color }}>{icon}</span>
      </div>
      <div className="text-[12.5px] font-semibold text-slate-700 mt-2">{label}</div>
      <div className="text-[11px] text-slate-400">{sub}</div>
    </div>
  );
}
