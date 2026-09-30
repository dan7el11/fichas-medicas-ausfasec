// CAMBIO DE CARGO — qué implica para el perfil de riesgo y las recomendaciones.
//
// Cuando un trabajador se mueve de puesto, su exposición cambia: otras
// actividades en la jornada, otros factores de riesgo marcados y otras medidas
// preventivas. Este módulo compara los dos perfiles y arma los datos que hay
// que dejar en la evaluación, sin tocar Firestore (eso es del servicio).
import type { PerfilRiesgoCargo } from '../types/perfilRiesgo';
import { MAX_ACTIVIDADES } from '../constants/funcionesCargo';
import { medidaCompleta } from '../constants/medidasPreventivas';
import { OPCIONES_RECOMENDACIONES, categoriasDesdeMatriz } from './catalogosEvaluacion';
import { textosActividades } from './resumenFuncion';

export interface ComparacionPerfiles {
  /** Factores que aparecen con el cargo nuevo y no estaban. */
  factoresNuevos: string[];
  /** Factores que dejan de aplicar. */
  factoresQueSalen: string[];
  /** Factores presentes en ambos. */
  factoresQueSiguen: string[];
  /** Medidas preventivas que se suman. */
  medidasNuevas: string[];
  /** Medidas que dejan de aplicar. */
  medidasQueSalen: string[];
  actividadesAnteriores: number;
  actividadesNuevas: number;
  /** true si no hay ninguna diferencia de exposición. */
  sinCambios: boolean;
}

const ordenar = (xs: Iterable<string>) => [...new Set(xs)].sort((a, b) => a.localeCompare(b, 'es'));

/** Todas las medidas de un perfil, sin repetir. */
export const medidasDePerfil = (perfil: PerfilRiesgoCargo | null): string[] =>
  ordenar((perfil?.medidasActividades ?? []).flat());

/** Todos los factores marcados de un perfil. */
export const factoresDePerfil = (perfil: PerfilRiesgoCargo | null): string[] =>
  ordenar(Object.keys(perfil?.riesgoActividades ?? {}));

/** Qué cambia al pasar de un cargo a otro. */
export function compararPerfiles(
  anterior: PerfilRiesgoCargo | null,
  nuevo: PerfilRiesgoCargo | null,
): ComparacionPerfiles {
  const fAnt = new Set(factoresDePerfil(anterior));
  const fNue = new Set(factoresDePerfil(nuevo));
  const mAnt = new Set(medidasDePerfil(anterior));
  const mNue = new Set(medidasDePerfil(nuevo));

  const factoresNuevos = ordenar([...fNue].filter(f => !fAnt.has(f)));
  const factoresQueSalen = ordenar([...fAnt].filter(f => !fNue.has(f)));
  const factoresQueSiguen = ordenar([...fNue].filter(f => fAnt.has(f)));
  const medidasNuevas = ordenar([...mNue].filter(m => !mAnt.has(m)));
  const medidasQueSalen = ordenar([...mAnt].filter(m => !mNue.has(m)));

  return {
    factoresNuevos, factoresQueSalen, factoresQueSiguen,
    medidasNuevas, medidasQueSalen,
    actividadesAnteriores: anterior?.actividades.length ?? 0,
    actividadesNuevas: nuevo?.actividades.length ?? 0,
    sinCambios: factoresNuevos.length === 0 && factoresQueSalen.length === 0
      && medidasNuevas.length === 0 && medidasQueSalen.length === 0,
  };
}

/**
 * Sección G de una evaluación según un perfil de cargo: actividades de la
 * jornada, matriz riesgo × actividad y medidas preventivas al pie.
 *
 * `factoresPrevios` conserva los arreglos por categoría que usan los formatos
 * antiguos, para no dejar esos campos inconsistentes.
 */
export function factoresRiesgoDesdePerfil(
  perfil: PerfilRiesgoCargo,
  factoresPrevios: any = {},
): Record<string, any> {
  const actividades = perfil.actividades.slice(0, MAX_ACTIVIDADES);
  const resumen = textosActividades(perfil.actividades, perfil.actividadesResumen).slice(0, MAX_ACTIVIDADES);

  // Solo las marcas que caen en las columnas que existen.
  const riesgoActividades: Record<string, number[]> = {};
  Object.entries(perfil.riesgoActividades).forEach(([factor, idxs]) => {
    const dentro = idxs.filter(i => i < actividades.length);
    if (dentro.length) riesgoActividades[factor] = dentro;
  });

  // Arreglos por categoría, derivados de la matriz (los leen los informes).
  const medidas = (perfil.medidasActividades ?? []).slice(0, actividades.length).map(m => m.join('; '));

  return {
    ...factoresPrevios,
    ...categoriasDesdeMatriz(riesgoActividades),
    puestoArea: perfil.cargo,
    actividadesJornada: actividades,
    actividadesResumen: resumen,
    riesgoActividades,
    medidasActividades: medidas,
    // Respaldo en texto plano para informes y formatos antiguos.
    actividades: actividades.join('; '),
    medidasPreventivas: medidas.filter(Boolean).join(' · '),
  };
}

/**
 * Reglas para proponer las recomendaciones del formulario a partir de las
 * medidas del perfil. Cada regla se apoya en lo que la propia medida dice, no
 * en una equivalencia inventada; el médico puede ajustarlas después.
 */
const REGLAS_RECOMENDACION: { patron: RegExp; recomendaciones: string[] }[] = [
  { patron: /ergonom/i, recomendaciones: ['Ergonomía laboral', 'Higiene postural'] },
  { patron: /pausas activas/i, recomendaciones: ['Pausas activas frecuentes'] },
  { patron: /\bEPP\b|protección personal/i, recomendaciones: ['Uso de EPP'] },
  { patron: /audiometr|ruido/i, recomendaciones: ['Protección auditiva'] },
  { patron: /oftalmológ|visual|PVD/i, recomendaciones: ['Protección visual'] },
  { patron: /manipulación (manual )?de cargas|musculoesquelétic|lumbar|hombro/i, recomendaciones: ['Evitar sobreesfuerzos'] },
  { patron: /hidratación/i, recomendaciones: ['Hidratación adecuada'] },
  { patron: /sueño|jornada/i, recomendaciones: ['Descanso adecuado'] },
  { patron: /cardiometabólic|metabólic/i, recomendaciones: ['Dieta balanceada', 'Actividad física diaria'] },
  { patron: /vigilancia|tamizaje|valoración|espirometr|control/i, recomendaciones: ['Control médico periódico'] },
];

export interface RecomendacionesSugeridas {
  /** Opciones marcables del formulario (Sección M). */
  recomendaciones: string[];
  /** Redacción clínica de las medidas del perfil, para el campo de texto. */
  recomendacionesOtras: string;
}

/**
 * Recomendaciones que se desprenden de las medidas preventivas del cargo.
 *
 * Las opciones marcables salen de las reglas de arriba; el texto libre lleva la
 * redacción clínica completa de cada medida, que es el contenido con sustancia.
 */
export function recomendacionesDesdeMedidas(medidas: string[]): RecomendacionesSugeridas {
  const marcadas = new Set<string>();
  const etiquetas = ordenar(medidas);

  etiquetas.forEach(etiqueta => {
    const texto = `${etiqueta} ${medidaCompleta(etiqueta)}`;
    REGLAS_RECOMENDACION.forEach(({ patron, recomendaciones }) => {
      if (patron.test(texto)) recomendaciones.forEach(r => marcadas.add(r));
    });
  });

  return {
    // Se respeta el orden del catálogo del formulario.
    recomendaciones: OPCIONES_RECOMENDACIONES.filter(o => marcadas.has(o)),
    recomendacionesOtras: etiquetas.map(e => medidaCompleta(e)).join(' '),
  };
}

/** Un cambio de cargo registrado en la ficha del trabajador. */
export interface CambioCargo {
  cargoAnterior: string;
  cargoNuevo: string;
  departamentoAnterior?: string;
  departamentoNuevo?: string;
  motivo?: string;
  /** Nº de evaluaciones cuyo perfil se actualizó junto con el cambio. */
  evaluacionesActualizadas?: number;
  fecha: any;
  usuarioId: string;
}
