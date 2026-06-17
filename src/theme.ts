// Tokens de diseño globales del sistema de fichas médicas.
// Importar como: import { COLORS, FONTS } from '../theme';

export const COLORS = {
  // Marca (color institucional por defecto)
  brand:   '#9a3036',   // vino/ladrillo
  brandSoft: '#f4e8e9',

  // Semánticos
  ok:      '#0a6b3b',
  okBg:    '#e6f6ee',
  warn:    '#8a4a0a',
  warnBg:  '#fff4e3',
  bad:     '#a01f2a',
  badBg:   '#fce8eb',

  // Verde (módulo Inicio / Trabajadores)
  green:   '#0a6b3b',
  greenBg: '#e6f6ee',

  // Azul
  blue:    '#2563eb',
  blueBg:  '#dbeafe',

  // Cian (Exámenes)
  cyan:    '#0891b2',
  cyanBg:  '#cffafe',

  // Violeta (Permisos)
  violet:  '#7c3aed',
  violetBg: '#ede9fe',

  // Neutros
  bg:      '#f5f7fa',
  panel:   '#ffffff',
  line:    '#e5e9ef',
  ink:     '#1a2332',
  muted:   '#4a5568',
  faint:   '#8a97a8',
} as const;

export const FONTS = {
  sans:  "'Public Sans', system-ui, sans-serif",
  serif: "'Spectral', Georgia, 'Times New Roman', serif",
  mono:  "'JetBrains Mono', ui-monospace, monospace",
} as const;

// Mapa de tonos semánticos con bg/fg. Usar en vez de indexar COLORS dinámicamente.
export const TONE = {
  success: { fg: '#0a6b3b', bg: '#e6f6ee' },
  warning: { fg: '#8a4a0a', bg: '#fff4e3' },
  danger:  { fg: '#a01f2a', bg: '#fce8eb' },
  info:    { fg: '#0891b2', bg: '#cffafe' },
  blue:    { fg: '#2563eb', bg: '#dbeafe' },
  violet:  { fg: '#7c3aed', bg: '#ede9fe' },
  muted:   { fg: '#4a5568', bg: '#f5f7fa' },
} as const;
