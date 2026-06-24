// Capa de datos de la bitácora de auditoría (colección `auditoria`).
// `registrarAuditoria` NUNCA lanza error: si falla, no debe romper la operación
// principal (guardar un trabajador, una evaluación, etc.).
import { collection, addDoc, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import type { AccionAuditoria, RegistroAuditoria } from '../types/auditoria';

/** Registra una acción en la bitácora. Toma el usuario actual de la sesión. */
export async function registrarAuditoria(
  accion: AccionAuditoria,
  entidad: string,
  entidadId: string,
  descripcion: string,
): Promise<void> {
  try {
    const u = auth.currentUser;
    await addDoc(collection(db, 'auditoria'), {
      fecha: Timestamp.now(),
      usuarioId: u?.uid ?? '',
      usuarioEmail: u?.email ?? '',
      accion,
      entidad,
      entidadId,
      descripcion,
    });
  } catch (err) {
    console.warn('[auditoria] no se pudo registrar la acción:', err);
  }
}

/** Trae las últimas N entradas de la bitácora (más recientes primero). */
export async function listarAuditoria(max = 500): Promise<RegistroAuditoria[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'auditoria'), orderBy('fecha', 'desc'), limit(max)),
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RegistroAuditoria, 'id'>) }));
  } catch (err) {
    console.error('[auditoria] no se pudo leer la bitácora:', err);
    return [];
  }
}
