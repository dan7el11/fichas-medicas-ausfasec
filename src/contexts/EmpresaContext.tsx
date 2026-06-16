// Contexto de empresa: carga UNA sola vez la configuración institucional desde
// Firestore (configuracion/empresa) y la entrega de forma síncrona a toda la
// app. Reemplaza al antiguo hook que hacía una lectura por componente.
//
// Single-tenant: cada instalación (una empresa) configura sus datos en la
// pantalla de Configuración y aparecen en encabezados, PDF y certificados.
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface DatosEmpresa {
  institucion: string;       // nombre mostrado en encabezados, login y PDF
  ruc: string;
  ciu: string;
  establecimiento: string;
  prefijoArchivo: string;    // prefijo del N° de archivo de las evaluaciones
  logoUrl: string;           // logo opcional (URL); si vacío usa /logo.png
  emailDominio: string;      // dominio sugerido en el placeholder del login
}

// Valores por defecto = respaldo de la instalación actual (CEM AUSTROGAS).
// En una instalación nueva, la pantalla de Configuración los sobrescribe.
const DEFAULTS: DatosEmpresa = {
  institucion: 'CEM AUSTROGAS',
  ruc: '190070301001',
  ciu: '4661',
  establecimiento: 'MEDICINA OCUPACIONAL',
  prefijoArchivo: 'AUSTROGAS',
  logoUrl: '',
  emailDominio: 'austrogas.com',
};

interface EmpresaContextType {
  empresa: DatosEmpresa;
  cargando: boolean;
  guardar: (datos: DatosEmpresa) => Promise<void>;
}

const EmpresaContext = createContext<EmpresaContextType>({
  empresa: DEFAULTS,
  cargando: true,
  guardar: async () => {},
});

export const useEmpresa = () => useContext(EmpresaContext);

export const EmpresaProvider = ({ children }: { children: ReactNode }) => {
  const [empresa, setEmpresa] = useState<DatosEmpresa>(DEFAULTS);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'configuracion', 'empresa'))
      .then((snap) => {
        if (snap.exists()) setEmpresa({ ...DEFAULTS, ...snap.data() } as DatosEmpresa);
      })
      .catch(() => {}) // sin sesión / sin permiso: se usan los valores por defecto
      .finally(() => setCargando(false));
  }, []);

  // Título de la pestaña del navegador según la empresa configurada.
  useEffect(() => {
    document.title = empresa.institucion
      ? `${empresa.institucion} — Fichas Médicas`
      : 'Fichas Médicas Ocupacionales';
  }, [empresa.institucion]);

  const guardar = useCallback(async (datos: DatosEmpresa) => {
    await setDoc(doc(db, 'configuracion', 'empresa'), datos);
    setEmpresa(datos);
  }, []);

  return (
    <EmpresaContext.Provider value={{ empresa, cargando, guardar }}>
      {children}
    </EmpresaContext.Provider>
  );
};
