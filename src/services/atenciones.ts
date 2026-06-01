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

/** Rango [inicio, fin) del día indicado (por defecto hoy). */
function rangoDia(ref: Date = new Date()) {
  const inicio = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);
  return { inicio, fin };
}

// ── Lectura: atenciones de un día ────────────────────────────────────────────
export async function getAtencionesDelDia(ref: Date = new Date()): Promise<AtencionMedica[]> {
  const { inicio, fin } = rangoDia(ref);
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

// ── Escritura: nueva atención ────────────────────────────────────────────────
export async function crearAtencion(
  data: Omit<AtencionMedica, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Timestamp.now(),
  });
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
    reposos: atenciones.filter((a) => a.reposoDias > 0).length,
  };
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
  if (a.reposoDias > 0) partes.push(`Reposo ${a.reposoDias}d`);
  return partes.length ? partes.join(' · ') : '—';
}
