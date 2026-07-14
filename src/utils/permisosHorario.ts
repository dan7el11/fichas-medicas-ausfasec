// Utilidades puras para permisos por horario (desde–hasta) y para el conteo
// de sesiones de fisioterapia por intervalos de fechas laborables.

/** Horas (decimales, 1 decimal) entre dos horas 'HH:MM'. 0 si el rango es inválido. */
export function horasEntre(horaDesde: string, horaHasta: string): number {
  const [h1, m1] = (horaDesde || '').split(':').map(Number);
  const [h2, m2] = (horaHasta || '').split(':').map(Number);
  if ([h1, m1, h2, m2].some((v) => Number.isNaN(v) || v == null)) return 0;
  const minutos = h2 * 60 + m2 - (h1 * 60 + m1);
  if (minutos <= 0) return 0;
  return Math.round((minutos / 60) * 10) / 10;
}

/** 'HH:MM' (24 h) → formato 12 h legible: '14:30' → '2:30 pm'. */
export function fmtHora12(hora: string): string {
  const [h, m] = (hora || '').split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hora || '—';
  const sufijo = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

/** Texto del horario de un permiso: 'desde 12:30 pm hasta 2:30 pm'. */
export function rangoHorarioTexto(horaDesde: string, horaHasta: string): string {
  if (!horaDesde || !horaHasta) return '';
  return `desde ${fmtHora12(horaDesde)} hasta ${fmtHora12(horaHasta)}`;
}

/**
 * Fechas laborables (lunes–viernes) entre `desde` y `hasta` inclusive, en
 * formato aaaa-mm-dd. Los sábados y domingos se excluyen porque no se
 * realizan sesiones. Rango inválido → [].
 */
export function fechasLaborables(desde: string, hasta: string): string[] {
  if (!desde || !hasta) return [];
  const d0 = new Date(desde + 'T12:00:00');
  const d1 = new Date(hasta + 'T12:00:00');
  if (isNaN(d0.getTime()) || isNaN(d1.getTime()) || d0 > d1) return [];
  const fechas: string[] = [];
  const cursor = new Date(d0);
  // Tope de seguridad: un año de sesiones.
  for (let i = 0; i < 366 && cursor <= d1; i++) {
    const dow = cursor.getDay(); // 0 = domingo, 6 = sábado
    if (dow !== 0 && dow !== 6) fechas.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return fechas;
}

/** Une varios intervalos {desde, hasta} en una lista de fechas laborables únicas y ordenadas. */
export function fechasDeIntervalos(intervalos: { desde: string; hasta: string }[]): string[] {
  const set = new Set<string>();
  for (const it of intervalos) {
    if (!it?.desde || !it?.hasta) continue;
    fechasLaborables(it.desde, it.hasta).forEach((f) => set.add(f));
  }
  return [...set].sort();
}
