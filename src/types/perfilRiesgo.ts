// Perfil de riesgo por función y cargo.
//
// La línea base viene del análisis auditado (`constants/perfilRiesgoCargo.ts`)
// y se autocompleta en cada evaluación. Los ajustes que haga el equipo de
// seguridad se guardan como documentos en Firestore y se superponen a esa
// línea base, para no perderlos si el análisis se vuelve a generar.

export interface PerfilRiesgoCargo {
  /** Nombre del cargo, tal como está en el catálogo de funciones. */
  cargo: string;
  departamento: string;
  /** Actividades representativas de la jornada (columnas 1..n de la matriz). */
  actividades: string[];
  /** Factor de riesgo → índices (base 0) de las actividades donde está presente. */
  riesgoActividades: Record<string, number[]>;
  /** Nivel registrado en el profesiograma previo (TRIVIAL, MODERADO, …). */
  niveles?: Record<string, string>;
}

/** Perfil editado y guardado en Firestore (colección `perfilesRiesgo`). */
export interface PerfilRiesgoGuardado extends PerfilRiesgoCargo {
  /** Id del documento = cargo normalizado. */
  id?: string;
  actualizadoEn?: any;
  actualizadoPor?: string;
}

/** Estado de un cargo frente al análisis de riesgos. */
export type EstadoCobertura = 'con-analisis' | 'personalizado' | 'sin-analisis';

export interface CoberturaCargo {
  cargo: string;
  departamento: string;
  estado: EstadoCobertura;
  /** Nº de trabajadores activos registrados con ese cargo. */
  trabajadores: number;
  actividades: number;
  factores: number;
  /** true si el cargo no está en el catálogo institucional de funciones. */
  fueraDeCatalogo: boolean;
}
