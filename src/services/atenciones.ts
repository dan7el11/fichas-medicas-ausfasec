// Capa de datos del módulo Consulta Médica Diaria.
// Archivo NUEVO. Usa la misma instancia `db` que el resto del sistema.
// Colección Firestore: `atenciones`.

import {
  collection,
  getDocs,
  addDoc,
  query as fbQuery,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { registrarAuditoria } from './auditoria';
import type { AtencionMedica } from '../types/atencion';

const COL = 'atenciones';

// ── Conversión robusta de fechas Firestore → Date ────────────────────────────
// (Acepta Timestamp, {seconds,nanoseconds}, string ISO o Date.)
export function toDate(value: any): Date {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000 + (value.nanoseconds ?? 0) / 1e6);
  }
  return new Date(NaN);
}

// ── Períodos de vista (día / semana / mes) ──────────────────────────────────
export type PeriodoVista = 'dia' | 'semana' | 'mes';

/** Rango [inicio, fin) del período que contiene la fecha de referencia. */
export function rangoPeriodo(periodo: PeriodoVista, ref: Date = new Date()) {
  if (periodo === 'mes') {
    return {
      inicio: new Date(ref.getFullYear(), ref.getMonth(), 1),
      fin: new Date(ref.getFullYear(), ref.getMonth() + 1, 1),
    };
  }
  if (periodo === 'semana') {
    // Semana lunes–domingo
    const dia = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const desdeLunes = (dia.getDay() + 6) % 7;
    const inicio = new Date(dia);
    inicio.setDate(dia.getDate() - desdeLunes);
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 7);
    return { inicio, fin };
  }
  const inicio = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);
  return { inicio, fin };
}

/** Desplaza la fecha de referencia un período hacia adelante (+1) o atrás (−1). */
export function desplazarPeriodo(periodo: PeriodoVista, ref: Date, delta: number): Date {
  const out = new Date(ref);
  if (periodo === 'mes') out.setMonth(out.getMonth() + delta);
  else out.setDate(out.getDate() + delta * (periodo === 'semana' ? 7 : 1));
  return out;
}

// ── Lectura: atenciones en un rango [inicio, fin) ────────────────────────────
export async function getAtencionesEnRango(inicio: Date, fin: Date): Promise<AtencionMedica[]> {
  try {
    const snap = await getDocs(
      fbQuery(
        collection(db, COL),
        where('fecha', '>=', Timestamp.fromDate(inicio)),
        where('fecha', '<', Timestamp.fromDate(fin)),
        orderBy('fecha', 'asc'),
      ),
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AtencionMedica));
  } catch (err) {
    // Fallback sin índice compuesto: traer todo y filtrar en cliente.
    console.warn('[atenciones] consulta por rango falló, usando fallback:', err);
    const snap = await getDocs(collection(db, COL));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as AtencionMedica))
      .filter((a) => {
        const f = toDate(a.fecha);
        return f >= inicio && f < fin;
      })
      .sort((a, b) => toDate(a.fecha).getTime() - toDate(b.fecha).getTime());
  }
}

// ── Lectura: atenciones de un día (compatibilidad) ───────────────────────────
export async function getAtencionesDelDia(ref: Date = new Date()): Promise<AtencionMedica[]> {
  const { inicio, fin } = rangoPeriodo('dia', ref);
  return getAtencionesEnRango(inicio, fin);
}

// ── Escritura: nueva atención ────────────────────────────────────────────────
export async function crearAtencion(
  data: Omit<AtencionMedica, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Timestamp.now(),
  });
  await registrarAuditoria(
    'crear', 'atencion', ref.id,
    `Atención a ${data.pacienteApellidos} ${data.pacienteNombres}${data.cieCodigo ? ` · ${data.cieCodigo}` : ''}`,
  );
  return ref.id;
}

// ── Estadísticas del día (para los KPIs) ─────────────────────────────────────
export interface ConsultaStats {
  total: number;
  espera: number;
  primeras: number;
  subsec: number;
  ocupacionales: number;
  medicamentos: number;
  procedimientos: number;
  reposos: number;
}

export function calcularStats(atenciones: AtencionMedica[]): ConsultaStats {
  const atendidas = atenciones.filter((a) => a.estado === 'atendido');
  return {
    total: atendidas.length,
    espera: atenciones.filter((a) => a.estado === 'espera').length,
    primeras: atendidas.filter((a) => a.tipoAtencion === 'Primera').length,
    subsec: atendidas.filter((a) => a.tipoAtencion === 'Subsecuente').length,
    ocupacionales: atendidas.filter((a) => a.relacion === 'Ocupacional').length,
    medicamentos: atenciones.reduce(
      (s, a) => s + a.medicacion.reduce((q, m) => q + (m.cantidad || 0), 0),
      0,
    ),
    procedimientos: atenciones.reduce((s, a) => s + a.procedimientos.length, 0),
    // Ausentismo emitido: cuenta reposos por días Y permisos por horas.
    reposos: atenciones.filter((a) => tieneReposo(a)).length,
  };
}

/** ¿La atención emitió reposo/permiso (por días o por horas)? */
export function tieneReposo(a: AtencionMedica): boolean {
  return (a.reposoDias ?? 0) > 0 || (a.reposoHoras ?? 0) > 0;
}

/** Texto corto del reposo emitido: '2 d' o el horario ('08:00 – 12:00'). */
export function reposoTexto(a: AtencionMedica): string {
  if ((a.reposoDias ?? 0) > 0) return `${a.reposoDias} d`;
  if ((a.reposoHoras ?? 0) > 0) return a.reposoHorario || `${a.reposoHoras} h`;
  return '';
}

// ── Resumen CIE-10 del día (morbilidad por capítulo) ─────────────────────────
const CAPITULOS_CIE: Record<string, { label: string; color: string }> = {
  A: { label: 'Infecciosas', color: '#10a05a' }, B: { label: 'Infecciosas', color: '#10a05a' },
  E: { label: 'Endocrino / metabólico', color: '#e08a2c' },
  F: { label: 'Salud mental', color: '#e3496a' },
  G: { label: 'Neurológico', color: '#7c5cf2' },
  H: { label: 'Ojo / oído', color: '#0e9bbf' },
  I: { label: 'Circulatorio', color: '#dc2e3c' },
  J: { label: 'Respiratorio', color: '#1d4fad' },
  K: { label: 'Digestivo', color: '#b45309' },
  L: { label: 'Piel', color: '#d97706' },
  M: { label: 'Musculoesquelético', color: '#0f766e' },
  N: { label: 'Genitourinario', color: '#9333ea' },
  R: { label: 'Síntomas y signos', color: '#64748b' },
  S: { label: 'Traumatismos', color: '#a01f2a' }, T: { label: 'Traumatismos', color: '#a01f2a' },
  Z: { label: 'Otros / certificados', color: '#94a2b3' },
};
function capituloDe(codigo: string) {
  return CAPITULOS_CIE[(codigo || '?')[0]] || { label: 'Otros', color: '#94a2b3' };
}

export interface ResumenCie {
  total: number;
  capitulos: { label: string; color: string; n: number }[];
  codigos: { codigo: string; desc: string; color: string; n: number }[];
}

export function calcularResumenCie(atenciones: AtencionMedica[]): ResumenCie {
  const caps = new Map<string, { label: string; color: string; n: number }>();
  const cods = new Map<string, { codigo: string; desc: string; color: string; n: number }>();
  atenciones.forEach((a) => {
    if (!a.cieCodigo) return;
    const cap = capituloDe(a.cieCodigo);
    const c = caps.get(cap.label) ?? { label: cap.label, color: cap.color, n: 0 };
    c.n++; caps.set(cap.label, c);
    const cd = cods.get(a.cieCodigo) ?? { codigo: a.cieCodigo, desc: a.cieDescripcion, color: cap.color, n: 0 };
    cd.n++; cods.set(a.cieCodigo, cd);
  });
  return {
    total: atenciones.filter((a) => a.cieCodigo).length,
    capitulos: [...caps.values()].sort((a, b) => b.n - a.n),
    codigos: [...cods.values()].sort((a, b) => b.n - a.n),
  };
}

// ── Texto de tratamiento (medicación + procedimientos + reposo) ──────────────
export function tratamientoTexto(a: AtencionMedica): string {
  const meds = a.medicacion.map((m) => `${m.nombre}${m.cantidad > 1 ? ` ×${m.cantidad}` : ''}`);
  const partes = [...meds, ...a.procedimientos];
  if (tieneReposo(a)) partes.push(`Reposo ${reposoTexto(a)}`);
  return partes.length ? partes.join(' · ') : '—';
}
