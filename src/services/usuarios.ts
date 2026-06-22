// Gestión de usuarios (médicos / administradores) desde la app.
// Permite a un administrador crear cuentas, cambiar el rol, activar/desactivar y
// enviar correos de recuperación de contraseña, sin entrar a la consola de Firebase.
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
} from 'firebase/auth';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth, firebaseConfig } from './firebase';
import type { Usuario } from '../types';

/** Lista todos los usuarios registrados (colección `usuarios`). */
export async function listarUsuarios(): Promise<Usuario[]> {
  const snap = await getDocs(collection(db, 'usuarios'));
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Usuario, 'uid'>) }));
}

export interface NuevoUsuario {
  email: string;
  password: string;
  nombreCompleto: string;
  cedula: string;
  rol: 'medico' | 'admin';
}

/**
 * Crea una cuenta nueva SIN cerrar la sesión del administrador.
 * Truco: se usa una instancia secundaria de Firebase para el alta; la sesión
 * principal (la del admin) no se ve afectada.
 */
export async function crearUsuario(datos: NuevoUsuario): Promise<void> {
  const secApp = initializeApp(firebaseConfig, `alta-${Date.now()}`);
  const secAuth = getAuth(secApp);
  try {
    const cred = await createUserWithEmailAndPassword(secAuth, datos.email.trim(), datos.password);
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      email: datos.email.trim(),
      nombreCompleto: datos.nombreCompleto.trim(),
      cedula: datos.cedula.trim(),
      rol: datos.rol,
      activo: true,
      createdAt: new Date(),
    });
    await signOut(secAuth);
  } finally {
    await deleteApp(secApp);
  }
}

/** Cambia el rol de un usuario. */
export async function actualizarRol(uid: string, rol: 'medico' | 'admin'): Promise<void> {
  await updateDoc(doc(db, 'usuarios', uid), { rol });
}

/** Activa o desactiva el acceso de un usuario. */
export async function setActivo(uid: string, activo: boolean): Promise<void> {
  await updateDoc(doc(db, 'usuarios', uid), { activo });
}

/** Envía un correo de recuperación de contraseña (usa la sesión principal). */
export async function enviarReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}
