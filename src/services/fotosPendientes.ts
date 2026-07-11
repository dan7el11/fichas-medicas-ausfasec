// Cola local de fotos ergonómicas pendientes de subir a Storage.
//
// Motivación: el teléfono a veces no tiene red durante la evaluación. Las fotos
// anotadas se guardan primero en el navegador (IndexedDB) y se suben a Firebase
// Storage en una fase posterior, cuando haya conexión. Storage —a diferencia de
// Firestore— NO tiene cola sin conexión propia, por eso mantenemos la nuestra.
//
// Flujo:
//   1. Al guardar una evaluación, cada foto anotada se encola aquí (con la ruta
//      de Storage reservada y el id de la evaluación a la que pertenece).
//   2. El documento de Firestore guarda la foto con `pendiente: true` y `url: ''`.
//   3. `sincronizarFotosPendientes()` sube las fotos y actualiza el documento
//      (rellena la `url` y quita `pendiente`), y luego las borra de la cola.

import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { storage, db } from './firebase';
import type { FotoErgo, MedicionFoto } from '../types/ergonomia';

const COL = 'evaluacionesErgonomicas';
const DB_NAME = 'ergonomia-fotos';
const STORE = 'pendientes';
const DB_VERSION = 1;

export interface FotoPendiente {
  id?: number;              // clave autoincremental (IndexedDB)
  evaluacionId: string;     // documento de Firestore al que pertenece
  trabajadorId: string;
  path: string;             // ruta reservada en Storage
  nombre: string;
  dataUrl: string;          // imagen anotada (data:image/jpeg;base64,…)
  mediciones?: MedicionFoto[];
  creadaEn: number;         // epoch ms
}

// ── IndexedDB (envoltorio mínimo, sin dependencias) ──────────────────────────
function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function conStore<T>(modo: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return abrirDb().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const tx = database.transaction(STORE, modo);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => database.close();
      }),
  );
}

export async function guardarFotoPendiente(foto: Omit<FotoPendiente, 'id' | 'creadaEn'>): Promise<void> {
  try {
    await conStore('readwrite', (s) => s.add({ ...foto, creadaEn: Date.now() }));
  } catch (err) {
    console.error('[fotosPendientes] no se pudo encolar la foto:', err);
    throw err;
  }
}

export async function listarFotosPendientes(): Promise<FotoPendiente[]> {
  try {
    return (await conStore<FotoPendiente[]>('readonly', (s) => s.getAll())) ?? [];
  } catch (err) {
    console.warn('[fotosPendientes] no se pudo leer la cola:', err);
    return [];
  }
}

export async function contarFotosPendientes(): Promise<number> {
  try {
    return (await conStore<number>('readonly', (s) => s.count())) ?? 0;
  } catch {
    return 0;
  }
}

async function eliminarFotoPendiente(id: number): Promise<void> {
  await conStore('readwrite', (s) => s.delete(id));
}

// ── Sincronización ───────────────────────────────────────────────────────────
export interface ResultadoSync {
  subidas: number;
  pendientes: number;
  error?: string;
}

/**
 * Sube a Storage todas las fotos en cola y actualiza cada documento de
 * evaluación (rellena la `url` y quita `pendiente`). Las fotos subidas se
 * eliminan de la cola local. Es segura de llamar varias veces y sin conexión
 * (las que fallen quedan en la cola para el próximo intento).
 */
export async function sincronizarFotosPendientes(): Promise<ResultadoSync> {
  const cola = await listarFotosPendientes();
  if (cola.length === 0) return { subidas: 0, pendientes: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { subidas: 0, pendientes: cola.length, error: 'sin-conexion' };
  }

  let subidas = 0;
  for (const foto of cola) {
    try {
      // 1. Subir la imagen anotada a Storage.
      const r = storageRef(storage, foto.path);
      await uploadString(r, foto.dataUrl, 'data_url');
      const url = await getDownloadURL(r);

      // 2. Actualizar el documento de la evaluación: rellenar la url de esta foto.
      const dref = doc(db, COL, foto.evaluacionId);
      const snap = await getDoc(dref);
      if (snap.exists()) {
        const fotos: FotoErgo[] = (snap.data().fotos ?? []).map((f: FotoErgo) =>
          f.path === foto.path ? { ...f, url, pendiente: false } : f,
        );
        await updateDoc(dref, { fotos });
      }

      // 3. Quitar de la cola local.
      if (foto.id != null) await eliminarFotoPendiente(foto.id);
      subidas++;
    } catch (err) {
      console.warn('[fotosPendientes] no se pudo subir una foto (queda en cola):', err);
      // Se corta el bucle: si una falla (típicamente por red), las siguientes
      // probablemente también fallarán. Quedan en cola para el próximo intento.
      break;
    }
  }

  const pendientes = await contarFotosPendientes();
  return { subidas, pendientes };
}
