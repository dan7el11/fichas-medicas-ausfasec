// Párrafos explicativos para el informe PDF: qué mide el método, cómo se lee
// la escala, qué significa el resultado, qué parámetros resultaron
// desfavorables y qué se recomienda. Función pura (con pruebas).
import type { EvaluacionErgonomica } from '../../types/ergonomia';
import { METODOS } from './definiciones';

export const INTRO_METODO: Record<string, string> = {
  RULA: 'RULA (Rapid Upper Limb Assessment; McAtamney y Corlett, 1993) evalúa la carga postural del miembro superior a partir de la posición de brazo, antebrazo y muñeca (grupo A) y de cuello, tronco y piernas (grupo B), considerando además el uso muscular (posturas estáticas o acciones repetidas) y la carga o fuerza manejada. Cada segmento recibe una puntuación según el rango articular observado; las puntuaciones se combinan mediante las tablas del método hasta una puntuación final de 1 a 7. A mayor valor, mayor riesgo de trastorno musculoesquelético y mayor urgencia de actuación: 1–2 postura aceptable; 3–4 pueden requerirse cambios; 5–6 se requieren cambios pronto; 7 se requieren cambios inmediatos.',
  REBA: 'REBA (Rapid Entire Body Assessment; Hignett y McAtamney, 2000) evalúa la carga postural de cuerpo entero combinando tronco, cuello y piernas (grupo A) con brazo, antebrazo y muñeca (grupo B), e incorpora la carga manejada, la calidad del agarre y el tipo de actividad muscular (estática, repetitiva o con cambios bruscos). La puntuación final va de 1 a 15 y se interpreta por niveles de acción: 1 riesgo insignificante; 2–3 riesgo bajo; 4–7 riesgo medio (es necesaria la intervención); 8–10 riesgo alto (intervención pronta); 11–15 riesgo muy alto (intervención inmediata).',
  NIOSH: 'La ecuación NIOSH de levantamiento (Waters, Putz-Anderson y Garg, 1994) calcula el Peso Límite Recomendado (RWL): la carga que la mayoría de trabajadores sanos puede levantar durante la jornada sin riesgo aumentado de lumbalgia. El RWL parte de una constante de 23 kg en condiciones ideales y se reduce mediante seis multiplicadores según la geometría del levantamiento (distancia horizontal, altura de origen, recorrido vertical y asimetría), su frecuencia y duración, y la calidad del agarre. El Índice de Levantamiento (LI) es el cociente entre el peso realmente levantado y el RWL: hasta 1 la tarea es aceptable; entre 1 y 3 el riesgo aumenta y la tarea debe rediseñarse; sobre 3 el riesgo es alto para la mayoría de los trabajadores.',
  ROSA: 'ROSA (Rapid Office Strain Assessment; Sonne, Villalta y Andrews, 2012) evalúa los factores de riesgo del puesto de trabajo de oficina. Valora la silla en cuatro aspectos (altura del asiento, profundidad del asiento, reposabrazos y respaldo), la pantalla y el teléfono, y el ratón y el teclado; cada elemento se pondera por su tiempo de uso diario, de modo que un elemento deficiente pero poco usado pesa menos que uno deficiente de uso prolongado. Las puntuaciones se combinan mediante las tablas del método y el resultado final es el componente más desfavorable del puesto, en una escala de 1 a 10: puntuaciones de 5 o más indican que el puesto requiere intervención ergonómica.',
};

// Etiquetas legibles de los puntajes intermedios (resultado.detalle)
export const DETALLE_LABEL: Record<string, string> = {
  posturaA: 'Postura grupo A', puntajeA: 'Puntaje grupo A',
  posturaB: 'Postura grupo B', puntajeB: 'Puntaje grupo B', puntajeC: 'Puntaje C',
  RWL: 'Peso límite recomendado — RWL (kg)', LI: 'Índice de levantamiento (LI)',
  HM: 'Multiplicador horizontal (HM)', VM: 'Multiplicador vertical (VM)',
  DM: 'Multiplicador de desplazamiento (DM)', AM: 'Multiplicador de asimetría (AM)',
  FM: 'Multiplicador de frecuencia (FM)', CM: 'Multiplicador de agarre (CM)',
  silla: 'Puntaje silla', monitorTelefono: 'Monitor y teléfono',
  ratonTeclado: 'Ratón y teclado', perifericos: 'Periféricos y pantalla',
};

// Recomendaciones tipo por componente ROSA (se emiten para los componentes con
// puntuación desfavorable).
const RECOMENDACIONES_ROSA: Record<string, string> = {
  silla: 'Silla: ajustar la altura para que las rodillas queden a ~90° con los pies apoyados; regular la profundidad dejando ~8 cm entre el borde del asiento y la corva; situar los reposabrazos de modo que los codos descansen con los hombros relajados; usar el respaldo con apoyo lumbar y reclinación entre 95° y 110°; y pautar pausas activas si se permanece sentado más de 1 hora seguida.',
  monitorTelefono: 'Pantalla y teléfono: colocar el monitor a distancia de un brazo (40–75 cm) con el borde superior a la altura de los ojos y de frente (sin giro de cuello); controlar brillos y reflejos reubicando la pantalla o con cortinas; usar porta-documentos si se transcribe; y preferir auriculares o manos libres si el teléfono se usa de forma prolongada, evitando sujetarlo entre el cuello y el hombro.',
  ratonTeclado: 'Ratón y teclado: situar el ratón junto al teclado y alineado con el hombro, sobre la misma superficie; usar un ratón de tamaño adecuado (evitar el agarre en pinza); mantener las muñecas rectas al teclear con los hombros relajados (plataforma o altura de mesa regulable si es necesario); y acercar los objetos de uso frecuente para eliminar alcances lejanos o por encima de la cabeza.',
};

/** Parámetros del formulario con puntuación desfavorable (sobre su óptimo). */
export function hallazgosDesfavorables(ev: EvaluacionErgonomica): string[] {
  const def = METODOS[ev.metodo];
  if (!def) return [];
  const out: string[] = [];
  for (const c of def.campos) {
    if (c.tipo === 'numero') continue; // entradas de medida (NIOSH), no puntajes
    const val = ev.entradas[c.key];
    if (val === undefined) continue;
    const optimo = c.opciones?.[0]?.valor ?? c.min;
    if (val > optimo) out.push(`${c.label}: ${val}`);
  }
  return out;
}

/** Construye los párrafos de interpretación del resultado para el PDF. */
export function parrafosInterpretacion(ev: EvaluacionErgonomica): string[] {
  const r = ev.resultado;
  const d = r.detalle ?? {};
  const parrafos: string[] = [INTRO_METODO[ev.metodo] ?? ''];

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
      `Los multiplicadores obtenidos fueron: horizontal ${d.HM}, vertical ${d.VM}, desplazamiento ${d.DM}, asimetría ${d.AM}, frecuencia ${d.FM} y agarre ${d.CM} ` +
      '(1.00 es la condición ideal; cuanto menor el valor, más penaliza ese factor). Para reducir el LI conviene actuar sobre el multiplicador más castigado: ' +
      'acercar la carga al cuerpo (horizontal), evitar orígenes muy bajos o muy altos (vertical), reducir el recorrido, eliminar giros de tronco (asimetría), ' +
      'bajar la frecuencia o repartir la tarea, y mejorar el agarre con asas o cajas adecuadas.',
    );
  } else {
    // RULA / REBA
    parrafos.push(
      `En esta evaluación la puntuación final ${ev.metodo} es ${r.puntajeFinal} (${r.nivel.toLowerCase()})` +
      (ev.lado ? `, evaluando el lado ${ev.lado}` : '') +
      `. Los puntajes intermedios fueron: grupo A ${d.puntajeA} y grupo B ${d.puntajeB}` +
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

  // Hallazgos: parámetros con puntuación sobre su óptimo
  const hallazgos = hallazgosDesfavorables(ev);
  if (hallazgos.length > 0) {
    parrafos.push(
      `Parámetros con puntuación desfavorable respecto a su condición óptima: ${hallazgos.join('; ')}. ` +
      'Estos son los puntos concretos sobre los que debe dirigirse la corrección del puesto o de la tarea.',
    );
  } else if (ev.metodo !== 'NIOSH') {
    parrafos.push('Todos los parámetros valorados se encontraron en su condición óptima o cercana a ella.');
  }

  // Recomendaciones tipo (ROSA): por componente desfavorable
  if (ev.metodo === 'ROSA') {
    const recs: string[] = [];
    if ((d.silla ?? 0) > 2) recs.push(RECOMENDACIONES_ROSA.silla);
    if ((d.monitorTelefono ?? 0) > 2) recs.push(RECOMENDACIONES_ROSA.monitorTelefono);
    if ((d.ratonTeclado ?? 0) > 2) recs.push(RECOMENDACIONES_ROSA.ratonTeclado);
    recs.forEach((t) => parrafos.push(t));
  }

  // Metodología
  parrafos.push(
    `Metodología: la evaluación se realizó por observación directa del puesto y de la tarea («${ev.tarea || 'tarea habitual'}»), ` +
    `aplicando la planilla del método ${ev.metodo} y registrando la puntuación de cada parámetro con sus factores de ajuste` +
    (ev.fotos?.length ? ', con apoyo de fotografías del puesto sobre las que se midieron ángulos' : '') +
    `. Evaluador: ${ev.medicoNombre || 'Servicio Médico Ocupacional'}. Se recomienda re-evaluar el puesto tras implementar las correcciones, y periódicamente o ante cambios de tarea, mobiliario o equipo.`,
  );

  if (ev.fotos?.length) {
    parrafos.push(
      `Se adjuntan ${ev.fotos.length === 1 ? '1 fotografía anotada' : `${ev.fotos.length} fotografías anotadas`} con las mediciones de ángulos realizadas sobre el puesto, que respaldan las puntuaciones asignadas. ` +
      'Las mediciones sobre fotografía son bidimensionales: su precisión depende de que la cámara esté perpendicular al plano del movimiento.',
    );
  }

  return parrafos.filter(Boolean);
}
