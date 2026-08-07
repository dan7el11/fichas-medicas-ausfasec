// Ayudas de maquetación para las tablas del PDF del formato unificado.

/** Filas que deben ocupar las tablas de altura fija de la página 3. */
export const FILAS_MINIMAS_PAGINA3 = 7;

/**
 * Completa una tabla hasta un número fijo de filas, rellenando desde arriba
 * con los datos y dejando vacías las restantes.
 *
 * La hoja oficial reserva un bloque de alto constante para los antecedentes
 * laborales y para los exámenes: sin esto, una evaluación con dos registros
 * dejaba la página 3 medio vacía y otra con ocho la desbordaba. Si hay más
 * datos que el mínimo, la tabla crece con las filas necesarias.
 */
export function conFilasMinimas<T>(filas: T[], columnas: number, minimo = FILAS_MINIMAS_PAGINA3): (T | string[])[] {
  const vacia = () => Array.from({ length: columnas }, () => '');
  if (filas.length >= minimo) return [...filas];
  return [...filas, ...Array.from({ length: minimo - filas.length }, vacia)];
}
