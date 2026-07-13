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

export interface RegistroFisioterapia {
  id?: string;
  trabajadorId: string;

  zona: string;              // zona trabajada (rodilla, espalda…)
  indicacion: string;        // indicación médica / diagnóstico que la motiva
  centro: string;            // centro donde recibe la terapia (opcional)
  dias: string[];            // días indicados (Lunes, Miércoles…)
  horario: string;           // ej. "08:00 – 09:00"
  desde: string;             // aaaa-mm-dd — inicio del tratamiento
  sesionesTotales: string;   // nº de sesiones indicadas ('' si no se sabe)
  sesionesCumplidas: string; // nº de sesiones ya realizadas
  notas: string;
  estado: 'activo' | 'finalizado';

  // Certificado / orden médica adjunta (Firebase Storage)
  certUrl?: string;
  certPath?: string;
  certNombre?: string;

  /** IDs de permisos internos generados para asistir a las sesiones. */
  permisosGenerados?: string[];

  medicoId: string;
  medicoNombre: string;
  createdAt: any;
}
