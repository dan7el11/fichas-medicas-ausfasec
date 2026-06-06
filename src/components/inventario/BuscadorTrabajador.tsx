import { useState, useRef, useEffect } from 'react';
import { User } from 'lucide-react';
import { normalizarTexto } from '../../utils/inventarioHelpers';
import { COLORS } from '../../theme';

interface Props {
  trabajadores: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function BuscadorTrabajador({ trabajadores, value, onChange, placeholder = 'Buscar trabajador…', disabled }: Props) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQ(value); }, [value]);

  const results = q.length > 1
    ? trabajadores.filter((t) => normalizarTexto(t).includes(normalizarTexto(q))).slice(0, 10)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '6px 10px', background: COLORS.panel }}>
        <User size={15} color={COLORS.faint} />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
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
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)', marginTop: 4, maxHeight: 240, overflowY: 'auto',
        }}>
          {results.map((t) => (
            <button
              key={t}
              onClick={() => { setQ(t); onChange(t); setOpen(false); }}
              style={{
                display: 'block', width: '100%', padding: '8px 12px', background: 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: COLORS.ink,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.bg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
