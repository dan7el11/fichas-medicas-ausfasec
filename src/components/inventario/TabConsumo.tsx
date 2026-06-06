import { useState } from 'react';
import { Plus, Trash2, ShoppingCart, CheckCircle } from 'lucide-react';
import type { Medicamento, Consumo, CentroId } from '../../types/inventario';
import { CENTROS } from '../../types/inventario';
import { registrarConsumos, eliminarConsumo } from '../../services/inventario';
import { fmtFecha, exportarConsumosCSV } from '../../utils/inventarioHelpers';
import BuscadorMedicamento from './BuscadorMedicamento';
import BuscadorTrabajador from './BuscadorTrabajador';
import { COLORS, FONTS } from '../../theme';

interface ConsumoLinea { med: Medicamento; cantidad: number; }

interface Props {
  inventario: Medicamento[];
  consumos: Consumo[];
  trabajadores: string[];
  centroDefault: CentroId;
  usuarioNombre: string;
  isAdmin: boolean;
  onRefresh: () => void;
}

export default function TabConsumo({ inventario, consumos, trabajadores, centroDefault, usuarioNombre, isAdmin, onRefresh }: Props) {
  const [centro, setCentro] = useState<CentroId>(centroDefault);
  const [trabajador, setTrabajador] = useState('');
  const [lineas, setLineas] = useState<ConsumoLinea[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [ultimaTransaccion, setUltimaTransaccion] = useState('');
  const [error, setError] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroTrab, setFiltroTrab] = useState('');

  function agregarLinea(med: Medicamento) {
    setLineas((prev) => {
      const existing = prev.find((l) => l.med.codigo === med.codigo);
      if (existing) return prev.map((l) => l.med.codigo === med.codigo ? { ...l, cantidad: l.cantidad + 1 } : l);
      return [...prev, { med, cantidad: 1 }];
    });
  }

  function cambiarCantidad(codigo: string, val: number) {
    setLineas((prev) => prev.map((l) => l.med.codigo === codigo ? { ...l, cantidad: Math.max(1, val) } : l));
  }

  function quitarLinea(codigo: string) {
    setLineas((prev) => prev.filter((l) => l.med.codigo !== codigo));
  }

  async function confirmar() {
    if (!trabajador.trim()) { setError('Ingrese el nombre del trabajador'); return; }
    if (lineas.length === 0) { setError('Agregue al menos un medicamento'); return; }
    setError(''); setGuardando(true);
    try {
      const items = lineas.map((l) => ({ medicamentoCodigo: l.med.codigo, cantidad: l.cantidad }));
      const tid = await registrarConsumos(items, centro, trabajador.trim(), usuarioNombre);
      setUltimaTransaccion(tid);
      setLineas([]); setTrabajador('');
      onRefresh();
    } catch (e: any) { setError(e.message ?? 'Error al registrar'); }
    setGuardando(false);
  }

  async function handleEliminar(id: number) {
    if (!confirm('¿Eliminar este consumo?')) return;
    await eliminarConsumo(id);
    onRefresh();
  }

  const consumosFiltrados = consumos.filter((c) => {
    if (filtroFecha && !c.fecha.startsWith(filtroFecha)) return false;
    if (filtroTrab && !c.trabajador.toLowerCase().includes(filtroTrab.toLowerCase())) return false;
    return true;
  }).slice().reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Formulario */}
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, fontFamily: FONTS.serif, color: COLORS.ink }}>Registrar consumo</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: 'block', marginBottom: 4 }}>CENTRO</label>
            <select value={centro} onChange={(e) => setCentro(e.target.value as CentroId)}
              style={{ width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '7px 10px', fontSize: 13, color: COLORS.ink, background: COLORS.panel }}>
              {(Object.entries(CENTROS) as [CentroId, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: 'block', marginBottom: 4 }}>TRABAJADOR</label>
            <BuscadorTrabajador trabajadores={trabajadores} value={trabajador} onChange={setTrabajador} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: 'block', marginBottom: 4 }}>AGREGAR MEDICAMENTO</label>
          <BuscadorMedicamento inventario={inventario} onSelect={agregarLinea} />
        </div>

        {lineas.length > 0 && (
          <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lineas.map((l) => (
              <div key={l.med.codigo} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: COLORS.bg, borderRadius: 8 }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: COLORS.ink }}>{l.med.nombre}</div>
                <div style={{ fontSize: 11, color: COLORS.muted }}>Stock: {l.med.stocks[centro] ?? 0}</div>
                <input type="number" min={1} max={l.med.stocks[centro] ?? 999} value={l.cantidad}
                  onChange={(e) => cambiarCantidad(l.med.codigo, parseInt(e.target.value) || 1)}
                  style={{ width: 60, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: '4px 8px', fontSize: 13, textAlign: 'center' }} />
                <button onClick={() => quitarLinea(l.med.codigo)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.bad }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p style={{ color: COLORS.bad, fontSize: 12, marginBottom: 10 }}>{error}</p>}
        {ultimaTransaccion && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: COLORS.ok, fontSize: 12, marginBottom: 10 }}>
            <CheckCircle size={14} /> Registrado: <strong style={{ fontFamily: FONTS.mono }}>{ultimaTransaccion}</strong>
          </div>
        )}

        <button onClick={confirmar} disabled={guardando || lineas.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: COLORS.brand, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: guardando ? 'wait' : 'pointer', opacity: lineas.length === 0 ? 0.5 : 1 }}>
          <ShoppingCart size={15} /> {guardando ? 'Guardando…' : `Confirmar consumo (${lineas.length} ítem${lineas.length !== 1 ? 's' : ''})`}
        </button>
      </div>

      {/* Historial */}
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: FONTS.serif, color: COLORS.ink }}>Historial de consumos</h3>
          <button onClick={() => exportarConsumosCSV(consumos, inventario)}
            style={{ fontSize: 12, padding: '5px 12px', border: `1px solid ${COLORS.line}`, borderRadius: 7, background: COLORS.bg, cursor: 'pointer', color: COLORS.muted }}>
            Exportar CSV
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input type="month" value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)}
            style={{ border: `1px solid ${COLORS.line}`, borderRadius: 7, padding: '5px 10px', fontSize: 12, color: COLORS.ink }} />
          <input placeholder="Filtrar por trabajador" value={filtroTrab} onChange={(e) => setFiltroTrab(e.target.value)}
            style={{ flex: 1, border: `1px solid ${COLORS.line}`, borderRadius: 7, padding: '5px 10px', fontSize: 12, color: COLORS.ink }} />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${COLORS.line}` }}>
                {['Transacción', 'Medicamento', 'Centro', 'Cantidad', 'Trabajador', 'Fecha', isAdmin ? 'Acciones' : ''].filter(Boolean).map((h) => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: COLORS.muted, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {consumosFiltrados.slice(0, 100).map((c) => {
                const med = inventario.find((m) => m.codigo === c.medicamentoCodigo);
                return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                    <td style={{ padding: '7px 10px', fontFamily: FONTS.mono, color: COLORS.brand }}>{c.transaccionId}</td>
                    <td style={{ padding: '7px 10px', color: COLORS.ink }}>{med?.nombre ?? c.medicamentoCodigo}</td>
                    <td style={{ padding: '7px 10px', color: COLORS.muted }}>{CENTROS[c.centro] ?? c.centro}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 600, color: COLORS.ink }}>{c.cantidad}</td>
                    <td style={{ padding: '7px 10px', color: COLORS.ink }}>{c.trabajador}</td>
                    <td style={{ padding: '7px 10px', color: COLORS.muted }}>{fmtFecha(c.fecha)}</td>
                    {isAdmin && (
                      <td style={{ padding: '7px 10px' }}>
                        <button onClick={() => handleEliminar(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.bad }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {consumosFiltrados.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: COLORS.faint }}>Sin consumos para los filtros seleccionados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
