import { useState } from 'react';
import { ArrowRight, Trash2 } from 'lucide-react';
import type { Medicamento, Movimiento, CentroId } from '../../types/inventario';
import { CENTROS } from '../../types/inventario';
import { registrarMovimiento, eliminarMovimiento } from '../../services/inventario';
import { fmtFecha, exportarMovimientosCSV } from '../../utils/inventarioHelpers';
import BuscadorMedicamento from './BuscadorMedicamento';
import { COLORS, FONTS } from '../../theme';

const CENTROS_LIST = Object.keys(CENTROS) as CentroId[];

interface Props {
  inventario: Medicamento[];
  movimientos: Movimiento[];
  usuarioNombre: string;
  isAdmin: boolean;
  onRefresh: () => void;
}

export default function TabMovimientos({ inventario, movimientos, usuarioNombre, isAdmin, onRefresh }: Props) {
  const [medSel, setMedSel] = useState<Medicamento | null>(null);
  const [origen, setOrigen] = useState<CentroId | 'PROVEEDOR'>('PROVEEDOR');
  const [destino, setDestino] = useState<CentroId>('planta_envasado');
  const [cantidad, setCantidad] = useState(1);
  const [obs, setObs] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  async function confirmar() {
    if (!medSel) { setError('Seleccione un medicamento'); return; }
    if (origen === destino) { setError('Origen y destino deben ser distintos'); return; }
    if (cantidad < 1) { setError('Cantidad inválida'); return; }
    setError(''); setGuardando(true);
    try {
      await registrarMovimiento(medSel.codigo, origen, destino as CentroId, cantidad, usuarioNombre, obs);
      setMedSel(null); setCantidad(1); setObs(''); setOk(true);
      setTimeout(() => setOk(false), 3000);
      onRefresh();
    } catch (e: any) { setError(e.message ?? 'Error'); }
    setGuardando(false);
  }

  const stockOrigen = medSel && origen !== 'PROVEEDOR' ? (medSel.stocks[origen as CentroId] ?? 0) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Formulario */}
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, fontFamily: FONTS.serif, color: COLORS.ink }}>Registrar movimiento</h3>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: 'block', marginBottom: 4 }}>MEDICAMENTO</label>
          {medSel
            ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: COLORS.bg, borderRadius: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: COLORS.ink }}>{medSel.nombre}</span>
                <button onClick={() => setMedSel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.faint, fontSize: 11 }}>cambiar</button>
              </div>
            : <BuscadorMedicamento inventario={inventario} onSelect={setMedSel} />}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'end', marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: 'block', marginBottom: 4 }}>ORIGEN</label>
            <select value={origen} onChange={(e) => setOrigen(e.target.value as CentroId | 'PROVEEDOR')}
              style={{ width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '7px 10px', fontSize: 13 }}>
              <option value="PROVEEDOR">Proveedor / Compra</option>
              {CENTROS_LIST.map((k) => <option key={k} value={k}>{CENTROS[k]}</option>)}
            </select>
            {stockOrigen !== null && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 3 }}>Stock: {stockOrigen}</div>}
          </div>
          <ArrowRight size={18} color={COLORS.faint} style={{ marginBottom: 6 }} />
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: 'block', marginBottom: 4 }}>DESTINO</label>
            <select value={destino} onChange={(e) => setDestino(e.target.value as CentroId)}
              style={{ width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '7px 10px', fontSize: 13 }}>
              {CENTROS_LIST.map((k) => <option key={k} value={k}>{CENTROS[k]}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: 'block', marginBottom: 4 }}>CANTIDAD</label>
            <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
              style={{ width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '7px 10px', fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: 'block', marginBottom: 4 }}>OBSERVACIÓN (opcional)</label>
            <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Motivo del movimiento"
              style={{ width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '7px 10px', fontSize: 13 }} />
          </div>
        </div>

        {error && <p style={{ color: COLORS.bad, fontSize: 12, marginBottom: 10 }}>{error}</p>}
        {ok && <p style={{ color: COLORS.ok, fontSize: 12, marginBottom: 10 }}>✓ Movimiento registrado</p>}

        <button onClick={confirmar} disabled={guardando || !medSel}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: COLORS.brand, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: guardando ? 'wait' : 'pointer', opacity: !medSel ? 0.5 : 1 }}>
          <ArrowRight size={15} /> {guardando ? 'Guardando…' : 'Confirmar movimiento'}
        </button>
      </div>

      {/* Historial */}
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: FONTS.serif, color: COLORS.ink }}>Historial de movimientos</h3>
          <button onClick={() => exportarMovimientosCSV(movimientos, inventario)}
            style={{ fontSize: 12, padding: '5px 12px', border: `1px solid ${COLORS.line}`, borderRadius: 7, background: COLORS.bg, cursor: 'pointer', color: COLORS.muted }}>
            Exportar CSV
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${COLORS.line}` }}>
                {['Medicamento', 'Desde', 'Hacia', 'Cantidad', 'Fecha', 'Usuario', isAdmin ? 'Acc.' : ''].filter(Boolean).map((h) => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: COLORS.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...movimientos].reverse().slice(0, 100).map((m) => {
                const med = inventario.find((x) => x.codigo === m.medicamentoCodigo);
                const origenLabel = m.origen === 'PROVEEDOR' ? 'Proveedor' : (CENTROS[m.origen as CentroId] ?? m.origen);
                return (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                    <td style={{ padding: '7px 10px', color: COLORS.ink, fontWeight: 500 }}>{med?.nombre ?? m.medicamentoCodigo}</td>
                    <td style={{ padding: '7px 10px', color: COLORS.muted }}>{origenLabel}</td>
                    <td style={{ padding: '7px 10px', color: COLORS.brand, fontWeight: 600 }}>{CENTROS[m.destino]}</td>
                    <td style={{ padding: '7px 10px', fontFamily: FONTS.mono, fontWeight: 700, color: COLORS.ok }}>{m.cantidad}</td>
                    <td style={{ padding: '7px 10px', color: COLORS.muted }}>{fmtFecha(m.fecha)}</td>
                    <td style={{ padding: '7px 10px', color: COLORS.muted }}>{m.usuario}</td>
                    {isAdmin && (
                      <td style={{ padding: '7px 10px' }}>
                        <button onClick={async () => { if (confirm('¿Revertir movimiento?')) { await eliminarMovimiento(m.id); onRefresh(); } }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.bad }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {movimientos.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: COLORS.faint }}>Sin movimientos registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
