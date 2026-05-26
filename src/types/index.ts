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
  codigo: string;      // Ej: "9a"
  region: string;      // Ej: "Abdomen"
  subregion: string;   // Ej: "Vísceras"
  descripcion: string; // Lo que escribe el médico
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

export interface EvaluacionMedica {
  id?: string;
  trabajadorId: string;
  medicoId: string;
  medicoNombre: string;
  medicoCedula: string;
  fecha: Date;
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

  createdAt: Date;
}
