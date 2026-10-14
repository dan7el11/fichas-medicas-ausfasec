// La fecha de una evaluación.
//
// Cada evaluación guarda `fecha`, que es la que muestran la lista y el detalle
// de la ficha, la sección O del PDF y el nombre de los archivos. Hasta ahora
// era siempre el momento en que se CREÓ el registro: el formulario ocupacional
// tiene su propio campo «Fecha de atención» (`fechaAtencion`), pero cambiarlo
// no tocaba `fecha`, así que una evaluación cargada con otra fecha, o
// corregida después, seguía mostrando el día en que se tecleó.
//
// Ahora `fecha` es la fecha de la atención. El día sale de lo que elige el
// médico; la hora se conserva (la de la atención original, o la de ahora si es
// nueva), porque el PDF la imprime junto a la firma. El momento real de
// creación sigue en `createdAt`.

/** Convierte lo que guarda Firestore (Timestamp, Date, texto) en Date. */
export function aFecha(f: any): Date | null {
  if (!f) return null;
  if (f instanceof Date) return Number.isNaN(f.getTime()) ? null : f;
  if (typeof f.toDate === 'function') return f.toDate();
  if (typeof f.seconds === 'number') return new Date(f.seconds * 1000);
  if (typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f)) return diaLocal(f, new Date(2000, 0, 1, 0, 0));
  const d = new Date(f);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Día en formato aaaa-mm-dd, en hora local (la del médico, no UTC). */
export function aDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Un día aaaa-mm-dd con la hora de `hora`. */
function diaLocal(dia: string, hora: Date): Date {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d, hora.getHours(), hora.getMinutes(), hora.getSeconds());
}

/**
 * La fecha que hay que guardar en `fecha` para una atención del día `dia`.
 * Conserva la hora de `anterior` (si la evaluación ya existía) o la de `ahora`.
 */
export function fechaDeAtencion(dia: string, anterior?: any, ahora = new Date()): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia || '')) return aFecha(anterior) ?? ahora;
  return diaLocal(dia, aFecha(anterior) ?? ahora);
}

/**
 * Evaluaciones del formato ocupacional guardadas antes de este arreglo: la
 * fecha de atención elegida por el médico no coincide con `fecha`. Devuelve la
 * fecha corregida, o null si ya está bien (o no hay fecha de atención).
 */
export function fechaPorCorregir(ev: any): Date | null {
  const dia = ev?.fechaAtencion;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia || '')) return null;
  const actual = aFecha(ev.fecha);
  if (actual && aDia(actual) === dia) return null;
  return fechaDeAtencion(dia, actual ?? aFecha(ev.createdAt) ?? undefined);
}
