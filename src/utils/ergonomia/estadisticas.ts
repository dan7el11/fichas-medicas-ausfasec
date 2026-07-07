// Estadísticas agregadas de un conjunto de evaluaciones de UN método
// (para el informe global). Función pura, con pruebas.
import type { EvaluacionErgonomica, ToneErgo } from '../../types/ergonomia';
import { toDate } from '../../services/atenciones';

export interface EstadisticasErgo {
  n: number;
  trabajadoresUnicos: number;
  promedio: number;
  minimo: number;
  maximo: number;
  desde: Date | null;
  hasta: Date | null;
  /** Distribución por nivel de riesgo (ordenada por severidad descendente). */
  porNivel: { nivel: string; tone: ToneErgo; n: number; pct: number }[];
  /** Evaluaciones en zona de riesgo (tone danger). */
  enRiesgo: number;
  pctEnRiesgo: number;
  /** Promedio de cada puntaje intermedio (detalle). */
  promedioDetalle: { key: string; promedio: number }[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function estadisticasErgo(evals: EvaluacionErgonomica[]): EstadisticasErgo {
  const n = evals.length;
  if (n === 0) {
    return { n: 0, trabajadoresUnicos: 0, promedio: 0, minimo: 0, maximo: 0, desde: null, hasta: null, porNivel: [], enRiesgo: 0, pctEnRiesgo: 0, promedioDetalle: [] };
  }

  const puntajes = evals.map((e) => e.resultado.puntajeFinal);
  const fechas = evals.map((e) => toDate(e.fecha)).filter((d) => !isNaN(d.getTime()));

  // Distribución por nivel (el orden sigue la severidad del tone)
  const niveles = new Map<string, { tone: ToneErgo; n: number }>();
  evals.forEach((e) => {
    const cur = niveles.get(e.resultado.nivel) ?? { tone: e.resultado.tone, n: 0 };
    cur.n++;
    niveles.set(e.resultado.nivel, cur);
  });
  const orden: Record<ToneErgo, number> = { danger: 0, warning: 1, success: 2 };
  const porNivel = [...niveles.entries()]
    .map(([nivel, v]) => ({ nivel, tone: v.tone, n: v.n, pct: Math.round((v.n / n) * 100) }))
    .sort((a, b) => orden[a.tone] - orden[b.tone] || b.n - a.n);

  // Promedios de los puntajes intermedios comunes a las evaluaciones
  const sumas = new Map<string, { s: number; c: number }>();
  evals.forEach((e) => Object.entries(e.resultado.detalle ?? {}).forEach(([k, v]) => {
    const cur = sumas.get(k) ?? { s: 0, c: 0 };
    cur.s += v; cur.c++;
    sumas.set(k, cur);
  }));
  const promedioDetalle = [...sumas.entries()].map(([key, { s, c }]) => ({ key, promedio: r2(s / c) }));

  const enRiesgo = evals.filter((e) => e.resultado.tone === 'danger').length;

  return {
    n,
    trabajadoresUnicos: new Set(evals.map((e) => e.trabajadorId)).size,
    promedio: r2(puntajes.reduce((a, b) => a + b, 0) / n),
    minimo: Math.min(...puntajes),
    maximo: Math.max(...puntajes),
    desde: fechas.length ? new Date(Math.min(...fechas.map((d) => d.getTime()))) : null,
    hasta: fechas.length ? new Date(Math.max(...fechas.map((d) => d.getTime()))) : null,
    porNivel,
    enRiesgo,
    pctEnRiesgo: Math.round((enRiesgo / n) * 100),
    promedioDetalle,
  };
}
