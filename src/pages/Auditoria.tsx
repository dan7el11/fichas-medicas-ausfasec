// Bitácora de auditoría (solo administradores). Muestra quién creó, editó o
// eliminó registros y cuándo, con filtros y exportación. Ruta: /auditoria
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, ShieldCheck, Download, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/dashboard/TopBar';
import { listarAuditoria } from '../services/auditoria';
import { toDate } from '../services/atenciones';
import type { RegistroAuditoria } from '../types/auditoria';
import { COLORS, FONTS } from '../theme';

const BRAND = COLORS.brand;

const ACCION_TONO: Record<string, { fg: string; bg: string; label: string }> = {
  crear:    { fg: COLORS.ok,  bg: COLORS.okBg,  label: 'Creó' },
  editar:   { fg: '#1d4fad',  bg: '#eaf3ff',    label: 'Editó' },
  eliminar: { fg: COLORS.bad, bg: COLORS.badBg, label: 'Eliminó' },
};

const ENTIDAD_LABEL: Record<string, string> = {
  trabajador: 'Trabajador', evaluacion: 'Evaluación', atencion: 'Atención',
  permiso: 'Permiso', usuario: 'Usuario', ergonomia: 'Ergonomía',
};

export default function Auditoria() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [fEntidad, setFEntidad] = useState('Todas');
  const [fAccion, setFAccion] = useState('Todas');
  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'AD';

  useEffect(() => {
    (async () => {
      setCargando(true);
      setRegistros(await listarAuditoria(500));
      setCargando(false);
    })();
  }, []);

  const entidades = useMemo(() => ['Todas', ...Array.from(new Set(registros.map((r) => r.entidad)))], [registros]);

  const filtrados = useMemo(() => registros.filter((r) => {
    if (fEntidad !== 'Todas' && r.entidad !== fEntidad) return false;
    if (fAccion !== 'Todas' && r.accion !== fAccion) return false;
    if (q) {
      const t = `${r.descripcion} ${r.usuarioEmail}`.toLowerCase();
      if (!t.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [registros, fEntidad, fAccion, q]);

  const fmt = (f: any) => {
    const d = toDate(f);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const exportarCSV = () => {
    const rows = [['FECHA', 'USUARIO', 'ACCIÓN', 'ENTIDAD', 'DESCRIPCIÓN']];
    filtrados.forEach((r) => rows.push([fmt(r.fecha), r.usuarioEmail, r.accion, r.entidad, r.descripcion]));
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `auditoria_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center text-center" style={{ fontFamily: FONTS.sans }}>
        <div>
          <ShieldCheck size={40} className="mx-auto mb-3" style={{ color: COLORS.bad }} />
          <div className="font-bold text-lg">Acceso restringido</div>
          <div className="text-sm text-slate-500 mt-1.5">Solo los administradores pueden ver la bitácora de auditoría.</div>
          <button onClick={() => navigate('/')} className="mt-4 px-5 py-2 text-white rounded-lg font-semibold" style={{ background: BRAND }}>Volver al inicio</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg, fontFamily: FONTS.sans, color: COLORS.ink }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Admin'} userRol="Administrador" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <div className="max-w-5xl mx-auto p-6 md:p-8">
        <div className="flex items-end justify-between gap-3 mb-5 flex-wrap">
          <div>
            <h1 className="m-0 text-[26px] font-bold tracking-tight flex items-center gap-2" style={{ fontFamily: FONTS.serif }}>
              <History size={24} /> Bitácora de auditoría
            </h1>
            <p className="m-0 text-sm text-slate-500 mt-1">Registro de quién creó, editó o eliminó información, y cuándo.</p>
          </div>
          <button onClick={exportarCSV} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50">
            <Download size={15} /> Exportar (CSV)
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 flex-1 min-w-[220px]">
            <Search size={15} className="text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por descripción o usuario…" className="flex-1 border-none outline-none text-[13px] bg-transparent" />
          </div>
          <select value={fEntidad} onChange={(e) => setFEntidad(e.target.value)} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-[13px] font-semibold cursor-pointer outline-none">
            {entidades.map((e) => <option key={e} value={e}>{e === 'Todas' ? 'Todas las áreas' : (ENTIDAD_LABEL[e] ?? e)}</option>)}
          </select>
          <select value={fAccion} onChange={(e) => setFAccion(e.target.value)} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-[13px] font-semibold cursor-pointer outline-none">
            <option value="Todas">Todas las acciones</option>
            <option value="crear">Creaciones</option>
            <option value="editar">Ediciones</option>
            <option value="eliminar">Eliminaciones</option>
          </select>
        </div>

        <div className="bg-white border rounded-[14px] overflow-hidden shadow-sm" style={{ borderColor: COLORS.line }}>
          {cargando ? (
            <div className="p-12 text-center text-slate-400">Cargando bitácora…</div>
          ) : filtrados.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              {registros.length === 0 ? 'Aún no hay registros de auditoría.' : 'Sin resultados con esos filtros.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[760px]">
                <thead>
                  <tr className="border-b text-left" style={{ background: COLORS.bg, borderColor: COLORS.line }}>
                    {['Fecha y hora', 'Usuario', 'Acción', 'Detalle'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.faint }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((r) => {
                    const tono = ACCION_TONO[r.accion] ?? { fg: COLORS.muted, bg: COLORS.bg, label: r.accion };
                    return (
                      <tr key={r.id} className="border-t hover:bg-slate-50" style={{ borderColor: COLORS.line }}>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ fontFamily: FONTS.mono, color: COLORS.muted }}>{fmt(r.fecha)}</td>
                        <td className="px-4 py-3 text-slate-600">{r.usuarioEmail || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ color: tono.fg, background: tono.bg }}>{tono.label}</span>
                          <span className="ml-1.5 text-[11px] text-slate-400">{ENTIDAD_LABEL[r.entidad] ?? r.entidad}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{r.descripcion}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-3">Se muestran los últimos {registros.length} eventos. La bitácora no se puede modificar ni borrar.</p>
      </div>
    </div>
  );
}
