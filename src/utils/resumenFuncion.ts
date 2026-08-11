// Versión corta de las funciones del cargo para los encabezados de la matriz
// de la página 2.
//
// Las funciones del consolidado son frases largas; puestas enteras en las siete
// columnas de la matriz estiran las filas hasta desbordar la única página que
// el formato reserva para ese recuadro. Aquí se recortan por un límite de
// palabra y se marcan con «…» para que se vea que están abreviadas y no se
// lean como si fueran el texto completo.

/** Nº de caracteres que caben cómodamente en una columna de la matriz. */
export const LARGO_ACTIVIDAD_MATRIZ = 58;

/**
 * Recorta una función a `max` caracteres.
 *
 * Prefiere cerrar en la primera pausa fuerte de la frase (coma, punto y coma,
 * paréntesis o dos puntos) si cae dentro del límite, porque ahí la idea ya está
 * completa. Si no hay ninguna, corta en el último espacio y añade «…».
 */
export function resumirFuncion(texto: string, max = LARGO_ACTIVIDAD_MATRIZ): string {
  const t = (texto ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;

  // Pausa fuerte dentro del límite: se corta ahí, sin puntos suspensivos si
  // lo que queda ya es una idea cerrada de al menos media longitud.
  const corte = t.slice(0, max + 1);
  const pausa = Math.max(corte.lastIndexOf(', '), corte.lastIndexOf('; '), corte.lastIndexOf(' ('), corte.lastIndexOf(': '));
  if (pausa >= max * 0.5) return `${t.slice(0, pausa).trim()}…`;

  const espacio = corte.lastIndexOf(' ');
  const base = espacio > max * 0.5 ? t.slice(0, espacio) : t.slice(0, max);
  return `${base.replace(/[,;:.\s]+$/, '')}…`;
}

/** Aplica el recorte a la lista de actividades de la jornada. */
export const resumirActividades = (actividades: string[], max = LARGO_ACTIVIDAD_MATRIZ): string[] =>
  (actividades ?? []).map(a => resumirFuncion(a, max));

/**
 * Texto corto de una actividad para los recuadros estrechos (matriz de la
 * página 2 e historia laboral).
 *
 * Prefiere la redacción corta revisada del análisis, que está escrita a mano y
 * se lee mejor que cualquier recorte automático. Como algunas de esas
 * redacciones siguen siendo largas, se les aplica el mismo tope por si acaso.
 */
export function textoCortoActividad(
  completas: string[] | undefined,
  resumidas: string[] | undefined,
  indice: number,
  max = LARGO_ACTIVIDAD_MATRIZ,
): string {
  const revisada = (resumidas ?? [])[indice];
  const original = (completas ?? [])[indice];
  return resumirFuncion(revisada?.trim() || original || '', max);
}

/** Aplica `textoCortoActividad` a toda la lista. */
export const actividadesCortas = (
  completas: string[] | undefined,
  resumidas: string[] | undefined,
  max = LARGO_ACTIVIDAD_MATRIZ,
): string[] =>
  (completas ?? []).map((_, i) => textoCortoActividad(completas, resumidas, i, max));
