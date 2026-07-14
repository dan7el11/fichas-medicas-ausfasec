// Capa de datos del módulo Permisos médicos.
// Archivo NUEVO. Colección Firestore: `permisos`.

import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, where, query as fbQuery, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { registrarAuditoria } from './auditoria';
import {
  TIPOS_PERMISO, type PermisoMedico, type EstadoPermiso,
} from '../types/permiso';
import { fmtHora12 } from '../utils/permisosHorario';

const COL = 'permisos';

// ── Fechas robustas ──────────────────────────────────────────────────────────
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
export async function getPermisos(): Promise<PermisoMedico[]> {
  try {
    const snap = await getDocs(fbQuery(collection(db, COL), orderBy('desde', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PermisoMedico));
  } catch (err) {
    console.warn('[permisos] orderBy falló, fallback sin orden:', err);
    const snap = await getDocs(collection(db, COL));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as PermisoMedico))
      .sort((a, b) => toDate(b.desde).getTime() - toDate(a.desde).getTime());
  }
}

/** Permisos cuya fecha de inicio es >= `desde` (para no traer todo el histórico). */
export async function getPermisosDesde(desde: Date): Promise<PermisoMedico[]> {
  try {
    const snap = await getDocs(
      fbQuery(collection(db, COL), where('desde', '>=', Timestamp.fromDate(desde)), orderBy('desde', 'desc')),
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PermisoMedico));
  } catch (err) {
    console.warn('[permisos] consulta por fecha falló, usando fallback:', err);
    const todos = await getPermisos();
    return todos.filter((p) => toDate(p.desde) >= desde);
  }
}

export async function crearPermiso(data: Omit<PermisoMedico, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), { ...data, createdAt: Timestamp.now() });
  await registrarAuditoria('crear', 'permiso', ref.id, `Permiso (${data.tipo}) para ${data.apellidos} ${data.nombres}`);
  return ref.id;
}

export async function marcarCertificado(id: string, nombreArchivo: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { certAdjunto: true, certNombreArchivo: nombreArchivo });
}

export async function actualizarPermiso(id: string, patch: Partial<PermisoMedico>): Promise<void> {
  await updateDoc(doc(db, COL, id), patch as any);
}

export async function eliminarPermiso(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  await registrarAuditoria('eliminar', 'permiso', id, 'Eliminó un permiso');
}

// ── Estado calculado ─────────────────────────────────────────────────────────
export function estadoPermiso(p: PermisoMedico): EstadoPermiso {
  const meta = TIPOS_PERMISO[p.tipo];
  const finDias = diasHasta(p.hasta);
  const activo = diasHasta(p.desde) <= 0 && finDias >= 0;
  if (meta.requiereCert && !p.certAdjunto) {
    return finDias < -8 ? 'vencido' : 'pendiente';
  }
  if (activo && p.tipo !== 'cita') return 'activo';
  return 'justificado';
}
export function duracionPermiso(p: PermisoMedico): string {
  const meta = TIPOS_PERMISO[p.tipo];
  // Un permiso es por horas si su tipo lo es (cita) o si un reposo se registró
  // por horas (unidad === 'horas'). En ese caso se muestra el horario.
  const porHoras = meta.unidad === 'horas' || p.unidad === 'horas';
  if (porHoras) {
    if (p.horaDesde && p.horaHasta) return `${fmtHora12(p.horaDesde)}–${fmtHora12(p.horaHasta)}`;
    return `${p.horas} h`;
  }
  return `${p.dias} día${p.dias !== 1 ? 's' : ''}`;
}

// ── Indicadores de ausentismo (Resolución C.D. 513 IESS · K = 200.000) ───────
export interface Ausentismo {
  diasPerdidos: number; nCasos: number;
  pctAusentismo: string; frecuencia: number; gravedad: number; duracionMedia: string;
}
export function calcularAusentismo(permisos: PermisoMedico[]): Ausentismo {
  const reposos = permisos.filter((p) => p.tipo !== 'cita');
  const enVentana = reposos.filter((p) => diasHasta(p.desde) >= -30);
  const diasPerdidos = enVentana.reduce((s, p) => s + (p.dias || 0), 0);
  const nCasos = enVentana.length;
  const K = 200000;
  const nTrabAprox = 40;        // se puede parametrizar con el total real de trabajadores
  const horasHombre = nTrabAprox * 21 * 8;
  const diasProgramados = nTrabAprox * 21;
  return {
    diasPerdidos, nCasos,
    pctAusentismo: ((diasPerdidos / diasProgramados) * 100).toFixed(1),
    frecuencia: Math.round((nCasos * K) / horasHombre),
    gravedad: Math.round((diasPerdidos * K) / horasHombre),
    duracionMedia: (nCasos ? diasPerdidos / nCasos : 0).toFixed(1),
  };
}

// ── Control de justificativos ────────────────────────────────────────────────
export interface ControlJustif { total: number; conCert: number; pendientes: number; vencidos: number; pct: number; }
export function controlJustificativos(permisos: PermisoMedico[]): ControlJustif {
  const requieren = permisos.filter((p) => TIPOS_PERMISO[p.tipo].requiereCert);
  const conCert = requieren.filter((p) => p.certAdjunto).length;
  const pendientes = requieren.filter((p) => estadoPermiso(p) === 'pendiente').length;
  const vencidos = requieren.filter((p) => estadoPermiso(p) === 'vencido').length;
  return { total: requieren.length, conCert, pendientes, vencidos, pct: requieren.length ? Math.round((conCert / requieren.length) * 100) : 100 };
}

// ── Plantilla del correo de reposo interno ───────────────────────────────────
export function asuntoCorreo(p: PermisoMedico): string {
  return `Notificación de reposo médico interno — ${p.apellidos} ${p.nombres} (CI ${p.cedula})`;
}
export function cuerpoCorreo(p: PermisoMedico, institucion = ''): string {
  const reincorp = new Date(toDate(p.hasta)); reincorp.setDate(reincorp.getDate() + 1);
  const emp = institucion.trim();
  return `Estimados señores:

Reciban un cordial saludo del Servicio Médico Ocupacional${emp ? ` de ${emp}` : ''}.

Por medio de la presente, y en cumplimiento de las disposiciones vigentes en materia de seguridad y salud en el trabajo, notifico que el trabajador detallado a continuación fue valorado en el dispensario médico de la empresa y se le ha prescrito reposo médico interno:

DATOS DEL TRABAJADOR
• Nombre completo:  ${p.apellidos} ${p.nombres}
• Cédula de identidad:  ${p.cedula}
• Cargo / Puesto:  ${p.puesto}
• Área:  ${p.area}

DETALLE DEL REPOSO
• Días de reposo otorgados:  ${p.dias}
• Fecha de inicio:  ${fmtFecha(p.desde)}
• Fecha de finalización:  ${fmtFecha(p.hasta)}
• Reincorporación prevista:  ${reincorp.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}

El Servicio Médico realizará el seguimiento correspondiente del caso y notificará oportunamente cualquier novedad o eventual necesidad de prórroga.

Solicito comedidamente adoptar las acciones administrativas pertinentes (registro de la novedad y justificación de la ausencia), guardando la debida confidencialidad de la información médica del trabajador.

Atentamente,


_____________________________________
Dr./Dra. [Nombre del médico tratante]
Médico Ocupacional${emp ? ` — ${emp}` : ''}`;
}
export function buildMailto(asunto: string, cuerpo: string): string {
  return `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

// ── Stats de cabecera ────────────────────────────────────────────────────────
export function permisosStats(permisos: PermisoMedico[]) {
  const cj = controlJustificativos(permisos);
  return {
    total: permisos.length,
    activos: permisos.filter((p) => estadoPermiso(p) === 'activo').length,
    pendientes: cj.pendientes,
    vencidos: cj.vencidos,
  };
}
