// Pestaña Consumos — Inventario. Archivo NUEVO: src/components/inventario/TabConsumos.tsx
// Lista todos los medicamentos administrados desde el formulario de atención diaria
// (colección `atenciones`, campo `medicacion`). Solo lectura: no toca el inventario.
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query as fbQuery, orderBy } from 'firebase/firestore';
import { Search, Pill, Stethoscope, Download, TrendingUp } from 'lucide-react';
import { db } from '../../services/firebase';
import type { AtencionMedica } from '../../types/atencion';
import { CENTROS } from '../../types/inventario';
import { normalizarTexto } from '../../utils/inventarioHelpers';
import { COLORS, FONTS } from '../../theme';

const ACCENT = '#9a5b12';
const ACCENT_BG = '#f8eddc';

interface ConsumoRow {
  id: string;            // atencionId + index
  fecha: Date;
  paciente: string;
  externo: boolean;
  medicamento: string;
  cantidad: number;
  cie: string;
  medico: string;
  centro: string;        // etiqueta del centro de atención ('' si no se registró)
}

function toDateSafe(v: any): Date {
  if (!v) return new Date(NaN);
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  return v instanceof Date ? v : new Date(v);
}

export default function TabConsumos() {
  const [rows, setRows] = useState<ConsumoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [mes, setMes] = useState<string>('todos'); // 'todos' | 'YYYY-MM'
  const [dia, setDia] = useState<string>('');      // '' | 'YYYY-MM-DD' — día del registro
  const [medico, setMedico] = useState<string>('todos');

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        let docs;
        try {
          docs = (await getDocs(fbQuery(collection(db, 'atenciones'), orderBy('fecha', 'desc')))).docs;
        } catch {
          docs = (await getDocs(collection(db, 'atenciones'))).docs;
        }
        const out: ConsumoRow[] = [];
        docs.forEach((d) => {
          const a = { id: d.id, ...d.data() } as AtencionMedica;
          (a.medicacion ?? []).forEach((m, i) => {
            if (!m?.nombre) return;
            out.push({
              id: `${d.id}-${i}`,
              fecha: toDateSafe(a.fecha),
              paciente: `${a.pacienteApellidos ?? ''} ${a.pacienteNombres ?? ''}`.trim() || '—',
              externo: a.pacienteTipo === 'externo',
              medicamento: m.nombre,
              cantidad: Number(m.cantidad) || 1,
              cie: a.cieCodigo ?? '',
              medico: a.medicoNombre ?? '',
              centro: a.centroAtencion ? ((CENTROS as any)[a.centroAtencion] ?? a.centroAtencion) : '',
            });
          });
        });
        out.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
        setRows(out);
      } catch (err) {
        console.error('Error al cargar consumos:', err);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // Fecha en hora local (toISOString desplaza el día en UTC-5)
  const fechaLocal = (d: Date) => {
    if (isNaN(d.getTime())) return '';
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

  // Meses y médicos disponibles para los filtros
  const meses = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { const f = fechaLocal(r.fecha); if (f) s.add(f.slice(0, 7)); });
    return [...s].sort().reverse();
  }, [rows]);

  const medicos = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.medico) s.add(r.medico); });
    return [...s].sort((a, b) => a.localeCompare(b, 'es'));
  }, [rows]);

  const filtrados = useMemo(() => {
    let l = rows;
    if (dia) l = l.filter((r) => fechaLocal(r.fecha) === dia);
    else if (mes !== 'todos') l = l.filter((r) => fechaLocal(r.fecha).slice(0, 7) === mes);
    if (medico !== 'todos') l = l.filter((r) => r.medico === medico);
    if (q) {
      // Sin tildes: «Pérez» y «Perez» son intercambiables.
      const s = normalizarTexto(q);
      l = l.filter((r) => normalizarTexto(r.paciente).includes(s) || normalizarTexto(r.medicamento).includes(s));
    }
    // Siempre los más recientes primero, también con filtros aplicados.
    return [...l].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }, [rows, q, mes, dia, medico]);

  const stats = useMemo(() => {
    const unidades = filtrados.reduce((s, r) => s + r.cantidad, 0);
    const porMed = new Map<string, number>();
    filtrados.forEach((r) => porMed.set(r.medicamento, (porMed.get(r.medicamento) ?? 0) + r.cantidad));
    const top = [...porMed.entries()].sort((a, b) => b[1] - a[1])[0];
    return { registros: filtrados.length, unidades, top: top ? `${top[0]} (${top[1]} u.)` : '—' };
  }, [filtrados]);

  const exportarCSV = () => {
    const data = [['FECHA', 'HORA', 'PACIENTE', 'TIPO', 'MEDICAMENTO', 'CANTIDAD', 'CIE-10', 'CENTRO', 'MÉDICO']];
    filtrados.forEach((r) => {
      data.push([
        r.fecha.toLocaleDateString('es-EC'),
        r.fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        r.paciente, r.externo ? 'Externo' : 'Trabajador', r.medicamento, String(r.cantidad), r.cie, r.centro, r.medico,
      ]);
    });
    const csv = '\ufeff' + data.map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Consumos_atencion_diaria${mes !== 'todos' ? '_' + mes : ''}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const fmtMes = (m: string) => {
    const d = new Date(m + '-15T12:00:00');
    const s = d.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <div>
      {/* Mini-KPIs del filtro actual */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Mini value={stats.registros} label="Dispensaciones" icon={<Stethoscope size={16} />} />
        <Mini value={stats.unidades} label="Unidades entregadas" icon={<Pill size={16} />} />
        <Mini value={stats.top} label="Más dispensado" icon={<TrendingUp size={16} />} texto />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3.5 flex-wrap">
        <div className="flex items-center gap-2 p-[8px_12px] rounded-[9px] border flex-1 min-w-[220px] max-w-[340px]" style={{ borderColor: COLORS.line, background: COLORS.panel }}>
          <Search size={15} style={{ color: COLORS.faint }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar paciente o medicamento…" className="flex-1 border-none outline-none text-[13px] bg-transparent" style={{ color: COLORS.ink }} />
        </div>
        <select value={mes} onChange={(e) => setMes(e.target.value)} disabled={!!dia} className="px-3 py-[9px] rounded-[9px] border text-[12.5px] font-semibold cursor-pointer outline-none disabled:opacity-50" style={{ borderColor: COLORS.line, background: COLORS.panel, color: COLORS.muted }}>
          <option value="todos">Todos los meses</option>
          {meses.map((m) => <option key={m} value={m}>{fmtMes(m)}</option>)}
        </select>
        {/* Día exacto del registro del consumo */}
        <div className="flex items-center gap-1.5">
          <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} title="Consumos de un día concreto"
            className="px-3 py-[8px] rounded-[9px] border text-[12.5px] font-semibold cursor-pointer outline-none" style={{ borderColor: COLORS.line, background: COLORS.panel, color: dia ? COLORS.ink : COLORS.muted }} />
          {dia && (
            <button onClick={() => setDia('')} title="Quitar filtro de día" className="px-2 py-[8px] rounded-[9px] border text-[12px] font-bold cursor-pointer" style={{ borderColor: COLORS.line, background: COLORS.panel, color: COLORS.bad }}>✕</button>
          )}
        </div>
        {/* Médico que registró el consumo */}
        <select value={medico} onChange={(e) => setMedico(e.target.value)} className="px-3 py-[9px] rounded-[9px] border text-[12.5px] font-semibold cursor-pointer outline-none max-w-[220px]" style={{ borderColor: COLORS.line, background: COLORS.panel, color: COLORS.muted }}>
          <option value="todos">Todos los médicos</option>
          {medicos.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={exportarCSV} className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-[9px] rounded-[9px] border text-[12.5px] font-semibold cursor-pointer" style={{ borderColor: COLORS.line, background: COLORS.panel, color: COLORS.muted }}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* Tabla */}
      <div className="rounded-[14px] border overflow-hidden" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b" style={{ background: COLORS.bg, borderColor: COLORS.line }}>
                {['Fecha', 'Hora', 'Paciente', 'Medicamento', 'Cant.', 'CIE-10', 'Centro', 'Médico'].map((h) => (
                  <th key={h} className="px-3.5 py-2.5 text-left font-bold uppercase tracking-wide whitespace-nowrap text-[10.5px]" style={{ color: COLORS.faint }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={8} className="p-12 text-center font-semibold" style={{ color: COLORS.faint }}>Cargando consumos…</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={8} className="p-12 text-center text-[13px]" style={{ color: COLORS.faint }}>
                  {rows.length === 0 ? 'Aún no hay medicación registrada en atenciones diarias.' : 'Sin resultados con ese filtro.'}
                </td></tr>
              ) : filtrados.map((r, i) => (
                <tr key={r.id} style={{ borderTop: i > 0 ? `1px solid ${COLORS.line}` : 'none' }} className="hover:bg-[#faf7f8]">
                  <td className="px-3.5 py-2.5 whitespace-nowrap" style={{ fontFamily: FONTS.mono, color: COLORS.muted }}>{isNaN(r.fecha.getTime()) ? '—' : r.fecha.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap" style={{ fontFamily: FONTS.mono, color: COLORS.faint }}>{isNaN(r.fecha.getTime()) ? '—' : r.fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-3.5 py-2.5">
                    <span className="font-semibold" style={{ color: COLORS.ink }}>{r.paciente}</span>
                    {r.externo && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-px rounded-full" style={{ background: COLORS.bg, color: COLORS.faint }}>externo</span>}
                  </td>
                  <td className="px-3.5 py-2.5" style={{ color: COLORS.ink }}>{r.medicamento}</td>
                  <td className="px-3.5 py-2.5 font-bold" style={{ fontFamily: FONTS.mono, color: ACCENT }}>{r.cantidad}</td>
                  <td className="px-3.5 py-2.5" style={{ fontFamily: FONTS.mono, color: COLORS.muted }}>{r.cie || '—'}</td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-[11.5px]" style={{ color: COLORS.muted }}>{r.centro || '—'}</td>
                  <td className="px-3.5 py-2.5 max-w-[160px] truncate" style={{ color: COLORS.faint }}>{r.medico || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Mini({ value, label, icon, texto }: { value: ReactNode; label: string; icon: ReactNode; texto?: boolean }) {
  return (
    <div className="rounded-[14px] p-[13px_16px] flex items-center gap-3 border" style={{ background: COLORS.panel, borderColor: COLORS.line }}>
      <span className="grid place-items-center w-[34px] h-[34px] rounded-[9px] flex-shrink-0" style={{ background: ACCENT_BG, color: ACCENT }}>{icon}</span>
      <div className="min-w-0">
        <div className={texto ? 'text-[13.5px] font-bold truncate' : 'text-[22px] font-bold tracking-tight leading-none'} style={{ fontFamily: texto ? FONTS.sans : FONTS.mono, color: COLORS.ink }}>{value}</div>
        <div className="text-[10.5px] font-semibold mt-1 uppercase" style={{ color: COLORS.faint, letterSpacing: '.3px' }}>{label}</div>
      </div>
    </div>
  );
}
