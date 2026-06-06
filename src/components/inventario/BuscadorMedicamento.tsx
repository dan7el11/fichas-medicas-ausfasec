import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { Medicamento } from '../../types/inventario';
import { normalizarTexto, checkExpiracion } from '../../utils/inventarioHelpers';
import { COLORS } from '../../theme';

interface Props {
  inventario: Medicamento[];
  onSelect: (med: Medicamento) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function BuscadorMedicamento({ inventario, onSelect, placeholder = 'Buscar medicamento…', disabled }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = q.length > 0
    ? inventario.filter((m) => {
        const n = normalizarTexto(q);
        return normalizarTexto(m.nombre).includes(n) || normalizarTexto(m.sobrenombre).includes(n) || m.codigo.toLowerCase().includes(n);
      }).slice(0, 12)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function select(med: Medicamento) {
    setQ('');
    setOpen(false);
    onSelect(med);
  }

  const expColor = (m: Medicamento) => {
    const e = checkExpiracion(m.fechaExpiracion);
    if (e === 'expirado') return COLORS.bad;
    if (e === 'proximo') return COLORS.warn;
    return COLORS.faint;
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '6px 10px', background: COLORS.panel }}>
        <Search size={15} color={COLORS.faint} />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, color: COLORS.ink, background: 'transparent' }}
        />
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)', marginTop: 4, maxHeight: 280, overflowY: 'auto',
        }}>
          {results.map((m) => (
            <button
              key={m.codigo}
              onClick={() => select(m)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '8px 12px', background: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.bg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>{m.nombre}</div>
                {m.sobrenombre && <div style={{ fontSize: 11, color: COLORS.muted }}>{m.sobrenombre}</div>}
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: expColor(m) }}>
                <div style={{ fontWeight: 600 }}>{m.codigo}</div>
                <div>Exp: {m.fechaExpiracion || '—'}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
