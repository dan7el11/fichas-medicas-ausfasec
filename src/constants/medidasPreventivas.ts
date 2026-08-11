// CATÁLOGO DE MEDIDAS PREVENTIVAS — generado del análisis
// «Matriz_Compacta_Medidas_AUSTROGAS.xlsx» (hoja Catálogo_6_Medidas).
//
// Cada medida tiene una ETIQUETA CORTA, que es la que cabe en la fila de
// medidas preventivas de la página 2, y su REDACCIÓN CLÍNICA COMPLETA, que se
// muestra en pantalla al pasar por encima y sirve de referencia al médico.
// `orden` es la jerarquía clínica con la que se eligen las medidas de cada
// función. Los factores vienen normalizados a los nombres de MATRIZ_RIESGOS.

export interface MedidaPreventiva {
  orden: number;
  eje: string;
  etiqueta: string;
  completa: string;
  /** Factores de riesgo que exigen esta medida. */
  factores: string[];
}

export const CATALOGO_MEDIDAS: MedidaPreventiva[] = [
  {
    orden: 1, eje: "Aptitud específica",
    etiqueta: "Aptitud cardiorrespiratoria (atmósfera GLP)",
    completa: "Aptitud cardiorrespiratoria para uso de protección respiratoria y evacuación de emergencia en atmósfera GLP, con espirometría de base.",
    factores: ["Incendio y explosión (atmósfera GLP)"],
  },
  {
    orden: 2, eje: "Aptitud específica",
    etiqueta: "Aptitud para trabajo en altura",
    completa: "Aptitud para trabajo en altura: valoración cardiovascular, neurológica, vestibular y visual, y glucemia. Descartar epilepsia, vértigo y uso de psicofármacos.",
    factores: ["Caídas a diferente nivel"],
  },
  {
    orden: 3, eje: "Aptitud específica",
    etiqueta: "Aptitud para conducción",
    completa: "Aptitud para conducción: agudeza visual, campimetría, visión de colores, audiometría, glucemia y tensión arterial. Descartar apnea del sueño y fármacos sedantes.",
    factores: ["Choques / colisión vehicular", "Desplazamiento en medios de transporte"],
  },
  {
    orden: 4, eje: "Educación sanitaria",
    etiqueta: "Capacitación en seguridad vial",
    completa: "Capacitación en seguridad vial y conducción defensiva; control de la jornada de conducción, descansos y pausas en ruta.",
    factores: ["Choques / colisión vehicular", "Atropellamientos por vehículos", "Desplazamiento en medios de transporte"],
  },
  {
    orden: 5, eje: "Aptitud específica",
    etiqueta: "Control de alcohol y sustancias",
    completa: "Control de alcohol y sustancias psicoactivas y revisión de medicación sedante prescrita, en tareas de conducción y operación de equipos.",
    factores: ["Atrapamiento entre máquinas y/o superficies", "Caídas a diferente nivel", "Choques / colisión vehicular", "Desplazamiento en medios de transporte"],
  },
  {
    orden: 6, eje: "Ergonomía",
    etiqueta: "Evaluación ergonómica de manipulación de cargas",
    completa: "Evaluación ergonómica de la manipulación manual de cargas (ecuación NIOSH o método equivalente): límites de peso y frecuencia, alturas de agarre y depósito, distancias de transporte y ayudas mecánicas obligatorias.",
    factores: ["Manejo manual de cargas", "Posturas forzadas"],
  },
  {
    orden: 7, eje: "Vigilancia de la salud",
    etiqueta: "Vigilancia musculoesquelética lumbar",
    completa: "Valoración musculoesquelética de columna lumbar preocupacional y anual; capacitación en técnica de levantamiento, límites de peso y uso de ayudas mecánicas.",
    factores: ["Manejo manual de cargas"],
  },
  {
    orden: 8, eje: "Vigilancia de la salud",
    etiqueta: "Tamizaje de hombro y manguito rotador",
    completa: "Tamizaje de patología de hombro y manguito rotador (Neer, Jobe y Hawkins) en manipulación repetida de cilindros, con control de la carga acumulada por jornada.",
    factores: ["Manejo manual de cargas"],
  },
  {
    orden: 9, eje: "Ergonomía",
    etiqueta: "Calentamiento y acondicionamiento físico laboral",
    completa: "Calentamiento musculoesquelético dirigido antes de iniciar la jornada de manipulación de cargas y programa de acondicionamiento físico laboral de tronco y cintura escapular.",
    factores: ["Manejo manual de cargas", "Movimientos repetitivos"],
  },
  {
    orden: 10, eje: "Vigilancia de la salud",
    etiqueta: "Espirometría anual",
    completa: "Espirometría preocupacional y anual con vigilancia dirigida de síntomas respiratorios; protección respiratoria con prueba de ajuste.",
    factores: ["Ventilación", "Polvos", "Sólidos", "Humos", "Vapores", "Aerosoles", "Gaseosos"],
  },
  {
    orden: 11, eje: "Vigilancia de la salud",
    etiqueta: "Audiometría anual",
    completa: "Audiometría tonal preocupacional y anual, con reposo auditivo de 12 h previo; verificar tolerancia y ajuste de la protección auditiva.",
    factores: ["Ruido"],
  },
  {
    orden: 12, eje: "Protección personal",
    etiqueta: "Prescripción y control de uso de EPP",
    completa: "Prescripción del EPP según el riesgo de la tarea, con verificación médica de tolerancia, ajuste y compatibilidad dermatológica; control del uso efectivo en el examen periódico.",
    factores: ["Ruido", "Caída de objetos", "Pinchazos", "Cortes", "Proyección de fluidos", "Proyección de partículas – fragmentos", "Contacto con superficies de trabajos", "Contacto eléctrico", "Incendio y explosión (atmósfera GLP)", "Manejo de recipientes a presión", "Polvos", "Humos", "Líquidos", "Aerosoles", "Gaseosos"],
  },
  {
    orden: 13, eje: "Vigilancia de la salud",
    etiqueta: "Vigilancia de la exposición a GLP",
    completa: "Vigilancia médica de la exposición a GLP: control periódico de síntomas respiratorios y neurológicos, y formación en reconocimiento precoz de signos de fuga y de contacto con producto criogénico antes de que se produzca la lesión.",
    factores: ["Contacto con superficies de trabajos", "Incendio y explosión (atmósfera GLP)", "Manejo de recipientes a presión", "Gaseosos"],
  },
  {
    orden: 14, eje: "Vigilancia de la salud",
    etiqueta: "Vigilancia dermatológica",
    completa: "Valoración dermatológica de manos y antebrazos (dermatitis de contacto y quemadura por frío); biometría y función hepática y renal según el producto manejado.",
    factores: ["Contacto con superficies de trabajos", "Sólidos", "Líquidos"],
  },
  {
    orden: 15, eje: "Vigilancia de la salud",
    etiqueta: "Vigilancia neurológica por vapores",
    completa: "Vigilancia de síntomas neurológicos por exposición a vapores: cefalea, mareo y somnolencia; retiro inmediato del puesto ante su aparición.",
    factores: ["Vapores"],
  },
  {
    orden: 16, eje: "Aptitud específica",
    etiqueta: "Aptitud psicomotriz y sensorial",
    completa: "Aptitud psicomotriz, visual y auditiva para operar equipos y transitar por áreas de circulación vehicular; descartar medicación sedante.",
    factores: ["Atrapamiento entre máquinas y/o superficies", "Choques / colisión vehicular", "Atropellamientos por vehículos"],
  },
  {
    orden: 17, eje: "Vigilancia de la salud",
    etiqueta: "Vigilancia del sueño y control metabólico",
    completa: "Evaluación del sueño (escala de Epworth) y control metabólico semestral por trabajo a turnos; educación en higiene del sueño. No asignar turno nocturno a gestantes ni a personal con patología metabólica descompensada.",
    factores: ["Turnos rotativos"],
  },
  {
    orden: 18, eje: "Vigilancia de la salud",
    etiqueta: "Tamizaje de miembro superior",
    completa: "Tamizaje de trastornos de miembro superior (Phalen, Tinel, Finkelstein) y rotación de tarea.",
    factores: ["Movimientos repetitivos"],
  },
  {
    orden: 19, eje: "Ergonomía",
    etiqueta: "Ergonomía del puesto con PVD",
    completa: "Examen visual por trabajo con pantallas cada dos años, pausas visuales 20-20-20 y ajuste de altura de pantalla, silla y apoyos.",
    factores: ["Trabajos con PVD", "Diseño inadecuado del puesto"],
  },
  {
    orden: 20, eje: "Ergonomía",
    etiqueta: "Pausas activas y estiramientos",
    completa: "Pausas activas y estiramientos programados durante la jornada, con educación en higiene postural aplicada a la tarea.",
    factores: ["Posturas forzadas", "Monotonía del trabajo", "Minuciosidad de la tarea"],
  },
  {
    orden: 21, eje: "Vigilancia de la salud",
    etiqueta: "Valoración oftalmológica anual",
    completa: "Valoración oftalmológica anual: agudeza visual, refracción y segmento anterior; corrección óptica y protección ocular específica.",
    factores: ["Radiación No Ionizante", "Iluminación", "Proyección de partículas – fragmentos"],
  },
  {
    orden: 22, eje: "Vigilancia de la salud",
    etiqueta: "Control cardiovascular con ECG basal",
    completa: "Control de tensión arterial y glucemia con electrocardiograma basal en personal expuesto a instalaciones energizadas; capacitación del área en RCP.",
    factores: ["Fluido eléctrico", "Contacto eléctrico"],
  },
  {
    orden: 23, eje: "Vigilancia de la salud",
    etiqueta: "Valoración neurovascular por vibración",
    completa: "Valoración neurovascular de miembros superiores por vibración mano-brazo (prueba de Allen y de sensibilidad).",
    factores: ["Vibración"],
  },
  {
    orden: 24, eje: "Psicosocial",
    etiqueta: "Evaluación psicosocial y control de jornada",
    completa: "Aplicación del cuestionario de riesgo psicosocial vigente con tamizaje de agotamiento profesional, y control de la jornada efectiva y de las horas extra.",
    factores: ["Monotonía del trabajo", "Sobrecarga laboral", "Autonomía en la toma de decisiones", "Incorrecta distribución del trabajo"],
  },
  {
    orden: 25, eje: "Inmunización",
    etiqueta: "Esquema antitetánico vigente",
    completa: "Esquema antitetánico vigente (refuerzo cada 10 años) y protocolo de curación y seguimiento de herida cortante o punzante.",
    factores: ["Pinchazos", "Cortes", "Bacterias"],
  },
  {
    orden: 26, eje: "Inmunización",
    etiqueta: "Vacunación influenza y COVID-19",
    completa: "Vacunación anual contra influenza y esquema COVID-19 vigente; higiene de manos, etiqueta respiratoria y retiro del puesto del sintomático respiratorio.",
    factores: ["Virus", "Bacterias"],
  },
  {
    orden: 27, eje: "Aptitud específica",
    etiqueta: "Protección de la trabajadora gestante",
    completa: "Protocolo de protección de la trabajadora gestante y en lactancia: reubicación ante manejo de cargas, turno nocturno y exposición a GLP.",
    factores: ["Incendio y explosión (atmósfera GLP)", "Manejo manual de cargas", "Turnos rotativos"],
  },
  {
    orden: 28, eje: "Educación sanitaria",
    etiqueta: "Instrucción en fichas de seguridad química",
    completa: "Instrucción en la ficha de datos de seguridad antes de manipular cada producto y en la prevención del contacto dérmico y ocular; verificación de la disponibilidad de ducha y lavaojos.",
    factores: ["Proyección de fluidos", "Líquidos"],
  },
  {
    orden: 29, eje: "Vigilancia de la salud",
    etiqueta: "Vigilancia dermatomicótica y parasitaria",
    completa: "Valoración dermatológica y micológica ante lesión sospechosa y coproparasitario periódico; repelente, ropa cubriente y notificación de picadura con vigilancia de síndrome febril.",
    factores: ["Hongos", "Parásitos", "Exposición a vectores"],
  },
  {
    orden: 30, eje: "Psicosocial",
    etiqueta: "Apoyo psicológico y tamizaje de ansiedad",
    completa: "Acceso a apoyo psicológico con tamizaje de ansiedad y control de tensión arterial en el examen periódico.",
    factores: ["Alta responsabilidad"],
  },
  {
    orden: 31, eje: "Psicosocial",
    etiqueta: "Tamizaje postraumático por evento delictivo",
    completa: "Tamizaje de estrés agudo y postraumático tras evento delictivo, con atención psicológica inmediata.",
    factores: ["Amenaza delincuencial"],
  },
  {
    orden: 32, eje: "Ergonomía",
    etiqueta: "Ergonomía del puesto de trabajo",
    completa: "Evaluación ergonómica del puesto: alturas de trabajo, alcances, apoyos y espacio de maniobra adecuados a la tarea.",
    factores: ["Diseño inadecuado del puesto"],
  },
  {
    orden: 33, eje: "Vigilancia de la salud",
    etiqueta: "Control cardiometabólico para ruta",
    completa: "Control de tensión arterial y glucemia; educación sobre descanso previo al desplazamiento y no uso de fármacos sedantes en ruta.",
    factores: ["Desplazamiento en medios de transporte"],
  },
  {
    orden: 34, eje: "Psicosocial",
    etiqueta: "Perfil de puesto y clima laboral",
    completa: "Entrega formal del perfil de puesto por escrito con línea de mando única; evaluación de clima laboral y canal confidencial de reporte.",
    factores: ["Supervisión y estilos de dirección deficiente", "Conflicto de rol", "Falta de claridad en las funciones", "Relaciones interpersonales"],
  },
  {
    orden: 35, eje: "Vigilancia de la salud",
    etiqueta: "Vigilancia de incidentes y cuasi-accidentes",
    completa: "Vigilancia epidemiológica de incidentes y cuasi-accidentes: registro y análisis médico de eventos sin lesión para corregir la causa antes de que produzca daño.",
    factores: ["Falta de señalización, aseo, desorden", "Atrapamiento entre objetos", "Caída de objetos"],
  },
  {
    orden: 36, eje: "Aptitud específica",
    etiqueta: "Valoración de marcha y equilibrio",
    completa: "Valoración de marcha, equilibrio y agudeza visual; revisión del calzado y de la medicación que altere el equilibrio.",
    factores: ["Caídas al mismo nivel", "Caídas a diferente nivel"],
  },
  {
    orden: 37, eje: "Vigilancia de la salud",
    etiqueta: "Vigilancia respiratoria por polvo de archivo",
    completa: "Vigilancia de síntomas rinoconjuntivales y respiratorios por polvo documental o ventilación deficiente; control de limpieza y renovación de aire del área.",
    factores: ["Ventilación", "Polvos"],
  },
  {
    orden: 38, eje: "Vigilancia de la salud",
    etiqueta: "Confort acústico del puesto",
    completa: "Verificación del confort acústico del puesto; audiometría solo ante síntomas o fuente de ruido continuo.",
    factores: ["Ruido"],
  },
  {
    orden: 39, eje: "Educación sanitaria",
    etiqueta: "Hidratación y protección solar",
    completa: "Hidratación programada y protección solar, con vigilancia de agotamiento térmico y de vasculopatía periférica en exposición a frío.",
    factores: ["Temperaturas altas", "Temperaturas bajas"],
  },
];

const porEtiqueta = new Map(CATALOGO_MEDIDAS.map(m => [m.etiqueta, m]));

/** Redacción clínica completa de una etiqueta corta (o la etiqueta si no está). */
export const medidaCompleta = (etiqueta: string): string =>
  porEtiqueta.get(etiqueta)?.completa ?? etiqueta;

export const buscarMedida = (etiqueta: string): MedidaPreventiva | undefined =>
  porEtiqueta.get(etiqueta);
