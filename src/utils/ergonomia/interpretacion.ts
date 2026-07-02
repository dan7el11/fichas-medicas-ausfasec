// Párrafos explicativos para el informe PDF: qué mide el método, cómo se lee
// la escala y qué significa el resultado obtenido. Función pura (con pruebas).
import type { EvaluacionErgonomica } from '../../types/ergonomia';

const INTRO: Record<string, string> = {
  RULA: 'RULA (Rapid Upper Limb Assessment) evalúa la carga postural del miembro superior a partir de la posición de brazo, antebrazo y muñeca (grupo A) y de cuello, tronco y piernas (grupo B), considerando además el uso muscular y la carga manejada. La puntuación final va de 1 a 7: a mayor valor, mayor riesgo de trastorno musculoesquelético y mayor urgencia de intervenir.',
  REBA: 'REBA (Rapid Entire Body Assessment) evalúa la carga postural de cuerpo entero combinando tronco, cuello y piernas (grupo A) con brazo, antebrazo y muñeca (grupo B), más la carga manejada, la calidad del agarre y el tipo de actividad. La puntuación final va de 1 a 15: valores de 8 o más indican riesgo alto y necesidad de intervención pronta.',
  NIOSH: 'La ecuación NIOSH de levantamiento calcula el Peso Límite Recomendado (RWL): la carga que la mayoría de trabajadores sanos puede levantar sin riesgo aumentado de lumbalgia, según la geometría del levantamiento (distancias, alturas, asimetría), su frecuencia, duración y la calidad del agarre. El Índice de Levantamiento (LI) es el cociente entre el peso real y el RWL: valores hasta 1 son aceptables, entre 1 y 3 indican riesgo creciente, y sobre 3 riesgo alto.',
  ROSA: 'ROSA (Rapid Office Strain Assessment) evalúa el puesto de trabajo de oficina: la silla (altura del asiento, profundidad, reposabrazos y respaldo), el monitor, el teléfono, el ratón y el teclado, ponderando cada elemento por su tiempo de uso diario. La puntuación final va de 1 a 10: valores de 5 o más indican que el puesto requiere intervención.',
};

/** Construye los párrafos de interpretación del resultado para el PDF. */
export function parrafosInterpretacion(ev: EvaluacionErgonomica): string[] {
  const r = ev.resultado;
  const d = r.detalle ?? {};
  const parrafos: string[] = [INTRO[ev.metodo] ?? ''];

  if (ev.metodo === 'ROSA') {
    parrafos.push(
      `En esta evaluación la puntuación final ROSA es ${r.puntajeFinal} (${r.nivel.toLowerCase()}). ` +
      `Proviene de combinar la silla (puntaje ${d.silla}) con los periféricos y la pantalla (puntaje ${d.perifericos}), ` +
      `donde monitor y teléfono obtuvieron ${d.monitorTelefono} y ratón y teclado ${d.ratonTeclado}. ` +
      `El método toma como resultado el componente más desfavorable del puesto.`,
    );
    const dominante = (d.silla ?? 0) >= (d.perifericos ?? 0)
      ? 'la silla (revise altura, profundidad, reposabrazos, respaldo y el tiempo sentado)'
      : (d.monitorTelefono ?? 0) >= (d.ratonTeclado ?? 0)
        ? 'el monitor y el teléfono (revise altura y distancia de la pantalla, reflejos y el uso del teléfono)'
        : 'el ratón y el teclado (revise la alineación del ratón y la postura de las muñecas al teclear)';
    parrafos.push(`El componente que más aporta al riesgo es ${dominante}. ${r.accion}`);
  } else if (ev.metodo === 'NIOSH') {
    parrafos.push(
      `Para la tarea evaluada, el peso límite recomendado (RWL) es ${d.RWL} kg y la carga real levantada es ${ev.entradas.pesoCarga} kg, ` +
      `lo que da un índice de levantamiento (LI) de ${r.puntajeFinal} (${r.nivel.toLowerCase()}). ${r.accion}`,
    );
    parrafos.push(
      'Para reducir el LI conviene actuar sobre el multiplicador más castigado: acercar la carga al cuerpo (horizontal), ' +
      'evitar orígenes muy bajos o muy altos (vertical), reducir el recorrido, eliminar giros de tronco (asimetría), ' +
      'bajar la frecuencia o mejorar el agarre.',
    );
  } else {
    // RULA / REBA
    parrafos.push(
      `En esta evaluación la puntuación final ${ev.metodo} es ${r.puntajeFinal} (${r.nivel.toLowerCase()}). ` +
      `Los puntajes intermedios fueron: grupo A ${d.puntajeA} y grupo B ${d.puntajeB}` +
      (d.puntajeC !== undefined ? `, con puntaje C de ${d.puntajeC}. ` : '. ') +
      `${r.accion}`,
    );
    parrafos.push(
      (d.puntajeA ?? 0) >= (d.puntajeB ?? 0)
        ? (ev.metodo === 'RULA'
          ? 'El mayor aporte al riesgo proviene del grupo A (brazo, antebrazo y muñeca): priorice reducir la elevación del brazo, la desviación de la muñeca y la carga o repetitividad de la tarea.'
          : 'El mayor aporte al riesgo proviene del grupo A (tronco, cuello y piernas): priorice reducir la flexión o torsión del tronco y mejorar el apoyo de las piernas.')
        : (ev.metodo === 'RULA'
          ? 'El mayor aporte al riesgo proviene del grupo B (cuello, tronco y piernas): priorice corregir la posición del cuello y del tronco durante la tarea.'
          : 'El mayor aporte al riesgo proviene del grupo B (brazo, antebrazo y muñeca): priorice reducir la elevación del brazo y la desviación de la muñeca, y mejorar el agarre.'),
    );
  }

  if (ev.fotos?.length) {
    parrafos.push(
      `Se adjuntan ${ev.fotos.length === 1 ? '1 fotografía anotada' : `${ev.fotos.length} fotografías anotadas`} con las mediciones de ángulos realizadas sobre el puesto, que respaldan las puntuaciones asignadas. ` +
      'Las mediciones sobre fotografía son bidimensionales: su precisión depende de que la cámara esté perpendicular al plano del movimiento.',
    );
  }

  return parrafos.filter(Boolean);
}
