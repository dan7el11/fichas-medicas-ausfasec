// Panel de administración. Solo accesible cuando el email contiene "admin".
// Tabs: Trabajadores, Medicamentos, Movimientos.
// Cada tab ofrece CRUD manual (formulario) e importación masiva vía CSV.
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy,
} from 'firebase/firestore';
import {
  Shield, Users, Package, ArrowLeftRight, Plus, Edit2, Trash2, Save,
  X, Upload, Download, Check, AlertTriangle, ChevronDown,
} from 'lucide-react';
import { db } from '../services/firebase';
import { descargarRespaldo } from '../services/respaldo';
import { registrarAuditoria } from '../services/auditoria';
import { getTrabajadores } from '../services/trabajadores';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import TopBar from '../components/dashboard/TopBar';
import { cargarEstado, guardarMedicamento, eliminarMedicamento, registrarMovimiento } from '../services/inventario';
import { checkExpiracion, fmtFecha as fmtFechaInv } from '../utils/inventarioHelpers';
import { parseCSV, csvAObjetos, descargarPlantillaCSV } from '../utils/csv';
import type { Trabajador } from '../types';
import type { Medicamento, CentroId, Movimiento } from '../types/inventario';
import { CENTROS } from '../types/inventario';
import { COLORS, FONTS } from '../theme';

const BRAND = COLORS.brand;
const CENTROS_LIST = Object.keys(CENTROS) as CentroId[];

type Tab = 'trabajadores' | 'medicamentos' | 'movimientos';

// ── helpers ──────────────────────────────────────────────────────────────────

function medVacio(): Medicamento {
  return { codigo: '', tipo: 'NUEVA COMPRA', nombre: '', sobrenombre: '', lote: '', fechaExpiracion: '', precio: 0, stockInicial: 0, stocks: { planta_envasado: 0, vergel: 0, planta_ventanas: 0 } };
}

function trabVacio(): Omit<Trabajador, 'id' | 'evaluaciones' | 'createdAt' | 'updatedAt'> {
  return { primerApellido: '', segundoApellido: '', primerNombre: '', segundoNombre: '', cedula: '', sexo: 'M', puestoTrabajo: '', departamento: '' };
}

// ── componentes pequeños ─────────────────────────────────────────────────────

function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{children}</div>;
}

function Inp({ value, onChange, placeholder, type = 'text', disabled }: { value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean }) {
  return (
    <input type={type} value={String(value)} disabled={disabled} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '8px 11px', fontSize: 13, color: COLORS.ink, background: disabled ? COLORS.bg : '#fff', boxSizing: 'border-box' }} />
  );
}

function Btn({ children, onClick, variant = 'primary', icon, disabled, small }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode; disabled?: boolean; small?: boolean;
}) {
  const bg = variant === 'primary' ? BRAND : variant === 'danger' ? COLORS.bad : variant === 'secondary' ? COLORS.panel : 'transparent';
  const color = variant === 'primary' || variant === 'danger' ? '#fff' : COLORS.ink;
  const border = variant === 'secondary' ? `1px solid ${COLORS.line}` : 'none';
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: small ? '6px 12px' : '8px 16px', background: bg, color, border, borderRadius: 8, fontSize: small ? 12 : 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      {icon}{children}
    </button>
  );
}

// ── Importador CSV genérico ───────────────────────────────────────────────────

interface CsvImportProps<T> {
  columnas: string[];
  ejemplo: string[];
  plantilla: string;
  parseRow: (row: Record<string, string>, idx: number) => T | null;
  onImport: (rows: T[]) => Promise<void>;
  onClose: () => void;
}

function CsvImporter<T>({ columnas, ejemplo, plantilla, parseRow, onImport, onClose }: CsvImportProps<T>) {
  const [preview, setPreview] = useState<{ parsed: T[]; errores: string[] } | null>(null);
  const [importando, setImportando] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = csvAObjetos(parseCSV(text), columnas);
      const parsed: T[] = [];
      const errores: string[] = [];
      rows.forEach((r, i) => {
        try {
          const item = parseRow(r, i + 2);
          if (item) parsed.push(item);
        } catch (err: any) {
          errores.push(`Fila ${i + 2}: ${err.message}`);
        }
      });
      setPreview({ parsed, errores });
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const confirmar = async () => {
    if (!preview || preview.parsed.length === 0) return;
    setImportando(true);
    try {
      await onImport(preview.parsed);
      setDone(true);
    } catch (err: any) {
      alert('Error al importar: ' + (err.message ?? 'Error desconocido'));
    }
    setImportando(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center', background: 'rgba(13,27,42,0.55)' }} onClick={onClose}>
      <div style={{ width: 640, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${COLORS.line}` }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.ink }}>Importar CSV</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.muted }}><X size={20} /></button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: COLORS.ok }}>
              <Check size={40} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 700, fontSize: 16 }}>{preview!.parsed.length} registros importados correctamente</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Btn icon={<Download size={14} />} variant="secondary" small onClick={() => descargarPlantillaCSV(plantilla, columnas, ejemplo)}>Descargar plantilla</Btn>
                <Btn icon={<Upload size={14} />} variant="secondary" small onClick={() => fileRef.current?.click()}>Seleccionar archivo CSV</Btn>
                <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFile} />
              </div>

              <p style={{ fontSize: 12, color: COLORS.muted, margin: 0 }}>
                El archivo debe tener las columnas: <strong>{columnas.join(', ')}</strong>. Separador punto y coma (;) o coma (,).
              </p>

              {preview && (
                <>
                  {preview.errores.length > 0 && (
                    <div style={{ background: COLORS.badBg, border: `1px solid ${COLORS.bad}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: COLORS.bad }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}><AlertTriangle size={13} style={{ display: 'inline', marginRight: 4 }} />Advertencias</div>
                      {preview.errores.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  )}
                  <div style={{ background: COLORS.panel, borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
                    <strong style={{ color: COLORS.ok }}>{preview.parsed.length}</strong> filas válidas listas para importar.
                    {preview.errores.length > 0 && <span style={{ color: COLORS.warn, marginLeft: 8 }}>({preview.errores.length} con errores serán omitidas)</span>}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${COLORS.line}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn variant="secondary" onClick={onClose}>{done ? 'Cerrar' : 'Cancelar'}</Btn>
          {!done && preview && preview.parsed.length > 0 && (
            <Btn icon={<Check size={14} />} onClick={confirmar} disabled={importando}>
              {importando ? 'Importando…' : `Importar ${preview.parsed.length} registros`}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: TRABAJADORES
// ════════════════════════════════════════════════════════════════════════════
function TabTrabajadores({ userId }: { userId: string }) {
  const [lista, setLista] = useState<Trabajador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Trabajador | null>(null);
  const [form, setForm] = useState(trabVacio());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [csvOpen, setCsvOpen] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setLista(await getTrabajadores());
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => { setForm(trabVacio()); setEditando(null); setError(''); setFormOpen(true); };
  const abrirEditar = (t: Trabajador) => { setForm({ primerApellido: t.primerApellido, segundoApellido: t.segundoApellido ?? '', primerNombre: t.primerNombre, segundoNombre: t.segundoNombre ?? '', cedula: t.cedula, sexo: t.sexo, puestoTrabajo: t.puestoTrabajo, departamento: t.departamento ?? '' }); setEditando(t); setError(''); setFormOpen(true); };
  const cancelar = () => { setFormOpen(false); setEditando(null); setError(''); };

  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!form.primerApellido.trim() || !form.primerNombre.trim() || !form.cedula.trim() || !form.puestoTrabajo.trim()) {
      setError('Apellido, nombre, cédula y puesto son obligatorios.'); return;
    }
    setGuardando(true); setError('');
    try {
      if (editando?.id) {
        await updateDoc(doc(db, 'trabajadores', editando.id), { ...form, updatedAt: new Date(), updatedBy: userId });
        await registrarAuditoria('editar', 'trabajador', editando.id, `Editó a ${form.primerApellido} ${form.primerNombre} (CI ${form.cedula})`);
      } else {
        const dup = lista.find((t) => t.cedula === form.cedula.trim());
        if (dup) { setError('Ya existe un trabajador con esa cédula.'); setGuardando(false); return; }
        const ref = await addDoc(collection(db, 'trabajadores'), { ...form, evaluaciones: [], createdAt: new Date(), updatedAt: new Date(), createdBy: userId });
        await registrarAuditoria('crear', 'trabajador', ref.id, `Registró a ${form.primerApellido} ${form.primerNombre} (CI ${form.cedula})`);
      }
      await cargar(); cancelar();
    } catch (e: any) { setError(e.message ?? 'Error al guardar'); }
    setGuardando(false);
  };

  const eliminar = async (t: Trabajador) => {
    if (!t.id || !window.confirm(`¿Eliminar a ${t.primerApellido} ${t.primerNombre}? Esta acción no se puede deshacer.`)) return;
    await deleteDoc(doc(db, 'trabajadores', t.id));
    await registrarAuditoria('eliminar', 'trabajador', t.id, `Eliminó a ${t.primerApellido} ${t.primerNombre} (CI ${t.cedula})`);
    await cargar();
  };

  const COLS_CSV = ['primerApellido', 'segundoApellido', 'primerNombre', 'segundoNombre', 'cedula', 'sexo', 'puestoTrabajo', 'departamento'];
  const EJEMPLO_CSV = ['PÉREZ', 'GÓMEZ', 'JUAN', 'CARLOS', '1712345678', 'M', 'Operario de planta', 'Producción'];

  const importarFilas = async (filas: Trabajador[]) => {
    const ceduSet = new Set(lista.map((t) => t.cedula));
    for (const t of filas) {
      if (ceduSet.has(t.cedula)) continue;
      await addDoc(collection(db, 'trabajadores'), { ...t, evaluaciones: [], createdAt: new Date(), updatedAt: new Date(), createdBy: userId });
      ceduSet.add(t.cedula);
    }
    await cargar();
  };

  const parseRow = (r: Record<string, string>): Trabajador | null => {
    if (!r.primerApellido || !r.primerNombre || !r.cedula) throw new Error('Faltan campos obligatorios (primerApellido, primerNombre, cedula)');
    const sexo = r.sexo?.toUpperCase();
    if (sexo !== 'M' && sexo !== 'F') throw new Error('sexo debe ser M o F');
    return { primerApellido: r.primerApellido, segundoApellido: r.segundoApellido ?? '', primerNombre: r.primerNombre, segundoNombre: r.segundoNombre ?? '', cedula: r.cedula, sexo: sexo as 'M' | 'F', puestoTrabajo: r.puestoTrabajo ?? '', departamento: r.departamento ?? '', evaluaciones: [], createdAt: new Date(), updatedAt: new Date() };
  };

  const filtrados = lista.filter((t) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return `${t.primerApellido} ${t.segundoApellido} ${t.primerNombre} ${t.cedula} ${t.puestoTrabajo}`.toLowerCase().includes(q);
  });

  return (
    <div>
      {csvOpen && (
        <CsvImporter columnas={COLS_CSV} ejemplo={EJEMPLO_CSV} plantilla="plantilla_trabajadores.csv" parseRow={parseRow} onImport={importarFilas} onClose={() => { setCsvOpen(false); }} />
      )}

      {/* Barra de herramientas */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, cédula o puesto…"
          style={{ flex: 1, minWidth: 220, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '8px 12px', fontSize: 13 }} />
        <Btn icon={<Plus size={14} />} onClick={abrirNuevo} small>Nuevo trabajador</Btn>
        <Btn icon={<Upload size={14} />} variant="secondary" onClick={() => setCsvOpen(true)} small>Importar CSV</Btn>
        <Btn icon={<Download size={14} />} variant="secondary" onClick={() => descargarPlantillaCSV('plantilla_trabajadores.csv', COLS_CSV, EJEMPLO_CSV)} small>Plantilla</Btn>
      </div>

      {/* Formulario */}
      {formOpen && (
        <div style={{ background: COLORS.panel, border: `2px solid ${BRAND}`, borderRadius: 14, padding: 20, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <strong style={{ fontSize: 15, fontFamily: FONTS.serif }}>{editando ? `Editar: ${editando.primerApellido} ${editando.primerNombre}` : 'Nuevo trabajador'}</strong>
            <button onClick={cancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.faint }}><X size={17} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
            {(['primerApellido', 'segundoApellido', 'primerNombre', 'segundoNombre'] as const).map((k) => (
              <div key={k}><Lbl>{k.replace(/([A-Z])/g, ' $1')}</Lbl><Inp value={form[k]} onChange={f(k)} /></div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
            <div><Lbl>Cédula</Lbl><Inp value={form.cedula} onChange={f('cedula')} disabled={!!editando} /></div>
            <div>
              <Lbl>Sexo</Lbl>
              <select value={form.sexo} onChange={(e) => setForm((p) => ({ ...p, sexo: e.target.value as 'M' | 'F' }))}
                style={{ width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '8px 11px', fontSize: 13 }}>
                <option value="M">M</option><option value="F">F</option>
              </select>
            </div>
            <div><Lbl>Puesto de trabajo</Lbl><Inp value={form.puestoTrabajo} onChange={f('puestoTrabajo')} /></div>
            <div><Lbl>Departamento</Lbl><Inp value={form.departamento ?? ''} onChange={f('departamento')} /></div>
          </div>
          {error && <p style={{ color: COLORS.bad, fontSize: 12, marginBottom: 10 }}>{error}</p>}
          <Btn icon={<Save size={14} />} onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Btn>
        </div>
      )}

      {/* Tabla */}
      <div style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${COLORS.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 14, fontFamily: FONTS.serif }}>{cargando ? 'Cargando…' : `${filtrados.length} de ${lista.length} trabajadores`}</strong>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: COLORS.panel, borderBottom: `2px solid ${COLORS.line}` }}>
                {['Apellidos', 'Nombres', 'Cédula', 'Puesto', 'Departamento', ''].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: COLORS.muted, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((t) => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                  <td style={{ padding: '9px 12px', fontWeight: 600 }}>{t.primerApellido} {t.segundoApellido}</td>
                  <td style={{ padding: '9px 12px' }}>{t.primerNombre} {t.segundoNombre}</td>
                  <td style={{ padding: '9px 12px', fontFamily: FONTS.mono, fontSize: 12, color: COLORS.muted }}>{t.cedula}</td>
                  <td style={{ padding: '9px 12px', color: COLORS.muted }}>{t.puestoTrabajo}</td>
                  <td style={{ padding: '9px 12px', color: COLORS.faint }}>{t.departamento || '—'}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button title="Editar" onClick={() => abrirEditar(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.muted, padding: 4 }}><Edit2 size={14} /></button>
                      <button title="Eliminar" onClick={() => eliminar(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.bad, padding: 4 }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!cargando && filtrados.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: COLORS.faint }}>No hay trabajadores{busqueda ? ' que coincidan con la búsqueda' : ' registrados'}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: MEDICAMENTOS
// ════════════════════════════════════════════════════════════════════════════
function TabMedicamentos({ inventario, onRefresh }: { inventario: Medicamento[]; onRefresh: () => void }) {
  const [editando, setEditando] = useState<Medicamento | null>(null);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState<Medicamento>(medVacio());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [csvOpen, setCsvOpen] = useState(false);
  const [busqueda, setBusqueda] = useState(false);

  const iniciarCrear = () => { setForm(medVacio()); setCreando(true); setEditando(null); setError(''); };
  const iniciarEditar = (m: Medicamento) => { setForm({ ...m, stocks: { ...m.stocks } }); setEditando(m); setCreando(false); setError(''); };
  const cancelar = () => { setCreando(false); setEditando(null); setError(''); };

  const setStock = (c: CentroId, v: number) => setForm((f) => ({ ...f, stocks: { ...f.stocks, [c]: v } }));

  const guardar = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) { setError('Código y nombre son obligatorios'); return; }
    setGuardando(true); setError('');
    try { await guardarMedicamento(form); cancelar(); onRefresh(); }
    catch (e: any) { setError(e.message ?? 'Error'); }
    setGuardando(false);
  };

  const eliminar = async (codigo: string, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    await eliminarMedicamento(codigo); onRefresh();
  };

  const COLS_CSV = ['codigo', 'nombre', 'sobrenombre', 'lote', 'fechaExpiracion', 'precio', 'stockInicial', 'planta_envasado', 'vergel', 'planta_ventanas'];
  const EJEMPLO_CSV = ['MED001', 'Paracetamol 500 mg', 'Paracetamol', 'LT-2024-01', '2026-12-31', '0.15', '100', '40', '30', '30'];

  const parseRowMed = (r: Record<string, string>): Medicamento | null => {
    if (!r.codigo || !r.nombre) throw new Error('Faltan codigo o nombre');
    return {
      codigo: r.codigo, tipo: 'NUEVA COMPRA', nombre: r.nombre, sobrenombre: r.sobrenombre ?? '',
      lote: r.lote ?? '', fechaExpiracion: r.fechaExpiracion ?? '', precio: parseFloat(r.precio) || 0,
      stockInicial: parseInt(r.stockInicial) || 0,
      stocks: { planta_envasado: parseInt(r.planta_envasado) || 0, vergel: parseInt(r.vergel) || 0, planta_ventanas: parseInt(r.planta_ventanas) || 0 },
    };
  };

  const importarMeds = async (filas: Medicamento[]) => {
    for (const m of filas) await guardarMedicamento(m);
    onRefresh();
  };

  const isFormOpen = creando || editando !== null;
  const filtrados = busqueda ? inventario : inventario;

  return (
    <div>
      {csvOpen && (
        <CsvImporter columnas={COLS_CSV} ejemplo={EJEMPLO_CSV} plantilla="plantilla_medicamentos.csv" parseRow={parseRowMed} onImport={importarMeds} onClose={() => setCsvOpen(false)} />
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Btn icon={<Plus size={14} />} onClick={iniciarCrear} small>Nuevo medicamento</Btn>
        <Btn icon={<Upload size={14} />} variant="secondary" onClick={() => setCsvOpen(true)} small>Importar CSV</Btn>
        <Btn icon={<Download size={14} />} variant="secondary" onClick={() => descargarPlantillaCSV('plantilla_medicamentos.csv', COLS_CSV, EJEMPLO_CSV)} small>Plantilla</Btn>
      </div>

      {isFormOpen && (
        <div style={{ background: COLORS.panel, border: `2px solid ${BRAND}`, borderRadius: 14, padding: 20, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <strong style={{ fontSize: 15, fontFamily: FONTS.serif }}>{creando ? 'Nuevo medicamento' : `Editar: ${editando?.nombre}`}</strong>
            <button onClick={cancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.faint }}><X size={17} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            {([
              { label: 'CÓDIGO', key: 'codigo' as const, disabled: !creando, type: 'text' },
              { label: 'NOMBRE', key: 'nombre' as const, disabled: false, type: 'text' },
              { label: 'NOMBRE CORTO', key: 'sobrenombre' as const, disabled: false, type: 'text' },
              { label: 'LOTE', key: 'lote' as const, disabled: false, type: 'text' },
              { label: 'FECHA EXPIRACIÓN', key: 'fechaExpiracion' as const, disabled: false, type: 'date' },
              { label: 'PRECIO', key: 'precio' as const, disabled: false, type: 'number' },
            ] as const).map(({ label, key, disabled, type }) => (
              <div key={key}>
                <Lbl>{label}</Lbl>
                <Inp value={String(form[key])} onChange={(v) => setForm((f) => ({ ...f, [key]: type === 'number' ? parseFloat(v) || 0 : v }))} disabled={disabled} type={type} />
              </div>
            ))}
          </div>
          <Lbl>STOCK POR CENTRO</Lbl>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            {CENTROS_LIST.map((k) => (
              <div key={k}>
                <Lbl>{CENTROS[k]}</Lbl>
                <Inp type="number" value={form.stocks[k] ?? 0} onChange={(v) => setStock(k, parseInt(v) || 0)} />
              </div>
            ))}
          </div>
          {error && <p style={{ color: COLORS.bad, fontSize: 12, marginBottom: 10 }}>{error}</p>}
          <Btn icon={<Save size={14} />} onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Btn>
        </div>
      )}

      <div style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${COLORS.line}` }}>
          <strong style={{ fontSize: 14, fontFamily: FONTS.serif }}>{inventario.length} medicamentos en catálogo</strong>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: COLORS.panel, borderBottom: `2px solid ${COLORS.line}` }}>
                {['Código', 'Nombre', 'Lote', 'Expiración', 'P.Envasado', 'Vergel', 'P.Ventanas', ''].map((h) => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: COLORS.muted, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m) => {
                const exp = checkExpiracion(m.fechaExpiracion);
                return (
                  <tr key={m.codigo} style={{ borderBottom: `1px solid ${COLORS.line}`, background: editando?.codigo === m.codigo ? COLORS.brandSoft : 'transparent' }}>
                    <td style={{ padding: '7px 10px', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.faint }}>{m.codigo}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 600 }}>{m.nombre}</td>
                    <td style={{ padding: '7px 10px', color: COLORS.muted }}>{m.lote || '—'}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ color: exp === 'expirado' ? COLORS.bad : exp === 'proximo' ? COLORS.warn : COLORS.muted }}>{fmtFechaInv(m.fechaExpiracion)}</span>
                    </td>
                    {CENTROS_LIST.map((k) => (
                      <td key={k} style={{ padding: '7px 10px', textAlign: 'center', fontFamily: FONTS.mono, color: (m.stocks[k] ?? 0) === 0 ? COLORS.faint : COLORS.ink }}>{m.stocks[k] ?? 0}</td>
                    ))}
                    <td style={{ padding: '7px 10px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => iniciarEditar(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.muted }}><Edit2 size={13} /></button>
                        <button onClick={() => eliminar(m.codigo, m.nombre)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.bad }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: COLORS.faint }}>Sin medicamentos en el catálogo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: MOVIMIENTOS
// ════════════════════════════════════════════════════════════════════════════
function TabMovimientosAdmin({ inventario, movimientos, usuarioNombre, onRefresh }: { inventario: Medicamento[]; movimientos: Movimiento[]; usuarioNombre: string; onRefresh: () => void }) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ medicamentoCodigo: '', origen: 'PROVEEDOR' as CentroId | 'PROVEEDOR', destino: 'planta_envasado' as CentroId, cantidad: 1, fecha: new Date().toISOString().slice(0, 10), observacion: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [csvOpen, setCsvOpen] = useState(false);

  const guardar = async () => {
    if (!form.medicamentoCodigo) { setError('Selecciona un medicamento'); return; }
    if (form.cantidad <= 0) { setError('La cantidad debe ser mayor a 0'); return; }
    setGuardando(true); setError('');
    try {
      await registrarMovimiento(form.medicamentoCodigo, form.origen, form.destino, form.cantidad, usuarioNombre, form.observacion);
      setFormOpen(false); onRefresh();
    } catch (e: any) { setError(e.message ?? 'Error'); }
    setGuardando(false);
  };

  const ORIGENES = [{ value: 'PROVEEDOR', label: 'Proveedor (entrada)' }, ...CENTROS_LIST.map((k) => ({ value: k, label: CENTROS[k] }))];
  const DESTINOS = CENTROS_LIST.map((k) => ({ value: k, label: CENTROS[k] }));

  const COLS_CSV = ['medicamentoCodigo', 'origen', 'destino', 'cantidad', 'fecha', 'observacion'];
  const EJEMPLO_CSV = ['MED001', 'PROVEEDOR', 'planta_envasado', '50', '2024-06-01', 'Stock inicial'];

  const parseRowMov = (r: Record<string, string>): { medicamentoCodigo: string; origen: string; destino: string; cantidad: number; fecha: string; observacion: string } | null => {
    if (!r.medicamentoCodigo || !r.destino) throw new Error('Faltan medicamentoCodigo o destino');
    const cantidad = parseInt(r.cantidad);
    if (isNaN(cantidad) || cantidad <= 0) throw new Error('cantidad debe ser un número positivo');
    const origenValido = r.origen === 'PROVEEDOR' || CENTROS_LIST.includes(r.origen as CentroId);
    const destinoValido = CENTROS_LIST.includes(r.destino as CentroId);
    if (!origenValido) throw new Error(`origen inválido: ${r.origen}`);
    if (!destinoValido) throw new Error(`destino inválido: ${r.destino}`);
    return { medicamentoCodigo: r.medicamentoCodigo, origen: r.origen, destino: r.destino, cantidad, fecha: r.fecha ?? new Date().toISOString().slice(0, 10), observacion: r.observacion ?? '' };
  };

  const importarMovs = async (filas: { medicamentoCodigo: string; origen: string; destino: string; cantidad: number; fecha: string; observacion: string }[]) => {
    for (const mov of filas) {
      await registrarMovimiento(mov.medicamentoCodigo, mov.origen as CentroId | 'PROVEEDOR', mov.destino as CentroId, mov.cantidad, usuarioNombre, mov.observacion);
    }
    onRefresh();
  };

  const medicNombre = (codigo: string) => inventario.find((m) => m.codigo === codigo)?.nombre ?? codigo;
  const centroNombre = (id: string) => id === 'PROVEEDOR' ? 'Proveedor' : CENTROS[id as CentroId] ?? id;

  const [ver, setVer] = useState<'recientes' | 'todos'>('recientes');
  const movsMostrar = ver === 'recientes' ? [...movimientos].reverse().slice(0, 50) : [...movimientos].reverse();

  return (
    <div>
      {csvOpen && (
        <CsvImporter columnas={COLS_CSV} ejemplo={EJEMPLO_CSV} plantilla="plantilla_movimientos.csv" parseRow={parseRowMov as any} onImport={importarMovs as any} onClose={() => setCsvOpen(false)} />
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Btn icon={<Plus size={14} />} onClick={() => { setFormOpen((v) => !v); setError(''); }} small>Nuevo movimiento</Btn>
        <Btn icon={<Upload size={14} />} variant="secondary" onClick={() => setCsvOpen(true)} small>Importar CSV</Btn>
        <Btn icon={<Download size={14} />} variant="secondary" onClick={() => descargarPlantillaCSV('plantilla_movimientos.csv', COLS_CSV, EJEMPLO_CSV)} small>Plantilla</Btn>
      </div>

      {formOpen && (
        <div style={{ background: COLORS.panel, border: `2px solid ${BRAND}`, borderRadius: 14, padding: 20, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <strong style={{ fontSize: 15, fontFamily: FONTS.serif }}>Registrar movimiento</strong>
            <button onClick={() => setFormOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.faint }}><X size={17} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <Lbl>Medicamento</Lbl>
              <select value={form.medicamentoCodigo} onChange={(e) => setForm((f) => ({ ...f, medicamentoCodigo: e.target.value }))}
                style={{ width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '8px 11px', fontSize: 13 }}>
                <option value="">-- Seleccionar --</option>
                {inventario.map((m) => <option key={m.codigo} value={m.codigo}>{m.nombre}</option>)}
              </select>
            </div>
            <div>
              <Lbl>Origen</Lbl>
              <select value={form.origen} onChange={(e) => setForm((f) => ({ ...f, origen: e.target.value as CentroId | 'PROVEEDOR' }))}
                style={{ width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '8px 11px', fontSize: 13 }}>
                {ORIGENES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Lbl>Destino</Lbl>
              <select value={form.destino} onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value as CentroId }))}
                style={{ width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '8px 11px', fontSize: 13 }}>
                {DESTINOS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div><Lbl>Cantidad</Lbl><Inp type="number" value={form.cantidad} onChange={(v) => setForm((f) => ({ ...f, cantidad: parseInt(v) || 1 }))} /></div>
            <div><Lbl>Fecha</Lbl><Inp type="date" value={form.fecha} onChange={(v) => setForm((f) => ({ ...f, fecha: v }))} /></div>
            <div><Lbl>Observación</Lbl><Inp value={form.observacion} onChange={(v) => setForm((f) => ({ ...f, observacion: v }))} placeholder="Opcional" /></div>
          </div>
          {error && <p style={{ color: COLORS.bad, fontSize: 12, marginBottom: 10 }}>{error}</p>}
          <Btn icon={<Save size={14} />} onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar'}</Btn>
        </div>
      )}

      <div style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${COLORS.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 14, fontFamily: FONTS.serif }}>{movimientos.length} movimientos registrados</strong>
          <button onClick={() => setVer((v) => v === 'recientes' ? 'todos' : 'recientes')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: COLORS.muted }}>
            {ver === 'recientes' ? 'Ver todos' : 'Ver últimos 50'} <ChevronDown size={13} />
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: COLORS.panel, borderBottom: `2px solid ${COLORS.line}` }}>
                {['Medicamento', 'Origen', 'Destino', 'Cantidad', 'Fecha', 'Usuario'].map((h) => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: COLORS.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movsMostrar.map((m) => (
                <tr key={m.id} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{medicNombre(m.medicamentoCodigo)}</td>
                  <td style={{ padding: '8px 12px', color: COLORS.muted }}>{centroNombre(m.origen)}</td>
                  <td style={{ padding: '8px 12px', color: COLORS.muted }}>{centroNombre(m.destino)}</td>
                  <td style={{ padding: '8px 12px', fontFamily: FONTS.mono, color: COLORS.ok }}>{m.cantidad}</td>
                  <td style={{ padding: '8px 12px', color: COLORS.faint }}>{m.fecha}</td>
                  <td style={{ padding: '8px 12px', color: COLORS.faint }}>{m.usuario}</td>
                </tr>
              ))}
              {movimientos.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: COLORS.faint }}>Sin movimientos registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function AdminPanel() {
  const { user, isAdmin } = useAuth();
  const { empresa } = useEmpresa();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('trabajadores');
  const [inventario, setInventario] = useState<Medicamento[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargandoInv, setCargandoInv] = useState(true);
  const [respaldando, setRespaldando] = useState(false);

  const handleRespaldo = async () => {
    setRespaldando(true);
    try {
      await descargarRespaldo();
    } catch (err) {
      console.error('Error al generar el respaldo:', err);
      alert('No se pudo generar el respaldo. Verifica tu conexión e inténtalo de nuevo.');
    } finally {
      setRespaldando(false);
    }
  };

  const usuarioNombre = user?.email?.split('@')[0] ?? 'admin';
  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'AD';

  const cargarInv = useCallback(async () => {
    setCargandoInv(true);
    const est = await cargarEstado();
    setInventario(est.inventario);
    setMovimientos(est.movimientos);
    setCargandoInv(false);
  }, []);

  useEffect(() => { cargarInv(); }, [cargarInv]);

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.sans }}>
        <div style={{ textAlign: 'center', color: COLORS.bad }}>
          <Shield size={40} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 700, fontSize: 18 }}>Acceso restringido</div>
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 6 }}>Solo los administradores pueden acceder a este panel.</div>
          <button onClick={() => navigate('/')} style={{ marginTop: 16, padding: '8px 20px', background: BRAND, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Volver al inicio</button>
        </div>
      </div>
    );
  }

  const TABS_DEF: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'trabajadores', label: 'Trabajadores', icon: <Users size={15} /> },
    { key: 'medicamentos', label: 'Medicamentos', icon: <Package size={15} /> },
    { key: 'movimientos', label: 'Movimientos', icon: <ArrowLeftRight size={15} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, fontFamily: FONTS.sans, color: COLORS.ink }}>
      <TopBar userInitials={userInitials} userName={user?.email ?? 'Admin'} userRol="Administrador" onNewWorker={() => navigate('/nuevo-trabajador')} />

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, #1e293b 0%, #0f172a 100%)`, padding: '28px 32px 0' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 10 }}>
              <Shield size={22} color="rgba(255,255,255,0.9)" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: FONTS.serif }}>Panel de Administración</h1>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Gestión de datos maestros — {empresa.institucion}</p>
            </div>
            <button
              onClick={handleRespaldo}
              disabled={respaldando}
              title="Descarga una copia de seguridad (JSON) con todos los datos de esta instancia"
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 9, cursor: respaldando ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              <Download size={15} /> {respaldando ? 'Generando respaldo…' : 'Descargar respaldo'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS_DEF.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? '#fff' : 'rgba(255,255,255,0.6)', borderBottom: tab === t.key ? '3px solid #fff' : '3px solid transparent', transition: 'all 0.15s' }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 32px 80px' }}>
        {tab === 'trabajadores' && <TabTrabajadores userId={user?.uid ?? ''} />}
        {tab === 'medicamentos' && (cargandoInv ? <div style={{ color: COLORS.muted }}>Cargando inventario…</div> : <TabMedicamentos inventario={inventario} onRefresh={cargarInv} />)}
        {tab === 'movimientos' && (cargandoInv ? <div style={{ color: COLORS.muted }}>Cargando…</div> : <TabMovimientosAdmin inventario={inventario} movimientos={movimientos} usuarioNombre={usuarioNombre} onRefresh={cargarInv} />)}
      </div>
    </div>
  );
}
