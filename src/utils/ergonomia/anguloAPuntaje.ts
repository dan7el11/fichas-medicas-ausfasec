// Mapea un ángulo medido (en grados) al puntaje base del segmento, según el
// método. Es una SUGERENCIA: el evaluador confirma o ajusta. Devuelve null para
// segmentos que no se derivan de un ángulo (piernas, giro de muñeca, factores).
import type { MetodoErgo } from '../../types/ergonomia';

// Para brazo, cuello y tronco el ángulo es la flexión respecto a la neutral.
// Para antebrazo el ángulo es el del codo (ángulo incluido entre brazo y antebrazo).
export function anguloAPuntaje(metodo: MetodoErgo, segKey: string, angulo: number): number | null {
  const a = Math.abs(angulo);

  if (segKey === 'brazo') {
    // Igual en RULA y REBA: flexión/extensión del hombro
    if (a < 20) return 1;
    if (a <= 45) return 2;
    if (a <= 90) return 3;
    return 4;
  }

  if (segKey === 'antebrazo') {
    // Ángulo del codo
    return a >= 60 && a <= 100 ? 1 : 2;
  }

  if (segKey === 'tronco') {
    if (a < 5) return 1;
    if (a <= 20) return 2;
    if (a <= 60) return 3;
    return 4;
  }

  if (segKey === 'cuello') {
    if (metodo === 'REBA') return a <= 20 ? 1 : 2;
    // RULA
    if (a <= 10) return 1;
    if (a <= 20) return 2;
    return 3;
  }

  if (segKey === 'muneca') {
    if (metodo === 'REBA') return a <= 15 ? 1 : 2;
    // RULA
    if (a < 2) return 1;
    if (a <= 15) return 2;
    return 3;
  }

  return null; // segmento no derivable de un ángulo
}

/** Segmentos que aceptan sugerencia desde un ángulo (para el selector del medidor). */
export const SEGMENTOS_ANGULO = ['brazo', 'antebrazo', 'tronco', 'cuello', 'muneca'];
