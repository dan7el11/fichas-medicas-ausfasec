// Definición data-driven de los métodos ergonómicos para el formulario.
// Cada campo es un "segmento" (postura, con select base + ajustes) o un
// "factor" (carga, acople, etc., solo select). El formulario calcula el valor
// efectivo de cada campo y lo pasa a la función `calcular` del método.
import type { MetodoErgo, ResultadoErgo } from '../../types/ergonomia';
import { calcularRULA } from './rula';
import { calcularREBA } from './reba';

export interface OpcionSeg { valor: number; label: string; }
export interface AjusteSeg { key: string; label: string; delta: number; }

export interface CampoErgo {
  key: string;
  label: string;
  grupo: string;            // título de sección en el formulario
  opciones: OpcionSeg[];    // postura/factor base
  ajustes?: AjusteSeg[];    // checkboxes que suman/restan al valor base
  min: number;
  max: number;
}

export interface DefinicionMetodo {
  metodo: MetodoErgo;
  label: string;
  descripcion: string;
  campos: CampoErgo[];
  calcular: (vals: Record<string, number>) => ResultadoErgo;
}

// ── RULA ─────────────────────────────────────────────────────────────────────
const RULA: DefinicionMetodo = {
  metodo: 'RULA',
  label: 'RULA',
  descripcion: 'Rapid Upper Limb Assessment — carga postural de miembro superior.',
  campos: [
    { key: 'brazo', label: 'Brazo', grupo: 'A · Brazo, antebrazo y muñeca', min: 1, max: 6,
      opciones: [{ valor: 1, label: '20° ext. a 20° flex.' }, { valor: 2, label: '>20° ext. o 20–45° flex.' }, { valor: 3, label: '45–90° flex.' }, { valor: 4, label: '>90° flex.' }],
      ajustes: [{ key: 'hombro', label: 'Hombro elevado', delta: 1 }, { key: 'abducido', label: 'Brazo abducido', delta: 1 }, { key: 'apoyado', label: 'Brazo apoyado / persona recostada', delta: -1 }] },
    { key: 'antebrazo', label: 'Antebrazo', grupo: 'A · Brazo, antebrazo y muñeca', min: 1, max: 3,
      opciones: [{ valor: 1, label: '60–100° flex.' }, { valor: 2, label: '<60° o >100° flex.' }],
      ajustes: [{ key: 'cruza', label: 'Cruza línea media o hacia el lado', delta: 1 }] },
    { key: 'muneca', label: 'Muñeca', grupo: 'A · Brazo, antebrazo y muñeca', min: 1, max: 4,
      opciones: [{ valor: 1, label: 'Neutra (0°)' }, { valor: 2, label: '0–15° flex./ext.' }, { valor: 3, label: '>15° flex./ext.' }],
      ajustes: [{ key: 'desviada', label: 'Desviada de la línea media', delta: 1 }] },
    { key: 'giroMuneca', label: 'Giro de muñeca', grupo: 'A · Brazo, antebrazo y muñeca', min: 1, max: 2,
      opciones: [{ valor: 1, label: 'Rango medio' }, { valor: 2, label: 'Cerca del límite del giro' }] },
    { key: 'usoMuscular', label: 'Uso muscular', grupo: 'A · Carga y esfuerzo', min: 0, max: 1,
      opciones: [{ valor: 0, label: 'No' }, { valor: 1, label: 'Estático >1 min o repetido >4/min' }] },
    { key: 'carga', label: 'Carga / fuerza', grupo: 'A · Carga y esfuerzo', min: 0, max: 3,
      opciones: [{ valor: 0, label: '<2 kg intermitente' }, { valor: 1, label: '2–10 kg intermitente' }, { valor: 2, label: '2–10 kg estático/repetido o 10+ kg intermitente' }, { valor: 3, label: '10+ kg estático/repetido o golpes' }] },
    { key: 'cuello', label: 'Cuello', grupo: 'B · Cuello, tronco y piernas', min: 1, max: 6,
      opciones: [{ valor: 1, label: '0–10° flex.' }, { valor: 2, label: '10–20° flex.' }, { valor: 3, label: '>20° flex.' }, { valor: 4, label: 'En extensión' }],
      ajustes: [{ key: 'girado', label: 'Cuello girado', delta: 1 }, { key: 'inclinado', label: 'Cuello inclinado', delta: 1 }] },
    { key: 'tronco', label: 'Tronco', grupo: 'B · Cuello, tronco y piernas', min: 1, max: 6,
      opciones: [{ valor: 1, label: 'Erguido / bien apoyado' }, { valor: 2, label: '0–20° flex.' }, { valor: 3, label: '20–60° flex.' }, { valor: 4, label: '>60° flex.' }],
      ajustes: [{ key: 'girado', label: 'Tronco girado', delta: 1 }, { key: 'inclinado', label: 'Tronco inclinado', delta: 1 }] },
    { key: 'piernas', label: 'Piernas', grupo: 'B · Cuello, tronco y piernas', min: 1, max: 2,
      opciones: [{ valor: 1, label: 'Apoyadas y equilibradas' }, { valor: 2, label: 'No apoyadas / desequilibradas' }] },
  ],
  calcular: (v) => calcularRULA({
    brazo: v.brazo, antebrazo: v.antebrazo, muneca: v.muneca, giroMuneca: v.giroMuneca,
    cuello: v.cuello, tronco: v.tronco, piernas: v.piernas,
    usoMuscularA: v.usoMuscular, cargaA: v.carga, usoMuscularB: v.usoMuscular, cargaB: v.carga,
  }),
};

// ── REBA ─────────────────────────────────────────────────────────────────────
const REBA: DefinicionMetodo = {
  metodo: 'REBA',
  label: 'REBA',
  descripcion: 'Rapid Entire Body Assessment — carga postural de cuerpo entero.',
  campos: [
    { key: 'cuello', label: 'Cuello', grupo: 'A · Cuello, tronco y piernas', min: 1, max: 3,
      opciones: [{ valor: 1, label: '0–20° flex.' }, { valor: 2, label: '>20° flex. o en extensión' }],
      ajustes: [{ key: 'girado', label: 'Girado o inclinado', delta: 1 }] },
    { key: 'tronco', label: 'Tronco', grupo: 'A · Cuello, tronco y piernas', min: 1, max: 5,
      opciones: [{ valor: 1, label: 'Erguido' }, { valor: 2, label: '0–20° flex./ext.' }, { valor: 3, label: '20–60° flex. o >20° ext.' }, { valor: 4, label: '>60° flex.' }],
      ajustes: [{ key: 'girado', label: 'Girado o inclinado', delta: 1 }] },
    { key: 'piernas', label: 'Piernas', grupo: 'A · Cuello, tronco y piernas', min: 1, max: 4,
      opciones: [{ valor: 1, label: 'Soporte bilateral, de pie o sentado' }, { valor: 2, label: 'Soporte unilateral o inestable' }, { valor: 3, label: 'Rodillas flexionadas 30–60°' }, { valor: 4, label: 'Rodillas flexionadas >60° (sin sentarse)' }] },
    { key: 'carga', label: 'Carga / fuerza', grupo: 'A · Carga', min: 0, max: 3,
      opciones: [{ valor: 0, label: '<5 kg' }, { valor: 1, label: '5–10 kg' }, { valor: 2, label: '>10 kg' }, { valor: 3, label: '>10 kg con fuerza brusca / golpe' }] },
    { key: 'brazo', label: 'Brazo', grupo: 'B · Brazo, antebrazo y muñeca', min: 1, max: 6,
      opciones: [{ valor: 1, label: '20° ext. a 20° flex.' }, { valor: 2, label: '>20° ext. o 20–45° flex.' }, { valor: 3, label: '45–90° flex.' }, { valor: 4, label: '>90° flex.' }],
      ajustes: [{ key: 'hombro', label: 'Hombro elevado', delta: 1 }, { key: 'abducido', label: 'Brazo abducido', delta: 1 }, { key: 'apoyado', label: 'Brazo apoyado / persona recostada', delta: -1 }] },
    { key: 'antebrazo', label: 'Antebrazo', grupo: 'B · Brazo, antebrazo y muñeca', min: 1, max: 2,
      opciones: [{ valor: 1, label: '60–100° flex.' }, { valor: 2, label: '<60° o >100° flex.' }] },
    { key: 'muneca', label: 'Muñeca', grupo: 'B · Brazo, antebrazo y muñeca', min: 1, max: 3,
      opciones: [{ valor: 1, label: '0–15° flex./ext.' }, { valor: 2, label: '>15° flex./ext.' }],
      ajustes: [{ key: 'desviada', label: 'Desviada o con torsión', delta: 1 }] },
    { key: 'acople', label: 'Agarre (acople)', grupo: 'B · Carga y agarre', min: 0, max: 3,
      opciones: [{ valor: 0, label: 'Bueno' }, { valor: 1, label: 'Aceptable' }, { valor: 2, label: 'Pobre' }, { valor: 3, label: 'Inaceptable' }] },
    { key: 'actividad', label: 'Actividad', grupo: 'C · Actividad', min: 0, max: 3,
      opciones: [{ valor: 0, label: 'Ninguna' }, { valor: 1, label: '1 condición (estático/repetido/cambios bruscos)' }, { valor: 2, label: '2 condiciones' }, { valor: 3, label: '3 condiciones' }] },
  ],
  calcular: (v) => calcularREBA({
    cuello: v.cuello, tronco: v.tronco, piernas: v.piernas, carga: v.carga,
    brazo: v.brazo, antebrazo: v.antebrazo, muneca: v.muneca, acople: v.acople, actividad: v.actividad,
  }),
};

export const METODOS: Record<MetodoErgo, DefinicionMetodo> = { RULA, REBA };

/** Valores base por defecto (mínimos) para un método. */
export function valoresIniciales(metodo: MetodoErgo): Record<string, number> {
  const v: Record<string, number> = {};
  METODOS[metodo].campos.forEach((c) => { v[c.key] = c.opciones[0].valor; });
  return v;
}
