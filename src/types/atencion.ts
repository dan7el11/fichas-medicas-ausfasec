// Modelo de datos del módulo Consulta Médica Diaria.
// Archivo NUEVO — no modifica src/types/index.ts.
// La atención se guarda en la colección Firestore `atenciones`.

export interface SignosVitalesConsulta {
  pa?: string;    // presión arterial, ej. "120/80"
  fc?: string;    // frecuencia cardiaca
  temp?: string;  // temperatura
  spo2?: string;  // saturación
}

export interface MedicacionAdministrada {
  nombre: string;
  cantidad: number;
}

/** Documento de atención médica diaria (colección `atenciones`) */
export interface AtencionMedica {
  id?: string;

  // ── Paciente ──────────────────────────────────────────────
  pacienteTipo: 'trabajador' | 'externo';
  trabajadorId?: string;     // si pacienteTipo === 'trabajador'
  pacienteApellidos: string; // desnormalizado para la tabla/exportación
  pacienteNombres: string;
  pacienteDetalle?: string;  // externo: "Contratista · Soldadura", etc.
  sexo: 'M' | 'F' | '';
  edad: number | null;

  // ── Datos clínicos ────────────────────────────────────────
  fecha: any;                // Firestore Timestamp
  motivo: string;
  cieCodigo: string;
  cieDescripcion: string;
  tipoAtencion: 'Primera' | 'Subsecuente';
  relacion: 'Común' | 'Ocupacional';
  signosVitales: SignosVitalesConsulta;
  procedimientos: string[];
  medicacion: MedicacionAdministrada[];
  /** Centro desde el que se atendió (origen del stock de la medicación). */
  centroAtencion?: string;
  reposoDias: number;
  observaciones: string;
  estado: 'atendido' | 'espera';

  // ── Metadatos ─────────────────────────────────────────────
  medicoId: string;
  medicoNombre: string;
  createdAt: any;            // Firestore Timestamp
}

/** Procedimientos frecuentes en el dispensario */
export const PROCEDIMIENTOS_CONSULTA = [
  'Curación simple',
  'Curación compleja',
  'Inyección IM',
  'Inyección IV',
  'Toma de presión arterial',
  'Nebulización',
  'Retiro de puntos',
  'Vendaje / inmovilización',
  'Glucemia capilar',
  'Lavado ocular',
] as const;

/** Medicamentos del botiquín (lista local; el módulo de Inventario la reemplazará a futuro) */
export const MEDICAMENTOS_DISPENSARIO = [
  'Paracetamol 500 mg',
  'Ibuprofeno 400 mg',
  'Diclofenaco 75 mg/3 mL',
  'Omeprazol 20 mg',
  'Loratadina 10 mg',
  'Amoxicilina 500 mg',
  'Naproxeno 550 mg',
  'Complejo B (ampolla)',
  'Suero oral',
  'Sales de rehidratación',
  'Gel antiinflamatorio',
  'Butilescopolamina 10 mg',
  'Salbutamol inhalador',
  'Cetirizina 10 mg',
  'Metoclopramida 10 mg',
] as const;
