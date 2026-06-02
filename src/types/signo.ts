// Modelo de datos — Mediciones de signos. Archivo NUEVO. Colección Firestore: `signos`.

export type TipoSigno = 'presion' | 'peso' | 'glucosa';

export interface MedicionSigno {
  id?: string;
  trabajadorId: string;
  tipo: TipoSigno;
  fecha: any;                 // Timestamp — en presión/glucosa incluye HORA exacta
  // Presión
  sistolica?: number;
  diastolica?: number;
  // Peso
  peso?: number;
  imc?: number;               // calculado con la talla al registrar
  // Glucosa
  glucosa?: number;
  contexto?: 'Ayunas' | 'Postprandial';
  // común
  observacion?: string;
  medicoId?: string;
  createdAt?: any;
}

export const SIGNO_META: Record<TipoSigno, { label: string; unidad: string; color: string; conHora: boolean }> = {
  presion: { label: 'Presión arterial', unidad: 'mmHg', color: '#dc2e3c', conHora: true },
  peso:    { label: 'Peso',             unidad: 'kg',    color: '#0f766e', conHora: false },
  glucosa: { label: 'Glucosa',          unidad: 'mg/dL', color: '#a01f2a', conHora: true },
};
