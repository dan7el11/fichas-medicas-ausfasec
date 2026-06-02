// Capa de datos — Seguimiento de signos. Archivo NUEVO. Colección Firestore: `signos`.
import { collection, getDocs, addDoc, query as fbQuery, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { MedicionSigno, TipoSigno } from '../types/signo';

const COL = 'signos';

export function toDate(v: any): Date {
  if (!v) return new Date(NaN);
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  return new Date(NaN);
}
export function fmtFechaHora(v: any): string {
  const d = toDate(v); if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
}
export function fmtFechaSola(v: any): string {
  const d = toDate(v); if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}
export const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

// ── CRUD ─────────────────────────────────────────────────────────────────────
export async function getMediciones(trabajadorId: string): Promise<MedicionSigno[]> {
  try {
    const snap = await getDocs(fbQuery(collection(db, COL), where('trabajadorId', '==', trabajadorId), orderBy('fecha', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MedicionSigno));
  } catch (err) {
    console.warn('[signos] orderBy falló, fallback:', err);
    const snap = await getDocs(fbQuery(collection(db, COL), where('trabajadorId', '==', trabajadorId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MedicionSigno)).sort((a, b) => toDate(a.fecha).getTime() - toDate(b.fecha).getTime());
  }
}
export async function crearMedicion(data: Omit<MedicionSigno, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), { ...data, createdAt: Timestamp.now() });
  return ref.id;
}

export function porTipo(meds: MedicionSigno[], tipo: TipoSigno) {
  return meds.filter((m) => m.tipo === tipo).sort((a, b) => toDate(a.fecha).getTime() - toDate(b.fecha).getTime());
}

// ── Clasificaciones ──────────────────────────────────────────────────────────
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'muted';
export function clasePA(s: number, d: number): { label: string; tone: Tone } {
  if (s >= 140 || d >= 90) return { label: 'Hipertensión', tone: 'danger' };
  if (s >= 130 || d >= 85) return { label: 'Limítrofe', tone: 'warning' };
  if (s < 100) return { label: 'Hipotensión', tone: 'info' };
  return { label: 'Normal', tone: 'success' };
}
export function claseGlu(v: number, ctx?: string): { label: string; tone: Tone } {
  if (ctx === 'Ayunas') {
    if (v >= 126) return { label: 'Elevada (DM)', tone: 'danger' };
    if (v >= 100) return { label: 'Prediabetes', tone: 'warning' };
    if (v < 70) return { label: 'Hipoglucemia', tone: 'info' };
    return { label: 'Normal', tone: 'success' };
  }
  if (v >= 200) return { label: 'Elevada (DM)', tone: 'danger' };
  if (v >= 140) return { label: 'Alterada', tone: 'warning' };
  return { label: 'Normal', tone: 'success' };
}
export function claseIMC(imc: number): { label: string; tone: Tone } {
  if (imc >= 30) return { label: 'Obesidad', tone: 'danger' };
  if (imc >= 25) return { label: 'Sobrepeso', tone: 'warning' };
  if (imc < 18.5) return { label: 'Bajo peso', tone: 'info' };
  return { label: 'Normal', tone: 'success' };
}

export const TONE_STYLE: Record<Tone, { fg: string; bg: string; bar: string }> = {
  success: { fg: '#0a6b3b', bg: '#e6f6ee', bar: '#10a05a' },
  warning: { fg: '#8a4a0a', bg: '#fff4e3', bar: '#e08a2c' },
  danger: { fg: '#a01f2a', bg: '#fce8eb', bar: '#dc2e3c' },
  info: { fg: '#1d4fad', bg: '#eaf3ff', bar: '#3b82f6' },
  muted: { fg: '#3a4a5e', bg: '#eef1f5', bar: '#94a2b3' },
};

/** Peso máximo para IMC normal (≤24.9) según talla en metros. */
export function pesoNormalMax(talla: number): number { return +(24.9 * talla * talla).toFixed(1); }
