// 1. EL GRAN DICCIONARIO DE COLORES (TODOS EN UNO SOLO)
export const TONE = {
  // Marca Austrogas
  brand:     '#9a3036',   
  brandSoft: '#f4e8e9',

  // Semánticos
  ok:        '#0a6b3b',
  okBg:      '#e6f6ee',
  warn:      '#8a4a0a',
  warnBg:    '#fff4e3',
  bad:       '#a01f2a',
  badBg:     '#fce8eb',

  // Colores Nuevos
  cyan:      '#0891b2',
  cyanBg:    '#cffafe',
  blue:      '#2563eb',
  blueBg:    '#dbeafe',
  violet:    '#7c3aed',
  violetBg:  '#ede9fe',
  green:     '#0a6b3b',
  greenBg:   '#e6f6ee',

  // Neutros de la interfaz
  bg:        '#f5f7fa',
  panel:     '#ffffff',
  line:      '#e5e9ef',
  ink:       '#1a2332',
  muted:     '#4a5568',
  faint:     '#8a97a8',
} as const;

// 2. CREAMOS "CLONES" PARA QUE NINGÚN COMPONENTE LLORE
export const COLORS = TONE;
export const theme = TONE;

// 3. LAS FUENTES INTACTAS
export const FONTS = {
  sans:  "'Public Sans', system-ui, sans-serif",
  serif: "'Spectral', Georgia, 'Times New Roman', serif",
  mono:  "'JetBrains Mono', ui-monospace, monospace",
} as const;
