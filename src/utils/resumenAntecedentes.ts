// Resumen en UNA LÍNEA de los antecedentes personales.
//
// El formato unificado (HCU-form.123/2025) imprime los antecedentes clínicos,
// quirúrgicos y las alergias en un ÚNICO recuadro de texto. La captura, en
// cambio, se hace como antes: Sí/No por separado y, si es Sí, el detalle
// completo de cada antecedente. Estas funciones convierten ese detalle en la
// frase que va al recuadro (y a la ficha del trabajador).
import type { AntecedenteClinico, AntecedenteQuirurgico, Alergia } from '../types';

/** Texto cuando el paciente no refiere nada en ninguno de los tres bloques. */
export const TEXTO_SIN_ANTECEDENTES =
  'Paciente no refiere antecedentes clínicos, alergias ni quirúrgicos.';

const limpio = (s?: string) => (s ?? '').trim();

/**
 * Antepone la preposición correcta al tiempo de evolución:
 *  - «6 años»      → «desde hace 6 años»
 *  - «2018»        → «desde 2018»
 *  - «desde 2018»  → «desde 2018» (ya viene con preposición)
 */
export function fraseTiempo(desdeCuando?: string): string {
  const t = limpio(desdeCuando);
  if (!t) return '';
  if (/^(desde|hace)\b/i.test(t)) return t.toLowerCase().startsWith('hace') ? `desde ${t}` : t;
  if (/^\d{4}$/.test(t)) return `desde ${t}`;
  return `desde hace ${t}`;
}

/** «HTA desde hace 6 años, en tratamiento con Losartán 50 mg cada día, con buena adherencia» */
export function fraseClinico(a: AntecedenteClinico): string {
  const partes: string[] = [];
  const enfermedad = limpio(a.enfermedad);
  if (!enfermedad) return '';
  const tiempo = fraseTiempo(a.desdeCuando);
  partes.push(tiempo ? `${enfermedad} ${tiempo}` : enfermedad);

  if (a.tomaMedicacion) {
    const med = [limpio(a.medicacionNombre), limpio(a.medicacionDosis), limpio(a.medicacionFrecuencia)]
      .filter(Boolean).join(' ');
    partes.push(med ? `en tratamiento con ${med}` : 'en tratamiento farmacológico');
    const adh = limpio((a as any).adherencia);
    if (adh) partes.push(`con ${adh} adherencia`);
  } else {
    partes.push('sin tratamiento farmacológico');
  }

  if (a.seguimientoEspecialista) {
    const esp = limpio(a.especialista);
    partes.push(esp ? `en seguimiento por ${esp}` : 'en seguimiento por especialista');
  }
  const comp = limpio(a.complicaciones);
  if (comp && !/^(ninguna|no|sin)\b/i.test(comp)) partes.push(`complicaciones: ${comp}`);

  return partes.join(', ');
}

/** «Apendicectomía (2019), sin complicaciones, recuperación completa» */
export function fraseQuirurgico(a: AntecedenteQuirurgico): string {
  const proc = limpio(a.procedimiento);
  if (!proc) return '';
  const partes: string[] = [];
  const fecha = limpio(a.fechaAproximada);
  partes.push(fecha ? `${proc} (${fecha})` : proc);

  const comp = limpio(a.complicaciones);
  partes.push(comp && !/^(ninguna|no|sin)\b/i.test(comp) ? `con complicaciones: ${comp}` : 'sin complicaciones');

  if (a.recuperacionCompleta) partes.push('recuperación completa');
  else {
    const sec = limpio(a.secuelas);
    partes.push(sec ? `con secuelas: ${sec}` : 'sin recuperación completa');
  }
  return partes.join(', ');
}

/** «Alergia a penicilina (severa): urticaria, tratada con antihistamínico» */
export function fraseAlergia(a: Alergia): string {
  const alergeno = limpio(a.alergeno);
  if (!alergeno) return '';
  const intensidad = limpio(a.intensidadReaccion);
  const partes: string[] = [`Alergia a ${alergeno}${intensidad ? ` (${intensidad})` : ''}`];
  const sintomas = limpio(a.sintomas);
  if (sintomas) partes.push(sintomas);
  const tto = limpio(a.tratamientoHabitual);
  if (tto && !/^(ninguno|no|sin)\b/i.test(tto)) partes.push(`tratada con ${tto}`);
  return partes.join(', ');
}

export interface AntecedentesEstructurados {
  clinicosQ?: boolean | null;
  clinicos?: AntecedenteClinico[];
  quirurgicosQ?: boolean | null;
  quirurgicos?: AntecedenteQuirurgico[];
  alergiasQ?: boolean | null;
  alergias?: Alergia[];
}

/**
 * Construye el texto del recuadro «ANTECEDENTES CLÍNICOS Y QUIRÚRGICOS».
 *
 * - Si los tres bloques están marcados en NO → texto genérico.
 * - Si hay detalle → una frase por antecedente, separadas por «; ».
 * - Si no se marcó nada y no hay detalle → cadena vacía (el llamador decide
 *   si conserva un texto escrito a mano).
 */
export function resumirAntecedentes(x: AntecedentesEstructurados): string {
  const frases: string[] = [];

  if (x.clinicosQ === true) frases.push(...(x.clinicos ?? []).map(fraseClinico).filter(Boolean));
  if (x.alergiasQ === true) frases.push(...(x.alergias ?? []).map(fraseAlergia).filter(Boolean));
  if (x.quirurgicosQ === true) frases.push(...(x.quirurgicos ?? []).map(fraseQuirurgico).filter(Boolean));

  if (frases.length) {
    // Los bloques respondidos «No» se hacen explícitos para que el recuadro
    // no deje dudas sobre lo que se preguntó.
    const negados: string[] = [];
    if (x.clinicosQ === false) negados.push('clínicos');
    if (x.alergiasQ === false) negados.push('alergias');
    if (x.quirurgicosQ === false) negados.push('quirúrgicos');
    if (negados.length) frases.push(`no refiere antecedentes ${negados.join(' ni ')}`);
    return `${frases.join('; ')}.`;
  }

  const respondidos = [x.clinicosQ, x.quirurgicosQ, x.alergiasQ].filter(v => v != null);
  if (respondidos.length > 0 && respondidos.every(v => v === false)) return TEXTO_SIN_ANTECEDENTES;
  return '';
}
