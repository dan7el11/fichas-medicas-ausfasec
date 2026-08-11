// Carga por lotes desde un recuadro de texto con formato CSV (separado por
// punto y coma), para no teclear registro por registro.
//
// Es tolerante a propósito: acepta líneas incompletas, espacios de sobra,
// separadores decimales distintos y un encabezado opcional. Lo que no entiende
// lo devuelve como advertencia en vez de descartarlo en silencio.

export interface FilaCsv {
  /** Nº de línea dentro del texto, para poder señalar el error. */
  linea: number;
  campos: string[];
}

/** Palabras que delatan una fila de encabezado copiada junto a los datos. */
const CABECERAS = ['empresa', 'centro de trabajo', 'nombre examen', 'nombre del examen'];

/**
 * Parte el texto en filas de campos. Ignora líneas vacías y una primera línea
 * que sea claramente el encabezado del formato.
 */
export function leerCsv(texto: string): FilaCsv[] {
  const filas: FilaCsv[] = [];
  (texto ?? '').split(/\r?\n/).forEach((linea, i) => {
    const limpia = linea.trim();
    if (!limpia) return;
    const campos = limpia.split(';').map(c => c.trim());
    const primera = (campos[0] ?? '').toLowerCase();
    if (filas.length === 0 && CABECERAS.some(c => primera.startsWith(c))) return;
    filas.push({ linea: i + 1, campos });
  });
  return filas;
}

/** Campo por posición, o cadena vacía si la línea venía corta. */
export const campo = (f: FilaCsv, i: number): string => (f.campos[i] ?? '').trim();

/** «sí», «s», «x», «1», «true» → true. Vacío o cualquier otra cosa → false. */
export function siNo(valor: string): boolean {
  const v = (valor ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  return ['si', 's', 'x', '1', 'true', 'verdadero'].includes(v);
}

/** Solo los dígitos de un texto («18 meses» → «18»). */
export function soloNumero(valor: string): string {
  const m = /-?\d+(?:[.,]\d+)?/.exec(valor ?? '');
  return m ? m[0].replace(',', '.') : '';
}

/**
 * Normaliza una fecha escrita a mano a `aaaa-mm-dd`.
 * Acepta `aaaa-mm-dd`, `dd/mm/aaaa` y `dd-mm-aaaa`. Devuelve '' si no la
 * entiende o si el día no existe en ese mes (31 de febrero, por ejemplo).
 */
export function normalizarFechaCsv(valor: string): string {
  const t = (valor ?? '').trim();
  if (!t) return '';
  let a = '', m = '', d = '';
  let x = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(t);
  if (x) { [, a, m, d] = x; }
  else {
    x = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(t);
    if (!x) return '';
    [, d, m, a] = x;
  }
  const iso = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const fecha = new Date(`${iso}T12:00:00`);
  if (isNaN(fecha.getTime())) return '';
  // Rebota el 31 de un mes de 30: Date lo desplazaría al mes siguiente.
  if (fecha.getUTCDate() !== Number(d) || fecha.getUTCMonth() + 1 !== Number(m)) return '';
  return iso;
}

export interface ResultadoCsv<T> {
  registros: T[];
  /** Líneas que no se pudieron aprovechar, con el motivo. */
  advertencias: string[];
}

/**
 * Aplica un conversor a cada fila. El conversor devuelve el registro, o una
 * cadena con el motivo por el que la línea se descarta.
 */
export function convertirCsv<T>(texto: string, convertir: (f: FilaCsv) => T | string): ResultadoCsv<T> {
  const registros: T[] = [];
  const advertencias: string[] = [];
  leerCsv(texto).forEach(f => {
    const r = convertir(f);
    if (typeof r === 'string') advertencias.push(`Línea ${f.linea}: ${r}`);
    else registros.push(r);
  });
  return { registros, advertencias };
}
