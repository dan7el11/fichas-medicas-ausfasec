// Modelo de datos del módulo Permisos médicos.
// Archivo NUEVO — colección Firestore `permisos`.

export type TipoPermiso = 'reposo_interno' | 'reposo_iess' | 'cita';

export interface MetaTipoPermiso {
  label: string;
  short: string;
  color: string;
  unidad: 'días' | 'horas';
  requiereCert: boolean;
}

export const TIPOS_PERMISO: Record<TipoPermiso, MetaTipoPermiso> = {
  reposo_interno: { label: 'Reposo interno', short: 'Interno', color: '#0a6b3b', unidad: 'días', requiereCert: false },
  reposo_iess:    { label: 'Reposo IESS',    short: 'IESS',    color: '#1d4fad', unidad: 'días', requiereCert: true },
  cita:           { label: 'Cita médica',    short: 'Cita',    color: '#7c5cf2', unidad: 'horas', requiereCert: true },
};

export type EstadoPermiso = 'justificado' | 'pendiente' | 'vencido' | 'activo';

/** Documento de permiso médico (colección `permisos`) */
export interface PermisoMedico {
  id?: string;

  // Paciente (desnormalizado para tabla/exportación)
  trabajadorId: string;
  apellidos: string;
  nombres: string;
  cedula: string;
  puesto: string;
  area: string;

  // Datos del permiso
  tipo: TipoPermiso;
  desde: any;            // Firestore Timestamp (fecha de inicio)
  hasta: any;            // Firestore Timestamp (igual a desde si es cita)
  /** Unidad efectiva del permiso: 'dias' u 'horas' (un reposo puede ser por horas). */
  unidad?: 'dias' | 'horas';
  dias: number;          // para reposos por días
  horas: number;         // para permisos por horas (calculado del horario)
  /** Horario del permiso por horas, formato 'HH:MM' (24 h). */
  horaDesde?: string;
  horaHasta?: string;
  motivo: string;
  cieCodigo?: string;
  origen?: string;       // 'IESS' | 'Particular' | 'Interno'

  // Justificativo
  certAdjunto: boolean;        // true si tiene certificado / si es interno
  certNombreArchivo?: string;
  certUrl?: string;            // URL de descarga en Firebase Storage

  // Metadatos
  medicoId: string;
  medicoNombre: string;
  createdAt: any;
}

export const MOTIVOS_REPOSO_FRECUENTES = [
  'Infección respiratoria aguda',
  'Gastroenteritis aguda',
  'Lumbalgia mecánica',
  'Esguince de tobillo',
  'Crisis asmática',
  'Infección urinaria',
  'Gastritis aguda',
  'Síndrome viral',
];
