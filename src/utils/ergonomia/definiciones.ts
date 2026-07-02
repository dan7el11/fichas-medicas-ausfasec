// Definición data-driven de los métodos ergonómicos para el formulario.
// Cada campo es un "segmento" (postura, con select base + ajustes) o un
// "factor" (carga, acople, etc., solo select). El formulario calcula el valor
// efectivo de cada campo y lo pasa a la función `calcular` del método.
import type { MetodoErgo, ResultadoErgo } from '../../types/ergonomia';
import { calcularRULA } from './rula';
import { calcularREBA } from './reba';
import { calcularNIOSH, type DuracionNiosh, type AgarreNiosh } from './niosh';
import { calcularROSA } from './rosa';

export interface OpcionSeg { valor: number; label: string; }
export interface AjusteSeg { key: string; label: string; delta: number; }

export interface CampoErgo {
  key: string;
  label: string;
  grupo: string;            // título de sección en el formulario
  tipo?: 'select' | 'numero'; // por defecto 'select'
  opciones?: OpcionSeg[];   // postura/factor base (para 'select')
  ajustes?: AjusteSeg[];    // checkboxes que suman/restan al valor base
  unidad?: string;          // para 'numero' (ej. 'cm', 'kg')
  paso?: number;            // step del input numérico
  def?: number;             // valor inicial de un campo numérico
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

// ── NIOSH ────────────────────────────────────────────────────────────────────
const NIOSH: DefinicionMetodo = {
  metodo: 'NIOSH',
  label: 'NIOSH',
  descripcion: 'Ecuación de levantamiento de cargas — peso límite recomendado (RWL) e índice de levantamiento (LI).',
  campos: [
    { key: 'pesoCarga', label: 'Peso de la carga', grupo: 'Carga y geometría', tipo: 'numero', unidad: 'kg', min: 0, max: 200, def: 10, paso: 0.5 },
    { key: 'H', label: 'Distancia horizontal (H)', grupo: 'Carga y geometría', tipo: 'numero', unidad: 'cm', min: 0, max: 100, def: 25 },
    { key: 'V', label: 'Altura de las manos al inicio (V)', grupo: 'Carga y geometría', tipo: 'numero', unidad: 'cm', min: 0, max: 200, def: 75 },
    { key: 'D', label: 'Desplazamiento vertical (D)', grupo: 'Carga y geometría', tipo: 'numero', unidad: 'cm', min: 0, max: 200, def: 25 },
    { key: 'A', label: 'Ángulo de asimetría (A)', grupo: 'Carga y geometría', tipo: 'numero', unidad: '°', min: 0, max: 180, def: 0 },
    { key: 'frecuencia', label: 'Frecuencia', grupo: 'Frecuencia y duración', tipo: 'numero', unidad: 'lev/min', min: 0, max: 20, def: 1, paso: 0.5 },
    { key: 'duracion', label: 'Duración de la tarea', grupo: 'Frecuencia y duración', min: 1, max: 3,
      opciones: [{ valor: 1, label: '≤ 1 hora' }, { valor: 2, label: '≤ 2 horas' }, { valor: 3, label: '≤ 8 horas' }] },
    { key: 'agarre', label: 'Calidad del agarre', grupo: 'Agarre', min: 1, max: 3,
      opciones: [{ valor: 1, label: 'Bueno' }, { valor: 2, label: 'Regular' }, { valor: 3, label: 'Malo' }] },
  ],
  calcular: (v) => calcularNIOSH({
    pesoCarga: v.pesoCarga, H: v.H, V: v.V, D: v.D, A: v.A, frecuencia: v.frecuencia,
    duracion: v.duracion as DuracionNiosh, agarre: v.agarre as AgarreNiosh,
  }),
};

// ── ROSA ─────────────────────────────────────────────────────────────────────
// Duración de uso de cada elemento (modificador estándar del método)
const OPCIONES_DURACION: OpcionSeg[] = [
  { valor: 0, label: 'Entre 1 y 4 h/día (uso normal)' },
  { valor: -1, label: 'Menos de 1 h/día o <30 min seguidos' },
  { valor: 1, label: 'Más de 4 h/día o >1 h seguida' },
];

const ROSA: DefinicionMetodo = {
  metodo: 'ROSA',
  label: 'ROSA',
  descripcion: 'Rapid Office Strain Assessment — puestos de oficina (silla, monitor, teléfono, ratón y teclado).',
  campos: [
    // ── Silla ──
    { key: 'sillaAltura', label: 'Altura del asiento', grupo: 'A · Silla', min: 1, max: 5,
      opciones: [
        { valor: 1, label: 'Rodillas a ≈90°' },
        { valor: 2, label: 'Asiento muy bajo (<90°) o muy alto (>90°)' },
        { valor: 3, label: 'Pies sin contacto con el suelo' },
      ],
      ajustes: [
        { key: 'sinEspacio', label: 'Espacio insuficiente bajo la mesa', delta: 1 },
        { key: 'noAjustable', label: 'Altura no ajustable', delta: 1 },
      ] },
    { key: 'sillaProfundidad', label: 'Profundidad del asiento', grupo: 'A · Silla', min: 1, max: 3,
      opciones: [
        { valor: 1, label: '≈8 cm entre borde del asiento y rodilla' },
        { valor: 2, label: 'Asiento muy largo (<8 cm) o muy corto (>8 cm)' },
      ],
      ajustes: [{ key: 'noAjustable', label: 'Profundidad no ajustable', delta: 1 }] },
    { key: 'reposabrazos', label: 'Reposabrazos', grupo: 'A · Silla', min: 1, max: 4,
      opciones: [
        { valor: 1, label: 'Codos apoyados, hombros relajados' },
        { valor: 2, label: 'Muy altos (hombros encogidos) o muy bajos / mal ubicados' },
      ],
      ajustes: [
        { key: 'duro', label: 'Superficie dura o dañada', delta: 1 },
        { key: 'noAjustable', label: 'No ajustables', delta: 1 },
      ] },
    { key: 'respaldo', label: 'Respaldo', grupo: 'A · Silla', min: 1, max: 4,
      opciones: [
        { valor: 1, label: 'Soporte lumbar adecuado, reclinado 95–110°' },
        { valor: 2, label: 'Sin soporte lumbar, reclinación <95° o >110°, o sin usar el respaldo' },
      ],
      ajustes: [
        { key: 'mesaAlta', label: 'Superficie de trabajo muy alta (hombros encogidos)', delta: 1 },
        { key: 'noAjustable', label: 'Respaldo no ajustable', delta: 1 },
      ] },
    { key: 'durSilla', label: 'Tiempo sentado', grupo: 'A · Silla', min: -1, max: 1, opciones: OPCIONES_DURACION },

    // ── Monitor y teléfono ──
    { key: 'monitor', label: 'Monitor', grupo: 'B · Monitor y teléfono', min: 1, max: 6,
      opciones: [
        { valor: 1, label: 'A distancia de brazo (40–75 cm), borde superior a nivel de ojos' },
        { valor: 2, label: 'Muy bajo (cuello flexionado >30°)' },
        { valor: 3, label: 'Muy alto (cuello en extensión)' },
      ],
      ajustes: [
        { key: 'girado', label: 'Cuello girado (>30°)', delta: 1 },
        { key: 'reflejos', label: 'Brillos o reflejos en pantalla', delta: 1 },
        { key: 'documentos', label: 'Documentos sin porta-documentos', delta: 1 },
      ] },
    { key: 'durMonitor', label: 'Tiempo frente al monitor', grupo: 'B · Monitor y teléfono', min: -1, max: 1, opciones: OPCIONES_DURACION },
    { key: 'telefono', label: 'Teléfono', grupo: 'B · Monitor y teléfono', min: 1, max: 5,
      opciones: [
        { valor: 1, label: 'Auriculares o una mano con cuello neutro' },
        { valor: 2, label: 'Muy lejos del alcance (>30 cm)' },
      ],
      ajustes: [
        { key: 'pinza', label: 'Sujetado entre cuello y hombro', delta: 2 },
        { key: 'sinManosLibres', label: 'Sin opción de manos libres', delta: 1 },
      ] },
    { key: 'durTelefono', label: 'Tiempo al teléfono', grupo: 'B · Monitor y teléfono', min: -1, max: 1, opciones: OPCIONES_DURACION },

    // ── Ratón y teclado ──
    { key: 'raton', label: 'Ratón (mouse)', grupo: 'C · Ratón y teclado', min: 1, max: 6,
      opciones: [
        { valor: 1, label: 'Alineado con el hombro' },
        { valor: 2, label: 'Desalineado / alcanzándolo lejos' },
      ],
      ajustes: [
        { key: 'pinza', label: 'Agarre en pinza (ratón pequeño)', delta: 1 },
        { key: 'reposamanos', label: 'Reposamanos duro delante del ratón', delta: 1 },
        { key: 'superficies', label: 'Ratón y teclado en superficies distintas', delta: 2 },
      ] },
    { key: 'durRaton', label: 'Tiempo de uso del ratón', grupo: 'C · Ratón y teclado', min: -1, max: 1, opciones: OPCIONES_DURACION },
    { key: 'teclado', label: 'Teclado', grupo: 'C · Ratón y teclado', min: 1, max: 6,
      opciones: [
        { valor: 1, label: 'Muñecas rectas, hombros relajados' },
        { valor: 2, label: 'Muñecas extendidas >15°' },
      ],
      ajustes: [
        { key: 'desviadas', label: 'Muñecas desviadas al teclear', delta: 1 },
        { key: 'alto', label: 'Teclado muy alto (hombros encogidos)', delta: 1 },
        { key: 'alcances', label: 'Alcances por encima de la cabeza o lejanos', delta: 1 },
        { key: 'noAjustable', label: 'Plataforma no ajustable', delta: 1 },
      ] },
    { key: 'durTeclado', label: 'Tiempo de tecleo', grupo: 'C · Ratón y teclado', min: -1, max: 1, opciones: OPCIONES_DURACION },
  ],
  calcular: (v) => calcularROSA({
    sillaAltura: v.sillaAltura, sillaProfundidad: v.sillaProfundidad,
    reposabrazos: v.reposabrazos, respaldo: v.respaldo, durSilla: v.durSilla,
    monitor: v.monitor, durMonitor: v.durMonitor,
    telefono: v.telefono, durTelefono: v.durTelefono,
    raton: v.raton, durRaton: v.durRaton, teclado: v.teclado, durTeclado: v.durTeclado,
  }),
};

export const METODOS: Record<MetodoErgo, DefinicionMetodo> = { RULA, REBA, NIOSH, ROSA };

/** Valores iniciales para un método (mínimo del select o `def` del numérico). */
export function valoresIniciales(metodo: MetodoErgo): Record<string, number> {
  const v: Record<string, number> = {};
  METODOS[metodo].campos.forEach((c) => {
    v[c.key] = c.tipo === 'numero' ? (c.def ?? c.min) : (c.opciones?.[0].valor ?? c.min);
  });
  return v;
}
