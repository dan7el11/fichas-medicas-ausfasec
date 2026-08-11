// Validación de las fechas que se capturan en las evaluaciones.
//
// Los `<input type="date">` dejan escribir años de cuatro dígitos cualesquiera,
// así que sin esto entraban fechas imposibles (año 0202, nacimientos en el
// futuro, un último día laboral anterior al ingreso…). Aquí se decide qué es
// aceptable; el formulario solo muestra los mensajes.

/** Año mínimo razonable para cualquier fecha del expediente. */
export const ANIO_MINIMO = 1900;
/** Edad máxima admitida al calcular a partir de la fecha de nacimiento. */
export const EDAD_MAXIMA = 120;

export const hoyIso = (ref: Date = new Date()): string =>
  `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`;

/** ¿Es una fecha `aaaa-mm-dd` que existe en el calendario? */
export function esFechaReal(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return false;
  const [, a, mes, d] = m;
  const f = new Date(`${iso}T12:00:00`);
  if (isNaN(f.getTime())) return false;
  return f.getUTCFullYear() === Number(a)
    && f.getUTCMonth() + 1 === Number(mes)
    && f.getUTCDate() === Number(d);
}

export interface OpcionesFecha {
  /** Nombre del campo, para el mensaje. */
  etiqueta: string;
  /** true si la fecha puede ser posterior a hoy (p. ej. un reintegro previsto). */
  permitirFuturo?: boolean;
  /** Límite inferior adicional (`aaaa-mm-dd`). */
  min?: string;
  /** Descripción del límite inferior, para el mensaje. */
  minEtiqueta?: string;
}

/**
 * Devuelve el mensaje de error de una fecha, o null si es aceptable.
 * Una fecha vacía se considera válida: lo obligatorio se valida aparte.
 */
export function validarFecha(iso: string, opts: OpcionesFecha, ref: Date = new Date()): string | null {
  if (!iso) return null;
  const { etiqueta, permitirFuturo, min, minEtiqueta } = opts;
  if (!esFechaReal(iso)) return `${etiqueta}: la fecha no existe.`;
  const anio = Number(iso.slice(0, 4));
  if (anio < ANIO_MINIMO) return `${etiqueta}: el año no puede ser anterior a ${ANIO_MINIMO}.`;
  const hoy = hoyIso(ref);
  if (!permitirFuturo && iso > hoy) return `${etiqueta}: no puede ser una fecha futura.`;
  if (permitirFuturo && anio > ref.getFullYear() + 5) return `${etiqueta}: el año está demasiado lejos.`;
  if (min && iso < min) return `${etiqueta}: no puede ser anterior a ${minEtiqueta ?? min}.`;
  return null;
}

/** Mensaje de error de una fecha de nacimiento, o null. */
export function validarFechaNacimiento(iso: string, ref: Date = new Date()): string | null {
  const base = validarFecha(iso, { etiqueta: 'Fecha de nacimiento' }, ref);
  if (base) return base;
  if (!iso) return null;
  const anios = ref.getFullYear() - Number(iso.slice(0, 4));
  if (anios > EDAD_MAXIMA) return `Fecha de nacimiento: implicaría más de ${EDAD_MAXIMA} años.`;
  return null;
}

/**
 * Meses completos entre dos fechas `aaaa-mm-dd`, para el tiempo de trabajo.
 * Devuelve '' si falta alguna o si el orden no tiene sentido.
 */
export function mesesEntre(desde: string, hasta: string): string {
  if (!esFechaReal(desde) || !esFechaReal(hasta) || desde > hasta) return '';
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1);
  if (d2 < d1) meses--;
  return String(Math.max(0, meses));
}

export interface FechasEvaluacion {
  fechaAtencion: string;
  fechaIngresoTrabajo: string;
  fechaReingreso: string;
  fechaUltimoDia: string;
  fechaNacimiento?: string;
}

/**
 * Revisa el bloque de fechas de una evaluación, incluida su coherencia entre
 * sí: no se ingresa antes de nacer, ni se sale antes de entrar.
 */
export function validarFechasEvaluacion(f: FechasEvaluacion, ref: Date = new Date()): string[] {
  const errores: string[] = [];
  const agregar = (m: string | null) => { if (m) errores.push(m); };

  agregar(validarFechaNacimiento(f.fechaNacimiento ?? '', ref));
  agregar(validarFecha(f.fechaAtencion, { etiqueta: 'Fecha de atención' }, ref));
  agregar(validarFecha(f.fechaIngresoTrabajo, {
    etiqueta: 'Fecha de ingreso al trabajo',
    min: f.fechaNacimiento || undefined,
    minEtiqueta: 'la fecha de nacimiento',
  }, ref));
  agregar(validarFecha(f.fechaUltimoDia, {
    etiqueta: 'Último día laboral',
    min: f.fechaIngresoTrabajo || undefined,
    minEtiqueta: 'la fecha de ingreso',
  }, ref));
  // El reintegro puede estar previsto para los próximos días.
  agregar(validarFecha(f.fechaReingreso, {
    etiqueta: 'Fecha de reintegro',
    permitirFuturo: true,
    min: f.fechaIngresoTrabajo || undefined,
    minEtiqueta: 'la fecha de ingreso',
  }, ref));

  return errores;
}
