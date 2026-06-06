// 1. EL GRAN DICCIONARIO DE COLORES BÁSICOS
export const COLORS = {
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
} as const;

export const theme = {
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

  // 🚑 SUTURAS DE EMERGENCIA: Agregamos los nombres que busca el compilador
  info:      '#2563eb',
  danger:    '#a01f2a',
  success:   '#0a6b3b',
  warning:   '#8a4a0a',
} as const;

// 2. UNIFICAMOS TODO Y AÑADIMOS COMPATIBILIDAD CON OBJETOS { bg, fg }
export const TONE = {
  ...COLORS,
  ...theme,
  // Algunos de tus componentes esperan que TONE.blue sea un objeto {bg, fg} en vez de un texto
  // Por si acaso, proveemos estas versiones compatibles:
  blueObj: { bg: theme.blueBg, fg: theme.blue },
  cyanObj: { bg: theme.cyanBg, fg: theme.cyan },
  greenObj: { bg: theme.greenBg, fg: theme.green },
  violetObj: { bg: theme.violetBg, fg: theme.violet },
  dangerObj: { bg: COLORS.badBg, fg: COLORS.bad },
  warningObj: { bg: COLORS.warnBg, fg: COLORS.warn },
  successObj: { bg: COLORS.okBg, fg: COLORS.ok },
  infoObj: { bg: theme.blueBg, fg: theme.blue },
} as const;

// 3. LAS FUENTES INTACTAS
export const FONTS = {
  sans:  "'Public Sans', system-ui, sans-serif",
  serif: "'Spectral', Georgia, 'Times New Roman', serif",
  mono:  "'JetBrains Mono', ui-monospace, monospace",
} as const;
