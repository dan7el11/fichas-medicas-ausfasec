// Capa de datos del Resumen de Expediente (vista 360° de un trabajador).
// Archivo NUEVO. NO crea colecciones: solo LEE las que ya existen.
import { collection, getDocs, doc, getDoc, query as fbQuery, where } from 'firebase/firestore';
import { db } from './firebase';
import type { Trabajador, EvaluacionMedica, ExamenComplementarioDoc } from '../types';
import type { AtencionMedica } from '../types/atencion';
import type { PermisoMedico } from '../types/permiso';
import type { OrdenExamen } from '../types/examenPlan';

export function toDate(v: any): Date {
  if (!v) return new Date(NaN);
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  return new Date(NaN);
}
export function fmtFecha(v: any): string {
  const d = toDate(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}
const num = (s: any): number | null => {
  const n = parseFloat(String(s ?? '').replace(',', '.'));
  return isNaN(n) ? null : n;
};

// Lee una colección por trabajadorId con fallback (sin orderBy → ordena en cliente).
async function porTrabajador<T>(col: string, trabajadorId: string): Promise<T[]> {
  try {
    const snap = await getDocs(fbQuery(collection(db, col), where('trabajadorId', '==', trabajadorId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
  } catch (err) {
    console.warn(`[expediente] ${col} falló:`, err);
    return [];
  }
}

export interface SignoPunto {
  fecha: Date;
  peso: number | null;
  sistolica: number | null;
  diastolica: number | null;
  imc: number | null;
  glucosa: number | null;
}

export interface ExpedienteData {
  trabajador: Trabajador | null;
  evaluaciones: EvaluacionMedica[];
  atenciones: AtencionMedica[];
  examenes: ExamenComplementarioDoc[];
  ordenes: OrdenExamen[];
  permisos: PermisoMedico[];
  signos: SignoPunto[];
}

export async function cargarExpediente(trabajadorId: string): Promise<ExpedienteData> {
  const [tRes, evRes, atRes, exRes, ordRes, pmRes] = await Promise.allSettled([
    getDoc(doc(db, 'trabajadores', trabajadorId)),
    porTrabajador<EvaluacionMedica>('evaluaciones', trabajadorId),
    porTrabajador<AtencionMedica>('atenciones', trabajadorId),
    porTrabajador<ExamenComplementarioDoc>('examenes', trabajadorId),
    porTrabajador<OrdenExamen>('ordenesExamen', trabajadorId),
    porTrabajador<PermisoMedico>('permisos', trabajadorId),
  ]);

  const trabajador = tRes.status === 'fulfilled' && tRes.value.exists()
    ? ({ id: tRes.value.id, ...tRes.value.data() } as Trabajador) : null;
  const evaluaciones = (evRes.status === 'fulfilled' ? evRes.value : [])
    .sort((a, b) => toDate(b.fecha).getTime() - toDate(a.fecha).getTime());
  const atenciones = (atRes.status === 'fulfilled' ? atRes.value : [])
    .sort((a, b) => toDate(b.fecha).getTime() - toDate(a.fecha).getTime());
  const examenes = (exRes.status === 'fulfilled' ? exRes.value : [])
    .sort((a, b) => toDate(b.fecha).getTime() - toDate(a.fecha).getTime());
  const ordenes = (ordRes.status === 'fulfilled' ? ordRes.value : [])
    .sort((a, b) => toDate(b.fechaProgramada).getTime() - toDate(a.fechaProgramada).getTime());
  const permisos = (pmRes.status === 'fulfilled' ? pmRes.value : [])
    .sort((a, b) => toDate(b.desde).getTime() - toDate(a.desde).getTime());

  // Serie de signos a partir de las evaluaciones (orden cronológico asc)
  const signos: SignoPunto[] = [...evaluaciones]
    .sort((a, b) => toDate(a.fecha).getTime() - toDate(b.fecha).getTime())
    .map((e) => {
      const sv: any = e.signosVitales ?? {};
      return {
        fecha: toDate(e.fecha),
        peso: num(sv.peso),
        sistolica: num(sv.presionSistolica),
        diastolica: num(sv.presionDiastolica),
        imc: typeof sv.imc === 'number' ? sv.imc : num(sv.imc),
        glucosa: num(sv.glucosa),
      };
    });

  return { trabajador, evaluaciones, atenciones, examenes, ordenes, permisos, signos };
}

// ── Helpers de aptitud ───────────────────────────────────────────────────────
export const APTITUD_LABEL: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'muted' }> = {
  apto: { label: 'Apto', tone: 'success' },
  aptoObservacion: { label: 'Apto con observación', tone: 'warning' },
  aptoLimitaciones: { label: 'Apto con limitaciones', tone: 'warning' },
  noApto: { label: 'No apto', tone: 'danger' },
};

// Última lectura no nula de una métrica + su variación contra la anterior
export function ultimoConDelta(signos: SignoPunto[], campo: keyof SignoPunto) {
  const pts = signos.filter((s) => typeof s[campo] === 'number') as (SignoPunto & Record<string, number>)[];
  if (pts.length === 0) return { actual: null as number | null, delta: null as number | null, fecha: null as Date | null, serie: [] as number[] };
  const actual = pts[pts.length - 1][campo] as number;
  const previo = pts.length >= 2 ? (pts[pts.length - 2][campo] as number) : null;
  return {
    actual,
    delta: previo != null ? Math.round((actual - previo) * 10) / 10 : null,
    fecha: pts[pts.length - 1].fecha,
    serie: pts.map((p) => p[campo] as number),
  };
}
