// Modelos del seguimiento externo del trabajador:
//  - Consultas con médicos particulares / especialistas (colección
//    `consultasEspecialista`).
//  - Tratamientos de fisioterapia (colección `fisioterapia`), con certificado
//    en Storage (fisioterapia/{trabajadorId}/...) y permisos internos
//    generados en el módulo de Permisos.

export interface ConsultaEspecialista {
  id?: string;
  trabajadorId: string;

  fecha: any;              // Firestore Timestamp — fecha de la consulta
  especialidad: string;    // Cardiología, Traumatología…
  medico: string;          // nombre del especialista
  centro: string;          // hospital / consultorio (opcional)
  motivo: string;          // motivo o diagnóstico
  notas: string;           // notas u observaciones de la consulta
  seguimiento: string;     // plan / seguimiento posterior indicado
  proximaCita: string;     // aaaa-mm-dd de la cita de control ('' si no hay)
  estado: 'en_seguimiento' | 'alta';

  medicoId: string;        // médico ocupacional que registró
  medicoNombre: string;
  createdAt: any;
}

export const ESPECIALIDADES_FRECUENTES = [
  'Traumatología', 'Cardiología', 'Neurología', 'Oftalmología', 'Otorrinolaringología',
  'Dermatología', 'Gastroenterología', 'Endocrinología', 'Urología', 'Ginecología',
  'Psiquiatría', 'Psicología', 'Neumología', 'Reumatología', 'Cirugía general', 'Medicina interna',
];

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const ZONAS_FISIOTERAPIA = [
  'Columna cervical', 'Columna dorsal', 'Columna lumbar', 'Hombro', 'Codo',
  'Muñeca / mano', 'Cadera', 'Rodilla', 'Tobillo / pie',
];

/** Un intervalo de fechas del tratamiento (los fines de semana se excluyen). */
export interface IntervaloFisio {
  desde: string;   // aaaa-mm-dd
  hasta: string;   // aaaa-mm-dd
}

/** Una sesión (un día laborable) del tratamiento, con su permiso y certificado. */
export interface SesionFisio {
  fecha: string;         // aaaa-mm-dd
  asistio?: boolean;     // marcada como realizada
  permisoId?: string;    // permiso interno generado para este día
  // Comprobante físico de ese día (Firebase Storage)
  certUrl?: string;
  certPath?: string;
  certNombre?: string;
}

export interface RegistroFisioterapia {
  id?: string;
  trabajadorId: string;

  zona: string;              // zona trabajada (rodilla, espalda…)
  indicacion: string;        // indicación médica / diagnóstico que la motiva
  centro: string;            // centro donde recibe la terapia (opcional)

  /** Intervalos de fechas indicados (1 o 2). Los fines de semana no cuentan. */
  intervalos: IntervaloFisio[];
  horaDesde: string;         // horario de cada sesión (para el permiso)
  horaHasta: string;
  /** Sesiones (una por día laborable de los intervalos), con permiso/certificado. */
  sesiones: SesionFisio[];

  notas: string;
  estado: 'activo' | 'finalizado';

  // Orden médica general del tratamiento (opcional, además de los comprobantes por día)
  certUrl?: string;
  certPath?: string;
  certNombre?: string;

  medicoId: string;
  medicoNombre: string;
  createdAt: any;

  // ── Compatibilidad con registros antiguos (solo lectura) ──
  dias?: string[];
  horario?: string;
  desde?: string;
  sesionesTotales?: string;
  sesionesCumplidas?: string;
  permisosGenerados?: string[];
}
