import { useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import type { Medicamento, CentroId } from '../../types/inventario';
import { CENTROS } from '../../types/inventario';
import { checkExpiracion, diasParaExpirar, fmtFecha, normalizarTexto } from '../../utils/inventarioHelpers';
import { COLORS, FONTS } from '../../theme';

const CENTROS_LIST = Object.keys(CENTROS) as CentroId[];

interface Props {
  inventario: Medicamento[];
  centroDefault: CentroId;
  vista: 'mi-centro' | 'general';
}

export default function TabInventario({ inventario, centroDefault, vista }: Props) {
  const [centro, setCentro] = useState<CentroId>(centroDefault);
  const [q, setQ] = useState('');
  const [soloAlertas, setSoloAlertas] = useState(false);

  const filtrado = inventario.filter((m) => {
    if (q && !normalizarTexto(m.nombre).includes(normalizarTexto(q)) && !normalizarTexto(m.codigo).includes(normalizarTexto(q))) return false;
    if (soloAlertas) {
      const e = checkExpiracion(m.fechaExpiracion);
      const stockTotal = vista === 'mi-centro' ? (m.stocks[centro] ?? 0) : Object.values(m.stocks).reduce((s, v) => s + (v ?? 0), 0);
      if (e === 'ok' && stockTotal > 0) return false;
    }
    return true;
  });

  function stockColor(n: number): string {
    if (n === 0) return COLORS.bad;
    if (n <= 5) return COLORS.warn;
    return COLORS.ok;
  }

  function expTag(m: Medicamento) {
    const e = checkExpiracion(m.fechaExpiracion);
    const dias = diasParaExpirar(m.fechaExpiracion);
    if (e === 'expirado') return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: COLORS.badBg, color: COLORS.bad }}>EXPIRADO</span>;
    if (e === 'proximo') return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: COLORS.warnBg, color: COLORS.warn }}>{dias}d</span>;
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '6px 10px', background: COLORS.panel }}>
          <Search size={14} color={COLORS.faint} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar medicamento…"
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, color: COLORS.ink, background: 'transparent' }} />
        </div>

        {vista === 'mi-centro' && (
          <select value={centro} onChange={(e) => setCentro(e.target.value as CentroId)}
            style={{ border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '7px 12px', fontSize: 13, color: COLORS.ink, background: COLORS.panel }}>
            {CENTROS_LIST.map((k) => <option key={k} value={k}>{CENTROS[k]}</option>)}
          </select>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLORS.muted, cursor: 'pointer' }}>
          <input type="checkbox" checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} />
          Solo alertas
        </label>
      </div>

      {/* Tabla */}
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: COLORS.bg, borderBottom: `2px solid ${COLORS.line}` }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: COLORS.muted }}>Código</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: COLORS.muted }}>Medicamento</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: COLORS.muted }}>Lote</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: COLORS.muted }}>Expiración</th>
                {vista === 'mi-centro'
                  ? <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: COLORS.muted }}>Stock</th>
                  : CENTROS_LIST.map((k) => (
                    <th key={k} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: COLORS.muted, whiteSpace: 'nowrap' }}>{CENTROS[k]}</th>
                  ))
                }
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: COLORS.muted }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filtrado.map((m) => {
                const total = Object.values(m.stocks).reduce((s, v) => s + (v ?? 0), 0);
                return (
                  <tr key={m.codigo} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                    <td style={{ padding: '9px 14px', fontFamily: FONTS.mono, color: COLORS.faint, fontSize: 11 }}>{m.codigo}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <div style={{ fontWeight: 600, color: COLORS.ink }}>{m.nombre}</div>
                      {m.sobrenombre && <div style={{ fontSize: 11, color: COLORS.muted }}>{m.sobrenombre}</div>}
                    </td>
                    <td style={{ padding: '9px 14px', color: COLORS.muted }}>{m.lote || '—'}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: COLORS.muted }}>{fmtFecha(m.fechaExpiracion)}</span>
                        {expTag(m)}
                      </div>
                    </td>
                    {vista === 'mi-centro'
                      ? <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 700, color: stockColor(m.stocks[centro] ?? 0), fontFamily: FONTS.mono }}>{m.stocks[centro] ?? 0}</td>
                      : CENTROS_LIST.map((k) => (
                        <td key={k} style={{ padding: '9px 14px', textAlign: 'center', fontFamily: FONTS.mono, color: stockColor(m.stocks[k] ?? 0), fontWeight: 600 }}>{m.stocks[k] ?? 0}</td>
                      ))
                    }
                    <td style={{ padding: '9px 14px', textAlign: 'center', fontFamily: FONTS.mono, fontWeight: 700, color: stockColor(total) }}>{total}</td>
                  </tr>
                );
              })}
              {filtrado.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: 24, textAlign: 'center', color: COLORS.faint }}>
                    <AlertTriangle size={18} style={{ display: 'inline', marginRight: 6 }} />
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
