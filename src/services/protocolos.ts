// Capa de datos: protocolos por puesto (editables). Archivo NUEVO.
// Colección Firestore: `protocolosPuesto` (id del doc = nombre del puesto).
import { collection, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { ProtocoloPuesto } from '../types/examenPlan';
import { PROTOCOLOS_DEFAULT, PROTOCOLO_GENERICO } from '../types/examenPlan';
import type { TipoExamen } from '../types';

const COL = 'protocolosPuesto';

/**
 * Devuelve los protocolos efectivos: arranca de los DEFAULT (semilla) y aplica
 * encima los que el usuario haya guardado en Firestore. Así siempre hay algo útil
 * aunque la colección esté vacía, y las ediciones del usuario mandan.
 */
export async function getProtocolos(): Promise<Record<string, { nombre: string; tipo: TipoExamen }[]>> {
  const base: Record<string, { nombre: string; tipo: TipoExamen }[]> = { ...PROTOCOLOS_DEFAULT };
  try {
    const snap = await getDocs(collection(db, COL));
    snap.forEach((d) => {
      const data = d.data() as ProtocoloPuesto;
      base[data.puesto] = data.examenes;
    });
  } catch (err) {
    console.warn('[protocolosPuesto] no se pudo leer, uso defaults:', err);
  }
  return base;
}

/** Guarda (o sobrescribe) el protocolo de un puesto. */
export async function guardarProtocolo(puesto: string, examenes: { nombre: string; tipo: TipoExamen }[]): Promise<void> {
  const id = puesto.replace(/\//g, '-').trim();
  await setDoc(doc(db, COL, id), {
    puesto, examenes, updatedAt: Timestamp.now(),
  } as ProtocoloPuesto);
}

/** Batería para un puesto, con respaldo genérico. */
export function protocoloDePuesto(
  protocolos: Record<string, { nombre: string; tipo: TipoExamen }[]>,
  puesto: string,
): { nombre: string; tipo: TipoExamen }[] {
  return protocolos[puesto] ?? PROTOCOLO_GENERICO;
}
