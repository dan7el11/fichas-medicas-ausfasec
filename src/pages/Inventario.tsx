import { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Package, AlertTriangle, TrendingDown, Calendar, ChevronDown } from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/dashboard/TopBar';
import { cargarEstado } from '../services/inventario';
import { calcularKpis, consumosMes } from '../utils/inventarioHelpers';
import type { EstadoInventario, CentroId } from '../types/inventario';
import { CENTROS } from '../types/inventario';
import TabInventario from '../components/inventario/TabInventario';
import TabMovimientos from '../components/inventario/TabMovimientos';
import TabAnalisis from '../components/inventario/TabAnalisis';
import { COLORS, FONTS } from '../theme';

const BRAND = COLORS.brand;

type Tab = 'mi-inventario' | 'general' | 'movimientos' | 'analisis';

const TABS_DEF: { key: Tab; label: string }[] = [
  { key: 'mi-inventario', label: 'Mi Inventario' },
  { key: 'general', label: 'Inventario General' },
  { key: 'movimientos', label: 'Movimientos' },
  { key: 'analisis', label: 'Análisis' },
];

function KpiChip({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div style={{
      background: warn ? 'rgba(255,100,80,0.18)' : 'rgba(255,255,255,0.12)',
      borderRadius: 10, padding: '8px 16px', minWidth: 110, textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontFamily: FONTS.mono, fontSize: 22, fontWeight: 700, color: warn ? '#ffd5d0' : '#fff', lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

const CENTRO_DEFAULT: CentroId = 'planta_envasado';

export default function Inventario() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('mi-inventario');
  const [estado, setEstado] = useState<EstadoInventario>({ inventario: [], consumos: [], movimientos: [], trabajadores: [], ultimaActualizacion: null });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [trabajadoresFirestore, setTrabajadoresFirestore] = useState<string[]>([]);

  const isAdmin = !!(user?.email?.includes('admin'));
  const usuarioNombre = user?.email?.split('@')[0] ?? 'usuario';
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
      // Combinar con trabajadores del estado_actual (legacy)
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

  const tabs = TABS_DEF;

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, fontFamily: FONTS.sans }}>
        <div style={{ textAlign: 'center', color: COLORS.muted }}>
          <Package size={32} style={{ marginBottom: 12 }} />
          <div>Cargando inventario…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, fontFamily: FONTS.sans, color: COLORS.ink }}>
      <TopBar
        userInitials={userInitials}
        userName={user?.email ?? 'Médico'}
        userRol="Medicina Ocupacional"
        onNewWorker={() => navigate('/nuevo-trabajador')}
      />

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #7a2028 100%)`, padding: '28px 32px 0' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          {/* Título + KPIs */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Package size={22} color="rgba(255,255,255,0.85)" />
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: FONTS.serif }}>
                  Inventario Médico
                </h1>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.70)' }}>
                Control de medicamentos y suministros — CEM AUSTROGAS
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <KpiChip label="Medicamentos" value={kpis.totalMedicamentos} />
              <KpiChip label="Consumos mes" value={nConsumosMes} />
              <KpiChip label="Próx. vencer" value={kpis.proximosVencer} warn={kpis.proximosVencer > 0} />
              <KpiChip label="Expirados" value={kpis.expirados} warn={kpis.expirados > 0} />
            </div>
          </div>

          {/* Alertas */}
          {(kpis.expirados > 0 || kpis.sinStock > 0) && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {kpis.expirados > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(220,46,60,0.22)', border: '1px solid rgba(220,46,60,0.40)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#ffd0d0', fontWeight: 600 }}>
                  <AlertTriangle size={13} /> {kpis.expirados} medicamento{kpis.expirados !== 1 ? 's' : ''} expirado{kpis.expirados !== 1 ? 's' : ''}
                </div>
              )}
              {kpis.sinStock > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(200,140,10,0.22)', border: '1px solid rgba(200,140,10,0.40)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#ffe8a0', fontWeight: 600 }}>
                  <TrendingDown size={13} /> {kpis.sinStock} medicamento{kpis.sinStock !== 1 ? 's' : ''} sin stock
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '10px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
                  color: tab === t.key ? '#fff' : 'rgba(255,255,255,0.65)',
                  borderBottom: tab === t.key ? '3px solid #fff' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 32px 80px' }}>
        {error && (
          <div style={{ background: COLORS.badBg, border: `1px solid ${COLORS.bad}`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: COLORS.bad, fontSize: 13 }}>
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

        {tab === 'analisis' && (
          <TabAnalisis inventario={estado.inventario} consumos={estado.consumos} />
        )}
      </div>
    </div>
  );
}
