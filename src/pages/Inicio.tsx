// Página de Inicio (Hub). Ruta "/". Rediseño v2: rojo AUSTROGAS + Spectral + mono.
// Lo accionable primero ("Requiere atención"), módulos compactos y accesos rápidos.
// Carga resiliente (Promise.allSettled). NO cambia rutas ni contratos.
//
// Para la serif, agrega en index.html (si no está):
//   <link href="https://fonts.googleapis.com/css2?family=Spectral:wght@500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import {
  Users, Stethoscope, CalendarDays, ClipboardList, BarChart3,
  ArrowUpRight, Plus, Activity, AlertTriangle, Calendar,
} from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/dashboard/TopBar';
import type { Trabajador, EvaluacionMedica } from '../types';
import { AREA_COLORS, type Area } from '../constants/medical';
import { areaDeTrabajador, workerStatus, iniciales, TONE_STYLES } from '../utils/medicalHelpers';
import { getAtencionesDelDia, calcularStats as statsAtenciones } from '../services/atenciones';
import { getPermisos, permisosStats } from '../services/permisos';
import { getOrdenes, calcularStats as statsExamenes } from '../services/examenesPlan';

const BRAND = '#9a3036';
const BRAND_SOFT = '#f4e8e9';
const SERIF = "'Spectral', Georgia, 'Times New Roman', serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

interface HomeStats { trabajadores: number; atencionesHoy: number; permisosActivos: number; examenesAtrasados: number; }
interface Attn { w: Trabajador; label: string; tone: string; dias: number | null; }

export default function Inicio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<HomeStats>({ trabajadores: 0, atencionesHoy: 0, permisosActivos: 0, examenesAtrasados: 0 });
  const [atencion, setAtencion] = useState<Attn[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const [tRes, eRes2, aRes, pRes, eRes] = await Promise.allSettled([
        getDocs(collection(db, 'trabajadores')),
        getDocs(collection(db, 'evaluaciones')),
        getAtencionesDelDia(new Date()),
        getPermisos(),
        getOrdenes(),
      ]);
      const next: HomeStats = { trabajadores: 0, atencionesHoy: 0, permisosActivos: 0, examenesAtrasados: 0 };

      // Construir lista "Requiere atención" desde trabajadores + evaluaciones
      if (tRes.status === 'fulfilled') {
        next.trabajadores = tRes.value.size;
        const trabajadores = tRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as Trabajador));
        const evals: EvaluacionMedica[] = eRes2.status === 'fulfilled'
          ? eRes2.value.docs.map((d) => ({ id: d.id, ...d.data() } as EvaluacionMedica)) : [];
        const porTrab = new Map<string, EvaluacionMedica[]>();
        for (const ev of evals) { const a = porTrab.get(ev.trabajadorId) ?? []; a.push(ev); porTrab.set(ev.trabajadorId, a); }
        const rank: Record<string, number> = { 'No apto': 0, 'Vencida': 1, 'Por vencer': 2, 'Con restricciones': 3, 'Sin evaluación': 4 };
        const lista: Attn[] = trabajadores
          .map((w) => { const s = workerStatus(porTrab.get(w.id ?? '') ?? []); return { w, label: s.label, tone: s.tone, dias: s.dias }; })
          .filter((x) => x.tone === 'danger' || x.tone === 'warning' || x.label === 'Sin evaluación')
          .sort((a, b) => (rank[a.label] ?? 9) - (rank[b.label] ?? 9) || ((a.dias ?? 9999) - (b.dias ?? 9999)));
        setAtencion(lista);
      }
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

  const modulos = [
    { titulo: 'Trabajadores', ruta: '/trabajadores', icon: <Users size={20} />, color: BRAND, stat: `${stats.trabajadores} registrados`, alert: false },
    { titulo: 'Consulta diaria', ruta: '/consulta-diaria', icon: <Stethoscope size={20} />, color: '#2a4d8f', stat: `${stats.atencionesHoy} atenciones hoy`, alert: false },
    { titulo: 'Permisos médicos', ruta: '/permisos', icon: <CalendarDays size={20} />, color: '#6b4ba3', stat: `${stats.permisosActivos} activos`, alert: false },
    { titulo: 'Exámenes', ruta: '/agenda-examenes', icon: <ClipboardList size={20} />, color: '#0e6b7c', stat: stats.examenesAtrasados > 0 ? `${stats.examenesAtrasados} atrasados` : 'Al día', alert: stats.examenesAtrasados > 0 },
    { titulo: 'Reportes', ruta: '/reportes', icon: <BarChart3 size={20} />, color: '#1f7a4d', stat: 'Indicadores', alert: false },
  ];

  const resumen = atencion.length > 0
    ? <><strong style={{ color: '#9a5b12' }}>{atencion.length} trabajador{atencion.length !== 1 ? 'es' : ''}</strong> requiere{atencion.length !== 1 ? 'n' : ''} seguimiento.</>
    : 'Todo al día, sin pendientes.';

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: '#eef0f3', color: '#20242b', fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto p-[26px_32px_80px]">
          {/* Saludo */}
          <div className="text-[11px] font-semibold uppercase" style={{ color: BRAND, letterSpacing: '1.4px' }}>
            {fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)}
          </div>
          <h1 className="mt-1.5 mb-0 text-[30px] font-bold tracking-tight capitalize" style={{ fontFamily: SERIF }}>{saludo}, Dr. {nombreMedico}</h1>
          <p className="mt-2 mb-0 text-[14.5px]" style={{ color: '#646b75' }}>
            Sistema integral de salud ocupacional de CEM AUSTROGAS. {resumen}
          </p>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-[22px] mb-[26px]">
            <Kpi value={cargando ? '·' : stats.trabajadores} label="Trabajadores" icon={<Users size={18} />} color={BRAND} bg={BRAND_SOFT} />
            <Kpi value={cargando ? '·' : stats.atencionesHoy} label="Atenciones hoy" icon={<Activity size={18} />} color="#2a4d8f" bg="#eaf0f9" />
            <Kpi value={cargando ? '·' : stats.permisosActivos} label="Permisos activos" icon={<Calendar size={18} />} color="#6b4ba3" bg="#efeaf6" />
            <Kpi value={cargando ? '·' : stats.examenesAtrasados} label="Exámenes atrasados" icon={<AlertTriangle size={18} />} color="#a3142a" bg="#f9e6e8" />
          </div>

          <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 340px', alignItems: 'start' }}>
            {/* IZQUIERDA — Requiere atención */}
            <div className="bg-white border rounded-[14px] overflow-hidden" style={{ borderColor: '#e4e6ea' }}>
              <div className="flex items-center gap-2.5 px-[18px] py-[15px] border-b" style={{ borderColor: '#e4e6ea' }}>
                <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px]" style={{ background: '#f8eddc', color: '#9a5b12' }}><AlertTriangle size={17} /></span>
                <h3 className="m-0 text-[17px] font-semibold" style={{ fontFamily: SERIF }}>Requiere tu atención</h3>
                <span className="text-[11px] font-bold px-2 py-px rounded-full" style={{ fontFamily: MONO, background: '#eef0f3', color: '#646b75' }}>{atencion.length}</span>
                <button onClick={() => navigate('/trabajadores')} className="ml-auto bg-transparent border-none cursor-pointer text-[12.5px] font-bold inline-flex items-center gap-1" style={{ color: BRAND }}>Ver trabajadores →</button>
              </div>
              {cargando ? (
                <div className="p-10 text-center text-[13px]" style={{ color: '#98a0ab' }}>Cargando…</div>
              ) : atencion.length === 0 ? (
                <div className="p-10 text-center text-[13px]" style={{ color: '#98a0ab' }}>Ninguna ficha requiere atención inmediata.</div>
              ) : atencion.slice(0, 8).map((x, i) => {
                const area = areaDeTrabajador(x.w) as Area; const ac = AREA_COLORS[area]; const t = TONE_STYLES[x.tone as keyof typeof TONE_STYLES];
                return (
                  <div key={x.w.id} onClick={() => navigate(`/trabajador/${x.w.id}`)} className="flex items-center gap-3 px-[18px] py-3 cursor-pointer hover:bg-slate-50" style={{ borderTop: i > 0 ? '1px solid #eef0f3' : 'none' }}>
                    <div className="w-[38px] h-[38px] rounded-full grid place-items-center font-bold text-[13px] flex-shrink-0" style={{ background: ac.bg, color: ac.fg }}>{iniciales(x.w)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold truncate">{x.w.primerApellido?.split(' ')[0]} {x.w.primerNombre?.split(' ')[0]}</div>
                      <div className="text-[12px] truncate" style={{ color: '#98a0ab' }}>{x.w.puestoTrabajo}{area ? ` · ${area}` : ''}</div>
                    </div>
                    {x.dias != null && <span className="text-[13px] font-bold" style={{ fontFamily: MONO, color: t.fg }}>{x.dias < 0 ? `hace ${Math.abs(x.dias)}d` : `en ${x.dias}d`}</span>}
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: t.bg, color: t.fg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: t.bar }} />{x.label}</span>
                  </div>
                );
              })}
            </div>

            {/* DERECHA — módulos + accesos */}
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <h3 className="m-0 text-[16px] font-semibold" style={{ fontFamily: SERIF }}>Módulos</h3>
                <span className="text-[12px]" style={{ color: '#98a0ab' }}>Acceso directo</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {modulos.map((m) => (
                  <button key={m.titulo} onClick={() => navigate(m.ruta)} className="flex items-center gap-3 bg-white border rounded-xl p-[12px_14px] cursor-pointer text-left" style={{ borderColor: '#e4e6ea' }}>
                    <span className="grid place-items-center w-[38px] h-[38px] rounded-[10px] flex-shrink-0" style={{ background: `${m.color}16`, color: m.color }}>{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold">{m.titulo}</div>
                      <div className="text-[12px]" style={{ color: m.alert ? '#a3142a' : '#98a0ab', fontWeight: m.alert ? 600 : 400 }}>{m.stat}</div>
                    </div>
                    <ArrowUpRight size={17} style={{ color: '#cabfb4' }} />
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <div className="text-[11px] font-bold uppercase mb-2.5" style={{ color: '#98a0ab', letterSpacing: '.5px' }}>Accesos rápidos</div>
                <Quick label="Nuevo trabajador" onClick={() => navigate('/nuevo-trabajador')} />
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

function Kpi({ value, label, icon, color, bg }: { value: ReactNode; label: string; icon: ReactNode; color: string; bg: string }) {
  return (
    <div className="bg-white border rounded-xl p-[14px_16px] flex items-center gap-3" style={{ borderColor: '#e4e6ea' }}>
      <span className="grid place-items-center w-[34px] h-[34px] rounded-[9px] flex-shrink-0" style={{ background: bg, color }}>{icon}</span>
      <div>
        <div className="text-[22px] font-bold tracking-tight leading-none" style={{ fontFamily: MONO, color }}>{value}</div>
        <div className="text-[11px] font-semibold mt-1 uppercase" style={{ color: '#98a0ab', letterSpacing: '.3px' }}>{label}</div>
      </div>
    </div>
  );
}

function Quick({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border bg-white text-[13px] font-semibold cursor-pointer mb-2 hover:bg-slate-50" style={{ borderColor: '#e4e6ea', color: '#20242b' }}>
      <Plus size={14} style={{ color: '#98a0ab' }} /> {label}
    </button>
  );
}
