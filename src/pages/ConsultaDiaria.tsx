// Página: Consulta Médica Diaria. Archivo NUEVO (src/pages/ConsultaDiaria.tsx).
// Ruta sugerida: /consulta-diaria
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query as fbQuery, orderBy } from 'firebase/firestore';
import {
  Stethoscope, Plus, Activity, List, Check, Clock, User, Pill, AlertTriangle,
} from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/dashboard/TopBar';
import type { Trabajador } from '../types';
import type { AtencionMedica } from '../types/atencion';
import { getAtencionesDelDia, calcularStats, tratamientoTexto } from '../services/atenciones';

import AtencionCard from '../components/consulta/AtencionCard';
import AtencionesTable from '../components/consulta/AtencionesTable';
import ConsultaResumen from '../components/consulta/ConsultaResumen';
import NuevaAtencionModal from '../components/consulta/NuevaAtencionModal';

const ACCENT = '#1d4fad';

export default function ConsultaDiaria() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [atenciones, setAtenciones] = useState<AtencionMedica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<'feed' | 'tabla'>(
    () => (localStorage.getItem('consulta-vista') as 'feed' | 'tabla') || 'feed',
  );
  const [modal, setModal] = useState(false);

  useEffect(() => { localStorage.setItem('consulta-vista', vista); }, [vista]);

  const cargar = async () => {
    setCargando(true);
    try {
      const [tSnap, ats] = await Promise.all([
        getDocs(fbQuery(collection(db, 'trabajadores'), orderBy('primerApellido'))),
        getAtencionesDelDia(new Date()),
      ]);
      setTrabajadores(tSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Trabajador)));
      setAtenciones(ats);
    } catch (err) {
      console.error('Error al cargar consulta diaria:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const stats = useMemo(() => calcularStats(atenciones), [atenciones]);
  const espera = atenciones.filter((a) => a.estado === 'espera');
  const atendidas = atenciones.filter((a) => a.estado === 'atendido');

  const fechaLarga = new Date().toLocaleDateString('es-EC', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const exportarCSV = () => {
    const rows = [['HORA', 'APELLIDOS', 'NOMBRES', 'SEXO', 'EDAD', 'CIE-10', 'DIAGNÓSTICO', 'TRATAMIENTO', 'TIPO', 'RELACIÓN']];
    atenciones.forEach((a) => {
      const d = a.fecha?.toDate ? a.fecha.toDate() : new Date();
      rows.push([
        d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        a.pacienteApellidos, a.pacienteNombres, a.sexo, String(a.edad ?? ''),
        a.cieCodigo, a.cieDescripcion, tratamientoTexto(a), a.tipoAtencion, a.relacion,
      ]);
    });
    const csv = '\ufeff' + rows.map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Consulta_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'DR';

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden text-slate-900" style={{ background: '#f5f7fa', fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <main className="flex-1 overflow-y-auto">
        <div className={`mx-auto p-[24px_32px_80px] ${vista === 'tabla' ? 'max-w-[1280px]' : 'max-w-[1180px]'}`}>
          {/* Header */}
          <div className="flex items-end gap-3 mb-[18px] flex-wrap">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="grid place-items-center w-8 h-8 rounded-[9px]" style={{ background: '#eaf3ff', color: ACCENT }}>
                  <Stethoscope size={18} />
                </span>
                <h1 className="m-0 text-[22px] font-extrabold tracking-tight">Consulta del día</h1>
              </div>
              <p className="mt-1.5 mb-0 ml-[41px] text-[13px] text-slate-500">
                {fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {/* Toggle de vista */}
              <div className="flex gap-[3px] bg-slate-100 p-[3px] rounded-[9px]">
                <ToggleBtn active={vista === 'feed'} onClick={() => setVista('feed')} icon={<Activity size={14} />}>Feed</ToggleBtn>
                <ToggleBtn active={vista === 'tabla'} onClick={() => setVista('tabla')} icon={<List size={14} />}>Lista detallada</ToggleBtn>
              </div>
              <button onClick={() => setModal(true)} className="inline-flex items-center gap-1.5 px-[18px] py-[11px] text-white border-none rounded-[9px] text-[14px] font-bold cursor-pointer" style={{ background: ACCENT }}>
                <Plus size={17} /> Nueva atención
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-5 gap-[11px] mb-5">
            <Kpi value={stats.total} label="Atendidos" sub="hoy" icon={<Check size={16} />} tone="accent" />
            <Kpi value={stats.espera} label="En espera" sub="por atender" icon={<Clock size={16} />} tone="warning" />
            <Kpi value={`${stats.primeras}/${stats.subsec}`} label="1ª / subsec." sub="primeras vs control" icon={<User size={16} />} tone="info" />
            <Kpi value={stats.ocupacionales} label="Ocupacionales" sub="relación laboral" icon={<Activity size={16} />} tone="muted" />
            <Kpi value={stats.medicamentos} label="Medicamentos" sub="unidades dispensadas" icon={<Pill size={16} />} tone="warning" />
          </div>

          {/* Contenido */}
          {cargando ? (
            <div className="p-16 text-center text-slate-400 font-semibold">Cargando atenciones del día…</div>
          ) : vista === 'feed' ? (
            <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: '1fr 340px' }}>
              <div className="flex flex-col gap-4">
                {espera.length > 0 && (
                  <Grupo color="#e08a2c" label="En espera" count={espera.length}>
                    {espera.map((a) => <AtencionCard key={a.id} atencion={a} />)}
                  </Grupo>
                )}
                <Grupo color="#10a05a" label="Atendidos" count={atendidas.length}>
                  {[...atendidas].reverse().map((a) => <AtencionCard key={a.id} atencion={a} />)}
                  {atendidas.length === 0 && (
                    <div className="p-10 text-center text-slate-400 text-[13px] bg-white rounded-[13px] border border-slate-200">
                      Aún no hay atenciones registradas hoy. Pulsa «Nueva atención» para empezar.
                    </div>
                  )}
                </Grupo>
              </div>
              <div className="sticky top-0"><ConsultaResumen atenciones={atenciones} /></div>
            </div>
          ) : (
            <AtencionesTable atenciones={atenciones} onExport={exportarCSV} />
          )}
        </div>
      </main>

      {modal && (
        <NuevaAtencionModal
          trabajadores={trabajadores}
          medicoId={user?.uid ?? ''}
          medicoNombre={user?.email ?? 'Médico'}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); cargar(); }}
        />
      )}
    </div>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────────────
function ToggleBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[7px] border-none cursor-pointer text-[12.5px] font-semibold"
      style={{ background: active ? '#fff' : 'transparent', color: active ? ACCENT : '#5a6a7a', boxShadow: active ? '0 1px 2px rgba(13,27,42,0.1)' : 'none' }}>
      <span style={{ color: active ? ACCENT : '#94a2b3' }}>{icon}</span>{children}
    </button>
  );
}

const TONES: Record<string, { fg: string; bg: string }> = {
  accent: { fg: ACCENT, bg: '#eaf3ff' }, success: { fg: '#0a6b3b', bg: '#e6f6ee' },
  warning: { fg: '#8a4a0a', bg: '#fff4e3' }, info: { fg: '#1d4fad', bg: '#eaf3ff' }, muted: { fg: '#3a4a5e', bg: '#eef1f5' },
};
function Kpi({ value, label, sub, icon, tone }: { value: React.ReactNode; label: string; sub: string; icon: React.ReactNode; tone: string }) {
  const t = TONES[tone] ?? TONES.accent;
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-[14px_17px] relative overflow-hidden shadow-sm">
      <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ background: t.fg }} />
      <div className="flex items-center justify-between">
        <div className="text-[28px] font-extrabold tracking-tight leading-none" style={{ color: t.fg }}>{value}</div>
        <span className="grid place-items-center w-[30px] h-[30px] rounded-lg" style={{ background: t.bg, color: t.fg }}>{icon}</span>
      </div>
      <div className="text-[12.5px] font-semibold text-slate-900 mt-2">{label}</div>
      <div className="text-[11px] text-slate-400">{sub}</div>
    </div>
  );
}
function Grupo({ color, label, count, children }: { color: string; label: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-[7px] h-[7px] rounded-full" style={{ background: color }} />
        <h3 className="m-0 text-[14px] font-bold text-slate-900">{label}</h3>
        <span className="text-[12px] text-slate-400">{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
