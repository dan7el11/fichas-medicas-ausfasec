export interface Usuario {
  uid: string;
  email: string;
  nombreCompleto: string;
  cedula: string;
  rol: 'medico' | 'admin';
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

export interface EvaluacionMedica {
  id?: string;
  trabajadorId: string;
  medicoId: string;
  medicoNombre: string;
  medicoCedula: string;
  fecha: any;
  numeroHistoriaClinica: string;
  numeroArchivo: string;

  // B. Motivo de consulta
  motivoConsulta: string;

  // C. Antecedentes personales
  antecedentesClinicosQuirurgicos: string;
  habitosToxicos: HabitoToxico[];
  estiloVida: EstiloVida;
  incidentes: string;
  accidentesTrabajo: AccidenteTrabajo;
  enfermedadesProfesionales: EnfermedadProfesional;

  // D. Antecedentes familiares
  antecedentesFamiliares: AntecedenteFamiliar[];

  // E. Factores de riesgo del puesto de trabajo
  factoresRiesgo?: FactorRiesgoPuesto;

  // F. Enfermedad actual
  enfermedadActual: string;

  // G. Revisión de órganos y sistemas
  revisionSistemasSeleccionados: string[];
  revisionSistemasDescripcion: string;

  // H. Signos vitales
  signosVitales: SignosVitales;

  // I. Examen físico regional
  examenFisicoHallazgos: ExamenFisicoHallazgo[];

  // J. Exámenes complementarios
  examenesComplementarios: ExamenComplementario[];

  // K. Diagnósticos
  diagnosticos: Diagnostico[];

  // L. Aptitud médica
  aptitudMedica: 'apto' | 'aptoObservacion' | 'aptoLimitaciones' | 'noApto';
  aptitudObservacion: string;
  aptitudLimitaciones: string;

  // M. Recomendaciones
  recomendaciones: string[];
  recomendacionesOtras: string;

  createdAt: any;
}
