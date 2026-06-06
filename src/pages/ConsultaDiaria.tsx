// Página: Consulta Médica Diaria. Ruta /consulta-diaria.
// Restyle v2 (tema central): Spectral en títulos, mono en datos, neutros fríos.
// Acento del módulo: azul. NINGÚN cambio funcional.
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query as fbQuery, orderBy } from 'firebase/firestore';
import {
  Stethoscope, Plus, Activity, List, Check, Clock, User, Pill, Download,
} from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/dashboard/TopBar';
import type { Trabajador } from '../types';
import type { AtencionMedica } from '../types/atencion';
import { getAtencionesDelDia, calcularStats, tratamientoTexto } from '../services/atenciones';
import { COLORS, FONTS, TONE } from '../theme';

import AtencionCard from '../components/consulta/AtencionCard';
import AtencionesTable from '../components/consulta/AtencionesTable';
import ConsultaResumen from '../components/consulta/ConsultaResumen';
import NuevaAtencionModal from '../components/consulta/NuevaAtencionModal';

const ACCENT = COLORS.blue;
const ACCENT_BG = COLORS.blueBg;

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
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: COLORS.bg, color: COLORS.ink, fontFamily: FONTS.sans }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <main className="flex-1 overflow-y-auto">
        <div className={`mx-auto p-[24px_32px_80px] ${vista === 'tabla' ? 'max-w-[1280px]' : 'max-w-[1180px]'}`}>
          {/* Header */}
          <div className="flex items-end gap-3 mb-[20px] flex-wrap">
            <div>
              <div className="text-[11px] font-semibold uppercase" style={{ color: COLORS.brand, letterSpacing: '1.4px' }}>
                {fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)}
              </div>
              <h1 className="mt-1.5 mb-0 text-[28px] font-bold tracking-tight" style={{ fontFamily: FONTS.serif }}>Consulta del día</h1>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex gap-[3px] p-[3px] rounded-[9px]" style={{ background: '#e2e5ea' }}>
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
            <Kpi value={stats.total} label="Atendidos" sub="hoy" icon={<Check size={16} />} tone="info" />
            <Kpi value={stats.espera} label="En espera" sub="por atender" icon={<Clock size={16} />} tone="warning" />
            <Kpi value={`${stats.primeras}/${stats.subsec}`} label="1ª / subsec." sub="primeras vs control" icon={<User size={16} />} tone="muted" />
            <Kpi value={stats.ocupacionales} label="Ocupacionales" sub="relación laboral" icon={<Activity size={16} />} tone="muted" />
            <Kpi value={stats.medicamentos} label="Medicamentos" sub="unidades dispensadas" icon={<Pill size={16} />} tone="warning" />
          </div>

          {/* Contenido */}
          {cargando ? (
            <div className="p-16 text-center font-semibold" style={{ color: COLORS.faint }}>Cargando atenciones del día…</div>
          ) : vista === 'feed' ? (
            <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: '1fr 340px' }}>
              <div className="flex flex-col gap-4">
                {espera.length > 0 && (
                  <Grupo color={COLORS.warn} label="En espera" count={espera.length}>
                    {espera.map((a) => <AtencionCard key={a.id} atencion={a} />)}
                  </Grupo>
                )}
                <Grupo color={COLORS.ok} label="Atendidos" count={atendidas.length}>
                  {[...atendidas].reverse().map((a) => <AtencionCard key={a.id} atencion={a} />)}
                  {atendidas.length === 0 && (
                    <div className="p-10 text-center text-[13px] rounded-[13px] border" style={{ background: COLORS.panel, borderColor: COLORS.line, color: COLORS.faint }}>
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
function ToggleBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[7px] border-none cursor-pointer text-[12.5px] font-semibold"
      style={{ background: active ? COLORS.panel : 'transparent', color: active ? ACCENT : COLORS.muted, boxShadow: active ? '0 1px 2px rgba(28,29,34,0.1)' : 'none' }}>
      <span style={{ color: active ? ACCENT : COLORS.faint }}>{icon}</span>{children}
    </button>
  );
}

function Kpi({ value, label, sub, icon, tone }: { value: ReactNode; label: string; sub: string; icon: ReactNode; tone: keyof typeof TONE }) {
  const t = TONE[tone];
  return (
    <div className="rounded-[14px] p-[14px_16px] flex items-center gap-3 border" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
      <span className="grid place-items-center w-[34px] h-[34px] rounded-[9px] flex-shrink-0" style={{ background: t.bg, color: t.fg }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[22px] font-bold tracking-tight leading-none" style={{ fontFamily: FONTS.mono, color: t.fg }}>{value}</div>
        <div className="text-[11px] font-semibold mt-1" style={{ color: COLORS.ink }}>{label}</div>
        <div className="text-[10.5px]" style={{ color: COLORS.faint }}>{sub}</div>
      </div>
    </div>
  );
}

function Grupo({ color, label, count, children }: { color: string; label: string; count: number; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-[7px] h-[7px] rounded-full" style={{ background: color }} />
        <h3 className="m-0 text-[15px] font-semibold" style={{ fontFamily: FONTS.serif, color: COLORS.ink }}>{label}</h3>
        <span className="text-[12px]" style={{ fontFamily: FONTS.mono, color: COLORS.faint }}>{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
