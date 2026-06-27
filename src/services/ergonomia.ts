// Capa de datos del módulo de Evaluaciones Ergonómicas.
// Colección Firestore: `evaluacionesErgonomicas`.
import {
  collection, getDocs, addDoc, deleteDoc, doc, query as fbQuery, orderBy, where, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { registrarAuditoria } from './auditoria';
import type { EvaluacionErgonomica } from '../types/ergonomia';

const COL = 'evaluacionesErgonomicas';

export async function getEvaluacionesErgo(): Promise<EvaluacionErgonomica[]> {
  try {
    const snap = await getDocs(fbQuery(collection(db, COL), orderBy('fecha', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EvaluacionErgonomica));
  } catch (err) {
    console.warn('[ergonomia] orderBy falló, fallback sin orden:', err);
    const snap = await getDocs(collection(db, COL));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EvaluacionErgonomica));
  }
}

export async function getEvaluacionesErgoDeTrabajador(trabajadorId: string): Promise<EvaluacionErgonomica[]> {
  try {
    const snap = await getDocs(fbQuery(collection(db, COL), where('trabajadorId', '==', trabajadorId)));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as EvaluacionErgonomica))
      .sort((a, b) => (b.fecha?.seconds ?? 0) - (a.fecha?.seconds ?? 0));
  } catch (err) {
    console.warn('[ergonomia] consulta por trabajador falló:', err);
    return [];
  }
}

export async function crearEvaluacionErgo(
  data: Omit<EvaluacionErgonomica, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, COL), { ...data, createdAt: Timestamp.now() });
  await registrarAuditoria(
    'crear', 'ergonomia', ref.id,
    `Evaluación ${data.metodo} (${data.resultado.puntajeFinal} · ${data.resultado.nivel}) de ${data.apellidos} ${data.nombres}`,
  );
  return ref.id;
}

export async function eliminarEvaluacionErgo(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  await registrarAuditoria('eliminar', 'ergonomia', id, 'Eliminó una evaluación ergonómica');
}
