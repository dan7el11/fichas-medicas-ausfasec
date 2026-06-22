// Gestión de usuarios (solo administradores). Crear médicos/administradores,
// cambiar rol, activar/desactivar y enviar correo de recuperación de contraseña.
// Ruta: /usuarios
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ShieldCheck, Stethoscope, KeyRound, Power, X, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import TopBar from '../components/dashboard/TopBar';
import { listarUsuarios, crearUsuario, actualizarRol, setActivo, enviarReset } from '../services/usuarios';
import type { Usuario } from '../types';
import { COLORS, FONTS } from '../theme';

const BRAND = COLORS.brand;

export default function GestionUsuarios() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'AD';

  const cargar = async () => {
    setCargando(true);
    try { setUsuarios(await listarUsuarios()); }
    catch (err) { console.error(err); toast.error('No se pudieron cargar los usuarios.'); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center text-center" style={{ fontFamily: FONTS.sans }}>
        <div>
          <ShieldCheck size={40} className="mx-auto mb-3" style={{ color: COLORS.bad }} />
          <div className="font-bold text-lg">Acceso restringido</div>
          <div className="text-sm text-slate-500 mt-1.5">Solo los administradores pueden gestionar usuarios.</div>
          <button onClick={() => navigate('/')} className="mt-4 px-5 py-2 text-white rounded-lg font-semibold" style={{ background: BRAND }}>Volver al inicio</button>
        </div>
      </div>
    );
  }

  const cambiarRol = async (u: Usuario) => {
    const nuevo = u.rol === 'admin' ? 'medico' : 'admin';
    if (u.uid === user?.uid && nuevo === 'medico') {
      const ok = await confirm({ message: 'Vas a quitarte a ti mismo el rol de administrador. Perderás el acceso a esta pantalla. ¿Continuar?', danger: true, confirmLabel: 'Sí, quitar' });
      if (!ok) return;
    }
    try { await actualizarRol(u.uid, nuevo); toast.success(`Rol actualizado a ${nuevo}.`); cargar(); }
    catch (err) { console.error(err); toast.error('No se pudo cambiar el rol.'); }
  };

  const cambiarActivo = async (u: Usuario) => {
    const activar = u.activo === false;
    if (!activar && u.uid === user?.uid) { toast.error('No puedes desactivar tu propia cuenta.'); return; }
    if (!activar) {
      const ok = await confirm({ message: `Desactivar a ${u.nombreCompleto || u.email}. No podrá iniciar sesión hasta reactivarlo. ¿Continuar?`, danger: true, confirmLabel: 'Desactivar' });
      if (!ok) return;
    }
    try { await setActivo(u.uid, activar); toast.success(activar ? 'Usuario activado.' : 'Usuario desactivado.'); cargar(); }
    catch (err) { console.error(err); toast.error('No se pudo actualizar el estado.'); }
  };

  const resetear = async (u: Usuario) => {
    try { await enviarReset(u.email); toast.success(`Correo de recuperación enviado a ${u.email}.`); }
    catch (err) { console.error(err); toast.error('No se pudo enviar el correo.'); }
  };

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg, fontFamily: FONTS.sans, color: COLORS.ink }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Admin'} userRol="Administrador" onNewWorker={() => navigate('/nuevo-trabajador')} />

      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <div className="flex items-end justify-between gap-3 mb-6 flex-wrap">
          <div>
            <h1 className="m-0 text-[26px] font-bold tracking-tight" style={{ fontFamily: FONTS.serif }}>Usuarios del sistema</h1>
            <p className="m-0 text-sm text-slate-500 mt-1">Médicos y administradores con acceso a esta instancia.</p>
          </div>
          <button onClick={() => setModalNuevo(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white font-bold rounded-[9px] text-sm" style={{ background: BRAND }}>
            <UserPlus size={16} /> Nuevo usuario
          </button>
        </div>

        <div className="bg-white border rounded-[14px] overflow-hidden shadow-sm" style={{ borderColor: COLORS.line }}>
          {cargando ? (
            <div className="p-12 text-center text-slate-400">Cargando usuarios…</div>
          ) : usuarios.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">No hay usuarios registrados todavía.</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left" style={{ background: COLORS.bg, borderColor: COLORS.line }}>
                  {['Usuario', 'Rol', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.faint }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const activo = u.activo !== false;
                  return (
                    <tr key={u.uid} className="border-t" style={{ borderColor: COLORS.line }}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{u.nombreCompleto || '(sin nombre)'} {u.uid === user?.uid && <span className="text-[10px] text-slate-400">(tú)</span>}</div>
                        <div className="text-[11.5px] text-slate-500 font-mono">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold"
                          style={u.rol === 'admin' ? { background: '#ede9fe', color: '#6d28d9' } : { background: COLORS.okBg, color: COLORS.ok }}>
                          {u.rol === 'admin' ? <ShieldCheck size={12} /> : <Stethoscope size={12} />}{u.rol === 'admin' ? 'Administrador' : 'Médico'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold" style={activo ? { background: COLORS.okBg, color: COLORS.ok } : { background: COLORS.badBg, color: COLORS.bad }}>
                          {activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <BotonAccion icon={u.rol === 'admin' ? <Stethoscope size={13} /> : <ShieldCheck size={13} />} onClick={() => cambiarRol(u)}>
                            {u.rol === 'admin' ? 'Hacer médico' : 'Hacer admin'}
                          </BotonAccion>
                          <BotonAccion icon={<KeyRound size={13} />} onClick={() => resetear(u)}>Reset contraseña</BotonAccion>
                          <BotonAccion icon={<Power size={13} />} danger={activo} onClick={() => cambiarActivo(u)}>
                            {activo ? 'Desactivar' : 'Activar'}
                          </BotonAccion>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-slate-400 mt-3">
          Al crear un usuario se le asigna una contraseña inicial; puede cambiarla con «¿Olvidaste tu contraseña?» en el login o pidiéndote un reset.
        </p>
      </div>

      {modalNuevo && <ModalNuevoUsuario onClose={() => setModalNuevo(false)} onCreado={() => { setModalNuevo(false); cargar(); }} />}
    </div>
  );
}

function BotonAccion({ children, icon, onClick, danger }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border bg-white cursor-pointer hover:bg-slate-50"
      style={{ borderColor: danger ? '#f0c8cc' : COLORS.line, color: danger ? COLORS.bad : COLORS.muted }}>
      {icon}{children}
    </button>
  );
}

function ModalNuevoUsuario({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ nombreCompleto: '', cedula: '', email: '', password: '', rol: 'medico' as 'medico' | 'admin' });
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!form.email.trim() || !form.password || !form.nombreCompleto.trim()) {
      toast.error('Nombre, correo y contraseña son obligatorios.');
      return;
    }
    if (form.password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres.'); return; }
    setGuardando(true);
    try {
      await crearUsuario(form);
      toast.success('Usuario creado correctamente.');
      onCreado();
    } catch (err: any) {
      console.error(err);
      const msg = err?.code === 'auth/email-already-in-use' ? 'Ese correo ya está registrado.'
        : err?.code === 'auth/invalid-email' ? 'El correo no es válido.'
        : 'No se pudo crear el usuario.';
      toast.error(msg);
    } finally { setGuardando(false); }
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600';

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center p-5" style={{ background: 'rgba(13,27,42,0.55)' }} onClick={onClose}>
      <div className="w-[440px] max-w-full bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: COLORS.line }}>
          <h2 className="m-0 text-base font-bold">Nuevo usuario</h2>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-slate-400"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-3">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo *</label><input className={inputCls} value={form.nombreCompleto} placeholder="Ej: Dra. Ana López" onChange={(e) => set('nombreCompleto', e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Cédula / código médico</label><input className={inputCls} value={form.cedula} onChange={(e) => set('cedula', e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Correo *</label><input type="email" className={inputCls} value={form.email} placeholder="medico@empresa.com" onChange={(e) => set('email', e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Contraseña inicial *</label><input type="text" className={inputCls} value={form.password} placeholder="Mínimo 6 caracteres" onChange={(e) => set('password', e.target.value)} /></div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
            <select className={inputCls + ' bg-white'} value={form.rol} onChange={(e) => set('rol', e.target.value)}>
              <option value="medico">Médico</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50 border-t" style={{ borderColor: COLORS.line }}>
          <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-sm font-bold disabled:opacity-60" style={{ background: BRAND }}>
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}{guardando ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  );
}
