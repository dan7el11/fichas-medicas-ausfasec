// Modelo del registro de auditoría (bitácora de cambios).
// Colección Firestore: `auditoria`. Es de solo-anexar (append-only): nadie puede
// editar ni borrar registros, para que sirva como evidencia.

export type AccionAuditoria = 'crear' | 'editar' | 'eliminar';

/** Una entrada de la bitácora. */
export interface RegistroAuditoria {
  id?: string;
  fecha: any;            // Firestore Timestamp
  usuarioId: string;     // uid de quien hizo la acción
  usuarioEmail: string;  // correo (desnormalizado para la vista)
  accion: AccionAuditoria;
  entidad: string;       // 'trabajador' | 'evaluacion' | 'atencion' | 'permiso' | 'usuario' | ...
  entidadId: string;     // id del documento afectado
  descripcion: string;   // texto legible para la vista
  /**
   * Copia exacta del documento eliminado, tal como estaba en Firestore. Sólo
   * en las eliminaciones que se pueden deshacer (evaluaciones): la bitácora no
   * se puede modificar ni borrar, así que es el sitio seguro para guardarla.
   */
  copia?: Record<string, any>;
}
