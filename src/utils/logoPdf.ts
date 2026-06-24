// Carga un logo (por URL) y lo convierte a data URL para poder incrustarlo en
// los PDF con jsPDF (que necesita los datos de la imagen, no una URL).
// Si falla (URL inválida, sin CORS, sin conexión), devuelve null y el llamador
// usa el logo embebido por defecto.

export interface LogoPdf {
  data: string;    // data URL (data:image/...;base64,...)
  format: string;  // 'PNG' | 'JPEG' (lo que entiende jsPDF)
}

export async function cargarLogoParaPdf(url: string): Promise<LogoPdf | null> {
  if (!url || !url.trim()) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    if (!blob.type.startsWith('image/')) return null;
    const data = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const format = /jpe?g/i.test(blob.type) ? 'JPEG' : 'PNG';
    return { data, format };
  } catch (err) {
    console.warn('[logoPdf] no se pudo cargar el logo configurado, se usa el logo por defecto:', err);
    return null;
  }
}
