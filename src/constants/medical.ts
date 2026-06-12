// Constantes del dominio médico ocupacional — CEM AUSTROGAS
// Catálogos de áreas, puestos, tipos de evaluación y mapeos de color.

export const AREAS = [
  'Operaciones',
  'Mantenimiento',
  'Logística',
  'Administración',
  'Seguridad y Salud',
  'Comercial',
] as const;

export type Area = (typeof AREAS)[number];

export const PUESTOS_POR_AREA: Record<Area, string[]> = {
  Operaciones: [
    'Operario de planta',
    'Supervisor de turno',
    'Operador de envasado',
    'Operador de almacenamiento',
  ],
  Mantenimiento: [
    'Mecánico industrial',
    'Soldador',
    'Electricista',
    'Técnico de mantenimiento',
  ],
  Logística: [
    'Conductor de tanquero',
    'Despachador',
    'Bodeguero',
    'Asistente de despacho',
  ],
  Administración: [
    'Asistente contable',
    'Analista de RRHH',
    'Recepcionista',
    'Asistente administrativo',
  ],
  'Seguridad y Salud': [
    'Médico ocupacional',
    'Enfermera ocupacional',
    'Técnico de seguridad',
    'Paramédico',
  ],
  Comercial: ['Ejecutivo comercial', 'Asesor de ventas', 'Coordinador comercial'],
};

export const TIPOS_EVAL = [
  'Pre-empleo',
  'Periódico',
  'Retiro',
  'Reintegro',
  'Especial',
] as const;

export const APTITUDES = [
  'Apto',
  'Apto con restricciones',
  'No apto',
  'Pendiente',
] as const;

// Mapeo desde el enum del repo (EvaluacionMedica.aptitudMedica) al label legible
export const APTITUD_LABEL: Record<string, (typeof APTITUDES)[number]> = {
  apto: 'Apto',
  aptoObservacion: 'Apto con restricciones',
  aptoLimitaciones: 'Apto con restricciones',
  noApto: 'No apto',
};

// Paleta de colores por área (clínica, suave)
export const AREA_COLORS: Record<Area, { bg: string; fg: string; dot: string }> = {
  Operaciones: { bg: '#eaf3ff', fg: '#1d4fad', dot: '#3b82f6' },
  Mantenimiento: { bg: '#fff1e6', fg: '#9a4a07', dot: '#ea7c3c' },
  Logística: { bg: '#f0ebff', fg: '#5b3fbd', dot: '#7c5cf2' },
  Administración: { bg: '#eef1f5', fg: '#3a4a5e', dot: '#64748b' },
  'Seguridad y Salud': { bg: '#e6f6ee', fg: '#0a6b3b', dot: '#10a05a' },
  Comercial: { bg: '#fde9ee', fg: '#9c1d3f', dot: '#e3496a' },
};

// ── Áreas reales (texto libre desde la ficha del trabajador) ────────────────
// Las áreas que se muestran/filtran provienen del campo departamento/área de
// cada ficha (p. ej. «Planificación», «Seguridad y Ambiente», «TTHH»).
export const AREA_SIN_ASIGNAR = 'Sin área';

const PALETA_AREAS: { bg: string; fg: string; dot: string }[] = [
  { bg: '#eaf3ff', fg: '#1d4fad', dot: '#3b82f6' },
  { bg: '#e6f6ee', fg: '#0a6b3b', dot: '#10a05a' },
  { bg: '#fff1e6', fg: '#9a4a07', dot: '#ea7c3c' },
  { bg: '#f0ebff', fg: '#5b3fbd', dot: '#7c5cf2' },
  { bg: '#fde9ee', fg: '#9c1d3f', dot: '#e3496a' },
  { bg: '#e0f2fa', fg: '#0e7490', dot: '#0e9bbf' },
  { bg: '#fef3c7', fg: '#92400e', dot: '#d97706' },
  { bg: '#ecfdf5', fg: '#065f46', dot: '#0f766e' },
];

/** Colores estables para cualquier área (texto libre). */
export function colorsDeArea(area: string): { bg: string; fg: string; dot: string } {
  if (!area || area === AREA_SIN_ASIGNAR) return { bg: '#eef1f5', fg: '#3a4a5e', dot: '#94a2b3' };
  if ((AREA_COLORS as Record<string, { bg: string; fg: string; dot: string }>)[area]) {
    return (AREA_COLORS as Record<string, { bg: string; fg: string; dot: string }>)[area];
  }
  let h = 0;
  const n = normalizarTexto(area);
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return PALETA_AREAS[h % PALETA_AREAS.length];
}

// Categorías de riesgo y su color
export const RIESGO_COLORS: Record<string, string> = {
  Físico: '#3b82f6',
  Químico: '#e08a2c',
  Mecánico: '#dc2e3c',
  Ergonómico: '#7c5cf2',
  Psicosocial: '#e3496a',
  Biológico: '#10a05a',
  Eléctrico: '#facc15',
};

// Matriz de riesgos por puesto (puede moverse a Firestore más adelante)
export const RIESGOS_POR_PUESTO: Record<string, string[]> = {
  'Mecánico industrial': [
    'Físico: ruido > 85 dB',
    'Ergonómico: posturas forzadas',
    'Mecánico: atrapamientos',
    'Químico: hidrocarburos',
  ],
  Soldador: [
    'Físico: radiación UV/IR',
    'Químico: humos metálicos',
    'Físico: ruido',
    'Eléctrico: bajo voltaje',
  ],
  'Conductor de tanquero': [
    'Psicosocial: jornadas largas',
    'Ergonómico: postura sedente',
    'Mecánico: accidentes viales',
    'Químico: GLP',
  ],
  'Médico ocupacional': [
    'Biológico: agentes infecciosos',
    'Psicosocial: carga emocional',
    'Ergonómico: postura sedente',
  ],
  'Operario de planta': [
    'Físico: ruido',
    'Químico: GLP',
    'Mecánico: maquinaria',
    'Ergonómico: cargas',
  ],
  'Operador de envasado': [
    'Físico: ruido',
    'Químico: GLP',
    'Ergonómico: movimientos repetitivos',
  ],
  'Operador de almacenamiento': ['Químico: GLP', 'Físico: ruido', 'Mecánico: caídas'],
  Electricista: ['Eléctrico: alta tensión', 'Mecánico: caídas', 'Físico: ruido'],
  'Técnico de mantenimiento': [
    'Mecánico: atrapamientos',
    'Ergonómico: posturas forzadas',
    'Físico: ruido',
  ],
  Despachador: ['Ergonómico: cargas', 'Químico: GLP', 'Mecánico: caídas'],
  Bodeguero: ['Ergonómico: cargas', 'Mecánico: caídas'],
  'Asistente de despacho': [
    'Ergonómico: postura sedente',
    'Psicosocial: atención al cliente',
  ],
};

// Normaliza texto para comparaciones: minúsculas y sin tildes/diacríticos.
export function normalizarTexto(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Palabras clave para clasificar puestos ingresados como texto libre.
// Se evalúan en orden: la primera área cuyo keyword aparezca en el puesto gana.
const KEYWORDS_AREA: Array<[Area, string[]]> = [
  ['Seguridad y Salud', ['medic', 'enfermer', 'paramedic', 'seguridad', 'salud ocupacional', 'sso', 'hse']],
  ['Mantenimiento', ['mecanic', 'soldad', 'electric', 'mantenimiento']],
  ['Logística', ['conduct', 'chofer', 'tanquero', 'despach', 'bodeg', 'logistic', 'transport', 'almacen']],
  ['Comercial', ['comercial', 'venta', 'vendedor', 'asesor', 'marketing', 'cobranza']],
  ['Administración', ['administra', 'contab', 'contad', 'rrhh', 'recursos humanos', 'talento', 'recepcion', 'secretar', 'gerent', 'financ', 'sistemas', 'asistente', 'analista', 'auxiliar']],
  ['Operaciones', ['opera', 'planta', 'envasad', 'supervis', 'produc', 'tecnic']],
];

// Derivar área a partir del puesto cuando el Trabajador no la tenga guardada
export function deriveAreaFromPuesto(puesto: string): Area {
  const p = normalizarTexto(puesto);
  // 1) Coincidencia exacta con el catálogo
  for (const area of AREAS) {
    if (PUESTOS_POR_AREA[area].some((x) => normalizarTexto(x) === p)) return area;
  }
  // 2) Coincidencia por palabra clave (puestos de texto libre)
  for (const [area, kws] of KEYWORDS_AREA) {
    if (kws.some((k) => p.includes(k))) return area;
  }
  return 'Operaciones';
}
