/**
 * Descarga un blob como archivo.
 *
 * Parece de más para tres líneas, pero las tres líneas obvias no funcionan en
 * todos los navegadores y fallaban en silencio:
 *
 *  - El `<a>` tiene que estar en el documento antes del `click()`. Un ancla
 *    suelta funciona en Chrome pero Firefox la ignora sin avisar.
 *  - La URL del blob no se puede liberar justo después del `click()`: la
 *    descarga aún no ha empezado a leerla y se cancela. Hay que dejarla viva
 *    un momento.
 *  - Safari de iOS no respeta `download`: abre el archivo en lugar de
 *    guardarlo. Es lo mejor que se puede hacer ahí, pero al menos el usuario
 *    lo ve y puede compartirlo.
 */
export function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Margen para que el navegador empiece a leer el blob.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/** Añade la extensión si el nombre propuesto no la trae. */
export function conExtension(nombre: string, extension: string): string {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return nombre.toLowerCase().endsWith(ext.toLowerCase()) ? nombre : `${nombre}${ext}`;
}

/**
 * ¿El fallo viene de un trozo de la aplicación que ya no está en el servidor?
 *
 * La app se parte en varios archivos que se piden al usarlos (el de Excel pesa
 * casi un mega y no vale la pena cargarlo de entrada). Tras un despliegue, una
 * pestaña abierta desde antes pide el archivo viejo, que ya no existe, y la
 * importación falla. No es un error de los datos: hay que recargar.
 */
export function esFalloDeCarga(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|error loading dynamically/i.test(msg);
}
