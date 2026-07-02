// Modelo de datos del módulo de Evaluaciones Ergonómicas.
// Colección Firestore: `evaluacionesErgonomicas`. Fotos en Storage: ergonomia/{trabajadorId}/.

export type MetodoErgo = 'RULA' | 'REBA' | 'NIOSH' | 'ROSA';

export type ToneErgo = 'success' | 'warning' | 'danger';

/** Resultado calculado de una evaluación (puntaje final + interpretación). */
export interface ResultadoErgo {
  metodo: MetodoErgo;
  puntajeFinal: number;
  nivel: string;        // ej. 'Riesgo medio'
  accion: string;       // ej. 'Investigar y cambiar pronto'
  tone: ToneErgo;       // para el color en la UI
  detalle: Record<string, number>; // puntajes intermedios (A, B, C…)
}

/** Foto adjunta (con sus mediciones de ángulo opcionales, Fase B). */
export interface FotoErgo {
  url: string;
  path: string;
  nombre: string;
}

/** Documento de evaluación ergonómica. */
export interface EvaluacionErgonomica {
  id?: string;

  // Paciente (desnormalizado para lista/PDF)
  trabajadorId: string;
  apellidos: string;
  nombres: string;
  cedula: string;
  puesto: string;
  area: string;

  // Evaluación
  metodo: MetodoErgo;
  fecha: any;            // Firestore Timestamp
  tarea: string;         // descripción de la tarea/actividad evaluada
  lado?: 'izquierdo' | 'derecho';
  /** Valores efectivos de cada segmento/factor (entrada del motor). */
  entradas: Record<string, number>;
  resultado: ResultadoErgo;
  fotos: FotoErgo[];
  observaciones: string;
  recomendaciones: string;

  // Metadatos
  medicoId: string;
  medicoNombre: string;
  createdAt: any;
}
