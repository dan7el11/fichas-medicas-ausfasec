// Capa de datos del seguimiento externo del trabajador:
// consultas con especialistas (`consultasEspecialista`) y tratamientos de
// fisioterapia (`fisioterapia`, con certificado en Storage).
// Las consultas evitan orderBy en Firestore (requiere índice compuesto y falla
// en silencio si no existe): se ordena en el cliente.
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query as fbQuery, where, Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import { registrarAuditoria } from './auditoria';
import type { ConsultaEspecialista, RegistroFisioterapia } from '../types/seguimiento';

const COL_ESP = 'consultasEspecialista';
const COL_FISIO = 'fisioterapia';

const segundos = (f: any): number => (typeof f?.seconds === 'number' ? f.seconds : new Date(f).getTime() / 1000 || 0);

// ── Consultas con especialistas ──────────────────────────────────────────────

export async function getConsultasEspecialista(trabajadorId: string): Promise<ConsultaEspecialista[]> {
  const snap = await getDocs(fbQuery(collection(db, COL_ESP), where('trabajadorId', '==', trabajadorId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ConsultaEspecialista))
    .sort((a, b) => segundos(b.fecha) - segundos(a.fecha));
}

export async function crearConsultaEspecialista(data: Omit<ConsultaEspecialista, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, COL_ESP), { ...data, createdAt: Timestamp.now() });
  await registrarAuditoria('crear', 'especialista', ref.id, `Consulta con ${data.especialidad || 'especialista'} registrada`);
  return ref.id;
}

export async function actualizarConsultaEspecialista(id: string, patch: Partial<ConsultaEspecialista>): Promise<void> {
  await updateDoc(doc(db, COL_ESP, id), patch as any);
  await registrarAuditoria('editar', 'especialista', id, 'Actualizó un seguimiento con especialista');
}

export async function eliminarConsultaEspecialista(id: string): Promise<void> {
  await deleteDoc(doc(db, COL_ESP, id));
  await registrarAuditoria('eliminar', 'especialista', id, 'Eliminó un seguimiento con especialista');
}

// ── Fisioterapia ─────────────────────────────────────────────────────────────

export async function getFisioterapias(trabajadorId: string): Promise<RegistroFisioterapia[]> {
  const snap = await getDocs(fbQuery(collection(db, COL_FISIO), where('trabajadorId', '==', trabajadorId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as RegistroFisioterapia))
    .sort((a, b) => segundos(b.createdAt) - segundos(a.createdAt));
}

export async function crearFisioterapia(data: Omit<RegistroFisioterapia, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, COL_FISIO), { ...data, createdAt: Timestamp.now() });
  await registrarAuditoria('crear', 'fisioterapia', ref.id, `Fisioterapia (${data.zona || 'sin zona'}) registrada`);
  return ref.id;
}

export async function actualizarFisioterapia(id: string, patch: Partial<RegistroFisioterapia>): Promise<void> {
  await updateDoc(doc(db, COL_FISIO, id), patch as any);
}

export async function eliminarFisioterapia(reg: RegistroFisioterapia): Promise<void> {
  if (!reg.id) return;
  if (reg.certPath) {
    try { await deleteObject(storageRef(storage, reg.certPath)); } catch { /* ya no existe */ }
  }
  await deleteDoc(doc(db, COL_FISIO, reg.id));
  await registrarAuditoria('eliminar', 'fisioterapia', reg.id, 'Eliminó un registro de fisioterapia');
}

/** Sube el certificado/orden médica y lo asocia al registro de fisioterapia. */
export async function subirCertificadoFisioterapia(reg: RegistroFisioterapia, file: File): Promise<Partial<RegistroFisioterapia>> {
  if (!reg.id) throw new Error('Registro sin id');
  const path = `fisioterapia/${reg.trabajadorId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const snap = await uploadBytes(storageRef(storage, path), file);
  const url = await getDownloadURL(snap.ref);
  const patch = { certUrl: url, certPath: path, certNombre: file.name };
  await updateDoc(doc(db, COL_FISIO, reg.id), patch);
  return patch;
}
