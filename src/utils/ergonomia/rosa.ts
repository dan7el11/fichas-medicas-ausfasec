// Motor de puntuación ROSA (Rapid Office Strain Assessment).
// Referencia: Sonne, Villalta & Andrews (2012), Applied Ergonomics.
// Evalúa puestos de OFICINA: silla (altura, profundidad, reposabrazos,
// respaldo), monitor, teléfono, ratón y teclado, con la duración de uso de
// cada elemento. Funciones puras, cubiertas por pruebas.
// IMPORTANTE: validar contra la planilla ROSA oficial antes de uso clínico
// definitivo.
import type { ResultadoErgo } from '../../types/ergonomia';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

// Tabla A (silla) — filas: altura asiento + profundidad (2-8);
// columnas: reposabrazos + respaldo (2-9).
const TABLA_SILLA: Record<number, number[]> = {
  2: [2, 2, 3, 4, 5, 6, 7, 8],
  3: [2, 2, 3, 4, 5, 6, 7, 8],
  4: [3, 3, 3, 4, 5, 6, 7, 8],
  5: [4, 4, 4, 4, 5, 6, 7, 8],
  6: [5, 5, 5, 5, 6, 7, 8, 9],
  7: [6, 6, 6, 7, 7, 8, 8, 9],
  8: [7, 7, 7, 8, 8, 9, 9, 9],
};

// Tabla B (monitor y teléfono) — filas: teléfono (0-6); columnas: monitor (0-7).
const TABLA_B: Record<number, number[]> = {
  0: [1, 1, 1, 2, 3, 4, 5, 6],
  1: [1, 1, 2, 2, 3, 4, 5, 6],
  2: [1, 2, 2, 3, 3, 4, 6, 7],
  3: [2, 2, 3, 3, 4, 5, 6, 8],
  4: [3, 3, 4, 4, 5, 6, 7, 8],
  5: [4, 4, 5, 5, 6, 7, 8, 9],
  6: [5, 5, 6, 7, 8, 8, 9, 9],
};

// Tabla C (ratón y teclado) — filas: ratón (0-7); columnas: teclado (0-7).
const TABLA_C: Record<number, number[]> = {
  0: [1, 1, 1, 2, 3, 4, 5, 6],
  1: [1, 1, 2, 3, 4, 5, 6, 7],
  2: [1, 2, 2, 3, 4, 5, 6, 7],
  3: [2, 3, 3, 3, 5, 6, 7, 8],
  4: [3, 4, 4, 5, 5, 6, 7, 8],
  5: [4, 5, 5, 6, 6, 7, 8, 9],
  6: [5, 6, 6, 7, 7, 8, 8, 9],
  7: [6, 7, 7, 8, 8, 9, 9, 9],
};

export interface EntradasROSA {
  // Silla (valores efectivos: base + ajustes ya aplicados)
  sillaAltura: number;    // 1-5
  sillaProfundidad: number; // 1-3
  reposabrazos: number;   // 1-4
  respaldo: number;       // 1-4
  durSilla: number;       // -1 | 0 | +1
  // Monitor y periféricos (efectivos)
  monitor: number;        // 1-6
  durMonitor: number;     // -1 | 0 | +1
  telefono: number;       // 1-5
  durTelefono: number;    // -1 | 0 | +1
  raton: number;          // 1-6
  durRaton: number;       // -1 | 0 | +1
  teclado: number;        // 1-6
  durTeclado: number;     // -1 | 0 | +1
}

function interpretar(p: number): { nivel: string; accion: string; tone: ResultadoErgo['tone'] } {
  if (p <= 2) return { nivel: 'Insignificante', accion: 'Riesgo aceptable; no se requiere actuación inmediata.', tone: 'success' };
  if (p <= 4) return { nivel: 'Bajo — mejorable', accion: 'Pueden requerirse cambios; profundizar la evaluación.', tone: 'warning' };
  if (p <= 7) return { nivel: 'Alto', accion: 'Es necesaria una intervención pronta sobre el puesto.', tone: 'danger' };
  return { nivel: 'Muy alto', accion: 'Intervención urgente sobre el puesto de trabajo.', tone: 'danger' };
}

export function calcularROSA(e: EntradasROSA): ResultadoErgo {
  // Silla: (altura + profundidad) × (reposabrazos + respaldo) → tabla + duración
  const fila = clamp(clamp(e.sillaAltura, 1, 5) + clamp(e.sillaProfundidad, 1, 3), 2, 8);
  const col = clamp(clamp(e.reposabrazos, 1, 4) + clamp(e.respaldo, 1, 4), 2, 9);
  const silla = clamp(TABLA_SILLA[fila][col - 2] + clamp(e.durSilla, -1, 1), 1, 10);

  // Cada elemento suma su duración (puede bajar a 0 con uso breve)
  const monitor = clamp(clamp(e.monitor, 1, 6) + clamp(e.durMonitor, -1, 1), 0, 7);
  const telefono = clamp(clamp(e.telefono, 1, 5) + clamp(e.durTelefono, -1, 1), 0, 6);
  const raton = clamp(clamp(e.raton, 1, 6) + clamp(e.durRaton, -1, 1), 0, 7);
  const teclado = clamp(clamp(e.teclado, 1, 6) + clamp(e.durTeclado, -1, 1), 0, 7);

  const monitorTelefono = TABLA_B[telefono][monitor];
  const ratonTeclado = TABLA_C[raton][teclado];

  // Tablas D y E del método: el valor combinado es el máximo de ambos ejes.
  const perifericos = Math.max(monitorTelefono, ratonTeclado);
  const puntajeFinal = Math.max(silla, perifericos);

  const i = interpretar(puntajeFinal);
  return {
    metodo: 'ROSA',
    puntajeFinal,
    nivel: i.nivel,
    accion: i.accion,
    tone: i.tone,
    detalle: { silla, monitorTelefono, ratonTeclado, perifericos },
  };
}
