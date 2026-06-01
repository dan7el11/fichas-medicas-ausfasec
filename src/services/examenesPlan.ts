// Capa de datos: órdenes de exámenes + cobertura. Archivo NUEVO.
// Colección Firestore: `ordenesExamen`.
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query as fbQuery, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { OrdenExamen, EstadoOrden, EstadoOrdenInfo } from '../types/examenPlan';

const COL = 'ordenesExamen';

export function toDate(value: any): Date {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  return new Date(NaN);
}
export function diasHasta(value: any, ref: Date = new Date()): number {
  const d = toDate(value);
  if (isNaN(d.getTime())) return 0;
  return Math.round((d.getTime() - ref.getTime()) / 86400000);
}
export function fmtFecha(value: any): string {
  const d = toDate(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── CRUD ─────────────────────────────────────────────────────────────────────
export async function getOrdenes(): Promise<OrdenExamen[]> {
  try {
    const snap = await getDocs(fbQuery(collection(db, COL), orderBy('fechaProgramada', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrdenExamen));
  } catch (err) {
    console.warn('[ordenesExamen] orderBy falló, fallback:', err);
    const snap = await getDocs(collection(db, COL));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrdenExamen))
      .sort((a, b) => toDate(a.fechaProgramada).getTime() - toDate(b.fechaProgramada).getTime());
  }
}

export async function crearOrden(data: Omit<OrdenExamen, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), { ...data, createdAt: Timestamp.now() });
  return ref.id;
}

export async function actualizarOrden(id: string, patch: Partial<OrdenExamen>): Promise<void> {
  await updateDoc(doc(db, COL, id), patch as any);
}

export async function eliminarOrden(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

// ── Estado de una orden ──────────────────────────────────────────────────────
export function progresoOrden(o: OrdenExamen) {
  const total = o.examenes.length;
  const hechos = o.examenes.filter((e) => e.realizado).length;
  return { hechos, total, pct: total ? Math.round((hechos / total) * 100) : 0 };
}

export function estadoOrden(o: OrdenExamen): EstadoOrdenInfo {
  const { hechos, total } = progresoOrden(o);
  if (total > 0 && hechos === total) return { key: 'completado', label: 'Completado', tone: 'success', dias: null };
  const dias = diasHasta(o.fechaProgramada);
  if (dias < 0) return { key: 'atrasado', label: 'Atrasado', tone: 'danger', dias };
  if (hechos > 0) return { key: 'proceso', label: 'En proceso', tone: 'warning', dias };
  return { key: 'programado', label: 'Programado', tone: 'info', dias };
}

// ── Cobertura / KPIs ─────────────────────────────────────────────────────────
export interface ExamStats {
  programados: number;
  atrasados: number;
  enProceso: number;
  completados: number;
  realizadosMes: number;
  cobertura: number;        // % de órdenes completadas
}

export function calcularStats(ordenes: OrdenExamen[]): ExamStats {
  let programados = 0, atrasados = 0, enProceso = 0, completados = 0, realizadosMes = 0;
  const mesPrefix = new Date().toISOString().slice(0, 7);
  ordenes.forEach((o) => {
    const st = estadoOrden(o).key;
    if (st === 'programado') programados++;
    else if (st === 'atrasado') atrasados++;
    else if (st === 'proceso') enProceso++;
    else if (st === 'completado') completados++;
    o.examenes.forEach((e) => {
      if (e.realizado && e.fechaRealizado) {
        const f = toDate(e.fechaRealizado).toISOString().slice(0, 7);
        if (f === mesPrefix) realizadosMes++;
      }
    });
  });
  const cobertura = ordenes.length ? Math.round((completados / ordenes.length) * 100) : 0;
  return { programados, atrasados, enProceso, completados, realizadosMes, cobertura };
}

export function ordenesActivas(ordenes: OrdenExamen[]): OrdenExamen[] {
  return ordenes.filter((o) => estadoOrden(o).key !== 'completado');
}

/** Agrupa por estado para la vista de agenda */
export function agruparPorEstado(ordenes: OrdenExamen[]): Record<EstadoOrden, OrdenExamen[]> {
  const g: Record<EstadoOrden, OrdenExamen[]> = { atrasado: [], proceso: [], programado: [], completado: [] };
  ordenes.forEach((o) => g[estadoOrden(o).key].push(o));
  return g;
}
