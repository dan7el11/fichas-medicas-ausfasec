// Gráfico de stock vs. consumo por medicamento (Inventario).
// Barras horizontales en una sola escala (unidades): la barra principal es el
// STOCK actual coloreada por estado (agotado/crítico/bajo/ok, siempre con
// etiqueta de texto, nunca solo color) y debajo una barra gris neutra con el
// CONSUMO de los últimos 30 días. Ordenado por riesgo de agotarse, para ver de
// un vistazo qué medicamentos están cerca de acabarse. Sirve tanto para el
// inventario general (suma de centros) como para el stock de un centro.
import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import type { Medicamento, Consumo, CentroId } from '../../types/inventario';
import { COLORS, FONTS } from '../../theme';

const NEUTRO = '#98a0ab';       // consumo: gris neutro (identidad por leyenda/posición)
const DIAS_VENTANA = 30;
const TOP_INICIAL = 12;

interface Fila {
  codigo: string;
  nombre: string;
  stock: number;
  consumo30: number;
  /** Días estimados hasta agotarse al ritmo de consumo actual (null si no hay consumo). */
  cobertura: number | null;
  estado: 'agotado' | 'critico' | 'bajo' | 'ok';
}

const ESTADO_META: Record<Fila['estado'], { label: string; fg: string; bg: string }> = {
  agotado: { label: 'Agotado', fg: COLORS.bad, bg: COLORS.badBg },
  critico: { label: 'Crítico', fg: COLORS.bad, bg: COLORS.badBg },
  bajo:    { label: 'Bajo',    fg: COLORS.warn, bg: COLORS.warnBg },
  ok:      { label: 'OK',      fg: COLORS.ok, bg: COLORS.okBg },
};

interface Props {
  inventario: Medicamento[];
  consumos: Consumo[];
  /** 'general' = suma de todos los centros; un CentroId = solo ese centro. */
  centro: CentroId | 'general';
}

export default function GraficoStock({ inventario, consumos, centro }: Props) {
  const [verTodos, setVerTodos] = useState(false);

  const filas = useMemo<Fila[]>(() => {
    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS_VENTANA);
    const desdeISO = desde.toISOString().slice(0, 10);

    // Consumo (unidades) de los últimos 30 días por medicamento, del ámbito elegido.
    const consumoPorMed = new Map<string, number>();
    consumos.forEach((c) => {
      if (c.fecha < desdeISO) return;
      if (centro !== 'general' && c.centro !== centro) return;
      consumoPorMed.set(c.medicamentoCodigo, (consumoPorMed.get(c.medicamentoCodigo) ?? 0) + c.cantidad);
    });

    return inventario.map((m) => {
      const stock = centro === 'general'
        ? Object.values(m.stocks).reduce((s, v) => s + (v ?? 0), 0)
        : (m.stocks[centro] ?? 0);
      const consumo30 = consumoPorMed.get(m.codigo) ?? 0;
      const cobertura = consumo30 > 0 ? Math.round(stock / (consumo30 / DIAS_VENTANA)) : null;
      const estado: Fila['estado'] = stock === 0 ? 'agotado'
        : (cobertura !== null && cobertura <= 7) ? 'critico'
        : (stock <= 5 || (cobertura !== null && cobertura <= 15)) ? 'bajo'
        : 'ok';
      return { codigo: m.codigo, nombre: m.sobrenombre || m.nombre, stock, consumo30, cobertura, estado };
    })
      // Orden por riesgo: agotados primero, luego menor cobertura, luego menor stock.
      .sort((a, b) => {
        const rank = (f: Fila) => f.estado === 'agotado' ? 0 : f.estado === 'critico' ? 1 : f.estado === 'bajo' ? 2 : 3;
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        const ca = a.cobertura ?? Infinity, cb = b.cobertura ?? Infinity;
        if (ca !== cb) return ca - cb;
        return a.stock - b.stock;
      });
  }, [inventario, consumos, centro]);

  const visibles = verTodos ? filas : filas.slice(0, TOP_INICIAL);
  const maxValor = Math.max(1, ...visibles.map((f) => Math.max(f.stock, f.consumo30)));
  const ancho = (v: number) => v <= 0 ? 0 : Math.max(2, (v / maxValor) * 100);

  if (inventario.length === 0) return null;

  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: '16px 18px' }}>
      {/* Título + leyenda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 8, background: '#f8eddc', color: '#9a5b12' }}><BarChart3 size={15} /></span>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.ink }}>Stock vs. consumo (últimos {DIAS_VENTANA} días)</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 11, color: COLORS.muted, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 8, borderRadius: 3, background: COLORS.ok, display: 'inline-block' }} /> Stock actual
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 5, borderRadius: 3, background: NEUTRO, display: 'inline-block' }} /> Consumo {DIAS_VENTANA} d
          </span>
        </div>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: COLORS.faint }}>
        Ordenado por riesgo de agotarse{centro === 'general' ? ' · stock sumado de todos los centros' : ''}. El color de la barra de stock indica el estado.
      </p>

      {/* Filas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {visibles.map((f) => {
          const meta = ESTADO_META[f.estado];
          const detalle = `${f.nombre} — Stock: ${f.stock} u. · Consumo ${DIAS_VENTANA} d: ${f.consumo30} u.${f.cobertura !== null ? ` · Cobertura estimada: ${f.cobertura} día${f.cobertura !== 1 ? 's' : ''}` : ' · Sin consumo reciente'}`;
          return (
            <div key={f.codigo} title={detalle} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 200px) 1fr', gap: 10, alignItems: 'center' }}>
              {/* Nombre + estado (texto, no solo color) */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}</div>
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: meta.bg, color: meta.fg }}>
                  {meta.label}{f.cobertura !== null && f.estado !== 'agotado' ? ` · ≈${f.cobertura} d` : ''}
                </span>
              </div>
              {/* Barras (misma escala en unidades) */}
              <div style={{ borderLeft: `2px solid ${COLORS.line}`, paddingLeft: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <div style={{ width: `${ancho(f.stock)}%`, height: 12, borderRadius: '0 4px 4px 0', background: meta.fg, transition: 'width .2s' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.ink, whiteSpace: 'nowrap' }}>{f.stock} u.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: `${ancho(f.consumo30)}%`, height: 7, borderRadius: '0 3px 3px 0', background: NEUTRO, opacity: 0.75 }} />
                  <span style={{ fontSize: 10, fontFamily: FONTS.mono, color: COLORS.faint, whiteSpace: 'nowrap' }}>{f.consumo30} u.</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sin recortes silenciosos: se indica cuántos hay ocultos */}
      {filas.length > TOP_INICIAL && (
        <button onClick={() => setVerTodos((v) => !v)}
          style={{ marginTop: 12, padding: '7px 12px', borderRadius: 8, border: `1px solid ${COLORS.line}`, background: COLORS.bg, color: COLORS.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {verTodos ? `Mostrar solo los ${TOP_INICIAL} con más riesgo` : `Ver todos los medicamentos (${filas.length})`}
        </button>
      )}
    </div>
  );
}
