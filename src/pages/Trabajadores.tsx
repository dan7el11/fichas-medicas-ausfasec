// REDISEÑO en TypeScript — Directorio de Trabajadores (reemplaza el master-detail).
// Archivo NUEVO: src/pages/Trabajadores.tsx  ·  Ruta sugerida: /trabajadores
// Reutiliza tus helpers reales (constants/medical, utils/medicalHelpers) y Firestore.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query as fbQuery, orderBy } from 'firebase/firestore';
import { Search, Plus, Download, List, LayoutGrid, ChevronRight, X, ArrowRight } from 'lucide-react';
import { db } from '../services/firebase';
import { getTrabajadores } from '../services/trabajadores';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/dashboard/TopBar';
import type { Trabajador, EvaluacionMedica } from '../types';
import { APTITUD_LABEL, colorsDeArea } from '../constants/medical';
import { areaDeTrabajador, areasDeTrabajadores, lastEval, matchTrabajador, workerStatus, dashboardStats, iniciales, fmtDate, TONE_STYLES } from '../utils/medicalHelpers';

const BRAND = '#0a6b3b';
type StatusKey = 'Todos' | 'Aptos' | 'Por vencer' | 'Vencidas' | 'Sin eval.';

interface Entry { w: Trabajador; evals: EvaluacionMedica[]; }

export default function Trabajadores() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionMedica[]>([]);
  const [cargando, setCargando] = useState(true);

  const [q, setQ] = useState('');
  const [areaSel, setAreaSel] = useState<string>('Todas');
  const [statusSel, setStatusSel] = useState<StatusKey>('Todos');
  const [vista, setVista] = useState<'tabla' | 'tarjetas'>('tabla');
  const [sortBy, setSortBy] = useState<'nombre' | 'area' | 'estado'>('nombre');
  const [sel, setSel] = useState<Entry | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setTrabajadores(await getTrabajadores());
        const eSnap = await getDocs(collection(db, 'evaluaciones'));
        setEvaluaciones(eSnap.docs.map((d) => ({ id: d.id, ...d.data() } as EvaluacionMedica)));
      } catch (err) { console.error('Error al cargar trabajadores:', err); }
      finally { setCargando(false); }
    })();
  }, []);

  const evalsPorTrabajador = useMemo(() => {
    const m = new Map<string, EvaluacionMedica[]>();
    for (const e of evaluaciones) { const a = m.get(e.trabajadorId) ?? []; a.push(e); m.set(e.trabajadorId, a); }
    return m;
  }, [evaluaciones]);

  const stats = dashboardStats(trabajadores, evalsPorTrabajador);

  const list = useMemo(() => {
    const enriched: Entry[] = trabajadores.map((w) => ({ w, evals: evalsPorTrabajador.get(w.id ?? '') ?? [] }));
    let l = enriched.filter(({ w, evals }) => {
      if (!matchTrabajador(w, q)) return false;
      if (areaSel !== 'Todas' && areaDeTrabajador(w) !== areaSel) return false;
      if (statusSel !== 'Todos') {
        const s = workerStatus(evals);
        if (statusSel === 'Aptos' && s.tone !== 'success') return false;
        if (statusSel === 'Por vencer' && s.label !== 'Por vencer') return false;
        if (statusSel === 'Vencidas' && !(s.label === 'Vencida' || s.label === 'No apto')) return false;
        if (statusSel === 'Sin eval.' && !(s.label === 'Sin evaluación')) return false;
      }
      return true;
    });
    l.sort((a, b) => {
      if (sortBy === 'nombre') return a.w.primerApellido.localeCompare(b.w.primerApellido);
      if (sortBy === 'area') return areaDeTrabajador(a.w).localeCompare(areaDeTrabajador(b.w)) || a.w.primerApellido.localeCompare(b.w.primerApellido);
      const order: Record<string, number> = { danger: 0, warning: 1, muted: 2, success: 3 };
      return (order[workerStatus(a.evals).tone] - order[workerStatus(b.evals).tone]) || a.w.primerApellido.localeCompare(b.w.primerApellido);
    });
    return l;
  }, [trabajadores, evalsPorTrabajador, q, areaSel, statusSel, sortBy]);

  const statChips: { key: StatusKey; label: string; v: number; color: string }[] = [
    { key: 'Todos', label: 'Todos', v: stats.total, color: '#0d1b2a' },
    { key: 'Aptos', label: 'Aptos vigentes', v: stats.aptos, color: '#10a05a' },
    { key: 'Por vencer', label: 'Por vencer', v: stats.porVencer, color: '#e08a2c' },
    { key: 'Vencidas', label: 'Vencidas / No apto', v: stats.vencidasONoApto, color: '#dc2e3c' },
    { key: 'Sin eval.', label: 'Sin evaluación', v: stats.sinEval, color: '#94a2b3' },
  ];
  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'DR';

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden text-slate-900" style={{ background: '#f5f7fa', fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Médico'} userRol="Medicina Ocupacional" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1280px] mx-auto p-[16px_12px_60px] md:p-[24px_32px_80px]">
          {/* Header */}
          <div className="flex items-end gap-3.5 mb-5 flex-wrap">
            <div>
              <h1 className="m-0 text-[26px] font-extrabold tracking-tight">Trabajadores</h1>
              <p className="mt-1 mb-0 text-[14px] text-slate-500">{stats.total} registrados · {evaluaciones.length} evaluaciones en el sistema</p>
            </div>
            <div className="ml-auto flex gap-2">
              <button className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-[9px] text-[13px] font-semibold cursor-pointer whitespace-nowrap"><Download size={15} /> Exportar</button>
              <button onClick={() => navigate('/nuevo-trabajador')} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-white border-none rounded-[9px] text-[13px] font-bold cursor-pointer whitespace-nowrap" style={{ background: BRAND }}><Plus size={16} /> Nuevo trabajador</button>
            </div>
          </div>

          {/* Stat chips */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-[18px]">
            {statChips.map((c) => {
              const on = statusSel === c.key;
              return (
                <button key={c.key} onClick={() => setStatusSel(c.key)} className="bg-white rounded-[14px] p-[14px_16px] cursor-pointer text-left relative overflow-hidden transition-all"
                  style={{ border: `1.5px solid ${on ? c.color : '#e8edf2'}`, boxShadow: on ? `0 4px 16px ${c.color}1f` : '0 1px 2px rgba(13,27,42,0.04)' }}>
                  <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ background: c.color }} />
                  <div className="text-[28px] font-extrabold tracking-tight leading-none" style={{ color: c.color }}>{c.v}</div>
                  <div className="text-[12.5px] font-semibold text-slate-900 mt-1.5">{c.label}</div>
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
            <div className="flex items-center gap-2 p-[9px_13px] rounded-[10px] border border-slate-300 bg-white flex-1 min-w-[240px] max-w-[380px]">
              <Search size={16} className="text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, cédula o puesto…" className="flex-1 border-none outline-none text-[13.5px] bg-transparent" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-slate-400 font-semibold">Ordenar</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-[12.5px] font-semibold text-slate-700 cursor-pointer outline-none">
                <option value="nombre">Apellido</option><option value="area">Área</option><option value="estado">Urgencia</option>
              </select>
            </div>
            <div className="ml-auto flex gap-0.5 bg-slate-100 p-[3px] rounded-[9px]">
              {([['tabla', List], ['tarjetas', LayoutGrid]] as const).map(([v, Ic]) => (
                <button key={v} onClick={() => setVista(v)} className="grid place-items-center w-[34px] h-[30px] rounded-[7px] border-none cursor-pointer"
                  style={{ background: vista === v ? '#fff' : 'transparent', color: vista === v ? BRAND : '#94a2b3', boxShadow: vista === v ? '0 1px 2px rgba(13,27,42,0.08)' : 'none' }}><Ic size={16} /></button>
              ))}
            </div>
          </div>

          {/* Chips de área (las ingresadas en las fichas) */}
          <div className="flex gap-[7px] mb-4 flex-wrap">
            <AreaPill label="Todas las áreas" on={areaSel === 'Todas'} onClick={() => setAreaSel('Todas')} />
            {areasDeTrabajadores(trabajadores).map((a) => <AreaPill key={a} label={a} dot={colorsDeArea(a).dot} on={areaSel === a} onClick={() => setAreaSel(areaSel === a ? 'Todas' : a)} />)}
          </div>

          <div className="text-[12.5px] text-slate-400 mb-2.5">{list.length} trabajador{list.length !== 1 ? 'es' : ''}{(q || areaSel !== 'Todas' || statusSel !== 'Todos') ? ' · filtrados' : ''}</div>

          {cargando ? <div className="p-16 text-center text-slate-400 font-semibold">Cargando…</div>
            : vista === 'tabla' ? <Tabla list={list} onSel={setSel} sel={sel} /> : <Tarjetas list={list} onSel={setSel} />}
        </div>
      </main>

      {sel && <Drawer entry={sel} onClose={() => setSel(null)} onFicha={(id) => navigate(`/trabajador/${id}`)} />}
    </div>
  );
}

function Tabla({ list, onSel, sel }: { list: Entry[]; onSel: (e: Entry) => void; sel: Entry | null }) {
  const cols = '2.2fr 1.3fr 1.6fr 1.3fr 1.2fr 40px';
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] overflow-x-auto shadow-sm [&>div]:min-w-[720px]">
      <div className="grid gap-3.5 p-[11px_18px] bg-slate-50 border-b border-slate-100 text-[11px] font-bold tracking-[0.4px] uppercase text-slate-400" style={{ gridTemplateColumns: cols }}>
        <span>Trabajador</span><span>Área</span><span>Puesto</span><span>Última eval.</span><span>Estado</span><span></span>
      </div>
      {list.map(({ w, evals }) => {
        const s = workerStatus(evals); const le = lastEval(evals); const area = areaDeTrabajador(w);
        const on = sel?.w.id === w.id;
        return (
          <div key={w.id} onClick={() => onSel({ w, evals })} className="grid gap-3.5 items-center p-[11px_18px] border-b border-slate-50 cursor-pointer text-[13px] hover:bg-slate-50"
            style={{ gridTemplateColumns: cols, background: on ? '#f0fafd' : undefined }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar w={w} area={area} size={36} />
              <div className="min-w-0">
                <div className="font-bold text-slate-900 truncate">{w.primerApellido?.split(' ')[0]} {w.primerNombre?.split(' ')[0]}</div>
                <div className="text-[11.5px] text-slate-400 font-mono">CI {w.cedula}</div>
              </div>
            </div>
            <div><AreaChip area={area} /></div>
            <div className="text-slate-600 truncate">{w.puestoTrabajo}</div>
            <div className="text-slate-500">{le ? <>{fmtDate(le.fecha)}</> : <span className="text-slate-300">—</span>}</div>
            <div><StatusChip s={s} /></div>
            <div className="text-slate-300 text-right"><ChevronRight size={16} /></div>
          </div>
        );
      })}
      {list.length === 0 && <div className="p-12 text-center text-slate-400 text-[13px]">Sin resultados con esos filtros.</div>}
    </div>
  );
}

function Tarjetas({ list, onSel }: { list: Entry[]; onSel: (e: Entry) => void }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))' }}>
      {list.map(({ w, evals }) => {
        const s = workerStatus(evals); const le = lastEval(evals); const area = areaDeTrabajador(w);
        return (
          <button key={w.id} onClick={() => onSel({ w, evals })} className="bg-white border border-slate-200 rounded-[14px] p-4 cursor-pointer text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-center gap-2.5 mb-3">
              <Avatar w={w} area={area} size={42} ring />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-slate-900 truncate">{w.primerApellido?.split(' ')[0]} {w.primerNombre?.split(' ')[0]}</div>
                <div className="text-[11px] text-slate-400 font-mono">CI {w.cedula}</div>
              </div>
            </div>
            <div className="mb-2.5"><AreaChip area={area} /></div>
            <div className="text-[12.5px] text-slate-500 mb-3 min-h-[17px]">{w.puestoTrabajo}</div>
            <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
              <StatusChip s={s} />
              <span className="text-[11px] text-slate-400">{le ? fmtDate(le.fecha) : 'Sin eval.'}</span>
            </div>
          </button>
        );
      })}
      {list.length === 0 && <div className="col-span-full p-12 text-center text-slate-400 text-[13px]">Sin resultados con esos filtros.</div>}
    </div>
  );
}

function Drawer({ entry, onClose, onFicha }: { entry: Entry; onClose: () => void; onFicha: (id: string) => void }) {
  const { w, evals } = entry;
  const area = areaDeTrabajador(w); const ac = colorsDeArea(area); const s = workerStatus(evals); const le = lastEval(evals);
  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex justify-end" style={{ background: 'rgba(13,27,42,0.4)' }}>
      <div onClick={(e) => e.stopPropagation()} className="w-[420px] max-w-[92vw] h-full bg-white overflow-y-auto" style={{ boxShadow: '-12px 0 40px rgba(13,27,42,0.2)' }}>
        <div className="p-[20px_22px] border-b border-slate-100" style={{ background: `linear-gradient(135deg, ${ac.bg} 0%, #fff 75%)` }}>
          <div className="flex items-start gap-3.5">
            <Avatar w={w} area={area} size={52} />
            <div className="flex-1 min-w-0">
              <h2 className="m-0 text-[18px] font-extrabold tracking-tight">{w.primerApellido} {w.primerNombre}</h2>
              <div className="text-[12.5px] text-slate-500 mt-0.5">{w.puestoTrabajo}</div>
            </div>
            <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-slate-400 p-1"><X size={20} /></button>
          </div>
          <div className="flex gap-2 mt-3.5 flex-wrap"><AreaChip area={area} /><StatusChip s={s} /></div>
        </div>
        <div className="p-[18px_22px]">
          <div className="grid grid-cols-2 gap-3 mb-5">
            <KV k="Cédula" v={w.cedula} mono /><KV k="Sexo · Edad" v={`${w.sexo === 'M' ? 'Masculino' : 'Femenino'}`} />
            <KV k="Área" v={area} /><KV k="Evaluaciones" v={`${evals.length} registradas`} />
          </div>
          {le && (
            <div className="p-[14px_16px] rounded-[12px] mb-5" style={{ background: TONE_STYLES[s.tone].bg, border: `1px solid ${TONE_STYLES[s.tone].bar}33` }}>
              <div className="text-[11px] font-bold tracking-[0.4px] uppercase mb-1" style={{ color: TONE_STYLES[s.tone].fg }}>Última evaluación</div>
              <div className="text-[14px] font-bold text-slate-900">{APTITUD_LABEL[le.aptitudMedica] ?? le.aptitudMedica}</div>
              <div className="text-[12px] text-slate-500 mt-0.5">Realizada {fmtDate(le.fecha)}{s.dias != null ? ` · ${s.dias < 0 ? `vencida hace ${Math.abs(s.dias)}d` : `vence en ${s.dias}d`}` : ''}</div>
            </div>
          )}
          <button onClick={() => onFicha(w.id ?? '')} className="w-full justify-center inline-flex items-center gap-1.5 px-4 py-2.5 text-white border-none rounded-[9px] text-[13px] font-bold cursor-pointer" style={{ background: BRAND }}>
            Abrir expediente completo <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Primitivas ───────────────────────────────────────────────────────────────
function Avatar({ w, area, size, ring }: { w: Trabajador; area: string; size: number; ring?: boolean }) {
  const ac = colorsDeArea(area);
  return <div className="rounded-full grid place-items-center font-bold flex-shrink-0" style={{ width: size, height: size, background: ac.bg, color: ac.fg, fontSize: size * 0.34, boxShadow: ring ? `0 0 0 2px #fff, 0 0 0 4px ${ac.dot}40` : undefined }}>{iniciales(w)}</div>;
}
function AreaChip({ area }: { area: string }) {
  const ac = colorsDeArea(area);
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-[7px] text-[12px] font-semibold whitespace-nowrap" style={{ background: ac.bg, color: ac.fg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: ac.dot }} />{area}</span>;
}
function StatusChip({ s }: { s: { label: string; tone: string } }) {
  const t = TONE_STYLES[s.tone as keyof typeof TONE_STYLES];
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[12px] font-bold whitespace-nowrap" style={{ background: t.bg, color: t.fg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: t.bar }} />{s.label}</span>;
}
function AreaPill({ label, dot, on, onClick }: { label: string; dot?: string; on: boolean; onClick: () => void }) {
  return <button onClick={onClick} className="inline-flex items-center gap-[7px] px-[13px] py-[7px] rounded-full cursor-pointer text-[12.5px] font-semibold border"
    style={{ borderColor: on ? BRAND : '#dde4ec', background: on ? BRAND : '#fff', color: on ? '#fff' : '#5a6a7a' }}>
    {dot && <span className="w-[7px] h-[7px] rounded-full" style={{ background: on ? '#fff' : dot }} />}{label}</button>;
}
function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return <div><div className="text-[10.5px] font-bold tracking-[0.4px] uppercase text-slate-400 mb-[3px]">{k}</div><div className={`text-[13.5px] font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>{v}</div></div>;
}
