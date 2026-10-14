// Operaciones sobre una evaluación ya guardada que no pasan por su formulario:
// cambiarle la fecha, eliminarla y restaurarla.
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs,
  arrayRemove, arrayUnion, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { registrarAuditoria, registrarEliminacionConCopia } from './auditoria';
import { aFecha, aDia, fechaDeAtencion, fechaPorCorregir } from '../utils/fechaEvaluacion';
import type { RegistroAuditoria } from '../types/auditoria';

/** Descripción corta de una evaluación para la bitácora y los avisos. */
export function describirEvaluacion(ev: any, nombreTrabajador = ''): string {
  const tipo = ev?.formato === 'ocupacional-unificado'
    ? `ocupacional (${ev.tipoEvaluacion || 'sin tipo'})`
    : ev?.tipo === 'RETIRO' ? 'de retiro SO-RE-40'
    : String(ev?.tipoEvaluacion || '').includes('preocupacional') ? 'preocupacional SO-RE-41'
    : String(ev?.tipoEvaluacion || '').includes('reintegro') ? 'de reintegro SO-RE-39'
    : 'SO-RE-38';
  const f = aFecha(ev?.fecha);
  return `evaluación ${tipo} del ${f ? aDia(f) : 'sin fecha'}${nombreTrabajador ? ` de ${nombreTrabajador}` : ''}`;
}

/**
 * Cambia la fecha de una evaluación al día `dia` (aaaa-mm-dd), conservando su
 * hora. En el formato ocupacional se cambia también la «Fecha de atención» del
 * formulario, para que las dos digan lo mismo. Devuelve la nueva fecha.
 */
export async function cambiarFechaEvaluacion(ev: any, dia: string, nombreTrabajador = ''): Promise<Date> {
  const nueva = fechaDeAtencion(dia, ev.fecha ?? ev.createdAt);
  const cambios: Record<string, any> = { fecha: nueva, updatedAt: new Date() };
  if (ev.formato === 'ocupacional-unificado') cambios.fechaAtencion = dia;
  await updateDoc(doc(db, 'evaluaciones', ev.id), cambios);
  const antes = aFecha(ev.fecha);
  await registrarAuditoria('editar', 'evaluacion', ev.id,
    `Cambió la fecha de la ${describirEvaluacion(ev, nombreTrabajador)}: ${antes ? aDia(antes) : 'sin fecha'} → ${dia}`);
  return nueva;
}

/**
 * Evaluaciones ocupacionales guardadas antes de que `fecha` siguiera a la
 * fecha de atención: se corrigen para que muestren el día que eligió el
 * médico. Devuelve las fechas nuevas por id. Si alguna no se puede guardar
 * (sin conexión, sin permiso), se corrige igual en pantalla y se reintenta la
 * próxima vez que se abra la ficha.
 */
export async function corregirFechasGuardadas(evaluaciones: any[], nombreTrabajador = ''): Promise<Map<string, Date>> {
  const corregidas = new Map<string, Date>();
  for (const ev of evaluaciones) {
    const nueva = fechaPorCorregir(ev);
    if (!nueva || !ev.id) continue;
    corregidas.set(ev.id, nueva);
    try {
      await updateDoc(doc(db, 'evaluaciones', ev.id), { fecha: nueva });
      const antes = aFecha(ev.fecha);
      await registrarAuditoria('editar', 'evaluacion', ev.id,
        `Fecha de la ${describirEvaluacion({ ...ev, fecha: nueva }, nombreTrabajador)} alineada con su fecha de atención (antes mostraba ${antes ? aDia(antes) : 'sin fecha'})`);
    } catch (err) {
      console.warn('[evaluaciones] no se pudo guardar la fecha corregida:', ev.id, err);
    }
  }
  return corregidas;
}

/**
 * Elimina una evaluación.
 *
 * Primero guarda en la bitácora una copia exacta del documento, leída en ese
 * momento de Firestore. La bitácora no se puede modificar ni borrar, y desde
 * ella un administrador puede restaurar la evaluación. Si la copia no se puede
 * guardar, no se borra nada.
 *
 * Después quita la evaluación de la lista del trabajador y desvincula los
 * exámenes que la tenían asociada (quedan en el trabajador, sin evaluación).
 */
export async function eliminarEvaluacion(evaluacionId: string, nombreTrabajador = ''): Promise<void> {
  const ref = doc(db, 'evaluaciones', evaluacionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('La evaluación ya no existe.');
  const datos = snap.data();

  await registrarEliminacionConCopia('evaluacion', evaluacionId,
    `Eliminó la ${describirEvaluacion(datos, nombreTrabajador)}`, datos);
  await deleteDoc(ref);

  if (datos.trabajadorId) {
    try {
      await updateDoc(doc(db, 'trabajadores', datos.trabajadorId), { evaluaciones: arrayRemove(evaluacionId), updatedAt: new Date() });
    } catch (err) { console.warn('[evaluaciones] no se pudo quitar de la lista del trabajador:', err); }
    try {
      const examenes = await getDocs(query(collection(db, 'examenes'),
        where('trabajadorId', '==', datos.trabajadorId), where('evaluacionId', '==', evaluacionId)));
      await Promise.all(examenes.docs.map(d => updateDoc(d.ref, { evaluacionId: '' })));
    } catch (err) { console.warn('[evaluaciones] no se pudieron desvincular los exámenes:', err); }
  }
}

/** ¿Se puede restaurar desde esta entrada de la bitácora? */
export const esEliminacionRestaurable = (r: RegistroAuditoria): boolean =>
  r.accion === 'eliminar' && r.entidad === 'evaluacion' && !!r.copia && !!r.entidadId;

/**
 * Vuelve a crear una evaluación eliminada, con el mismo id y exactamente los
 * mismos datos, a partir de la copia guardada en la bitácora.
 */
export async function restaurarEvaluacion(r: RegistroAuditoria): Promise<void> {
  if (!esEliminacionRestaurable(r)) throw new Error('Esta entrada no trae una copia de la evaluación.');
  const ref = doc(db, 'evaluaciones', r.entidadId);
  if ((await getDoc(ref)).exists()) throw new Error('La evaluación ya existe: ya fue restaurada.');
  const copia = r.copia!;
  await setDoc(ref, copia);
  if (copia.trabajadorId) {
    try {
      await updateDoc(doc(db, 'trabajadores', copia.trabajadorId), { evaluaciones: arrayUnion(r.entidadId), updatedAt: Timestamp.now() });
    } catch (err) { console.warn('[evaluaciones] no se pudo volver a añadir a la lista del trabajador:', err); }
  }
  await registrarAuditoria('crear', 'evaluacion', r.entidadId,
    `Restauró la ${describirEvaluacion(copia)} (eliminada por ${r.usuarioEmail || 'usuario desconocido'})`);
}
