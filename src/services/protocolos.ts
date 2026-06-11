// Capa de datos: protocolos por puesto (editables). Archivo NUEVO.
// Colección Firestore: `protocolosPuesto` (id del doc = nombre del puesto).
// El catálogo de exámenes disponibles también es editable y se guarda en el
// documento reservado `__catalogo__` de la misma colección.
import { collection, getDocs, doc, setDoc, getDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { ProtocoloPuesto } from '../types/examenPlan';
import { PROTOCOLOS_DEFAULT, PROTOCOLO_GENERICO } from '../types/examenPlan';
import type { TipoExamen } from '../types';
import { NOMBRES_EXAMEN_COMUNES } from '../types';

const COL = 'protocolosPuesto';
const CATALOGO_DOC = '__catalogo__';

/** Inferir el tipo de examen a partir del nombre (catálogo de texto libre). */
export function inferirTipoExamen(nombre: string): TipoExamen {
  const n = nombre.toLowerCase();
  if (n.includes('rx') || n.includes('ecograf') || n.includes('tomograf') || n.includes('resonancia')) return 'Imagen';
  if (n.includes('audiomet')) return 'Audiometría';
  if (n.includes('espiromet')) return 'Espirometría';
  if (n.includes('electrocardio') || n.includes('ekg') || n.includes('ecg')) return 'Electrocardiograma';
  if (n.includes('optomet') || n.includes('visual')) return 'Optometría';
  if (n.includes('psicol')) return 'Psicología';
  if (n.includes('oftalm')) return 'Oftalmología';
  return 'Laboratorio';
}

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
      if (d.id === CATALOGO_DOC) return; // doc reservado del catálogo
      const data = d.data() as ProtocoloPuesto;
      if (data.puesto && Array.isArray(data.examenes)) base[data.puesto] = data.examenes;
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

// ── Catálogo editable de exámenes ────────────────────────────────────────────

/** Lista de exámenes disponibles: semilla + personalizados − ocultados. */
export async function getCatalogoExamenes(): Promise<string[]> {
  let agregados: string[] = [];
  let quitados: string[] = [];
  try {
    const snap = await getDoc(doc(db, COL, CATALOGO_DOC));
    if (snap.exists()) {
      const data = snap.data() as { agregados?: string[]; quitados?: string[] };
      agregados = data.agregados ?? [];
      quitados = data.quitados ?? [];
    }
  } catch (err) {
    console.warn('[protocolosPuesto] no se pudo leer el catálogo, uso semilla:', err);
  }
  const set = new Set<string>([...NOMBRES_EXAMEN_COMUNES, ...agregados]);
  quitados.forEach((q) => set.delete(q));
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Persiste el catálogo como diffs sobre la semilla (agregados / quitados). */
export async function guardarCatalogoExamenes(catalogo: string[]): Promise<void> {
  const semilla = new Set<string>(NOMBRES_EXAMEN_COMUNES);
  const actual = new Set(catalogo);
  const agregados = catalogo.filter((n) => !semilla.has(n));
  const quitados = [...semilla].filter((n) => !actual.has(n));
  await setDoc(doc(db, COL, CATALOGO_DOC), { agregados, quitados, updatedAt: Timestamp.now() });
}

// ── Operaciones masivas sobre todos los protocolos ───────────────────────────

const dedupe = (ex: { nombre: string; tipo: TipoExamen }[]) => {
  const m = new Map<string, { nombre: string; tipo: TipoExamen }>();
  ex.forEach((e) => { if (!m.has(e.nombre)) m.set(e.nombre, e); });
  return [...m.values()];
};

/** Agrega uno o varios exámenes al protocolo de TODOS los puestos indicados. */
export async function agregarExamenesATodos(
  puestos: string[],
  nombres: string[],
  protocolos: Record<string, { nombre: string; tipo: TipoExamen }[]>,
): Promise<void> {
  const nuevos = nombres.map((nombre) => ({ nombre, tipo: inferirTipoExamen(nombre) }));
  const batch = writeBatch(db);
  puestos.forEach((puesto) => {
    const id = puesto.replace(/\//g, '-').trim();
    if (!id) return;
    const examenes = dedupe([...(protocolos[puesto] ?? []), ...nuevos]);
    batch.set(doc(db, COL, id), { puesto, examenes, updatedAt: Timestamp.now() } as ProtocoloPuesto);
  });
  await batch.commit();
}

/**
 * Fusiona un examen en otro: en todos los protocolos donde aparece `de`,
 * se reemplaza por `a` (sin duplicar), y `de` se quita del catálogo.
 */
export async function fusionarExamen(
  de: string,
  a: string,
  protocolos: Record<string, { nombre: string; tipo: TipoExamen }[]>,
): Promise<void> {
  const batch = writeBatch(db);
  Object.entries(protocolos).forEach(([puesto, examenes]) => {
    if (!examenes.some((e) => e.nombre === de)) return;
    const id = puesto.replace(/\//g, '-').trim();
    if (!id) return;
    const nuevos = dedupe(examenes.map((e) => (e.nombre === de ? { nombre: a, tipo: inferirTipoExamen(a) } : e)));
    batch.set(doc(db, COL, id), { puesto, examenes: nuevos, updatedAt: Timestamp.now() } as ProtocoloPuesto);
  });
  await batch.commit();
  const catalogo = await getCatalogoExamenes();
  await guardarCatalogoExamenes(catalogo.filter((n) => n !== de).concat(catalogo.includes(a) ? [] : [a]));
}

/** Quita un examen del catálogo y de todos los protocolos donde aparece. */
export async function eliminarExamenDeTodos(
  nombre: string,
  protocolos: Record<string, { nombre: string; tipo: TipoExamen }[]>,
): Promise<void> {
  const batch = writeBatch(db);
  Object.entries(protocolos).forEach(([puesto, examenes]) => {
    if (!examenes.some((e) => e.nombre === nombre)) return;
    const id = puesto.replace(/\//g, '-').trim();
    if (!id) return;
    batch.set(doc(db, COL, id), {
      puesto, examenes: examenes.filter((e) => e.nombre !== nombre), updatedAt: Timestamp.now(),
    } as ProtocoloPuesto);
  });
  await batch.commit();
  const catalogo = await getCatalogoExamenes();
  await guardarCatalogoExamenes(catalogo.filter((n) => n !== nombre));
}
