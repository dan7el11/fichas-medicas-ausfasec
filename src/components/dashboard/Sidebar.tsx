import { useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { Trabajador, EvaluacionMedica } from '../../types';
import {
  AREAS,
  TIPOS_EVAL,
  AREA_COLORS,
  type Area,
} from '../../constants/medical';
import {
  areaDeTrabajador,
  dashboardStats,
  fmtDate,
  iniciales,
  lastEval,
  TONE_STYLES,
  workerStatus,
} from '../../utils/medicalHelpers';

type StatusFilter = 'Todos' | 'Apto vigente' | 'Por vencer' | 'Vencida' | 'Sin evaluación';

interface SidebarProps {
  trabajadores: Trabajador[];
  evalsPorTrabajador: Map<string, EvaluacionMedica[]>;
  filtered: Trabajador[];
  query: string;
  setQuery: (v: string) => void;
  areaFilter: Area | 'Todas';
  setAreaFilter: (v: Area | 'Todas') => void;
  tipoFilter: string;
  setTipoFilter: (v: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  selectedId?: string;
  onSelect: (id: string) => void;
  groupByArea?: boolean;
  density?: 'comfy' | 'compact';
  onNewWorker: () => void;
}

export default function Sidebar({
  trabajadores,
  evalsPorTrabajador,
  filtered,
  query,
  setQuery,
  areaFilter,
  setAreaFilter,
  tipoFilter,
  setTipoFilter,
  statusFilter,
  setStatusFilter,
  selectedId,
  onSelect,
  groupByArea = true,
  density = 'comfy',
  onNewWorker,
}: SidebarProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const stats = dashboardStats(trabajadores, evalsPorTrabajador);

  const exportarCSV = () => {
    const filas = filtered.map((w) => {
      const evals = evalsPorTrabajador.get(w.id ?? '') ?? [];
      const ultima = lastEval(evals);
      const status = workerStatus(evals);
      const aptitud = ultima?.aptitudMedica ?? '-';
      const aptitudLabel: Record<string, string> = {
        apto: 'Apto', aptoObservacion: 'Apto en observación',
        aptoLimitaciones: 'Apto con limitaciones', noApto: 'No apto',
      };
      return [
        w.cedula,
        `${w.primerApellido} ${w.segundoApellido || ''}`.trim(),
        `${w.primerNombre} ${w.segundoNombre || ''}`.trim(),
        w.puestoTrabajo,
        areaDeTrabajador(w),
        status.label,
        ultima ? fmtDate(ultima.fecha) : 'Sin evaluación',
        aptitudLabel[aptitud] ?? aptitud,
      ];
    });
    const encabezado = ['CÉDULA', 'APELLIDOS', 'NOMBRES', 'PUESTO', 'ÁREA', 'ESTADO', 'ÚLTIMA EVAL.', 'APTITUD'];
    const csv = '﻿' + [encabezado, ...filas].map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `trabajadores_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const grouped: Array<[string, Trabajador[]]> = groupByArea
    ? AREAS.map((a) => [a, filtered.filter((w) => areaDeTrabajador(w) === a)] as [string, Trabajador[]]).filter(
        ([, arr]) => arr.length > 0,
      )
    : [['__all', filtered]];

  const hasFilters =
    query ||
    areaFilter !== 'Todas' ||
    tipoFilter !== 'Todos' ||
    statusFilter !== 'Todos';

  return (
    <aside className="bg-white border-r border-slate-200 flex flex-col overflow-hidden">
      {/* Resumen */}
      <div className="px-4 pt-3.5 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-1">
          <h2 className="m-0 text-[15px] font-bold tracking-[-0.2px]">Trabajadores</h2>
          <span className="text-[11px] text-slate-500">{stats.total} total</span>
        </div>
        <div className="grid grid-cols-4 gap-1 mt-2.5">
          <MiniStat color="#10a05a" v={stats.aptos} label="Aptos" active={statusFilter === 'Apto vigente'} onClick={() => setStatusFilter(statusFilter === 'Apto vigente' ? 'Todos' : 'Apto vigente')} />
          <MiniStat color="#e08a2c" v={stats.porVencer} label="Por vencer" active={statusFilter === 'Por vencer'} onClick={() => setStatusFilter(statusFilter === 'Por vencer' ? 'Todos' : 'Por vencer')} />
          <MiniStat color="#dc2e3c" v={stats.vencidasONoApto} label="Vencidas" active={statusFilter === 'Vencida'} onClick={() => setStatusFilter(statusFilter === 'Vencida' ? 'Todos' : 'Vencida')} />
          <MiniStat color="#94a2b3" v={stats.sinEval} label="Sin eval." active={statusFilter === 'Sin evaluación'} onClick={() => setStatusFilter(statusFilter === 'Sin evaluación' ? 'Todos' : 'Sin evaluación')} />
        </div>
      </div>

      {/* Búsqueda + filtros */}
      <div className="px-4 pt-3 pb-2.5 border-b border-slate-100">
        <div className="relative mb-2">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" strokeWidth={2} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nombre, cédula, puesto…"
            className="w-full pl-8 pr-12 py-2 border border-slate-300 rounded-[7px] text-xs bg-slate-50 outline-none focus:ring-2 focus:ring-[var(--brand-primary,#0a6b3b)]/15 focus:border-[var(--brand-primary,#0a6b3b)]"
          />
          <span className="absolute right-2 top-2 px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-500 font-mono">⌘K</span>
        </div>
        <div className="flex gap-1.5">
          <NativeSelect value={areaFilter} options={['Todas', ...AREAS]} onChange={(v) => setAreaFilter(v as Area | 'Todas')} label="Área" />
          <NativeSelect value={tipoFilter} options={['Todos', ...TIPOS_EVAL]} onChange={setTipoFilter} label="Tipo eval." />
        </div>
        {hasFilters && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">{filtered.length} resultados</span>
            <button
              onClick={() => {
                setQuery('');
                setAreaFilter('Todas');
                setTipoFilter('Todos');
                setStatusFilter('Todos');
              }}
              className="ml-auto bg-transparent border-none cursor-pointer text-[11px] font-semibold p-0"
              style={{ color: 'var(--brand-primary, #0a6b3b)' }}
            >
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {grouped.map(([area, items]) => (
          <div key={area}>
            {groupByArea && (
              <div
                className="sticky top-0 z-10 px-4 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.6px] uppercase text-slate-500 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: AREA_COLORS[area as Area]?.dot }}
                />
                {area}
                <span className="ml-auto opacity-60 font-medium">{items.length}</span>
              </div>
            )}
            {items.map((w) => (
              <SidebarItem
                key={w.id}
                w={w}
                evals={evalsPorTrabajador.get(w.id ?? '') ?? []}
                selected={w.id === selectedId}
                onClick={() => w.id && onSelect(w.id)}
                density={density}
              />
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-xs">
            <div className="text-3xl mb-1.5">·</div>
            Sin resultados.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
        <button
          onClick={onNewWorker}
          className="bg-transparent border-none text-xs font-semibold cursor-pointer p-0 flex items-center gap-1"
          style={{ color: 'var(--brand-primary, #0a6b3b)' }}
        >
          <span className="text-sm leading-none">+</span> Agregar trabajador
        </button>
        <button
          onClick={exportarCSV}
          title={`Exportar ${filtered.length} trabajador(es) a CSV`}
          className="bg-transparent border-none text-[11px] cursor-pointer p-0 text-slate-500 hover:text-slate-800 transition-colors"
        >
          Exportar ↓
        </button>
      </div>
    </aside>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

function MiniStat({
  color,
  v,
  label,
  active,
  onClick,
}: {
  color: string;
  v: number;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="py-1.5 px-1 rounded-md cursor-pointer text-center transition-colors"
      style={{
        background: active ? `${color}18` : '#fafbfc',
        border: `1px solid ${active ? `${color}50` : '#eef1f5'}`,
      }}
    >
      <div className="text-sm font-bold" style={{ color }}>{v}</div>
      <div className="text-[9px] text-slate-500 mt-px">{label}</div>
    </button>
  );
}

function NativeSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  label: string;
}) {
  const defaultVal = options[0];
  const isDefault = value === defaultVal;
  return (
    <div className="flex-1 relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-2.5 pr-6 py-1.5 border border-slate-300 rounded-md text-[11px] cursor-pointer outline-none appearance-none"
        style={{
          background: isDefault ? '#fff' : '#eaf3ff',
          color: isDefault ? '#3a4a5e' : '#1d4fad',
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === defaultVal ? label : o}
          </option>
        ))}
      </select>
      <span className="absolute right-2 top-2 text-[9px] text-slate-500 pointer-events-none">▾</span>
    </div>
  );
}

function SidebarItem({
  w,
  evals,
  selected,
  onClick,
  density,
}: {
  w: Trabajador;
  evals: EvaluacionMedica[];
  selected: boolean;
  onClick: () => void;
  density: 'comfy' | 'compact';
}) {
  const ac = AREA_COLORS[areaDeTrabajador(w)];
  const status = workerStatus(evals);
  const bar = TONE_STYLES[status.tone].bar;
  const padY = density === 'compact' ? 'py-[7px]' : 'py-[11px]';
  const avatarSize = density === 'compact' ? 26 : 32;

  return (
    <button
      onClick={onClick}
      className={`block w-full text-left ${padY} pr-4 pl-[13px] cursor-pointer border-b border-slate-100 transition-colors`}
      style={{
        background: selected ? '#eaf3ff' : 'transparent',
        borderLeft: `3px solid ${selected ? 'var(--brand-primary, #0a6b3b)' : 'transparent'}`,
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = '#fafbfc';
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="rounded-full grid place-items-center font-bold flex-shrink-0"
          style={{
            width: avatarSize,
            height: avatarSize,
            background: ac.bg,
            color: ac.fg,
            fontSize: density === 'compact' ? 10 : 11,
          }}
        >
          {iniciales(w)}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-slate-900 truncate ${density === 'compact' ? 'text-xs' : 'text-[13px]'}`}>
            {w.primerApellido} {w.primerNombre.split(' ')[0]}
          </div>
          {density !== 'compact' && (
            <div className="text-[11px] text-slate-500 truncate">{w.puestoTrabajo}</div>
          )}
        </div>
        <div
          title={status.label}
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: bar }}
        />
      </div>
    </button>
  );
}
