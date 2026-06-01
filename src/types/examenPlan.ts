// Modelo de datos: planificación de exámenes ocupacionales y protocolos por puesto.
// Archivo NUEVO. Colecciones Firestore: `ordenesExamen` y `protocolosPuesto`.
// Reutiliza los tipos de examen que ya existen en types/index.ts.
import type { TipoExamen } from './index';

/** Un examen dentro de una orden o un protocolo */
export interface ExamenItem {
  nombre: string;
  tipo: TipoExamen;
  realizado: boolean;
  fechaRealizado?: any;     // Timestamp cuando se marca realizado
  examenDocId?: string;     // enlace opcional al doc de `examenes` (resultado/archivo)
}

export type TipoEvaluacionExamen = 'Ingreso' | 'Periódico' | 'Retiro' | 'Reintegro' | 'Especial';
export const TIPOS_EVALUACION_EXAMEN: TipoEvaluacionExamen[] = ['Ingreso', 'Periódico', 'Retiro', 'Reintegro', 'Especial'];

/** Orden de exámenes programada para un trabajador (colección `ordenesExamen`) */
export interface OrdenExamen {
  id?: string;
  trabajadorId: string;
  apellidos: string;
  nombres: string;
  cedula: string;
  puesto: string;
  departamento: string;

  tipoEvaluacion: TipoEvaluacionExamen;
  fechaProgramada: any;     // Timestamp
  examenes: ExamenItem[];

  observaciones?: string;
  medicoId: string;
  medicoNombre: string;
  createdAt: any;
}

/** Protocolo editable: batería de exámenes exigida por un puesto (colección `protocolosPuesto`) */
export interface ProtocoloPuesto {
  id?: string;              // usamos el nombre del puesto como id del documento
  puesto: string;
  examenes: { nombre: string; tipo: TipoExamen }[];
  updatedAt: any;
}

/** Estado calculado de una orden */
export type EstadoOrden = 'completado' | 'atrasado' | 'proceso' | 'programado';

export interface EstadoOrdenInfo {
  key: EstadoOrden;
  label: string;
  tone: 'success' | 'danger' | 'warning' | 'info';
  dias: number | null;      // días hasta la fecha programada (negativo = pasada)
}

// ── Protocolos por defecto (semilla). Editables desde la UI; persisten en Firestore. ──
// El usuario puede ajustar la batería de cada puesto y se guarda en `protocolosPuesto`.
export const PROTOCOLOS_DEFAULT: Record<string, { nombre: string; tipo: TipoExamen }[]> = {
  'Soldador': [
    { nombre: 'Biometría hemática', tipo: 'Laboratorio' },
    { nombre: 'Audiometría tonal', tipo: 'Audiometría' },
    { nombre: 'Espirometría basal', tipo: 'Espirometría' },
    { nombre: 'Optometría / Agudeza visual', tipo: 'Optometría' },
    { nombre: 'Rx Tórax', tipo: 'Imagen' },
  ],
  'Operario de planta': [
    { nombre: 'Biometría hemática', tipo: 'Laboratorio' },
    { nombre: 'Audiometría tonal', tipo: 'Audiometría' },
    { nombre: 'Espirometría basal', tipo: 'Espirometría' },
    { nombre: 'Rx Columna lumbar', tipo: 'Imagen' },
  ],
  'Conductor': [
    { nombre: 'Optometría / Agudeza visual', tipo: 'Optometría' },
    { nombre: 'Audiometría tonal', tipo: 'Audiometría' },
    { nombre: 'Electrocardiograma', tipo: 'Electrocardiograma' },
    { nombre: 'Glucosa en ayunas', tipo: 'Laboratorio' },
    { nombre: 'Valoración psicológica', tipo: 'Psicología' },
  ],
  'Bodeguero': [
    { nombre: 'Rx Columna lumbar', tipo: 'Imagen' },
    { nombre: 'Biometría hemática', tipo: 'Laboratorio' },
    { nombre: 'Optometría / Agudeza visual', tipo: 'Optometría' },
  ],
  'Administrativo': [
    { nombre: 'Optometría / Agudeza visual', tipo: 'Optometría' },
    { nombre: 'Biometría hemática', tipo: 'Laboratorio' },
  ],
};

/** Batería por defecto cuando el puesto no tiene protocolo definido */
export const PROTOCOLO_GENERICO: { nombre: string; tipo: TipoExamen }[] = [
  { nombre: 'Biometría hemática', tipo: 'Laboratorio' },
  { nombre: 'Optometría / Agudeza visual', tipo: 'Optometría' },
];
