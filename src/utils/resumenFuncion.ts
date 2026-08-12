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

/** Cuántas funciones caben en el recuadro de historia laboral (Sección H). */
export const FUNCIONES_HISTORIA_LABORAL = 5;

/**
 * Texto de una actividad para los recuadros del formato.
 *
 * Prefiere la redacción corta revisada del análisis y la devuelve TAL CUAL:
 * es una frase completa, así que recortarla solo servía para mostrarla a
 * medias. Cuando no hay redacción revisada (cargos fuera del análisis) sí se
 * recorta la función original, porque puede ser larguísima.
 */
export function textoActividad(
  completas: string[] | undefined,
  resumidas: string[] | undefined,
  indice: number,
): string {
  const revisada = (resumidas ?? [])[indice]?.trim();
  if (revisada) return revisada.replace(/\s+/g, ' ');
  const original = (completas ?? [])[indice];
  return original ? resumirFuncion(original) : '';
}

/**
 * Lista de textos de actividad. `limite` recorta el NÚMERO de actividades,
 * nunca su contenido: es lo que evita que el recuadro de historia laboral
 * crezca sin motivo.
 */
export const textosActividades = (
  completas: string[] | undefined,
  resumidas: string[] | undefined,
  limite?: number,
): string[] => {
  const todas = (completas ?? []).map((_, i) => textoActividad(completas, resumidas, i)).filter(Boolean);
  return limite != null ? todas.slice(0, limite) : todas;
};
