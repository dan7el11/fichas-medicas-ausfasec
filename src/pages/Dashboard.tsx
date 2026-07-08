import { useEffect, useMemo, useState } from 'react';
import { DashboardSkeleton } from '../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  query as fbQuery,
  orderBy,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { getTrabajadores } from '../services/trabajadores';
import { useAuth } from '../contexts/AuthContext';
import type { Trabajador, EvaluacionMedica } from '../types';

import TopBar from '../components/dashboard/TopBar';
import Sidebar from '../components/dashboard/Sidebar';
import FichaTrabajador from '../components/trabajador/FichaTrabajador';

import {
  areaDeTrabajador,
  matchTrabajador,
  tipoEvaluacionLabel,
  workerStatus,
} from '../utils/medicalHelpers';

type StatusFilter =
  | 'Todos'
  | 'Apto vigente'
  | 'Por vencer'
  | 'Vencida'
  | 'Sin evaluación';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionMedica[]>([]);
  const [cargando, setCargando] = useState(true);

  const [query, setQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState<string>('Todas');
  const [tipoFilter, setTipoFilter] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todos');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  // Móvil: lista y ficha se muestran como dos "pantallas" (maestro-detalle)
  const [fichaMovil, setFichaMovil] = useState(false);

  // Carga inicial — sin selectedId en deps para evitar re-fetch al seleccionar trabajador
  useEffect(() => {
    (async () => {
      try {
        const ts: Trabajador[] = await getTrabajadores();
        setTrabajadores(ts);
        if (ts.length > 0) setSelectedId((prev) => prev ?? ts[0].id);

        const evalsSnap = await getDocs(collection(db, 'evaluaciones'));
        const es: EvaluacionMedica[] = evalsSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as EvaluacionMedica),
        );
        setEvaluaciones(es);
      } catch (err) {
        console.error('Error al cargar dashboard:', err);
      } finally {
        setCargando(false);
      }
    })();
  }, []); // solo al montar

  const evalsPorTrabajador = useMemo(() => {
    const m = new Map<string, EvaluacionMedica[]>();
    for (const e of evaluaciones) {
      const arr = m.get(e.trabajadorId) ?? [];
      arr.push(e);
      m.set(e.trabajadorId, arr);
    }
    return m;
  }, [evaluaciones]);

  const filtered = useMemo(() => {
    return trabajadores.filter((w) => {
      if (!matchTrabajador(w, query)) return false;
      if (areaFilter !== 'Todas' && areaDeTrabajador(w) !== areaFilter) return false;
      const evals = evalsPorTrabajador.get(w.id ?? '') ?? [];
      if (tipoFilter !== 'Todos' && !evals.some((e) => tipoEvaluacionLabel(e) === tipoFilter)) return false;
      if (statusFilter !== 'Todos') { const s = workerStatus(evals); if (s.label !== statusFilter) return false; }
      return true;
    });
  }, [trabajadores, query, areaFilter, tipoFilter, statusFilter, evalsPorTrabajador]);

  const selected = trabajadores.find((w) => w.id === selectedId) ?? filtered[0] ?? null;

  const handleLogout = async () => { try { await signOut(auth); } catch (err) { console.error(err); } };
  const handleNewWorker = () => navigate('/nuevo-trabajador');

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'DR';

  if (cargando) return <DashboardSkeleton />;

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden text-slate-900"
      style={{ background: '#f5f7fa', fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={handleNewWorker} />

      <div className="flex-1 grid overflow-hidden grid-cols-1 md:grid-cols-[360px_1fr]">
        <div className={`${fichaMovil ? 'hidden md:block' : 'block'} h-full min-h-0 overflow-hidden`}>
          <Sidebar
            trabajadores={trabajadores} evalsPorTrabajador={evalsPorTrabajador} filtered={filtered}
            query={query} setQuery={setQuery} areaFilter={areaFilter} setAreaFilter={setAreaFilter}
            tipoFilter={tipoFilter} setTipoFilter={setTipoFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            selectedId={selected?.id}
            onSelect={(id) => { setSelectedId(id); setFichaMovil(true); }}
            onNewWorker={handleNewWorker}
          />
        </div>

        <main className={`${fichaMovil ? 'block' : 'hidden md:block'} overflow-y-auto`} style={{ background: '#f5f7fa' }}>
          <button
            onClick={() => setFichaMovil(false)}
            className="md:hidden sticky top-0 z-20 w-full text-left px-4 py-2.5 bg-white border-b border-slate-200 text-[13px] font-semibold text-slate-700"
          >
            ← Volver a la lista
          </button>
          {selected?.id ? (
            <FichaTrabajador trabajadorId={selected.id} />
          ) : (
            <EmptyState onClear={() => { setQuery(''); setAreaFilter('Todas'); setTipoFilter('Todos'); setStatusFilter('Todos'); }} />
          )}
        </main>
      </div>

      <button onClick={handleLogout}
        className="fixed bottom-4 right-4 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 shadow-sm hover:bg-slate-50 z-50">
        Cerrar sesión
      </button>
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="h-full grid place-items-center text-slate-500 text-[13px]">
      <div className="text-center max-w-[320px]">
        <div className="text-4xl mb-2">·</div>
        <div className="font-semibold text-slate-900 mb-1">Selecciona un trabajador</div>
        <div>Usa la búsqueda o los filtros del panel izquierdo para encontrar al trabajador.</div>
        <button onClick={onClear} className="mt-3 bg-transparent border border-slate-300 rounded-md px-3 py-1.5 cursor-pointer text-xs text-slate-700 hover:bg-slate-50">
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}
