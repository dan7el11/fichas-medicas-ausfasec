// Perfiles de riesgo por cargo: línea base del análisis auditado + los ajustes
// que se guarden desde la pantalla de perfiles (colección `perfilesRiesgo`).
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { PERFILES_RIESGO_CARGO } from '../constants/perfilRiesgoCargo';
import { normalizarBusqueda, CARGOS } from '../constants/funcionesCargo';
import type { PerfilRiesgoCargo, PerfilRiesgoGuardado, CoberturaCargo } from '../types/perfilRiesgo';

const COL = 'perfilesRiesgo';

/** Id de documento estable a partir del nombre del cargo. */
export const idDeCargo = (cargo: string) => normalizarBusqueda(cargo) || 'sin-cargo';

const baseIndexada = new Map<string, PerfilRiesgoCargo>(
  PERFILES_RIESGO_CARGO.map(p => [idDeCargo(p.cargo), p]),
);

/** Perfil del análisis auditado, sin los ajustes guardados. */
export function perfilBaseDeCargo(cargo: string): PerfilRiesgoCargo | null {
  return baseIndexada.get(idDeCargo(cargo)) ?? null;
}

/**
 * Perfil vigente de un cargo: el guardado en Firestore si existe, si no el del
 * análisis auditado. Devuelve null si el cargo no tiene análisis.
 */
export async function getPerfilRiesgo(cargo: string): Promise<PerfilRiesgoCargo | null> {
  const id = idDeCargo(cargo);
  try {
    const snap = await getDoc(doc(db, COL, id));
    if (snap.exists()) return { id, ...snap.data() } as PerfilRiesgoGuardado;
  } catch (err) {
    console.warn('No se pudo leer el perfil de riesgo guardado:', err);
  }
  return baseIndexada.get(id) ?? null;
}

/** Todos los perfiles guardados, indexados por id de cargo. */
export async function getPerfilesGuardados(): Promise<Map<string, PerfilRiesgoGuardado>> {
  const mapa = new Map<string, PerfilRiesgoGuardado>();
  try {
    const snap = await getDocs(collection(db, COL));
    snap.docs.forEach(d => mapa.set(d.id, { id: d.id, ...d.data() } as PerfilRiesgoGuardado));
  } catch (err) {
    console.warn('No se pudieron leer los perfiles de riesgo:', err);
  }
  return mapa;
}

export async function guardarPerfilRiesgo(perfil: PerfilRiesgoCargo, usuarioId: string): Promise<void> {
  const id = idDeCargo(perfil.cargo);
  await setDoc(doc(db, COL, id), {
    ...perfil,
    actualizadoEn: new Date(),
    actualizadoPor: usuarioId,
  });
}

/** Descarta los ajustes y vuelve al perfil del análisis auditado. */
export async function restaurarPerfilRiesgo(cargo: string): Promise<void> {
  await deleteDoc(doc(db, COL, idDeCargo(cargo)));
}

/**
 * Cargos que el análisis auditado señala como pendientes: tienen profesiograma
 * de riesgos registrado pero ninguna función documentada, así que no se pudo
 * construir su matriz por actividad (hoja `Perfil_sin_funciones` del análisis).
 * Se listan aquí para que aparezcan en la cobertura aunque todavía no haya
 * ningún trabajador registrado con ese cargo.
 */
export const CARGOS_PENDIENTES_ANALISIS = [
  'Operador de Envasado y Despacho',
  'AUXILIAR DE TALLER DE MANTENIMIENTO DE CILINDROS',
  'MÉDICO/A OCUPACIONAL',
  'RECAUDADOR/A - FACTURADOR/A',
];

/**
 * Estado del análisis de riesgos cargo por cargo.
 *
 * Cruza tres fuentes: el catálogo institucional de cargos, el análisis
 * auditado y los cargos que realmente tienen trabajadores registrados. Así se
 * ve tanto lo que falta analizar como lo que se está usando fuera del catálogo.
 */
export function calcularCobertura(
  cargosDeTrabajadores: string[],
  guardados: Map<string, PerfilRiesgoGuardado>,
): CoberturaCargo[] {
  const conteo = new Map<string, { cargo: string; n: number }>();
  cargosDeTrabajadores.forEach(c => {
    const nombre = (c || '').trim();
    if (!nombre) return;
    const id = idDeCargo(nombre);
    const e = conteo.get(id) ?? { cargo: nombre, n: 0 };
    e.n++;
    conteo.set(id, e);
  });

  const pendientes = new Map(CARGOS_PENDIENTES_ANALISIS.map(c => [idDeCargo(c), c]));

  const ids = new Set<string>([
    ...CARGOS.map(c => idDeCargo(c.cargo)),
    ...baseIndexada.keys(),
    ...conteo.keys(),
    ...pendientes.keys(),
  ]);

  const filas: CoberturaCargo[] = [...ids].map(id => {
    const delCatalogo = CARGOS.find(c => idDeCargo(c.cargo) === id);
    const base = baseIndexada.get(id);
    const guardado = guardados.get(id);
    const vigente = guardado ?? base;
    const usado = conteo.get(id);
    return {
      cargo: delCatalogo?.cargo ?? base?.cargo ?? usado?.cargo ?? pendientes.get(id) ?? id,
      departamento: delCatalogo?.departamento ?? base?.departamento ?? '—',
      estado: guardado ? 'personalizado' : base ? 'con-analisis' : 'sin-analisis',
      trabajadores: usado?.n ?? 0,
      actividades: vigente?.actividades.length ?? 0,
      factores: vigente ? Object.keys(vigente.riesgoActividades).length : 0,
      fueraDeCatalogo: !delCatalogo,
    };
  });

  // Primero lo que falta, y dentro de cada grupo lo más usado.
  const orden: Record<string, number> = { 'sin-analisis': 0, personalizado: 1, 'con-analisis': 2 };
  return filas.sort((a, b) =>
    orden[a.estado] - orden[b.estado] ||
    b.trabajadores - a.trabajadores ||
    a.cargo.localeCompare(b.cargo, 'es'));
}
