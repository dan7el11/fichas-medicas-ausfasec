// Carga de trabajadores. Importante: NO se ordena en la consulta con
// `orderBy('primerApellido')`, porque Firestore excluye en silencio los
// documentos que no tengan ese campo, ocultando fichas de la lista y de la
// búsqueda. Se trae todo y se ordena en el cliente.
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { Trabajador } from '../types';

export async function getTrabajadores(): Promise<Trabajador[]> {
  const snap = await getDocs(collection(db, 'trabajadores'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Trabajador))
    .sort((a, b) => (a.primerApellido ?? '').localeCompare(b.primerApellido ?? '', 'es'));
}
