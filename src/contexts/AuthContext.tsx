import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { Usuario } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Perfil del médico desde Firestore usuarios/{uid} (null si aún no lo completó) */
  perfil: Usuario | null;
  /** Nombre a mostrar: nombreCompleto del perfil → email sin dominio → 'Médico' */
  displayName: string;
  /** Iniciales para el avatar */
  initials: string;
  /** Rol admin real (usuarios/{uid}.rol === 'admin') */
  isAdmin: boolean;
  logout: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, perfil: null, displayName: 'Médico', initials: 'DR',
  isAdmin: false, logout: async () => {}, refreshPerfil: async () => {},
});

export const useAuth = () => useContext(AuthContext);

async function cargarPerfil(u: User): Promise<Usuario | null> {
  const snap = await getDoc(doc(db, 'usuarios', u.uid));
  let data = snap.exists() ? (snap.data() as Usuario) : null;

  // Bootstrap único del rol admin: si el doc no tiene rol y el email contiene
  // "admin", se persiste rol:'admin' una sola vez. A partir de entonces la
  // autorización depende solo del campo rol en Firestore.
  if ((!data || !data.rol) && u.email?.includes('admin')) {
    try {
      await setDoc(doc(db, 'usuarios', u.uid), { email: u.email, rol: 'admin' }, { merge: true });
      data = { ...(data ?? { uid: u.uid, email: u.email ?? '', nombreCompleto: '', cedula: '', createdAt: new Date() }), rol: 'admin' } as Usuario;
    } catch (e) {
      console.error('No se pudo registrar el rol admin:', e);
    }
  }
  return data;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escucha los cambios de sesión en Firebase
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          setPerfil(await cargarPerfil(currentUser));
        } catch (e) {
          console.error('Error al cargar el perfil del usuario:', e);
          setPerfil(null);
        }
      } else {
        setPerfil(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const refreshPerfil = useCallback(async () => {
    if (!user) return;
    try {
      setPerfil(await cargarPerfil(user));
    } catch (e) {
      console.error('Error al refrescar el perfil:', e);
    }
  }, [user]);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const displayName = perfil?.nombreCompleto?.trim()
    || user?.email?.split('@')[0]
    || 'Médico';

  const initials = (() => {
    const n = perfil?.nombreCompleto?.trim();
    if (n) {
      const partes = n.replace(/^Dra?\.?\s+/i, '').split(/\s+/).filter(Boolean);
      if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
      if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    }
    return user?.email?.slice(0, 2).toUpperCase() ?? 'DR';
  })();

  const isAdmin = perfil?.rol === 'admin';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, perfil, displayName, initials, isAdmin, logout, refreshPerfil }}>
      {children}
    </AuthContext.Provider>
  );
};
