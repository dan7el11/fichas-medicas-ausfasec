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
  evaluaciones: string[]; // IDs de las evaluaciones
  createdAt: Date;
  updatedAt: Date;
}
