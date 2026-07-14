// Página: Inventario Médico. Ruta /inventario.
// Restyle v2 (tema central): sin gradiente, sub-header con pestañas, Spectral + mono.
// NUEVO: pestaña "Consumos" — medicación dispensada desde la atención diaria.
// NINGÚN cambio funcional en Mi Inventario / General / Movimientos / Análisis.
import type { ReactNode } from 'react';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Package, AlertTriangle, TrendingDown, Pill, CalendarX, Boxes, Activity } from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/dashboard/TopBar';
import { cargarEstado } from '../services/inventario';
import { calcularKpis, consumosMes } from '../utils/inventarioHelpers';
import type { EstadoInventario, CentroId } from '../types/inventario';
import TabInventario from '../components/inventario/TabInventario';
import TabMovimientos from '../components/inventario/TabMovimientos';
import TabAnalisis from '../components/inventario/TabAnalisis';
import TabConsumos from '../components/inventario/TabConsumos';
import { COLORS, FONTS } from '../theme';

// Acento del módulo: ámbar (inventario / suministros)
const ACCENT = '#9a5b12';
const ACCENT_BG = '#f8eddc';

type Tab = 'mi-inventario' | 'general' | 'movimientos' | 'consumos' | 'analisis';

const TABS_DEF: { key: Tab; label: string }[] = [
  { key: 'mi-inventario', label: 'Mi Inventario' },
  { key: 'general', label: 'Inventario General' },
  { key: 'movimientos', label: 'Movimientos' },
  { key: 'consumos', label: 'Consumos' },
  { key: 'analisis', label: 'Análisis' },
];

const CENTRO_DEFAULT: CentroId = 'planta_envasado';

export default function Inventario() {
  const { user, isAdmin, displayName } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem('inventario-tab') as Tab) || 'mi-inventario');
  const [estado, setEstado] = useState<EstadoInventario>({ inventario: [], consumos: [], movimientos: [], trabajadores: [], ultimaActualizacion: null });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [, setTrabajadoresFirestore] = useState<string[]>([]);

  useEffect(() => { localStorage.setItem('inventario-tab', tab); }, [tab]);

  const usuarioNombre = displayName;
  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'DR';

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [est, snap] = await Promise.all([
        cargarEstado(),
        getDocs(collection(db, 'trabajadores')),
      ]);
      setEstado(est);
      const nombres: string[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        const nombre = [data.primerApellido, data.segundoApellido, data.primerNombre, data.segundoNombre].filter(Boolean).join(' ');
        if (nombre) nombres.push(nombre);
      });
      const combinados = Array.from(new Set([...nombres, ...(est.trabajadores ?? [])])).sort();
      setTrabajadoresFirestore(combinados);
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar inventario');
    }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const kpis = useMemo(() => calcularKpis(estado.inventario), [estado.inventario]);
  const nConsumosMes = useMemo(() => consumosMes(estado.consumos), [estado.consumos]);
  const hoy = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (cargando) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: COLORS.bg, fontFamily: FONTS.sans }}>
        <div className="text-center" style={{ color: COLORS.muted }}>
          <Package size={32} className="mx-auto mb-3" />
          <div className="font-semibold">Cargando inventario…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: COLORS.bg, fontFamily: FONTS.sans, color: COLORS.ink }}>
      <TopBar
        userInitials={userInitials}
        userName={user?.email ?? 'Médico'}
        userRol="Medicina Ocupacional"
        onNewWorker={() => navigate('/nuevo-trabajador')}
      />

      {/* Sub-header con pestañas (mismo patrón que Exámenes) */}
      <div className="border-b px-3 md:px-8 flex items-center gap-1 flex-shrink-0 overflow-x-auto" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
        <span className="grid place-items-center w-[30px] h-[30px] rounded-lg mr-2.5 flex-shrink-0" style={{ background: ACCENT_BG, color: ACCENT }}><Package size={17} /></span>
        <span className="text-[15px] font-semibold mr-4 whitespace-nowrap" style={{ fontFamily: FONTS.serif }}>Inventario médico</span>
        {TABS_DEF.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className="inline-flex items-center gap-1.5 px-3.5 py-[14px] border-none bg-transparent cursor-pointer text-[13px] -mb-px whitespace-nowrap"
              style={{ fontWeight: active ? 700 : 600, color: active ? ACCENT : COLORS.muted, borderBottom: `2.5px solid ${active ? ACCENT : 'transparent'}` }}>
              {t.label}
            </button>
          );
        })}
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1180px] mx-auto p-[16px_12px_60px] md:p-[24px_32px_80px]">
          {/* Eyebrow + KPIs */}
          <div className="text-[11px] font-semibold uppercase mb-3" style={{ color: COLORS.brand, letterSpacing: '1.4px' }}>
            {hoy.charAt(0).toUpperCase() + hoy.slice(1)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Kpi value={kpis.totalMedicamentos} label="Medicamentos" sub="en catálogo" icon={<Boxes size={16} />} fg={ACCENT} bg={ACCENT_BG} />
            <Kpi value={nConsumosMes} label="Consumos" sub="este mes" icon={<Activity size={16} />} fg={COLORS.blue} bg={COLORS.blueBg} />
            <Kpi value={kpis.proximosVencer} label="Próx. a vencer" sub="requieren revisión" icon={<CalendarX size={16} />} fg={kpis.proximosVencer > 0 ? COLORS.warn : COLORS.muted} bg={kpis.proximosVencer > 0 ? COLORS.warnBg : COLORS.bg} />
            <Kpi value={kpis.expirados} label="Expirados" sub="retirar de stock" icon={<AlertTriangle size={16} />} fg={kpis.expirados > 0 ? COLORS.bad : COLORS.muted} bg={kpis.expirados > 0 ? COLORS.badBg : COLORS.bg} />
          </div>

          {/* Alertas */}
          {(kpis.expirados > 0 || kpis.sinStock > 0) && (
            <div className="flex gap-2.5 mb-5 flex-wrap">
              {kpis.expirados > 0 && (
                <Banner fg={COLORS.bad} bg={COLORS.badBg} border="#eccdd1" icon={<AlertTriangle size={14} />}>
                  {kpis.expirados} medicamento{kpis.expirados !== 1 ? 's' : ''} expirado{kpis.expirados !== 1 ? 's' : ''}
                </Banner>
              )}
              {kpis.sinStock > 0 && (
                <Banner fg={COLORS.warn} bg={COLORS.warnBg} border="#ecdcc0" icon={<TrendingDown size={14} />}>
                  {kpis.sinStock} medicamento{kpis.sinStock !== 1 ? 's' : ''} sin stock
                </Banner>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-[10px] px-4 py-3 mb-5 text-[13px] border" style={{ background: COLORS.badBg, borderColor: COLORS.bad, color: COLORS.bad }}>
              {error}
            </div>
          )}

          {tab === 'mi-inventario' && (
            <TabInventario inventario={estado.inventario} centroDefault={CENTRO_DEFAULT} vista="mi-centro" />
          )}
          {tab === 'general' && (
            <TabInventario inventario={estado.inventario} centroDefault={CENTRO_DEFAULT} vista="general" />
          )}
          {tab === 'movimientos' && (
            <TabMovimientos
              inventario={estado.inventario}
              movimientos={estado.movimientos}
              usuarioNombre={usuarioNombre}
              isAdmin={isAdmin}
              onRefresh={cargar}
            />
          )}
          {tab === 'consumos' && <TabConsumos />}
          {tab === 'analisis' && (
            <TabAnalisis inventario={estado.inventario} consumos={estado.consumos} />
          )}
        </div>
      </main>
    </div>
  );
}

function Kpi({ value, label, sub, icon, fg, bg }: { value: ReactNode; label: string; sub: string; icon: ReactNode; fg: string; bg: string }) {
  return (
    <div className="rounded-[14px] p-[14px_16px] flex items-center gap-3 border" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
      <span className="grid place-items-center w-[34px] h-[34px] rounded-[9px] flex-shrink-0" style={{ background: bg, color: fg }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[22px] font-bold tracking-tight leading-none" style={{ fontFamily: FONTS.mono, color: fg }}>{value}</div>
        <div className="text-[12px] font-semibold mt-1" style={{ color: COLORS.ink }}>{label}</div>
        <div className="text-[10.5px]" style={{ color: COLORS.faint }}>{sub}</div>
      </div>
    </div>
  );
}

function Banner({ children, fg, bg, border, icon }: { children: ReactNode; fg: string; bg: string; border: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold border" style={{ background: bg, borderColor: border, color: fg }}>
      {icon} {children}
    </div>
  );
}
