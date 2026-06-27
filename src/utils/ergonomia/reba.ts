// Motor de puntuación REBA (Rapid Entire Body Assessment).
// Tablas oficiales: Hignett & McAtamney (2000). Funciones puras, con pruebas.
// IMPORTANTE: validar contra una planilla REBA oficial antes de uso clínico.
import type { ResultadoErgo } from '../../types/ergonomia';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

// Tabla A — fila cuello 1-3 → 20 valores [tronco 1-5 × piernas 1-4].
const TABLA_A: Record<number, number[]> = {
  1: [1, 2, 3, 4, 2, 3, 4, 5, 2, 4, 5, 6, 3, 5, 6, 7, 4, 6, 7, 8],
  2: [1, 2, 3, 4, 3, 4, 5, 6, 4, 5, 6, 7, 5, 6, 7, 8, 6, 7, 8, 9],
  3: [3, 3, 5, 6, 4, 5, 6, 7, 5, 6, 7, 8, 6, 7, 8, 9, 7, 8, 9, 9],
};

// Tabla B — fila antebrazo 1-2 → 18 valores [brazo 1-6 × muñeca 1-3].
const TABLA_B: Record<number, number[]> = {
  1: [1, 2, 2, 1, 2, 3, 3, 4, 5, 4, 5, 5, 6, 7, 8, 7, 8, 8],
  2: [1, 2, 3, 2, 3, 4, 4, 5, 5, 5, 6, 7, 7, 8, 8, 8, 9, 9],
};

// Tabla C — [puntaje A 1-12][puntaje B 1-12].
const TABLA_C: number[][] = [
  [1, 1, 1, 2, 3, 3, 4, 5, 6, 7, 7, 7],
  [1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 7, 8],
  [2, 3, 3, 3, 4, 5, 6, 7, 7, 8, 8, 8],
  [3, 4, 4, 4, 5, 6, 7, 8, 8, 9, 9, 9],
  [4, 4, 4, 5, 6, 7, 8, 8, 9, 9, 9, 9],
  [6, 6, 6, 7, 8, 8, 9, 9, 10, 10, 10, 10],
  [7, 7, 7, 8, 9, 9, 9, 10, 10, 11, 11, 11],
  [8, 8, 8, 9, 10, 10, 10, 10, 10, 11, 11, 11],
  [9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12],
  [10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 12],
  [11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12],
  [12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12],
];

export interface EntradasREBA {
  cuello: number;     // 1-3 efectivo
  tronco: number;     // 1-5 efectivo
  piernas: number;    // 1-4 efectivo
  carga: number;      // 0-3 (fuerza/carga)
  brazo: number;      // 1-6 efectivo
  antebrazo: number;  // 1-2 efectivo
  muneca: number;     // 1-3 efectivo
  acople: number;     // 0-3 (coupling)
  actividad: number;  // 0-3 (puntos de actividad)
}

function interpretar(p: number): { nivel: string; accion: string; tone: ResultadoErgo['tone'] } {
  if (p <= 1) return { nivel: 'Insignificante', accion: 'No es necesario actuar.', tone: 'success' };
  if (p <= 3) return { nivel: 'Bajo', accion: 'Puede ser necesario un cambio.', tone: 'success' };
  if (p <= 7) return { nivel: 'Medio', accion: 'Es necesaria una intervención; investigar y cambiar pronto.', tone: 'warning' };
  if (p <= 10) return { nivel: 'Alto', accion: 'Intervención e implementación de cambios pronto.', tone: 'danger' };
  return { nivel: 'Muy alto', accion: 'Implementar cambios de inmediato.', tone: 'danger' };
}

export function calcularREBA(e: EntradasREBA): ResultadoErgo {
  const posturaA = TABLA_A[clamp(e.cuello, 1, 3)][
    (clamp(e.tronco, 1, 5) - 1) * 4 + (clamp(e.piernas, 1, 4) - 1)
  ];
  const puntajeA = posturaA + clamp(e.carga, 0, 3);

  const posturaB = TABLA_B[clamp(e.antebrazo, 1, 2)][
    (clamp(e.brazo, 1, 6) - 1) * 3 + (clamp(e.muneca, 1, 3) - 1)
  ];
  const puntajeB = posturaB + clamp(e.acople, 0, 3);

  const puntajeC = TABLA_C[clamp(puntajeA, 1, 12) - 1][clamp(puntajeB, 1, 12) - 1];
  const puntajeFinal = puntajeC + clamp(e.actividad, 0, 3);
  const i = interpretar(puntajeFinal);

  return {
    metodo: 'REBA',
    puntajeFinal,
    nivel: i.nivel,
    accion: i.accion,
    tone: i.tone,
    detalle: { posturaA, puntajeA, posturaB, puntajeB, puntajeC },
  };
}
