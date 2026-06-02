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
import { useAuth } from '../contexts/AuthContext';
import type { Trabajador, EvaluacionMedica } from '../types';

import TopBar from '../components/dashboard/TopBar';
import Sidebar from '../components/dashboard/Sidebar';
import FichaTrabajador from '../components/trabajador/FichaTrabajador';

import {
  areaDeTrabajador,
  lastEval,
  workerStatus,
} from '../utils/medicalHelpers';
import type { Area } from '../constants/medical';

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
  const [areaFilter, setAreaFilter] = useState<Area | 'Todas'>('Todas');
  const [tipoFilter, setTipoFilter] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todos');
  const [selectedId, setSelectedId] = useState<string | undefined>();

  // Carga inicial — sin selectedId en deps para evitar re-fetch al seleccionar trabajador
  useEffect(() => {
    (async () => {
      try {
        const trabajadoresSnap = await getDocs(
          fbQuery(collection(db, 'trabajadores'), orderBy('primerApellido')),
        );
        const ts: Trabajador[] = trabajadoresSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Trabajador),
        );
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
    const q = query.trim().toLowerCase();
    return trabajadores.filter((w) => {
      if (q) {
        const full =
          `${w.primerApellido} ${w.segundoApellido} ${w.primerNombre} ${w.segundoNombre}`.toLowerCase();
        if (!full.includes(q) && !w.cedula.toLowerCase().includes(q) && !w.puestoTrabajo.toLowerCase().includes(q))
          return false;
      }
      if (areaFilter !== 'Todas' && areaDeTrabajador(w) !== areaFilter) return false;
      const evals = evalsPorTrabajador.get(w.id ?? '') ?? [];
      if (tipoFilter !== 'Todos') { const le = lastEval(evals); if (!le) return false; }
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

      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: '360px 1fr' }}>
        <Sidebar
          trabajadores={trabajadores} evalsPorTrabajador={evalsPorTrabajador} filtered={filtered}
          query={query} setQuery={setQuery} areaFilter={areaFilter} setAreaFilter={setAreaFilter}
          tipoFilter={tipoFilter} setTipoFilter={setTipoFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          selectedId={selected?.id}
          onSelect={(id) => { setSelectedId(id); }}
          onNewWorker={handleNewWorker}
        />

        <main className="overflow-y-auto" style={{ background: '#f5f7fa' }}>
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
