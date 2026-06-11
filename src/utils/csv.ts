// Utilidades para importar datos desde CSV (separador ; o ,) y descargar plantillas.

/** Parsea texto CSV respetando comillas. Detecta automáticamente el separador (; o ,). */
export function parseCSV(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      row.push(field.trim()); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field.trim()); field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

/**
 * Convierte las filas CSV en objetos usando la primera fila como cabecera.
 * Las cabeceras se normalizan (minúsculas, sin tildes ni espacios) para tolerar variantes.
 */
export function csvAObjetos(rows: string[][], columnas: string[]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_-]/g, '');
  const header = rows[0].map(norm);
  const idx: Record<string, number> = {};
  for (const col of columnas) {
    const i = header.indexOf(norm(col));
    if (i >= 0) idx[col] = i;
  }
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    for (const col of columnas) obj[col] = idx[col] !== undefined ? (r[idx[col]] ?? '') : '';
    return obj;
  });
}

/** Descarga una plantilla CSV con cabeceras y una fila de ejemplo. */
export function descargarPlantillaCSV(nombreArchivo: string, columnas: string[], ejemplo: string[]) {
  const csv = '﻿' + columnas.join(';') + '\n' + ejemplo.join(';');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', nombreArchivo);
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}
