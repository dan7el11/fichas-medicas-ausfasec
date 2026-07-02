// Ecuación de levantamiento de cargas del NIOSH (Waters et al., 1994).
// Calcula el Peso Límite Recomendado (RWL) y el Índice de Levantamiento (LI).
// Funciones puras, con pruebas. IMPORTANTE: validar la tabla FM/CM y los
// multiplicadores contra la guía oficial NIOSH antes de uso clínico definitivo.
import type { ResultadoErgo } from '../../types/ergonomia';

const LC = 23; // constante de carga (kg)

// Tabla del Multiplicador de Frecuencia (FM).
// [frecuencia lev/min] → { duración: [V<75cm, V>=75cm] }  (corta ≤1h, media ≤2h, larga ≤8h)
const FM_TABLA: { f: number; corta: [number, number]; media: [number, number]; larga: [number, number] }[] = [
  { f: 0.2, corta: [1.00, 1.00], media: [0.95, 0.95], larga: [0.85, 0.85] },
  { f: 0.5, corta: [0.97, 0.97], media: [0.92, 0.92], larga: [0.81, 0.81] },
  { f: 1,   corta: [0.94, 0.94], media: [0.88, 0.88], larga: [0.75, 0.75] },
  { f: 2,   corta: [0.91, 0.91], media: [0.84, 0.84], larga: [0.65, 0.65] },
  { f: 3,   corta: [0.88, 0.88], media: [0.79, 0.79], larga: [0.55, 0.55] },
  { f: 4,   corta: [0.84, 0.84], media: [0.72, 0.72], larga: [0.45, 0.45] },
  { f: 5,   corta: [0.80, 0.80], media: [0.60, 0.60], larga: [0.35, 0.35] },
  { f: 6,   corta: [0.75, 0.75], media: [0.50, 0.50], larga: [0.27, 0.27] },
  { f: 7,   corta: [0.70, 0.70], media: [0.42, 0.42], larga: [0.22, 0.22] },
  { f: 8,   corta: [0.60, 0.60], media: [0.35, 0.35], larga: [0.18, 0.18] },
  { f: 9,   corta: [0.52, 0.52], media: [0.30, 0.30], larga: [0.00, 0.15] },
  { f: 10,  corta: [0.45, 0.45], media: [0.26, 0.26], larga: [0.00, 0.13] },
  { f: 11,  corta: [0.41, 0.41], media: [0.00, 0.23], larga: [0.00, 0.00] },
  { f: 12,  corta: [0.37, 0.37], media: [0.00, 0.21], larga: [0.00, 0.00] },
  { f: 13,  corta: [0.00, 0.34], media: [0.00, 0.00], larga: [0.00, 0.00] },
  { f: 14,  corta: [0.00, 0.31], media: [0.00, 0.00], larga: [0.00, 0.00] },
  { f: 15,  corta: [0.00, 0.28], media: [0.00, 0.00], larga: [0.00, 0.00] },
];

export type DuracionNiosh = 1 | 2 | 3; // 1=≤1h, 2=≤2h, 3=≤8h
export type AgarreNiosh = 1 | 2 | 3;   // 1=bueno, 2=regular, 3=malo

function fm(frecuencia: number, duracion: DuracionNiosh, V: number): number {
  if (frecuencia <= 0.1) return 1.0;
  if (frecuencia > 15) return 0;
  const fila = FM_TABLA.find((r) => frecuencia <= r.f) ?? FM_TABLA[FM_TABLA.length - 1];
  const col = duracion === 1 ? fila.corta : duracion === 2 ? fila.media : fila.larga;
  return V < 75 ? col[0] : col[1];
}

function cm(agarre: AgarreNiosh, V: number): number {
  if (agarre === 1) return 1.0;                    // bueno
  if (agarre === 2) return V < 75 ? 0.95 : 1.0;    // regular
  return 0.90;                                     // malo
}

export interface EntradasNIOSH {
  pesoCarga: number;   // kg
  H: number;           // distancia horizontal (cm)
  V: number;           // altura de las manos al inicio (cm)
  D: number;           // desplazamiento vertical (cm)
  A: number;           // ángulo de asimetría (grados)
  frecuencia: number;  // levantamientos por minuto
  duracion: DuracionNiosh;
  agarre: AgarreNiosh;
}

export function calcularNIOSH(e: EntradasNIOSH): ResultadoErgo {
  const HM = e.H <= 25 ? 1 : e.H > 63 ? 0 : 25 / e.H;
  const VM = Math.abs(e.V) > 175 ? 0 : Math.max(0, 1 - 0.003 * Math.abs(e.V - 75));
  const DM = e.D < 25 ? 1 : e.D > 175 ? 0 : 0.82 + 4.5 / e.D;
  const AM = e.A > 135 ? 0 : Math.max(0, 1 - 0.0032 * e.A);
  const FM = fm(e.frecuencia, e.duracion, e.V);
  const CM = cm(e.agarre, e.V);

  const RWL = LC * HM * VM * DM * AM * FM * CM;
  const LI = RWL > 0 ? e.pesoCarga / RWL : 999;

  const r2 = (n: number) => Math.round(n * 100) / 100;
  let nivel: string, accion: string, tone: ResultadoErgo['tone'];
  if (RWL <= 0) { nivel = 'No recomendado'; accion = 'La combinación de factores hace el levantamiento inseguro (RWL = 0).'; tone = 'danger'; }
  else if (LI <= 1) { nivel = 'Aceptable', accion = 'Riesgo bajo para la mayoría de trabajadores.'; tone = 'success'; }
  else if (LI <= 3) { nivel = 'Riesgo aumentado'; accion = 'Rediseñar la tarea; algunos trabajadores estarán en riesgo.'; tone = 'warning'; }
  else { nivel = 'Riesgo alto'; accion = 'Riesgo elevado; rediseñar la tarea de inmediato.'; tone = 'danger'; }

  return {
    metodo: 'NIOSH',
    puntajeFinal: r2(LI),
    nivel,
    accion,
    tone,
    detalle: { RWL: r2(RWL), LI: r2(LI), HM: r2(HM), VM: r2(VM), DM: r2(DM), AM: r2(AM), FM: r2(FM), CM: r2(CM) },
  };
}
