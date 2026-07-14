// Página de personalización del médico ocupacional (/perfil).
// Lo que se registra aquí se usa en el saludo del inicio, en la firma de las
// consultas diarias y en los datos del profesional de los documentos PDF
// (SO-RE-38/40/41, certificado SO-RE-20, permisos, etc.).
import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCircle, BadgeCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { useToast } from '../components/Toast';
import { registrarAuditoria } from '../services/auditoria';

const ABREVIATURAS = ['Dr.', 'Dra.', 'Md.', 'Lcdo.', 'Lcda.'];

export default function UserProfile() {
  const { user, perfil, refreshPerfil } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [abreviatura, setAbreviatura] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [cedula, setCedula] = useState('');
  const [titulo, setTitulo] = useState('');
  const [codigoSenescyt, setCodigoSenescyt] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Precargar lo ya registrado
  useEffect(() => {
    if (!perfil) return;
    setAbreviatura(perfil.abreviatura ?? '');
    setNombreCompleto(perfil.nombreCompleto ?? '');
    setCedula(perfil.cedula ?? '');
    setTitulo(perfil.titulo ?? '');
    setCodigoSenescyt(perfil.codigoSenescyt ?? '');
  }, [perfil]);

  const firmaPreview = (() => {
    const n = nombreCompleto.trim();
    if (!n) return '—';
    const conAb = abreviatura && !/^(dr|dra|md|lcd[oa])\.?\s/i.test(n) ? `${abreviatura} ${n}` : n;
    return `${conAb}${titulo.trim() ? ` — ${titulo.trim()}` : ''}${codigoSenescyt.trim() ? ` · Senescyt ${codigoSenescyt.trim()}` : ''}`;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!nombreCompleto.trim()) { toast.warning('El nombre es obligatorio.'); return; }

    setGuardando(true);
    try {
      // merge:true para NO tocar el rol ni otros campos administrados aparte.
      await setDoc(doc(db, 'usuarios', user.uid), {
        email: user.email,
        nombreCompleto: nombreCompleto.trim(),
        cedula: cedula.trim(),
        abreviatura,
        titulo: titulo.trim(),
        codigoSenescyt: codigoSenescyt.trim(),
        ...(perfil?.rol ? {} : { rol: 'medico', createdAt: new Date() }),
      }, { merge: true });
      await registrarAuditoria('editar', 'usuario', user.uid, 'Actualizó su perfil profesional');
      await refreshPerfil();
      toast.success('Perfil actualizado. Se usará en el saludo y en la firma de los documentos.');
      navigate('/');
    } catch (error) {
      console.error('Error al guardar el perfil', error);
      toast.error('Hubo un error al guardar los datos.');
    } finally {
      setGuardando(false);
    }
  };

  const inputCls = 'w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm';

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-4 bg-transparent border-none cursor-pointer p-0">
          <ArrowLeft size={15} /> Volver
        </button>

        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-blue-50 text-blue-700"><UserCircle size={22} /></span>
            <div>
              <h2 className="m-0 text-xl font-bold text-slate-800">Personalización del profesional</h2>
              <p className="m-0 text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          <p className="text-slate-500 mb-6 text-sm">
            Estos datos se usan en el saludo del inicio y en la firma de las consultas
            diarias y de todos los documentos (historias clínicas, certificados y permisos).
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Abreviatura</label>
              <div className="flex gap-2 flex-wrap">
                {ABREVIATURAS.map(ab => (
                  <button key={ab} type="button" onClick={() => setAbreviatura(abreviatura === ab ? '' : ab)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${abreviatura === ab ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'}`}>
                    {ab}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo <span className="text-red-500">*</span></label>
              <input type="text" required className={inputCls} value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)} placeholder="Ej: Juan Andrés Pérez López" />
              <p className="text-[11px] text-slate-400 mt-1">Sin la abreviatura: se antepone automáticamente la seleccionada arriba.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Título profesional</label>
              <input type="text" className={inputCls} value={titulo}
                onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Médico Ocupacional / Especialista en SST" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Código Senescyt</label>
                <input type="text" className={inputCls} value={codigoSenescyt}
                  onChange={(e) => setCodigoSenescyt(e.target.value)} placeholder="Nº de registro Senescyt" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cédula</label>
                <input type="text" className={inputCls} value={cedula}
                  onChange={(e) => setCedula(e.target.value)} placeholder="Cédula de identidad" />
              </div>
            </div>

            {/* Vista previa de la firma */}
            <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
              <BadgeCheck size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase text-slate-400">Así aparecerá tu firma</div>
                <div className="text-sm font-semibold text-slate-800">{firmaPreview}</div>
              </div>
            </div>

            <button type="submit" disabled={guardando}
              className="w-full bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-70">
              {guardando ? 'Guardando...' : 'Guardar personalización'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
