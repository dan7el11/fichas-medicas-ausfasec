// Validación de rangos de signos vitales — una sola fuente de verdad.
// Distingue dos niveles:
//   • 'error'  → valor fisiológicamente imposible (casi siempre error de tipeo,
//                ej. presión 999 o temperatura 500). Debe corregirse.
//   • 'alerta' → valor posible pero clínicamente notable (ej. fiebre, HTA).
// Los formularios la usan para avisar al médico antes de guardar.

export type NivelSigno = 'ok' | 'alerta' | 'error';

export interface ResultadoSigno {
  nivel: NivelSigno;
  mensaje?: string;
}

export type CampoSigno =
  | 'presionSistolica' | 'presionDiastolica' | 'frecuenciaCardiaca'
  | 'frecuenciaRespiratoria' | 'temperatura' | 'saturacion'
  | 'peso' | 'talla' | 'perimetroAbdominal' | 'glucosaCapilar';

interface ReglaSigno {
  min: number;   // por debajo o por encima de [min, max] = valor imposible
  max: number;
  unidad: string;
  alerta?: (v: number) => string | undefined; // evaluación clínica opcional
}

const REGLAS: Record<CampoSigno, ReglaSigno> = {
  presionSistolica:       { min: 50, max: 300, unidad: 'mmHg', alerta: (v) => v >= 140 ? 'Sistólica alta (≥140)' : v < 90 ? 'Sistólica baja (<90)' : undefined },
  presionDiastolica:      { min: 30, max: 200, unidad: 'mmHg', alerta: (v) => v >= 90 ? 'Diastólica alta (≥90)' : v < 60 ? 'Diastólica baja (<60)' : undefined },
  frecuenciaCardiaca:     { min: 25, max: 250, unidad: 'lpm',  alerta: (v) => v > 100 ? 'Taquicardia (>100)' : v < 60 ? 'Bradicardia (<60)' : undefined },
  frecuenciaRespiratoria: { min: 5,  max: 70,  unidad: 'rpm',  alerta: (v) => v > 20 ? 'Taquipnea (>20)' : v < 12 ? 'Bradipnea (<12)' : undefined },
  temperatura:            { min: 30, max: 45,  unidad: '°C',   alerta: (v) => v >= 38 ? 'Fiebre (≥38)' : v < 35 ? 'Hipotermia (<35)' : undefined },
  saturacion:             { min: 50, max: 100, unidad: '%',    alerta: (v) => v < 94 ? 'Saturación baja (<94%)' : undefined },
  peso:                   { min: 1,  max: 500, unidad: 'kg' },
  talla:                  { min: 30, max: 260, unidad: 'cm' },
  perimetroAbdominal:     { min: 20, max: 250, unidad: 'cm' },
  glucosaCapilar:         { min: 10, max: 900, unidad: 'mg/dL', alerta: (v) => v < 70 ? 'Hipoglucemia (<70)' : v >= 200 ? 'Glucosa alta (≥200)' : undefined },
};

/** Valida un signo. Un valor vacío se considera 'ok' (no se exige llenarlo aquí). */
export function validarSigno(campo: CampoSigno, valor: string | number | undefined | null): ResultadoSigno {
  if (valor === '' || valor === null || valor === undefined) return { nivel: 'ok' };
  const v = typeof valor === 'number' ? valor : parseFloat(String(valor).trim().replace(',', '.'));
  if (Number.isNaN(v)) return { nivel: 'error', mensaje: 'Valor no numérico' };
  const regla = REGLAS[campo];
  if (v < regla.min || v > regla.max) {
    return { nivel: 'error', mensaje: `Fuera de rango (${regla.min}–${regla.max} ${regla.unidad})` };
  }
  const alerta = regla.alerta?.(v);
  return alerta ? { nivel: 'alerta', mensaje: alerta } : { nivel: 'ok' };
}

/** Coherencia entre sistólica y diastólica (la diastólica no puede ser ≥ sistólica). */
export function validarPresion(sist: string | number | undefined, diast: string | number | undefined): ResultadoSigno {
  const s = parseFloat(String(sist ?? ''));
  const d = parseFloat(String(diast ?? ''));
  if (!Number.isNaN(s) && !Number.isNaN(d) && s > 0 && d > 0 && d >= s) {
    return { nivel: 'error', mensaje: 'La diastólica no puede ser mayor o igual que la sistólica' };
  }
  return { nivel: 'ok' };
}

export interface ResumenSignos {
  errores: { campo: CampoSigno; mensaje: string }[];
  alertas: { campo: CampoSigno; mensaje: string }[];
  hayError: boolean;
}

/** Revisa todos los signos de un formulario de una vez. */
export function validarSignosVitales(sv: Partial<Record<CampoSigno, string | number>>): ResumenSignos {
  const errores: { campo: CampoSigno; mensaje: string }[] = [];
  const alertas: { campo: CampoSigno; mensaje: string }[] = [];
  (Object.keys(REGLAS) as CampoSigno[]).forEach((campo) => {
    const r = validarSigno(campo, sv[campo]);
    if (r.nivel === 'error') errores.push({ campo, mensaje: r.mensaje! });
    else if (r.nivel === 'alerta') alertas.push({ campo, mensaje: r.mensaje! });
  });
  const pa = validarPresion(sv.presionSistolica, sv.presionDiastolica);
  if (pa.nivel === 'error') errores.push({ campo: 'presionDiastolica', mensaje: pa.mensaje! });
  return { errores, alertas, hayError: errores.length > 0 };
}
