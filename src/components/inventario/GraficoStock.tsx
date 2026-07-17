// Gráfico de % de stock restante por medicamento (Inventario).
// Línea sobre el perfil de medicamentos (ordenados del más crítico al más
// holgado) donde cada punto es el PORCENTAJE de stock restante del ámbito
// (centro o suma general) respecto de lo disponible histórico en ese ámbito
// (stock actual + unidades consumidas). Una línea transversal roja al 20 %
// marca el umbral de reposición: todo punto por debajo hay que reponerlo.
// Incluye el nombre genérico y el comercial de cada medicamento.
import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import type { Medicamento, Consumo, CentroId } from '../../types/inventario';
import { COLORS, FONTS } from '../../theme';

const UMBRAL_REPONER = 20;    // % — advertencia transversal de reposición
const NEUTRO = '#98a0ab';

interface Punto {
  codigo: string;
  etiqueta: string;    // nombre genérico (y comercial si existe)
  stock: number;
  consumido: number;   // unidades consumidas históricas del ámbito
  pct: number;         // % de stock restante (0–100)
}

interface Props {
  inventario: Medicamento[];
  consumos: Consumo[];
  /** 'general' = suma de todos los centros; un CentroId = solo ese centro. */
  centro: CentroId | 'general';
}

export default function GraficoStock({ inventario, consumos, centro }: Props) {
  const [expandido, setExpandido] = useState(false);

  const { puntos, omitidos } = useMemo(() => {
    // Unidades consumidas por medicamento en el ámbito (histórico completo:
    // junto al stock actual reconstruye lo que hubo disponible).
    const consumidoPorMed = new Map<string, number>();
    consumos.forEach((c) => {
      if (centro !== 'general' && c.centro !== centro) return;
      consumidoPorMed.set(c.medicamentoCodigo, (consumidoPorMed.get(c.medicamentoCodigo) ?? 0) + c.cantidad);
    });

    const lista: Punto[] = [];
    let fuera = 0;
    inventario.forEach((m) => {
      const stock = centro === 'general'
        ? Object.values(m.stocks).reduce((s, v) => s + (v ?? 0), 0)
        : (m.stocks[centro] ?? 0);
      const consumido = consumidoPorMed.get(m.codigo) ?? 0;
      const base = stock + consumido;
      if (base <= 0) { fuera++; return; } // nunca hubo stock ni consumo en este ámbito
      lista.push({
        codigo: m.codigo,
        etiqueta: m.sobrenombre && m.sobrenombre !== m.nombre ? `${m.nombre} (${m.sobrenombre})` : m.nombre,
        stock,
        consumido,
        pct: Math.round((stock / base) * 100),
      });
    });
    // Del más crítico (menor %) al más holgado: la zona de peligro queda a la izquierda.
    lista.sort((a, b) => a.pct - b.pct || a.stock - b.stock);
    return { puntos: lista, omitidos: fuera };
  }, [inventario, consumos, centro]);

  if (puntos.length === 0) return null;

  const bajoUmbral = puntos.filter((p) => p.pct <= UMBRAL_REPONER).length;

  // ── Geometría del SVG ──────────────────────────────────────────────────────
  const PASO = 56;                 // px por medicamento en el eje X
  const ML = 44, MR = 16, MT = 24, MB = 84;   // márgenes (arriba: % sobre los puntos; abajo: rótulos rotados)
  const H_PLOT = 150;
  const W = ML + MR + Math.max(1, puntos.length - 1) * PASO + 24;
  const H = MT + H_PLOT + MB;
  const x = (i: number) => ML + 12 + i * PASO;
  const y = (pct: number) => MT + H_PLOT - (pct / 100) * H_PLOT;
  const path = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.pct)}`).join(' ');

  const colorPunto = (pct: number) => pct <= UMBRAL_REPONER ? COLORS.bad : pct <= 40 ? COLORS.warn : COLORS.ok;
  const truncar = (s: string, n = 16) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  const alto = expandido || puntos.length <= 14;

  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: '16px 18px' }}>
      {/* Título + leyenda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 8, background: '#f8eddc', color: '#9a5b12' }}><BarChart3 size={15} /></span>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.ink }}>Stock restante por medicamento (%)</div>
        {bajoUmbral > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: COLORS.badBg, color: COLORS.bad }}>
            {bajoUmbral} por reponer (≤{UMBRAL_REPONER} %)
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 11, color: COLORS.muted, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: COLORS.ok, display: 'inline-block' }} /> &gt;40 %
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: COLORS.warn, display: 'inline-block' }} /> 21–40 %
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: COLORS.bad, display: 'inline-block' }} /> ≤{UMBRAL_REPONER} % — reponer
          </span>
        </div>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 11, color: COLORS.faint }}>
        % restante = stock actual sobre lo disponible del ámbito (stock + consumido{centro === 'general' ? ', todos los centros' : ''}).
        Ordenado del más crítico al más holgado{omitidos > 0 ? ` · ${omitidos} medicamento${omitidos !== 1 ? 's' : ''} sin stock ni consumo en este ámbito no se grafican` : ''}.
      </p>

      {/* Gráfico de líneas (scroll horizontal si hay muchos medicamentos) */}
      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={H} style={{ display: 'block', minWidth: '100%' }} role="img" aria-label="Porcentaje de stock restante por medicamento">
          {/* Rejilla y eje Y */}
          {[0, 20, 40, 60, 80, 100].map((g) => (
            <g key={g}>
              <line x1={ML} x2={W - MR} y1={y(g)} y2={y(g)} stroke={g === UMBRAL_REPONER ? 'transparent' : COLORS.line} strokeWidth={1} />
              <text x={ML - 6} y={y(g) + 3.5} textAnchor="end" fontSize={10} fill={COLORS.faint} fontFamily={FONTS.mono}>{g}%</text>
            </g>
          ))}

          {/* Advertencia transversal de reposición al 20 % */}
          <line x1={ML} x2={W - MR} y1={y(UMBRAL_REPONER)} y2={y(UMBRAL_REPONER)} stroke={COLORS.bad} strokeWidth={1.6} strokeDasharray="7 4" />
          <text x={W - MR} y={y(UMBRAL_REPONER) - 5} textAnchor="end" fontSize={10.5} fontWeight={700} fill={COLORS.bad}>
            Reponer (≤{UMBRAL_REPONER} %)
          </text>

          {/* Línea del perfil de stock */}
          <path d={path} fill="none" stroke={NEUTRO} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Puntos + rótulos */}
          {puntos.map((p, i) => (
            <g key={p.codigo}>
              {/* Punto con anillo blanco para separarse de la línea */}
              <circle cx={x(i)} cy={y(p.pct)} r={6.5} fill="#fff" />
              <circle cx={x(i)} cy={y(p.pct)} r={4.5} fill={colorPunto(p.pct)}>
                <title>{`${p.etiqueta}\nStock restante: ${p.pct} % (${p.stock} u.)\nConsumido en este ámbito: ${p.consumido} u.${p.pct <= UMBRAL_REPONER ? '\n⚠ Por debajo del umbral de reposición' : ''}`}</title>
              </circle>
              {/* % directo sobre el punto */}
              <text x={x(i)} y={y(p.pct) - 10} textAnchor="middle" fontSize={10} fontWeight={700} fill={COLORS.ink} fontFamily={FONTS.mono}>{p.pct}%</text>
              {/* Nombre (genérico + comercial) rotado bajo el eje */}
              <text transform={`translate(${x(i)}, ${MT + H_PLOT + 12}) rotate(45)`} fontSize={9.5} fill={p.pct <= UMBRAL_REPONER ? COLORS.bad : COLORS.muted} fontWeight={p.pct <= UMBRAL_REPONER ? 700 : 500}>
                {truncar(p.etiqueta, alto ? 24 : 16)}
                <title>{p.etiqueta}</title>
              </text>
            </g>
          ))}
        </svg>
      </div>

      {puntos.length > 14 && (
        <button onClick={() => setExpandido((v) => !v)}
          style={{ marginTop: 8, padding: '6px 12px', borderRadius: 8, border: `1px solid ${COLORS.line}`, background: COLORS.bg, color: COLORS.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {expandido ? 'Abreviar nombres' : 'Nombres completos'}
        </button>
      )}
    </div>
  );
}
