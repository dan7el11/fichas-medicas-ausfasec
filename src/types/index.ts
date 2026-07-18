export interface Usuario {
  uid: string;
  email: string;
  nombreCompleto: string;
  cedula: string;
  rol: 'medico' | 'admin';
  /** Abreviatura profesional para la firma y el saludo: Dr., Dra., Md., etc. */
  abreviatura?: string;
  /** Título profesional (ej. "Médico Ocupacional", "Especialista en SST"). */
  titulo?: string;
  /** Código de registro Senescyt (aparece como código en los documentos). */
  codigoSenescyt?: string;
  /** Si es false, el usuario no puede iniciar sesión. undefined = activo. */
  activo?: boolean;
  createdAt: Date;
}

export interface Trabajador {
  id?: string;
  primerApellido: string;
  segundoApellido: string;
  primerNombre: string;
  segundoNombre: string;
  cedula: string;
  sexo: 'M' | 'F';
  puestoTrabajo: string;
  departamento?: string;
  evaluaciones: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SignosVitales {
  presionSistolica: string;
  presionDiastolica: string;
  temperatura: string;
  frecuenciaCardiaca: string;
  frecuenciaRespiratoria: string;
  saturacion: string;
  peso: string;
  talla: string;
  imc: number;
  perimetroAbdominal: string;
  glucosaCapilar?: string;
}

export interface Reposo {
  id?: string;
  trabajadorId: string;
  tipo: 'reposo' | 'incapacidad' | 'permiso';
  fechaInicio: string;
  diasReposo: number;
  fechaFin: string;
  diagnostico: string;
  codigoCIE?: string;
  observaciones?: string;
  emitidoPor?: string;
  createdAt: any;
}

export interface HabitoToxico {
  tipo: 'tabaco' | 'alcohol' | 'drogas';
  consume: boolean;
  tiempoConsumo: string;
  cantidad: string;
  exConsumidor: boolean;
  tiempoAbstinencia: string;
}

export interface EstiloVida {
  actividadFisica: boolean;
  tipoActividad: string;
  tiempoCantidad: string;
  medicacionHabitual: string;
  medicacionCantidad: string;
}

export interface MedicacionHabitual {
  nombre: string;
  dosis: string;
  frecuencia: string;
  horario: string;
}

export interface AccidenteTrabajo {
  descripcion: string;
  calificado: boolean;
  especificacion: string;
  fechaAnio: string;
  fechaMes: string;
  fechaDia: string;
  observaciones: string;
}

export interface EnfermedadProfesional {
  descripcion: string;
  calificada: boolean;
  especificacion: string;
  fechaAnio: string;
  fechaMes: string;
  fechaDia: string;
  observaciones: string;
}

export interface AntecedenteFamiliar {
  tipo: string;
  descripcion: string;
  parentesco: string;
}

export interface AntecedenteClinico {
  enfermedad: string;
  desdeCuando: string;
  tomaMedicacion: boolean;
  medicacionNombre: string;
  medicacionDosis: string;
  medicacionFrecuencia: string;
  seguimientoEspecialista: boolean;
  especialista: string;
  complicaciones: string;
}

export interface AntecedenteQuirurgico {
  procedimiento: string;
  fechaAproximada: string;
  complicaciones: string;
  recuperacionCompleta: boolean;
  secuelas: string;
}

export interface Alergia {
  alergeno: string;
  intensidadReaccion: string;
  sintomas: string;
  tratamientoHabitual: string;
  seguimientoEspecialista: boolean;
  especialista: string;
}

export interface ExamenFisicoHallazgo {
  codigo: string;
  region: string;
  subregion: string;
  descripcion: string;
}

export interface ExamenComplementario {
  nombre: string;
  fecha: string;
  resultado: string;
}

export interface Diagnostico {
  descripcion: string;
  cie: string;
  tipo: 'presuntivo' | 'definitivo';
}

// ====================================================================
// ANTECEDENTES ESPECÍFICOS DEL FORMATO SO-RE-41 (PREOCUPACIONAL)
// ====================================================================

/** Datos personales/demográficos de la Sección A del SO-RE-41. */
export interface DatosPersonalesSO41 {
  religion: string;
  grupoSanguineo: string;
  lateralidad: string;
  orientacionSexual: string;
  identidadGenero: string;
  discapacidad: boolean | null;
  discapacidadTipo: string;
  discapacidadPorcentaje: string;
  raza: string;
  estadoCivil: string;
  gradoInstruccion: string;
  profesion: string;
  actividadesRelevantes: string;
}

/** Empleo anterior (Sección D del SO-RE-41: antecedentes de trabajo). */
export interface AntecedenteEmpleo {
  empresa: string;
  puesto: string;
  actividades: string;
  tiempoMeses: string;
  /** Riesgos a los que estuvo expuesto: FÍSICO, MECÁNICO, QUÍMICO, BIOLÓGICO, ERGONÓMICO, PSICOSOCIAL. */
  riesgos: string[];
  observaciones: string;
}

/** Examen de tamizaje con antigüedad y resultado (PAP, mamografía, PSA, etc.). */
export interface ExamenTamizaje {
  realizado: boolean | null;
  tiempoAnios: string;
  resultado: string;
}

/** Antecedentes gineco-obstétricos (SO-RE-41, solo sexo femenino). */
export interface AntecedentesGineco {
  menarquia: string;
  ciclos: string;
  fum: string;              // fecha de última menstruación (aaaa-mm-dd)
  gestas: string;
  partos: string;
  cesareas: string;
  abortos: string;
  hijosVivos: string;
  hijosMuertos: string;
  vidaSexualActiva: boolean | null;
  planificacionFamiliar: boolean | null;
  planificacionTipo: string;
  papanicolaou: ExamenTamizaje;
  colposcopia: ExamenTamizaje;
  ecoMamario: ExamenTamizaje;
  mamografia: ExamenTamizaje;
}

/** Antecedentes reproductivos masculinos (SO-RE-41, solo sexo masculino). */
export interface AntecedentesReproductivos {
  antigenoProstatico: ExamenTamizaje;
  ecoProstatico: ExamenTamizaje;
  planificacionFamiliar: boolean | null;
  planificacionTipo: string;
  hijosVivos: string;
  hijosMuertos: string;
}

// ====================================================================
// CERTIFICADO DE APTITUD MÉDICO LABORAL (SO-RE-20)
// Anexo a cualquier evaluación (preocupacional, periódica, retiro).
// ====================================================================

export interface LimitacionCertificado {
  actividad: string;
  severidad: 'LEVE' | 'MODERADA' | 'GRAVE';
}

export interface CertificadoAptitud {
  fechaEmision: string; // aaaa-mm-dd
  tipoEvaluacion: 'INGRESO' | 'PERIÓDICO' | 'REINTEGRO' | 'RETIRO';
  aptitud: 'apto' | 'aptoObservacion' | 'aptoLimitaciones' | 'noApto';
  observaciones: string;
  limitaciones: LimitacionCertificado[];
  // Sección D (aplica solo a evaluaciones de retiro)
  retiroRealizada: boolean | null;
  retiroCondicionDiagnostico: 'presuntiva' | 'definitiva' | 'noAplica';
  retiroRelacionadaTrabajo: 'si' | 'no' | 'noAplica';
  recomendaciones: string;
}

export interface FactorRiesgoPuesto {
  puestoArea: string;
  actividades: string;
  tiempoTrabajoMeses: string;
  fisicos: string[];
  mecanicos: string[];
  quimicos: string[];
  biologicos: string[];
  ergonomicos: string[];
  psicosociales: string[];
  medidasPreventivas: string;
}

// ====================================================================
// SISTEMA DE EXÁMENES COMPLEMENTARIOS CON ARCHIVOS
// ====================================================================

export const TIPOS_EXAMEN = [
  'Laboratorio',
  'Imagen',
  'Audiometría',
  'Espirometría',
  'Electrocardiograma',
  'Oftalmología',
  'Optometría',
  'Psicología',
  'Otro',
] as const;
export type TipoExamen = (typeof TIPOS_EXAMEN)[number];

export const GRUPOS_EXAMEN = [
  'Ingreso',
  'Periódico',
  'Particular',
  'Salida',
] as const;
export type GrupoExamen = (typeof GRUPOS_EXAMEN)[number];

export const NOMBRES_EXAMEN_COMUNES = [
  'Biometría hemática',
  'Química sanguínea',
  'Perfil lipídico',
  'Perfil hepático',
  'Perfil tiroideo',
  'EMO (Orina)',
  'Coproparasitario',
  'Glucosa en ayunas',
  'Hemoglobina glicosilada',
  'Creatinina',
  'Ácido úrico',
  'PSA (Antígeno prostático)',
  'Rx Tórax',
  'Rx Columna lumbar',
  'Rx Columna cervical',
  'Ecografía abdominal',
  'Audiometría tonal',
  'Espirometría basal',
  'Electrocardiograma',
  'Optometría / Agudeza visual',
  'Valoración psicológica',
  'Test de drogas',
] as const;

/** Documento de examen complementario almacenado en Firestore (colección `examenes`) */
export interface ExamenComplementarioDoc {
  id?: string;
  trabajadorId: string;
  evaluacionId?: string; // enlace bidireccional a la evaluación

  // Clasificación
  tipoExamen: TipoExamen;
  nombreExamen: string;
  grupoExamen: GrupoExamen;

  // Datos clínicos
  fecha: any;
  resultado: string;
  estado: 'normal' | 'patologico';
  observacion: string; // obligatorio si estado === 'patologico'

  // Archivo adjunto (Firebase Storage)
  archivoUrl: string;
  archivoNombre: string;
  archivoTipo: string; // 'application/pdf' | 'image/jpeg' | 'image/png'
  archivoPath: string; // ruta en Storage para poder eliminarlo

  // Metadatos
  medicoId: string;
  medicoNombre: string;
  createdAt: any;
}

// ====================================================================

export interface EvaluacionMedica {
  id?: string;
  tipo?: 'PERIODICA' | 'RETIRO';
  /** 'preocupacional' para el formato SO-RE-41 (evaluación de ingreso). */
  tipoEvaluacion?: string;
  trabajadorId: string;
  medicoId: string;
  medicoNombre: string;
  medicoCedula: string;
  fecha: any;
  numeroHistoriaClinica: string;
  numeroArchivo: string;

  motivoConsulta: string;
  antecedentesClinicosQuirurgicos?: string;
  antecedentesClinicosQ?: boolean;
  antecedentesClinicosLista?: AntecedenteClinico[];
  antecedentesQuirurgicosQ?: boolean;
  antecedentesQuirurgicosLista?: AntecedenteQuirurgico[];
  alergiasTiene?: boolean;
  alergias?: Alergia[];
  habitosToxicos: HabitoToxico[];
  estiloVida: EstiloVida;
  incidentes: string;
  accidentesTrabajo: AccidenteTrabajo;
  enfermedadesProfesionales: EnfermedadProfesional;
  antecedentesFamiliares: AntecedenteFamiliar[];
  factoresRiesgo?: FactorRiesgoPuesto;
  enfermedadActual: string;
  revisionSistemasSeleccionados: string[];
  revisionSistemasDescripcion?: string;
  revisionSistemasDescripciones?: Record<string, string>;
  medicacionesHabituales?: MedicacionHabitual[];
  signosVitales: SignosVitales;
  examenFisicoHallazgos: ExamenFisicoHallazgo[];
  examenesComplementarios: ExamenComplementario[];
  diagnosticos: Diagnostico[];
  aptitudMedica: 'apto' | 'aptoObservacion' | 'aptoLimitaciones' | 'noApto';
  aptitudObservacion: string;
  aptitudLimitaciones: string;
  recomendaciones: string[];
  recomendacionesOtras: string;

  /** IDs de exámenes vinculados desde la colección `examenes` */
  examenesVinculados?: string[];

  // ── Campos específicos del SO-RE-41 (preocupacional) ──
  /** Edad a la que inició su actividad laboral. */
  edadInicioLaboral?: string;
  /** Antecedentes de empleos anteriores (Sección D). */
  antecedentesEmpleos?: AntecedenteEmpleo[];
  /** Antecedentes gineco-obstétricos (sexo femenino). */
  antecedentesGineco?: AntecedentesGineco;
  /** Antecedentes reproductivos masculinos. */
  antecedentesReproductivos?: AntecedentesReproductivos;
  /** Actividades extra laborales (Sección G del SO-RE-41). */
  actividadesExtraLaborales?: string;
  /** Datos personales/demográficos de la Sección A del SO-RE-41. */
  datosPersonales?: DatosPersonalesSO41;

  /** Certificado de aptitud médico laboral (SO-RE-20) anexo a esta evaluación. */
  certificadoAptitud?: CertificadoAptitud;

  // ── Campos específicos del SO-RE-39 (reintegro) ──
  /** Fecha del último día laboral antes de la ausencia (aaaa-mm-dd). */
  fechaUltimoDiaLaboral?: string;
  /** Fecha de reingreso al trabajo (aaaa-mm-dd). */
  fechaReingreso?: string;
  /** Total de días de ausencia. */
  totalDiasAusencia?: string;
  /** Causa de la salida (enfermedad general, accidente de trabajo, etc.). */
  causaSalida?: string;
  /** Reubicación indicada en la aptitud (Sección H del SO-RE-39). */
  aptitudReubicacion?: string;

  createdAt: any;
}
