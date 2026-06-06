// Tema central del sistema — CEM AUSTROGAS. Archivo NUEVO: src/theme.ts
// Tokens compartidos por todos los módulos para una estética coherente.
// Importa lo que necesites:  import { COLORS, FONTS, moduleAccent } from '../theme';

export const COLORS = {
  // Marca
  brand: '#9a3036',        // rojo AUSTROGAS atenuado (vino/ladrillo)
  brandDeep: '#742227',
  brandSoft: '#f4e8e9',

  // Neutros (fríos, no crema)
  ink: '#20242b',          // texto principal
  muted: '#646b75',        // texto secundario
  faint: '#98a0ab',        // texto terciario / labels
  line: '#e4e6ea',         // bordes
  bg: '#eef0f3',           // fondo de página
  panel: '#ffffff',        // fondo de tarjeta
  hover: '#faf7f8',        // hover de filas

  // Semánticos
  ok: '#1f7a4d', okBg: '#e7f3ec',
  warn: '#9a5b12', warnBg: '#f8eddc',
  bad: '#a3142a', badBg: '#f9e6e8',

  // Acentos por módulo
  blue: '#2a4d8f', blueBg: '#eaf0f9',     // Consulta
  violet: '#6b4ba3', violetBg: '#efeaf6', // Permisos
  cyan: '#0e6b7c', cyanBg: '#e3f0f2',     // Exámenes
  green: '#1f7a4d', greenBg: '#e7f3ec',   // Reportes
} as const;

export const FONTS = {
  sans: "'Public Sans', system-ui, sans-serif",
  serif: "'Spectral', Georgia, 'Times New Roman', serif",  // títulos
  mono: "'JetBrains Mono', ui-monospace, monospace",        // datos / números
} as const;

// Acento + fondo suave por módulo
export type ModuleKey = 'consulta' | 'permisos' | 'examenes' | 'reportes' | 'brand';
export function moduleAccent(key: ModuleKey): { fg: string; bg: string } {
  switch (key) {
    case 'consulta': return { fg: COLORS.blue, bg: COLORS.blueBg };
    case 'permisos': return { fg: COLORS.violet, bg: COLORS.violetBg };
    case 'examenes': return { fg: COLORS.cyan, bg: COLORS.cyanBg };
    case 'reportes': return { fg: COLORS.green, bg: COLORS.greenBg };
    default: return { fg: COLORS.brand, bg: COLORS.brandSoft };
  }
}

// Tonos semánticos para chips de estado
export const TONE: Record<'success' | 'warning' | 'danger' | 'info' | 'muted', { fg: string; bg: string; bar: string }> = {
  success: { fg: COLORS.ok, bg: COLORS.okBg, bar: '#2a9d63' },
  warning: { fg: COLORS.warn, bg: COLORS.warnBg, bar: '#c47d1f' },
  danger: { fg: COLORS.bad, bg: COLORS.badBg, bar: '#c4283e' },
  info: { fg: COLORS.blue, bg: COLORS.blueBg, bar: '#3a63ad' },
  muted: { fg: COLORS.muted, bg: '#eef0f3', bar: COLORS.faint },
};
