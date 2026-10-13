// Cómo sacar un archivo generado en el navegador (el PDF de una evaluación, la
// ficha en Excel) hacia donde el usuario pueda usarlo.
//
// Es más enrevesado de lo que parece porque esta app se instala en la pantalla
// de inicio (`display: standalone` en el manifiesto). Dentro de la app
// instalada no hay pestañas, ni barra de direcciones, ni gestor de descargas:
//
//  - `<a download>` no descarga nada. No falla: no hace nada.
//  - `window.open()` abre una vista que se queda en blanco y nunca carga.
//  - Un `<iframe>` con un PDF no lo pinta.
//
// En un navegador normal las tres funcionan, así que el fallo sólo sale en la
// app instalada y no aparece probando en el escritorio.
//
// La salida que sí existe ahí es compartir el archivo: abre la hoja del
// sistema con «Guardar en Archivos», «Abrir en Excel», enviar por correo, etc.

export type Entrega = 'compartido' | 'descargado' | 'cancelado' | 'sin-salida';

/** ¿Estamos dentro de la app instalada y no en una pestaña del navegador? */
export function esAppInstalada(): boolean {
  try {
    if ((navigator as any).standalone === true) return true;   // iOS / iPadOS
    return window.matchMedia?.('(display-mode: standalone)').matches
      || window.matchMedia?.('(display-mode: fullscreen)').matches
      || window.matchMedia?.('(display-mode: minimal-ui)').matches
      || false;
  } catch {
    return false;
  }
}

function comoArchivo(blob: Blob, nombre: string): File | null {
  try {
    return new File([blob], nombre, { type: blob.type || 'application/octet-stream' });
  } catch {
    return null;   // navegadores sin constructor de File
  }
}

/** ¿Puede este navegador compartir este archivo por la hoja del sistema? */
export function puedeCompartirArchivo(blob: Blob, nombre: string): boolean {
  const archivo = comoArchivo(blob, nombre);
  if (!archivo) return false;
  const nav: any = navigator;
  return typeof nav.share === 'function'
    && typeof nav.canShare === 'function'
    && nav.canShare({ files: [archivo] });
}

/**
 * Abre la hoja de compartir con el archivo.
 *
 * Tiene que salir de un toque del usuario: si entre el toque y la llamada se
 * espera a generar el documento, el navegador puede rechazarla por haber
 * perdido el gesto. Eso se distingue en el resultado para poder pedir un
 * segundo toque en lugar de dar el archivo por perdido.
 */
export async function compartirArchivo(blob: Blob, nombre: string): Promise<Entrega> {
  const archivo = comoArchivo(blob, nombre);
  if (!archivo || !puedeCompartirArchivo(blob, nombre)) return 'sin-salida';
  try {
    await (navigator as any).share({ files: [archivo], title: nombre });
    return 'compartido';
  } catch (err: any) {
    // El usuario cerró la hoja: no es un error que haya que contarle.
    if (err?.name === 'AbortError') return 'cancelado';
    // Gesto perdido (NotAllowedError) o cualquier otro fallo: que el llamante
    // ofrezca el botón para intentarlo con un toque nuevo.
    return 'sin-salida';
  }
}

/**
 * Descarga clásica, para navegadores de escritorio.
 *
 * El `<a>` tiene que estar en el documento antes del `click()` (uno suelto
 * funciona en Chrome pero Firefox lo ignora sin avisar) y la URL del blob no
 * se puede liberar en la misma vuelta, porque la descarga aún no ha empezado a
 * leerla y se cancela.
 */
export function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/**
 * Entrega el archivo por el camino que funcione aquí: compartir en la app
 * instalada, descarga normal en el navegador de escritorio.
 *
 * Si devuelve `sin-salida`, el archivo está generado pero no se pudo entregar
 * solo: hay que ofrecer un botón para que el usuario lo toque.
 */
export async function entregarArchivo(blob: Blob, nombre: string): Promise<Entrega> {
  if (esAppInstalada() && puedeCompartirArchivo(blob, nombre)) {
    const r = await compartirArchivo(blob, nombre);
    if (r !== 'sin-salida') return r;
  }
  // En la app instalada esto puede no hacer nada, pero no hay mejor opción y
  // el llamante ya tiene el botón de compartir como respaldo.
  descargarBlob(blob, nombre);
  return esAppInstalada() ? 'sin-salida' : 'descargado';
}

/**
 * Resumen de lo que este aparato sabe hacer, para pegarlo en un reporte.
 *
 * Estos fallos no se reproducen en el escritorio: la app instalada, Safari de
 * iOS y los navegadores de Android se portan distinto y no hay forma de verlo
 * desde fuera. Con esta línea se sabe en qué caso está el usuario sin tener
 * que adivinarlo.
 */
export function infoEntorno(): string {
  const nav: any = navigator;
  const partes = [
    esAppInstalada() ? 'app instalada' : 'navegador',
    `compartir:${typeof nav.share === 'function' ? 'sí' : 'no'}`,
    `archivos:${typeof nav.canShare === 'function' && nav.canShare({ files: [new File([''], 'a.txt', { type: 'text/plain' })] }) ? 'sí' : 'no'}`,
    `descarga:${'download' in document.createElement('a') ? 'sí' : 'no'}`,
  ];
  return `${partes.join(' · ')} · ${navigator.userAgent}`;
}

/** Añade la extensión si el nombre propuesto no la trae. */
export function conExtension(nombre: string, extension: string): string {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return nombre.toLowerCase().endsWith(ext.toLowerCase()) ? nombre : `${nombre}${ext}`;
}

/**
 * ¿El fallo viene de un trozo de la aplicación que ya no está en el servidor?
 *
 * La app se parte en archivos que se piden al usarlos (el de Excel pesa casi
 * un mega). Tras un despliegue, una pestaña abierta desde antes pide el viejo,
 * que ya no existe, y la importación falla. No es un error de los datos: hay
 * que recargar.
 */
export function esFalloDeCarga(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|error loading dynamically/i.test(msg);
}
