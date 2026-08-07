// Expediente de antecedentes por trabajador (colección `antecedentes`,
// id = trabajadorId). Es la fuente ÚNICA y secuencial de antecedentes: se crea
// en la primera evaluación y las siguientes lo recuperan, autocompletan y
// actualizan (añadiendo nuevas entradas sin duplicar, sin borrar las previas).
import { doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { registrarAuditoria } from './auditoria';
import { fusionarAntecedentes } from '../utils/fusionAntecedentes';
import type { ExpedienteAntecedentes } from '../types';

const COL = 'antecedentes';

export async function getExpedienteAntecedentes(trabajadorId: string): Promise<ExpedienteAntecedentes | null> {
  try {
    const snap = await getDoc(doc(db, COL, trabajadorId));
    return snap.exists() ? ({ trabajadorId, ...snap.data() } as ExpedienteAntecedentes) : null;
  } catch (err) {
    console.warn('[antecedentes] no se pudo leer el expediente:', err);
    return null;
  }
}

/**
 * Fusiona los antecedentes de una evaluación con el expediente existente y lo
 * guarda. Los antecedentes previos se conservan; los repetidos se actualizan a
 * la versión nueva; los nuevos se añaden. Devuelve el expediente resultante.
 */
export async function fusionarYGuardarAntecedentes(
  trabajadorId: string,
  nuevos: Partial<ExpedienteAntecedentes>,
  meta: { evaluacionId?: string; medicoId?: string },
): Promise<ExpedienteAntecedentes> {
  const previo = await getExpedienteAntecedentes(trabajadorId);
  const combinado = fusionarAntecedentes(previo, nuevos);
  const data: ExpedienteAntecedentes = {
    ...combinado,
    trabajadorId,
    primeraEvaluacionId: previo?.primeraEvaluacionId ?? meta.evaluacionId,
    primeraVez: previo?.primeraVez ?? Timestamp.now(),
    actualizadoEn: Timestamp.now(),
    actualizadoPor: meta.medicoId ?? '',
  };
  await setDoc(doc(db, COL, trabajadorId), data);
  return data;
}

/** Guarda el expediente editado a mano desde el panel de administración. */
export async function guardarExpedienteAntecedentes(exp: ExpedienteAntecedentes, medicoId = ''): Promise<void> {
  await setDoc(doc(db, COL, exp.trabajadorId), {
    ...exp,
    actualizadoEn: Timestamp.now(),
    actualizadoPor: medicoId,
  });
  await registrarAuditoria('editar', 'antecedentes', exp.trabajadorId, 'Editó el expediente de antecedentes del trabajador');
}

export async function eliminarExpedienteAntecedentes(trabajadorId: string): Promise<void> {
  await deleteDoc(doc(db, COL, trabajadorId));
  await registrarAuditoria('eliminar', 'antecedentes', trabajadorId, 'Eliminó el expediente de antecedentes del trabajador');
}
