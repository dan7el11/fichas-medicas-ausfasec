// Carga un logo (por URL) y lo convierte a data URL para poder incrustarlo en
// los PDF con jsPDF (que necesita los datos de la imagen, no una URL).
// Si falla (URL inválida, sin CORS, sin conexión), devuelve null y el llamador
// usa el logo embebido por defecto.

import { ref as storageRef, getBlob } from 'firebase/storage';
import { storage } from '../services/firebase';

export interface LogoPdf {
  data: string;    // data URL (data:image/...;base64,...)
  format: string;  // 'PNG' | 'JPEG' (lo que entiende jsPDF)
}

async function blobADataUrl(blob: Blob): Promise<LogoPdf | null> {
  if (!blob.type.startsWith('image/')) return null;
  const data = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
  return { data, format: /jpe?g/i.test(blob.type) ? 'JPEG' : 'PNG' };
}

export async function cargarLogoParaPdf(url: string): Promise<LogoPdf | null> {
  if (!url || !url.trim()) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return await blobADataUrl(await resp.blob());
  } catch (err) {
    console.warn('[logoPdf] no se pudo cargar el logo configurado, se usa el logo por defecto:', err);
    return null;
  }
}

/**
 * Carga una imagen de Firebase Storage para incrustarla en un PDF.
 * Usa el SDK autenticado (getBlob) — el fetch directo de la URL de descarga
 * puede fallar por CORS — y cae al fetch por URL como respaldo.
 */
export async function cargarFotoParaPdf(path: string, url: string): Promise<LogoPdf | null> {
  if (path) {
    try {
      const blob = await getBlob(storageRef(storage, path));
      const r = await blobADataUrl(blob);
      if (r) return r;
    } catch (err) {
      console.warn('[logoPdf] getBlob falló, intentando por URL:', err);
    }
  }
  return cargarLogoParaPdf(url);
}
