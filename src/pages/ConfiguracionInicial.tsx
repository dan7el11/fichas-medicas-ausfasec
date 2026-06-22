// Asistente de configuración inicial (onboarding guiado de una empresa).
// Reúne en un solo flujo: datos de la empresa, logo y carga de trabajadores.
// Ruta: /configuracion-inicial
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Building2, Image as ImageIcon, Users, Upload, Download, Check, CheckCircle2,
  ArrowRight, ArrowLeft, Loader2, Home,
} from 'lucide-react';
import { db, storage } from '../services/firebase';
import { useEmpresa, type DatosEmpresa } from '../contexts/EmpresaContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { parseCSV, csvAObjetos, descargarPlantillaCSV } from '../utils/csv';

const BRAND = '#0a6b3b';

const COLS_TRAB = ['primerApellido', 'segundoApellido', 'primerNombre', 'segundoNombre', 'cedula', 'sexo', 'puestoTrabajo', 'departamento'];
const EJEMPLO_TRAB = ['PÉREZ', 'GÓMEZ', 'JUAN', 'CARLOS', '1712345678', 'M', 'Operario de planta', 'Planificación'];

interface TrabImport {
  primerApellido: string; segundoApellido: string; primerNombre: string; segundoNombre: string;
  cedula: string; sexo: 'M' | 'F'; puestoTrabajo: string; departamento: string;
}

function parseRowTrab(r: Record<string, string>): TrabImport {
  if (!r.primerApellido || !r.primerNombre || !r.cedula) throw new Error('Faltan campos obligatorios (primerApellido, primerNombre, cedula)');
  const sexo = (r.sexo ?? '').toUpperCase();
  if (sexo !== 'M' && sexo !== 'F') throw new Error('sexo debe ser M o F');
  return {
    primerApellido: r.primerApellido, segundoApellido: r.segundoApellido ?? '',
    primerNombre: r.primerNombre, segundoNombre: r.segundoNombre ?? '', cedula: r.cedula,
    sexo: sexo as 'M' | 'F', puestoTrabajo: r.puestoTrabajo ?? '', departamento: r.departamento ?? '',
  };
}

const PASOS = [
  { n: 1, label: 'Datos', icon: <Building2 size={16} /> },
  { n: 2, label: 'Logo', icon: <ImageIcon size={16} /> },
  { n: 3, label: 'Trabajadores', icon: <Users size={16} /> },
  { n: 4, label: 'Listo', icon: <CheckCircle2 size={16} /> },
];

export default function ConfiguracionInicial() {
  const navigate = useNavigate();
  const { empresa, guardar } = useEmpresa();
  const { user } = useAuth();
  const toast = useToast();

  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState<DatosEmpresa>(empresa);
  const [guardando, setGuardando] = useState(false);

  // Logo
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  // Trabajadores
  const [preview, setPreview] = useState<{ filas: TrabImport[]; errores: string[] } | null>(null);
  const [importando, setImportando] = useState(false);
  const [importados, setImportados] = useState<number | null>(null);

  const set = (k: keyof DatosEmpresa, v: string) => setDatos((p) => ({ ...p, [k]: v }));

  const guardarConfig = async (): Promise<boolean> => {
    setGuardando(true);
    try { await guardar(datos); return true; }
    catch (err) { console.error(err); toast.error('No se pudo guardar la configuración.'); return false; }
    finally { setGuardando(false); }
  };

  const irAPaso2 = async () => {
    if (!datos.institucion.trim() || !datos.ruc.trim()) {
      toast.error('El nombre de la institución y el RUC son obligatorios.');
      return;
    }
    if (await guardarConfig()) setPaso(2);
  };

  const irAPaso3 = async () => { if (await guardarConfig()) setPaso(3); };

  const subirLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('El logo debe ser una imagen.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('La imagen no debe superar 5 MB.'); return; }
    setSubiendoLogo(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const sref = storageRef(storage, `branding/logo_${Date.now()}.${ext}`);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      setDatos((p) => ({ ...p, logoUrl: url }));
      toast.success('Logo subido correctamente.');
    } catch (err) { console.error(err); toast.error('No se pudo subir el logo.'); }
    finally { setSubiendoLogo(false); }
  };

  const leerCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = csvAObjetos(parseCSV(text), COLS_TRAB);
      const filas: TrabImport[] = [];
      const errores: string[] = [];
      rows.forEach((r, i) => {
        try { filas.push(parseRowTrab(r)); }
        catch (err: any) { errores.push(`Fila ${i + 2}: ${err.message}`); }
      });
      setPreview({ filas, errores });
    };
    reader.readAsText(file, 'UTF-8');
  };

  const importarTrabajadores = async () => {
    if (!preview || preview.filas.length === 0) return;
    setImportando(true);
    try {
      const snap = await getDocs(collection(db, 'trabajadores'));
      const ceduSet = new Set(snap.docs.map((d) => (d.data() as any).cedula));
      let n = 0;
      for (const t of preview.filas) {
        if (ceduSet.has(t.cedula)) continue;
        await addDoc(collection(db, 'trabajadores'), {
          ...t, evaluaciones: [], createdAt: new Date(), updatedAt: new Date(), createdBy: user?.uid || '',
        });
        ceduSet.add(t.cedula); n++;
      }
      setImportados(n);
      toast.success(`${n} trabajador(es) importados.`);
      setPaso(4);
    } catch (err) { console.error(err); toast.error('No se pudo importar. Verifica tu conexión.'); }
    finally { setImportando(false); }
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600';

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Encabezado */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="m-0 text-2xl font-bold text-slate-800">Configuración inicial</h1>
            <p className="m-0 text-sm text-slate-500 mt-0.5">Deja lista la empresa en pocos pasos.</p>
          </div>
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
            <Home size={15} /> Inicio
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-6">
          {PASOS.map((p, i) => (
            <div key={p.n} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className="grid place-items-center w-9 h-9 rounded-full text-white font-bold transition-colors"
                  style={{ background: paso >= p.n ? BRAND : '#cbd5e1' }}>
                  {paso > p.n ? <Check size={16} /> : p.icon}
                </div>
                <span className="text-[11px] font-semibold" style={{ color: paso >= p.n ? BRAND : '#94a3b8' }}>{p.label}</span>
              </div>
              {i < PASOS.length - 1 && <div className="flex-1 h-[2px] mx-2 mb-4" style={{ background: paso > p.n ? BRAND : '#e2e8f0' }} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
          {/* ───── Paso 1: Datos de la empresa ───── */}
          {paso === 1 && (
            <div className="space-y-4">
              <h2 className="m-0 text-lg font-bold text-slate-800">Datos de la empresa</h2>
              <p className="m-0 text-[13px] text-slate-500">Aparecen en los encabezados, el login y los formularios oficiales (SO-RE-38/40).</p>
              {([
                { k: 'institucion', label: 'Nombre de la institución', req: true, ph: 'Ej: Clínica Ocupacional XYZ' },
                { k: 'ruc', label: 'RUC', req: true, ph: '13 dígitos' },
                { k: 'ciu', label: 'CIU (código de actividad)', ph: 'Opcional' },
                { k: 'establecimiento', label: 'Establecimiento / Área médica', ph: 'Ej: Medicina Ocupacional' },
                { k: 'prefijoArchivo', label: 'Prefijo del N° de archivo', ph: 'Ej: XYZ' },
                { k: 'emailDominio', label: 'Dominio de correo (para el login)', ph: 'Ej: empresa.com' },
              ] as { k: keyof DatosEmpresa; label: string; req?: boolean; ph?: string }[]).map(({ k, label, req, ph }) => (
                <div key={k}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}{req && <span className="text-red-500"> *</span>}</label>
                  <input className={inputCls} value={datos[k]} placeholder={ph} onChange={(e) => set(k, e.target.value)} />
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <button onClick={irAPaso2} disabled={guardando}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-semibold rounded-lg text-sm disabled:opacity-50" style={{ background: BRAND }}>
                  {guardando ? <Loader2 size={15} className="animate-spin" /> : null} Continuar <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ───── Paso 2: Logo ───── */}
          {paso === 2 && (
            <div className="space-y-4">
              <h2 className="m-0 text-lg font-bold text-slate-800">Logo de la empresa</h2>
              <p className="m-0 text-[13px] text-slate-500">Se mostrará en el encabezado y en la pantalla de inicio de sesión. Opcional.</p>

              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-xl border border-slate-200 bg-slate-50 grid place-items-center overflow-hidden flex-shrink-0">
                  {datos.logoUrl
                    ? <img src={datos.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    : <ImageIcon size={28} className="text-slate-300" />}
                </div>
                <div className="flex-1">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold cursor-pointer hover:bg-slate-50">
                    {subiendoLogo ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    {subiendoLogo ? 'Subiendo…' : 'Subir imagen'}
                    <input type="file" accept="image/*" className="hidden" disabled={subiendoLogo}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) subirLogo(f); e.target.value = ''; }} />
                  </label>
                  <p className="m-0 text-[11px] text-slate-400 mt-1.5">PNG o JPG, hasta 5 MB.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">…o pega la URL de un logo</label>
                <input className={inputCls} value={datos.logoUrl} placeholder="https://…" onChange={(e) => set('logoUrl', e.target.value)} />
              </div>

              <div className="flex justify-between pt-2">
                <button onClick={() => setPaso(1)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-slate-600 font-semibold rounded-lg text-sm bg-white border border-slate-300">
                  <ArrowLeft size={15} /> Atrás
                </button>
                <button onClick={irAPaso3} disabled={guardando}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-semibold rounded-lg text-sm disabled:opacity-50" style={{ background: BRAND }}>
                  {guardando ? <Loader2 size={15} className="animate-spin" /> : null} Continuar <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ───── Paso 3: Trabajadores ───── */}
          {paso === 3 && (
            <div className="space-y-4">
              <h2 className="m-0 text-lg font-bold text-slate-800">Cargar trabajadores</h2>
              <p className="m-0 text-[13px] text-slate-500">Sube un archivo CSV con la plantilla. Puedes saltar este paso y cargarlos luego desde el Panel de Administración.</p>

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => descargarPlantillaCSV('plantilla_trabajadores.csv', COLS_TRAB, EJEMPLO_TRAB)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50">
                  <Download size={15} /> Descargar plantilla
                </button>
                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold cursor-pointer hover:bg-slate-50">
                  <Upload size={15} /> Seleccionar archivo CSV
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) leerCSV(f); e.target.value = ''; }} />
                </label>
              </div>

              <p className="m-0 text-[12px] text-slate-400">
                Columnas: <strong>{COLS_TRAB.join(', ')}</strong>. Obligatorias: primerApellido, primerNombre, cedula. <code>sexo</code> = M o F. <code>departamento</code> es el área.
              </p>

              {preview && (
                <div className="space-y-2">
                  {preview.errores.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[12px] text-red-700 max-h-32 overflow-y-auto">
                      <strong>{preview.errores.length} fila(s) con error (se omitirán):</strong>
                      {preview.errores.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  )}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-800">
                    <strong>{preview.filas.length}</strong> trabajador(es) válidos listos para importar.
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button onClick={() => setPaso(2)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-slate-600 font-semibold rounded-lg text-sm bg-white border border-slate-300">
                  <ArrowLeft size={15} /> Atrás
                </button>
                <div className="flex gap-2">
                  <button onClick={() => { setImportados(0); setPaso(4); }} className="px-4 py-2.5 text-slate-600 font-semibold rounded-lg text-sm bg-white border border-slate-300">
                    Omitir
                  </button>
                  <button onClick={importarTrabajadores} disabled={importando || !preview || preview.filas.length === 0}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-semibold rounded-lg text-sm disabled:opacity-50" style={{ background: BRAND }}>
                    {importando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    {importando ? 'Importando…' : `Importar ${preview?.filas.length ?? ''}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ───── Paso 4: Listo ───── */}
          {paso === 4 && (
            <div className="text-center py-6">
              <div className="grid place-items-center w-16 h-16 rounded-full mx-auto mb-4 text-white" style={{ background: BRAND }}>
                <CheckCircle2 size={32} />
              </div>
              <h2 className="m-0 text-xl font-bold text-slate-800">¡Configuración completa!</h2>
              <p className="m-0 text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                <strong>{datos.institucion}</strong> ya está lista.
                {importados !== null && importados > 0 && <> Se importaron <strong>{importados}</strong> trabajadores.</>}
                {importados === 0 && <> Puedes cargar trabajadores cuando quieras desde el Panel de Administración.</>}
              </p>
              <div className="flex gap-2 justify-center mt-6 flex-wrap">
                <button onClick={() => navigate('/trabajadores')} className="inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-semibold rounded-lg text-sm" style={{ background: BRAND }}>
                  Ir a Trabajadores <ArrowRight size={15} />
                </button>
                <button onClick={() => navigate('/')} className="px-5 py-2.5 text-slate-600 font-semibold rounded-lg text-sm bg-white border border-slate-300">
                  Ir al inicio
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
