// Motor de puntuación RULA (Rapid Upper Limb Assessment).
// Tablas oficiales: McAtamney & Corlett (1993). Implementadas como funciones
// puras y cubiertas por pruebas. IMPORTANTE: validar contra una planilla RULA
// oficial antes de uso clínico definitivo.
import type { ResultadoErgo } from '../../types/ergonomia';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

// Tabla A — clave `${brazo}-${antebrazo}` → 8 valores [muñeca 1-4 × giro 1-2].
const TABLA_A: Record<string, number[]> = {
  '1-1': [1, 2, 2, 2, 2, 3, 3, 3], '1-2': [2, 2, 2, 2, 3, 3, 3, 3], '1-3': [2, 3, 3, 3, 3, 3, 4, 4],
  '2-1': [2, 3, 3, 3, 3, 4, 4, 4], '2-2': [3, 3, 3, 3, 3, 4, 4, 4], '2-3': [3, 4, 4, 4, 4, 4, 5, 5],
  '3-1': [3, 3, 4, 4, 4, 4, 5, 5], '3-2': [3, 4, 4, 4, 4, 4, 5, 5], '3-3': [4, 4, 4, 4, 4, 5, 5, 5],
  '4-1': [4, 4, 4, 4, 4, 5, 5, 5], '4-2': [4, 4, 4, 4, 4, 5, 5, 5], '4-3': [4, 4, 4, 5, 5, 5, 6, 6],
  '5-1': [5, 5, 5, 5, 5, 6, 6, 7], '5-2': [5, 6, 6, 6, 6, 7, 7, 7], '5-3': [6, 6, 6, 7, 7, 7, 7, 8],
  '6-1': [7, 7, 7, 7, 7, 8, 8, 9], '6-2': [8, 8, 8, 8, 8, 9, 9, 9], '6-3': [9, 9, 9, 9, 9, 9, 9, 9],
};

// Tabla B — fila cuello 1-6 → 12 valores [tronco 1-6 × piernas 1-2].
const TABLA_B: Record<number, number[]> = {
  1: [1, 3, 2, 3, 3, 4, 5, 5, 6, 6, 7, 7],
  2: [2, 3, 2, 3, 4, 5, 5, 5, 6, 7, 7, 7],
  3: [3, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7],
  4: [5, 5, 5, 6, 6, 7, 7, 7, 7, 7, 8, 8],
  5: [7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8],
  6: [8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9],
};

// Tabla C — [puntaje A 1-8][puntaje B 1-7].
const TABLA_C: number[][] = [
  [1, 2, 3, 3, 4, 5, 5],
  [2, 2, 3, 4, 4, 5, 5],
  [3, 3, 3, 4, 4, 5, 6],
  [3, 3, 3, 4, 5, 6, 6],
  [4, 4, 4, 5, 6, 7, 7],
  [4, 4, 5, 6, 6, 7, 7],
  [5, 5, 6, 6, 7, 7, 7],
  [5, 5, 6, 7, 7, 7, 7],
];

export interface EntradasRULA {
  brazo: number;        // 1-6 efectivo (base 1-4 ± ajustes)
  antebrazo: number;    // 1-3 efectivo
  muneca: number;       // 1-4 efectivo
  giroMuneca: number;   // 1-2
  usoMuscularA: number; // 0 ó 1
  cargaA: number;       // 0-3
  cuello: number;       // 1-6 efectivo
  tronco: number;       // 1-6 efectivo
  piernas: number;      // 1-2
  usoMuscularB: number; // 0 ó 1
  cargaB: number;       // 0-3
}

function interpretar(puntaje: number): { nivel: string; accion: string; tone: ResultadoErgo['tone'] } {
  if (puntaje <= 2) return { nivel: 'Aceptable', accion: 'Postura aceptable si no se mantiene o repite largos periodos.', tone: 'success' };
  if (puntaje <= 4) return { nivel: 'Bajo — investigar', accion: 'Pueden requerirse cambios; investigar más a fondo.', tone: 'warning' };
  if (puntaje <= 6) return { nivel: 'Medio — cambiar pronto', accion: 'Investigar y realizar cambios pronto.', tone: 'warning' };
  return { nivel: 'Alto — cambio inmediato', accion: 'Investigar e implementar cambios de inmediato.', tone: 'danger' };
}

export function calcularRULA(e: EntradasRULA): ResultadoErgo {
  const posturaA = TABLA_A[`${clamp(e.brazo, 1, 6)}-${clamp(e.antebrazo, 1, 3)}`][
    (clamp(e.muneca, 1, 4) - 1) * 2 + (clamp(e.giroMuneca, 1, 2) - 1)
  ];
  const puntajeA = posturaA + clamp(e.usoMuscularA, 0, 1) + clamp(e.cargaA, 0, 3);

  const posturaB = TABLA_B[clamp(e.cuello, 1, 6)][
    (clamp(e.tronco, 1, 6) - 1) * 2 + (clamp(e.piernas, 1, 2) - 1)
  ];
  const puntajeB = posturaB + clamp(e.usoMuscularB, 0, 1) + clamp(e.cargaB, 0, 3);

  const puntajeFinal = TABLA_C[clamp(puntajeA, 1, 8) - 1][clamp(puntajeB, 1, 7) - 1];
  const i = interpretar(puntajeFinal);

  return {
    metodo: 'RULA',
    puntajeFinal,
    nivel: i.nivel,
    accion: i.accion,
    tone: i.tone,
    detalle: { posturaA, puntajeA, posturaB, puntajeB },
  };
}
