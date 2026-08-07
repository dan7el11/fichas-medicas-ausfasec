// Catálogos compartidos de los formatos de historia clínica ocupacional
// (SO-RE-38 periódica, SO-RE-40 retiro, SO-RE-41 preocupacional).
// Extraídos de las hojas oficiales para que todos los formularios usen
// exactamente las mismas listas.
import type { AntecedenteClinico, AntecedenteQuirurgico, Alergia, AntecedenteEmpleo, ExamenTamizaje, AntecedentesGineco, AntecedentesReproductivos, DatosPersonalesSO41 } from '../types';

// ── Catálogos demográficos de la Sección A del SO-RE-41 ─────────────────────
export const RELIGIONES = ['Católica', 'Evangélica', 'Testigos de Jehová', 'Mormona', 'Ninguna', 'Otras'];
export const GRUPOS_SANGUINEOS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'No conoce'];
export const LATERALIDADES = ['Diestro', 'Zurdo', 'Ambidiestro'];
export const ORIENTACIONES_SEXUALES = ['Heterosexual', 'Lesbiana', 'Gay', 'Bisexual', 'No sabe / no responde'];
export const IDENTIDADES_GENERO = ['Femenino', 'Masculino', 'Trans-femenino', 'Trans-masculino', 'No sabe / no responde'];
export const RAZAS = ['Mestiza', 'Indígena', 'Blanca', 'Afrodescendiente', 'Otros'];
export const ESTADOS_CIVILES = ['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión libre', 'Otros'];
export const GRADOS_INSTRUCCION = ['Básica General', 'Bachillerato General', 'Tercer Nivel', 'Cuarto Nivel'];

// Opciones de recomendaciones predefinidas
export const OPCIONES_RECOMENDACIONES = [
  'Dieta balanceada',
  'Dieta baja en grasas',
  'Dieta baja en sal',
  'Actividad física diaria',
  'Ergonomía laboral',
  'Pausas activas frecuentes',
  'Higiene postural',
  'Uso de EPP',
  'Control médico periódico',
  'Hidratación adecuada',
  'Descanso adecuado',
  'Evitar sobreesfuerzos',
  'Protección auditiva',
  'Protección visual',
];

// Sistemas para revisión de órganos y sistemas
export const SISTEMAS = [
  { numero: 1, nombre: 'PIEL - ANEXOS' },
  { numero: 2, nombre: 'ÓRGANOS DE LOS SENTIDOS' },
  { numero: 3, nombre: 'RESPIRATORIO' },
  { numero: 4, nombre: 'CARDIO-VASCULAR' },
  { numero: 5, nombre: 'DIGESTIVO' },
  { numero: 6, nombre: 'GENITO - URINARIO' },
  { numero: 7, nombre: 'MÚSCULO ESQUELÉTICO' },
  { numero: 8, nombre: 'ENDOCRINO' },
  { numero: 9, nombre: 'HEMO LINFÁTICO' },
  { numero: 10, nombre: 'NERVIOSO' },
];

// Regiones del examen físico regional
export const REGIONES_EXAMEN_FISICO = [
  { numero: 1, region: 'Piel', subregiones: [
    { codigo: 'a', nombre: 'Cicatrices' },
    { codigo: 'b', nombre: 'Piel y Faneras' },
  ]},
  { numero: 2, region: 'Ojos', subregiones: [
    { codigo: 'a', nombre: 'Párpados' },
    { codigo: 'b', nombre: 'Conjuntivas' },
    { codigo: 'c', nombre: 'Pupilas' },
    { codigo: 'd', nombre: 'Córnea' },
    { codigo: 'e', nombre: 'Motilidad' },
  ]},
  { numero: 3, region: 'Oído', subregiones: [
    { codigo: 'a', nombre: 'C. auditivo externo' },
    { codigo: 'b', nombre: 'Pabellón' },
    { codigo: 'c', nombre: 'Tímpanos' },
  ]},
  { numero: 4, region: 'Oro faringe', subregiones: [
    { codigo: 'a', nombre: 'Labios' },
    { codigo: 'b', nombre: 'Lengua' },
    { codigo: 'c', nombre: 'Faringe' },
    { codigo: 'd', nombre: 'Amígdalas' },
    { codigo: 'e', nombre: 'Dentadura' },
  ]},
  { numero: 5, region: 'Nariz', subregiones: [
    { codigo: 'a', nombre: 'Tabique' },
    { codigo: 'b', nombre: 'Cornetes' },
    { codigo: 'c', nombre: 'Mucosas' },
    { codigo: 'd', nombre: 'Senos paranasales' },
  ]},
  { numero: 6, region: 'Cuello', subregiones: [
    { codigo: 'a', nombre: 'Tiroides / masas' },
    { codigo: 'b', nombre: 'Movilidad' },
  ]},
  { numero: 7, region: 'Tórax', subregiones: [
    { codigo: 'a', nombre: 'Mamas' },
  ]},
  { numero: 8, region: 'Tórax', subregiones: [
    { codigo: 'a', nombre: 'Pulmones' },
    { codigo: 'b', nombre: 'Corazón' },
    { codigo: 'c', nombre: 'Parrilla costal' },
  ]},
  { numero: 9, region: 'Abdomen', subregiones: [
    { codigo: 'a', nombre: 'Vísceras' },
    { codigo: 'b', nombre: 'Pared abdominal' },
  ]},
  { numero: 10, region: 'Columna', subregiones: [
    { codigo: 'a', nombre: 'Flexibilidad' },
    { codigo: 'b', nombre: 'Desviación' },
    { codigo: 'c', nombre: 'Dolor' },
  ]},
  { numero: 11, region: 'Pelvis', subregiones: [
    { codigo: 'a', nombre: 'Pelvis' },
    { codigo: 'b', nombre: 'Genitales' },
  ]},
  { numero: 12, region: 'Extremidades', subregiones: [
    { codigo: 'a', nombre: 'Vascular' },
    { codigo: 'b', nombre: 'Miembros superiores' },
    { codigo: 'c', nombre: 'Miembros inferiores' },
  ]},
  { numero: 13, region: 'Neurológico', subregiones: [
    { codigo: 'a', nombre: 'Fuerza' },
    { codigo: 'b', nombre: 'Sensibilidad' },
    { codigo: 'c', nombre: 'Marcha' },
    { codigo: 'd', nombre: 'Reflejos' },
  ]},
];

// Tipos de antecedentes familiares
export const TIPOS_ANTECEDENTES_FAMILIARES = [
  { numero: 1, nombre: 'Enfermedad Cardio-Vascular' },
  { numero: 2, nombre: 'Enfermedad Metabólica' },
  { numero: 3, nombre: 'Enfermedad Neurológica' },
  { numero: 4, nombre: 'Enfermedad Oncológica' },
  { numero: 5, nombre: 'Enfermedad Infecciosa' },
  { numero: 6, nombre: 'Enfermedad Hereditaria / Congénita' },
  { numero: 7, nombre: 'Discapacidades' },
  { numero: 8, nombre: 'Otros' },
];

// Factores de riesgo del puesto — catálogos exactos de los formatos
export const RIESGOS_FISICOS = [
  'Temperaturas altas',
  'Temperaturas bajas',
  'Radiación Ionizante',
  'Radiación No Ionizante',
  'Ruido',
  'Vibración',
  'Iluminación',
  'Ventilación',
  'Fluido eléctrico',
];

export const RIESGOS_MECANICOS = [
  'Atrapamiento entre máquinas',
  'Atrapamiento entre superficies',
  'Atrapamiento entre objetos',
  'Caída de objetos',
  'Caídas al mismo nivel',
  'Caídas a diferente nivel',
  'Contacto eléctrico',
  'Contacto con superficies de trabajos',
  'Proyección de partículas – fragmentos',
  'Proyección de fluidos',
  'Pinchazos',
  'Cortes',
  'Atropellamientos por vehículos',
  'Choques / colisión vehicular',
];

export const RIESGOS_QUIMICOS = [
  'Sólidos',
  'Polvos',
  'Humos',
  'Líquidos',
  'Vapores',
  'Aerosoles',
  'Neblinas',
  'Gaseosos',
];

export const RIESGOS_BIOLOGICOS = [
  'Virus',
  'Hongos',
  'Bacterias',
  'Parásitos',
  'Exposición a vectores',
  'Exposición a animales selváticos',
];

export const RIESGOS_ERGONOMICOS = [
  'Manejo manual de cargas',
  'Movimientos repetitivos',
  'Posturas forzadas',
  'Trabajos con PVD',
];

export const RIESGOS_PSICOSOCIALES = [
  'Monotonía del trabajo',
  'Sobrecarga laboral',
  'Minuciosidad de la tarea',
  'Alta responsabilidad',
  'Autonomía en la toma de decisiones',
  'Supervisión y estilos de dirección deficiente',
  'Conflicto de rol',
  'Falta de claridad en las funciones',
  'Incorrecta distribución del trabajo',
  'Turnos rotativos',
  'Relaciones interpersonales',
  'Inestabilidad laboral',
];

/** Categorías de riesgo de empleos anteriores (Sección D del SO-RE-41). */
export const CATEGORIAS_RIESGO_EMPLEO = ['FÍSICO', 'MECÁNICO', 'QUÍMICO', 'BIOLÓGICO', 'ERGONÓMICO', 'PSICOSOCIAL'];

// ── Catálogos del FORMATO UNIFICADO (Evaluación Médica Ocupacional, HCU-form.123/2025) ──
// La categoría "DE SEGURIDAD" agrupa locativos + mecánicos + eléctricos; se
// guarda en el arreglo `mecanicos` del modelo FactorRiesgoPuesto.
export const RIESGOS_SEGURIDAD = [
  'Falta de señalización, aseo, desorden',
  'Atrapamiento entre máquinas y/o superficies',
  'Atrapamiento entre objetos',
  'Caída de objetos',
  'Caídas al mismo nivel',
  'Caídas a diferente nivel',
  'Pinchazos',
  'Cortes',
  'Choques / colisión vehicular',
  'Atropellamientos por vehículos',
  'Proyección de fluidos',
  'Proyección de partículas – fragmentos',
  'Contacto con superficies de trabajos',
  'Contacto eléctrico',
];

export const RIESGOS_QUIMICOS_U = [
  'Polvos', 'Sólidos', 'Humos', 'Líquidos', 'Vapores', 'Aerosoles', 'Neblinas', 'Gaseosos',
];

export const RIESGOS_ERGONOMICOS_U = [
  'Manejo manual de cargas', 'Movimientos repetitivos', 'Posturas forzadas',
  'Trabajos con PVD', 'Diseño inadecuado del puesto',
];

export const RIESGOS_PSICOSOCIALES_U = [
  'Monotonía del trabajo', 'Sobrecarga laboral', 'Minuciosidad de la tarea', 'Alta responsabilidad',
  'Autonomía en la toma de decisiones', 'Supervisión y estilos de dirección deficiente',
  'Conflicto de rol', 'Falta de claridad en las funciones', 'Incorrecta distribución del trabajo',
  'Turnos rotativos', 'Relaciones interpersonales', 'Inestabilidad laboral', 'Amenaza delincuencial',
];

/**
 * Estructura EXACTA de la matriz de factores de riesgo del formato unificado
 * (Sección G, página 2 horizontal): categoría → subcategoría → factores.
 * Solo «DE SEGURIDAD» tiene subcategorías (locativos/mecánicos/eléctricos/otros).
 * Cada categoría cierra con su fila «Otros __________», como en la hoja oficial.
 * Es la fuente única para el formulario y para el PDF.
 */
export interface SubgrupoRiesgo { subcategoria?: string; items: string[] }
export interface CategoriaRiesgo {
  clave: 'fisicos' | 'mecanicos' | 'quimicos' | 'biologicos' | 'ergonomicos' | 'psicosociales';
  categoria: string;
  color: string;          // color del grupo en el formulario
  subgrupos: SubgrupoRiesgo[];
}

export const MATRIZ_RIESGOS: CategoriaRiesgo[] = [
  {
    clave: 'fisicos', categoria: 'FÍSICO', color: 'bg-blue-600',
    subgrupos: [{ items: [...RIESGOS_FISICOS, 'Otros __________'] }],
  },
  {
    clave: 'mecanicos', categoria: 'DE SEGURIDAD', color: 'bg-red-600',
    subgrupos: [
      { subcategoria: 'LOCATIVOS', items: ['Falta de señalización, aseo, desorden'] },
      { subcategoria: 'MECÁNICOS', items: [
        'Atrapamiento entre máquinas y/o superficies', 'Atrapamiento entre objetos', 'Caída de objetos',
        'Caídas al mismo nivel', 'Caídas a diferente nivel', 'Pinchazos', 'Cortes',
        'Choques / colisión vehicular', 'Atropellamientos por vehículos', 'Proyección de fluidos',
        'Proyección de partículas – fragmentos', 'Contacto con superficies de trabajos',
      ] },
      { subcategoria: 'ELÉCTRICOS', items: ['Contacto eléctrico'] },
      { subcategoria: 'OTROS', items: ['Otros __________'] },
    ],
  },
  {
    clave: 'quimicos', categoria: 'QUÍMICO', color: 'bg-amber-600',
    subgrupos: [{ items: [...RIESGOS_QUIMICOS_U, 'Otros __________'] }],
  },
  {
    clave: 'biologicos', categoria: 'BIOLÓGICO', color: 'bg-green-600',
    subgrupos: [{ items: [...RIESGOS_BIOLOGICOS, 'Otros __________'] }],
  },
  {
    clave: 'ergonomicos', categoria: 'ERGONÓMICO', color: 'bg-purple-600',
    subgrupos: [{ items: [...RIESGOS_ERGONOMICOS_U, 'Otros __________'] }],
  },
  {
    clave: 'psicosociales', categoria: 'PSICOSOCIAL', color: 'bg-pink-600',
    subgrupos: [{ items: [...RIESGOS_PSICOSOCIALES_U, 'Otros __________'] }],
  },
];

/** Grupo de atención prioritaria (Sección A del formato unificado). */
export const GRUPOS_PRIORITARIOS = ['Embarazada', 'Persona con discapacidad', 'Enfermedad catastrófica', 'Adulto mayor'];

/** Tipos de evaluación (etiqueta para catalogar y buscar). */
export const TIPOS_EVALUACION_OCUP = [
  { valor: 'preocupacional', label: 'Ingreso / Preocupacional' },
  { valor: 'periodica', label: 'Periódico' },
  { valor: 'reintegro', label: 'Reintegro' },
  { valor: 'retiro', label: 'Retiro' },
] as const;
export type TipoEvaluacionOcup = typeof TIPOS_EVALUACION_OCUP[number]['valor'];

/** Una de las cuatro fechas de la cabecera del formato (Sección B). */
export type CampoFechaEvaluacion = 'fechaAtencion' | 'fechaIngresoTrabajo' | 'fechaReingreso' | 'fechaUltimoDia';

export const ETIQUETA_CAMPO_FECHA: Record<CampoFechaEvaluacion, string> = {
  fechaAtencion: 'Fecha de atención',
  fechaIngresoTrabajo: 'Fecha de ingreso al trabajo',
  fechaReingreso: 'Fecha de reintegro',
  fechaUltimoDia: 'Último día laboral / salida',
};

/**
 * Fechas que pide el formato según el tipo de evaluación. La cabecera imprime
 * las cuatro columnas siempre, pero solo tienen sentido las de aquí: en un
 * RETIRO se llenan ingreso y último día laboral; en un REINTEGRO, además, la
 * fecha de reintegro y el último día trabajado antes de la ausencia.
 *
 * `obligatorias` son las que se exigen al guardar.
 */
export const CAMPOS_FECHA_POR_TIPO: Record<string, { campos: CampoFechaEvaluacion[]; obligatorias: CampoFechaEvaluacion[] }> = {
  preocupacional: {
    campos: ['fechaAtencion', 'fechaIngresoTrabajo'],
    obligatorias: ['fechaAtencion'],
  },
  periodica: {
    campos: ['fechaAtencion', 'fechaIngresoTrabajo'],
    obligatorias: ['fechaAtencion', 'fechaIngresoTrabajo'],
  },
  reintegro: {
    campos: ['fechaAtencion', 'fechaIngresoTrabajo', 'fechaUltimoDia', 'fechaReingreso'],
    obligatorias: ['fechaAtencion', 'fechaIngresoTrabajo', 'fechaReingreso'],
  },
  retiro: {
    campos: ['fechaAtencion', 'fechaIngresoTrabajo', 'fechaUltimoDia'],
    obligatorias: ['fechaAtencion', 'fechaIngresoTrabajo', 'fechaUltimoDia'],
  },
};

/** Ayuda contextual bajo cada campo, según el tipo de evaluación. */
export const AYUDA_CAMPO_FECHA: Record<string, Partial<Record<CampoFechaEvaluacion, string>>> = {
  preocupacional: { fechaIngresoTrabajo: 'Fecha prevista de ingreso' },
  reintegro: { fechaUltimoDia: 'Último día trabajado antes de la ausencia', fechaReingreso: 'Fecha en que se reincorpora' },
  retiro: { fechaUltimoDia: 'Último día laboral (salida)' },
};

// ── Fábricas de objetos vacíos ───────────────────────────────────────────────

export const emptyAntecedenteClinico = (): AntecedenteClinico => ({
  enfermedad: '', desdeCuando: '', tomaMedicacion: false,
  medicacionNombre: '', medicacionDosis: '', medicacionFrecuencia: '',
  seguimientoEspecialista: false, especialista: '', complicaciones: '',
});

export const emptyAntecedenteQuirurgico = (): AntecedenteQuirurgico => ({
  procedimiento: '', fechaAproximada: '', complicaciones: '',
  recuperacionCompleta: true, secuelas: '',
});

export const emptyAlergia = (): Alergia => ({
  alergeno: '', intensidadReaccion: '', sintomas: '',
  tratamientoHabitual: '', seguimientoEspecialista: false, especialista: '',
});

export const emptyAntecedenteEmpleo = (): AntecedenteEmpleo => ({
  empresa: '', puesto: '', actividades: '', tiempoMeses: '', riesgos: [], observaciones: '',
  esActual: false, incidente: false, accidente: false, enfermedadProfesional: false,
  calificadoIess: null, fechaCalificacion: '', especificar: '',
});

export const emptyExamenTamizaje = (): ExamenTamizaje => ({
  realizado: null, tiempoAnios: '', resultado: '',
});

export const emptyAntecedentesGineco = (): AntecedentesGineco => ({
  menarquia: '', ciclos: '', fum: '', gestas: '', partos: '', cesareas: '', abortos: '',
  hijosVivos: '', hijosMuertos: '', vidaSexualActiva: null,
  planificacionFamiliar: null, planificacionTipo: '',
  papanicolaou: emptyExamenTamizaje(), colposcopia: emptyExamenTamizaje(),
  ecoMamario: emptyExamenTamizaje(), mamografia: emptyExamenTamizaje(),
});

export const emptyAntecedentesReproductivos = (): AntecedentesReproductivos => ({
  antigenoProstatico: emptyExamenTamizaje(), ecoProstatico: emptyExamenTamizaje(),
  planificacionFamiliar: null, planificacionTipo: '', hijosVivos: '', hijosMuertos: '',
});

export const emptyDatosPersonales = (): DatosPersonalesSO41 => ({
  religion: '', grupoSanguineo: '', lateralidad: '',
  orientacionSexual: '', identidadGenero: '',
  discapacidad: null, discapacidadTipo: '', discapacidadPorcentaje: '',
  raza: '', estadoCivil: '', gradoInstruccion: '',
  profesion: '', actividadesRelevantes: '',
});
