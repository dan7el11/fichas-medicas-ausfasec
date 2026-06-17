// Respaldo completo de los datos de esta instancia (una empresa).
// Lee todas las colecciones de Firestore y produce un archivo JSON descargable.
// Es la red de seguridad básica ante "¿y si pierdo los datos?".
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

// Todas las colecciones que usa el sistema.
const COLECCIONES = [
  'trabajadores', 'evaluaciones', 'atenciones', 'permisos', 'examenes',
  'signos', 'reposos', 'protocolosPuesto', 'ordenesExamen',
  'configuracion', 'inventarios', 'usuarios',
];

export interface Respaldo {
  generadoEn: string;
  version: number;
  totales: Record<string, number>;
  colecciones: Record<string, any[]>;
}

/** Lee todas las colecciones y arma el objeto de respaldo. */
export async function generarRespaldo(): Promise<Respaldo> {
  const colecciones: Record<string, any[]> = {};
  const totales: Record<string, number> = {};
  for (const col of COLECCIONES) {
    try {
      const snap = await getDocs(collection(db, col));
      colecciones[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      totales[col] = colecciones[col].length;
    } catch (err) {
      // Si una colección no es accesible, se registra vacía y se continúa.
      console.warn(`[respaldo] no se pudo leer la colección "${col}":`, err);
      colecciones[col] = [];
      totales[col] = 0;
    }
  }
  return { generadoEn: new Date().toISOString(), version: 1, totales, colecciones };
}

/** Genera el respaldo y dispara la descarga del archivo JSON. */
export async function descargarRespaldo(): Promise<Respaldo> {
  const data = await generarRespaldo();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `respaldo_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return data;
}
