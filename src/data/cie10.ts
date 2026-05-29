export interface DiagnosticoCIE10 {
  codigo: string;
  descripcion: string;
}

export const catalogoCIE10: DiagnosticoCIE10[] = [
  { codigo: 'Z00.0', descripcion: 'Examen médico general' },
  { codigo: 'Z01.0', descripcion: 'Examen de ojos y de la visión' },
  { codigo: 'Z10.0', descripcion: 'Examen de salud ocupacional' },
  { codigo: 'J00', descripcion: 'Rinofaringitis aguda [resfriado común]' },
  { codigo: 'J03.9', descripcion: 'Amigdalitis aguda, no especificada' },
  { codigo: 'M54.5', descripcion: 'Lumbago no especificado' },
  { codigo: 'M54.2', descripcion: 'Cervicalgia' },
  { codigo: 'H10.9', descripcion: 'Conjuntivitis, no especificada' },
  { codigo: 'E11.9', descripcion: 'Diabetes mellitus tipo 2 sin complicaciones' },
  { codigo: 'I10', descripcion: 'Hipertensión esencial (primaria)' },
  { codigo: 'R51', descripcion: 'Cefalea' },
];
