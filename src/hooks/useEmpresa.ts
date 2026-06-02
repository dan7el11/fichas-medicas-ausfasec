import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface DatosEmpresa {
  institucion: string;
  ruc: string;
  ciu: string;
  establecimiento: string;
}

const DEFAULTS: DatosEmpresa = {
  institucion: 'CEM AUSTROGAS',
  ruc: '190070301001',
  ciu: '4661',
  establecimiento: 'MEDICINA OCUPACIONAL',
};

export function useEmpresa() {
  const [empresa, setEmpresa] = useState<DatosEmpresa>(DEFAULTS);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'configuracion', 'empresa'))
      .then(snap => {
        if (snap.exists()) setEmpresa({ ...DEFAULTS, ...snap.data() } as DatosEmpresa);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const guardar = async (datos: DatosEmpresa) => {
    await setDoc(doc(db, 'configuracion', 'empresa'), datos);
    setEmpresa(datos);
  };

  return { empresa, cargando, guardar };
}
