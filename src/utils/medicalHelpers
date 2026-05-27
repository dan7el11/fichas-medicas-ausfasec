// Helpers de presentación y cálculo de estado de fichas médicas

import type { Trabajador, EvaluacionMedica } from '../types';
import {
  APTITUD_LABEL,
  AREA_COLORS,
  deriveAreaFromPuesto,
  type Area,
} from '../constants/medical';

// ── Nombre / iniciales ─────────────────────────────────────────────────────

export function apellidos(t: Trabajador): string {
  return `${t.primerApellido} ${t.segundoApellido}`.trim();
}

export function nombres(t: Trabajador): string {
  return `${t.primerNombre} ${t.segundoNombre ?? ''}`.trim();
}

export function nombreCorto(t: Trabajador): string {
  return `${t.primerApellido} ${t.primerNombre}`.trim();
}

export function nombreCompleto(t: Trabajador): string {
  return `${apellidos(t)} ${nombres(t)}`.trim();
}

export function iniciales(t: Trabajador): string {
  const a = t.primerApellido?.[0] ?? '';
  const n = t.primerNombre?.[0] ?? '';
  return (a + n).toUpperCase();
}

// ── Área ───────────────────────────────────────────────────────────────────

export function areaDeTrabajador(t: Trabajador): Area {
  // El Trabajador en Firestore puede no tener `area` (legacy) — la derivamos del puesto
  return ((t as Trabajador & { area?: Area }).area as Area) ??
    deriveAreaFromPuesto(t.puestoTrabajo);
}

export function areaColors(t: Trabajador) {
  return AREA_COLORS[areaDeTrabajador(t)];
}

// ── Fechas ─────────────────────────────────────────────────────────────────

export function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function daysUntil(d: Date | string, ref: Date = new Date()): number {
  const date = typeof d === 'string' ? new Date(d) : d;
  return Math.round((date.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

export function venceEn(fechaEval: Date | string, meses = 12): Date {
  const base = typeof fechaEval === 'string' ? new Date(fechaEval) : new Date(fechaEval);
  const out = new Date(base);
  out.setMonth(out.getMonth() + meses);
  return out;
}

// ── Estado de aptitud ──────────────────────────────────────────────────────

export type StatusTone = 'success' | 'warning' | 'danger' | 'muted';

export interface WorkerStatus {
  label: string;
  tone: StatusTone;
  /** Días hasta el vencimiento (negativo si ya venció). null si no hay evaluación. */
  dias: number | null;
}

export const TONE_STYLES: Record<
  StatusTone,
  { fg: string; bg: string; bar: string; dot: string }
> = {
  success: { fg: '#0a6b3b', bg: '#e6f6ee', bar: '#10a05a', dot: '#10a05a' },
  warning: { fg: '#8a4a0a', bg: '#fff4e3', bar: '#e08a2c', dot: '#e08a2c' },
  danger: { fg: '#a01f2a', bg: '#fce8eb', bar: '#dc2e3c', dot: '#dc2e3c' },
  muted: { fg: '#3a4a5e', bg: '#eef1f5', bar: '#94a2b3', dot: '#94a2b3' },
};

export function aptitudLabel(e: EvaluacionMedica): string {
  return APTITUD_LABEL[e.aptitudMedica] ?? 'Pendiente';
}

export function sortEvaluacionesDesc(evals: EvaluacionMedica[]): EvaluacionMedica[] {
  return [...evals].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );
}

export function lastEval(evals: EvaluacionMedica[]): EvaluacionMedica | null {
  return sortEvaluacionesDesc(evals)[0] ?? null;
}

export function workerStatus(evals: EvaluacionMedica[]): WorkerStatus {
  const le = lastEval(evals);
  if (!le) return { label: 'Sin evaluación', tone: 'muted', dias: null };
  const vence = venceEn(le.fecha);
  const dias = daysUntil(vence);
  if (le.aptitudMedica === 'noApto') return { label: 'No apto', tone: 'danger', dias };
  if (dias < 0) return { label: 'Vencida', tone: 'danger', dias };
  if (dias <= 30) return { label: 'Por vencer', tone: 'warning', dias };
  if (le.aptitudMedica === 'aptoObservacion' || le.aptitudMedica === 'aptoLimitaciones') {
    return { label: 'Con restricciones', tone: 'warning', dias };
  }
  return { label: 'Apto vigente', tone: 'success', dias };
}

// ── Stats ──────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total: number;
  aptos: number;
  porVencer: number;
  vencidasONoApto: number;
  sinEval: number;
}

export function dashboardStats(
  trabajadores: Trabajador[],
  evalsPorTrabajador: Map<string, EvaluacionMedica[]>,
): DashboardStats {
  const statuses = trabajadores.map((t) =>
    workerStatus(evalsPorTrabajador.get(t.id ?? '') ?? []),
  );
  return {
    total: trabajadores.length,
    aptos: statuses.filter((s) => s.tone === 'success').length,
    porVencer: statuses.filter((s) => s.label === 'Por vencer').length,
    vencidasONoApto: statuses.filter(
      (s) => s.label === 'Vencida' || s.label === 'No apto',
    ).length,
    sinEval: statuses.filter((s) => s.label === 'Sin evaluación').length,
  };
}
