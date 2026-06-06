import { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import type { Medicamento, CentroId } from '../../types/inventario';
import { CENTROS } from '../../types/inventario';
import { guardarMedicamento, eliminarMedicamento } from '../../services/inventario';
import { checkExpiracion, fmtFecha } from '../../utils/inventarioHelpers';
import { COLORS, FONTS } from '../../theme';

const CENTROS_LIST = Object.keys(CENTROS) as CentroId[];

function medVacio(): Medicamento {
  return {
    codigo: '', tipo: 'NUEVA COMPRA', nombre: '', sobrenombre: '',
    lote: '', fechaExpiracion: '', precio: 0, stockInicial: 0,
    stocks: { planta_envasado: 0, vergel: 0, planta_ventanas: 0 },
  };
}

interface Props {
  inventario: Medicamento[];
  onRefresh: () => void;
}

export default function TabConfiguracion({ inventario, onRefresh }: Props) {
  const [editando, setEditando] = useState<Medicamento | null>(null);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState<Medicamento>(medVacio());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  function iniciarCrear() { setForm(medVacio()); setCreando(true); setEditando(null); }
  function iniciarEditar(m: Medicamento) { setForm({ ...m, stocks: { ...m.stocks } }); setEditando(m); setCreando(false); }
  function cancelar() { setCreando(false); setEditando(null); setError(''); }

  function setStock(centro: CentroId, val: number) {
    setForm((f) => ({ ...f, stocks: { ...f.stocks, [centro]: val } }));
  }

  async function guardar() {
    if (!form.codigo.trim() || !form.nombre.trim()) { setError('Código y nombre son obligatorios'); return; }
    setGuardando(true); setError('');
    try {
      await guardarMedicamento(form);
      cancelar(); onRefresh();
    } catch (e: any) { setError(e.message ?? 'Error'); }
    setGuardando(false);
  }

  async function handleEliminar(codigo: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}" del catálogo? Esta acción no se puede deshacer.`)) return;
    await eliminarMedicamento(codigo);
    onRefresh();
  }

  const isFormOpen = creando || editando !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Formulario */}
      {isFormOpen && (
        <div style={{ background: COLORS.panel, border: `2px solid ${COLORS.brand}`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: FONTS.serif, color: COLORS.ink }}>
              {creando ? 'Nuevo medicamento' : `Editar: ${editando?.nombre}`}
            </h3>
            <button onClick={cancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.faint }}><X size={18} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'CÓDIGO', key: 'codigo' as const, disabled: !creando },
              { label: 'NOMBRE', key: 'nombre' as const },
              { label: 'NOMBRE CORTO', key: 'sobrenombre' as const },
              { label: 'LOTE', key: 'lote' as const },
              { label: 'FECHA EXPIRACIÓN', key: 'fechaExpiracion' as const, type: 'date' },
              { label: 'PRECIO', key: 'precio' as const, type: 'number' },
            ].map(({ label, key, disabled, type }) => (
              <div key={key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: 'block', marginBottom: 4 }}>{label}</label>
                <input
                  type={type ?? 'text'}
                  value={String(form[key])}
                  disabled={disabled}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                  style={{ width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '7px 10px', fontSize: 13, background: disabled ? COLORS.bg : COLORS.panel }}
                />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: 'block', marginBottom: 8 }}>STOCK POR CENTRO</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {CENTROS_LIST.map((k) => (
                <div key={k}>
                  <label style={{ fontSize: 11, color: COLORS.muted, display: 'block', marginBottom: 4 }}>{CENTROS[k]}</label>
                  <input type="number" min={0} value={form.stocks[k] ?? 0}
                    onChange={(e) => setStock(k, parseInt(e.target.value) || 0)}
                    style={{ width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '7px 10px', fontSize: 13 }} />
                </div>
              ))}
            </div>
          </div>

          {error && <p style={{ color: COLORS.bad, fontSize: 12, marginBottom: 10 }}>{error}</p>}

          <button onClick={guardar} disabled={guardando}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: COLORS.brand, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Save size={15} /> {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}

      {/* Catálogo */}
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: FONTS.serif, color: COLORS.ink }}>Catálogo de medicamentos ({inventario.length})</h3>
          <button onClick={iniciarCrear}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: COLORS.brand, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Nuevo
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${COLORS.line}` }}>
                {['Código', 'Nombre', 'Lote', 'Expiración', 'P.Envasado', 'Vergel', 'P.Ventanas', ''].map((h) => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: COLORS.muted, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventario.map((m) => {
                const exp = checkExpiracion(m.fechaExpiracion);
                return (
                  <tr key={m.codigo} style={{ borderBottom: `1px solid ${COLORS.line}`, background: editando?.codigo === m.codigo ? COLORS.brandSoft : 'transparent' }}>
                    <td style={{ padding: '7px 10px', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.faint }}>{m.codigo}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 600, color: COLORS.ink }}>{m.nombre}</td>
                    <td style={{ padding: '7px 10px', color: COLORS.muted }}>{m.lote || '—'}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ color: exp === 'expirado' ? COLORS.bad : exp === 'proximo' ? COLORS.warn : COLORS.muted }}>
                        {fmtFecha(m.fechaExpiracion)}
                      </span>
                    </td>
                    {CENTROS_LIST.map((k) => (
                      <td key={k} style={{ padding: '7px 10px', textAlign: 'center', fontFamily: FONTS.mono, color: (m.stocks[k] ?? 0) === 0 ? COLORS.faint : COLORS.ink }}>{m.stocks[k] ?? 0}</td>
                    ))}
                    <td style={{ padding: '7px 10px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => iniciarEditar(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.muted }}><Edit2 size={13} /></button>
                        <button onClick={() => handleEliminar(m.codigo, m.nombre)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.bad }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
