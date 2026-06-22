export interface Usuario {
  uid: string;
  email: string;
  nombreCompleto: string;
  cedula: string;
  rol: 'medico' | 'admin';
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

  createdAt: any;
}
