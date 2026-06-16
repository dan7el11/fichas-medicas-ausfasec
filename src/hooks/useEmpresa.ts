// Compatibilidad: el hook ahora vive en el contexto de empresa, que carga la
// configuración una sola vez para toda la app. Se re-exporta desde aquí para no
// romper los imports existentes (`from '../hooks/useEmpresa'`).
export { useEmpresa, EmpresaProvider } from '../contexts/EmpresaContext';
export type { DatosEmpresa } from '../contexts/EmpresaContext';
