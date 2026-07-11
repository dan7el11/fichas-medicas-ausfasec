// Herramienta de medición sobre una foto (canvas). El usuario toma/sube una
// imagen y marca puntos para medir: ángulo de articulación (3 puntos),
// inclinación respecto a la vertical (2 puntos) o distancia en píxeles (2 puntos).
// Cada medición de ángulo puede asignarse a un segmento y sugerir su puntaje.
//
// La foto anotada NO se sube aquí: se devuelve como imagen local (data URL) para
// que quede retenida en la pantalla de la evaluación. La subida a Storage se
// hace en una fase posterior (ver services/fotosPendientes.ts), así funciona
// aunque el teléfono no tenga conexión en ese momento.
import { useRef, useState, useEffect } from 'react';
import { X, Upload, RotateCcw, Check, Ruler, Spline, Move } from 'lucide-react';
import { METODOS } from '../../utils/ergonomia/definiciones';
import { anguloAPuntaje, SEGMENTOS_ANGULO } from '../../utils/ergonomia/anguloAPuntaje';
import type { MetodoErgo, FotoErgo } from '../../types/ergonomia';

type Modo = 'angulo' | 'vertical' | 'distancia';
interface Punto { x: number; y: number; }
interface Medicion { modo: Modo; puntos: Punto[]; valor: number; segmento?: string; etiqueta: string; }

const COLOR = '#0d9488';
const MAX_W = 900;

// Articulaciones y objetos típicos para etiquetar mediciones (lista sugerida,
// el campo acepta texto libre).
const ETIQUETAS_SUGERIDAS = [
  'Hombro', 'Codo', 'Muñeca', 'Cuello', 'Tronco', 'Rodilla', 'Cadera',
  'Monitor', 'Teclado', 'Ratón', 'Respaldo', 'Asiento', 'Teléfono', 'Mesa',
];

const textoValor = (m: Medicion) => (m.modo === 'distancia' ? `${Math.round(m.valor)} px` : `${m.valor.toFixed(0)}°`);

function gradosIncluido(a: Punto, v: Punto, b: Punto): number {
  const v1 = { x: a.x - v.x, y: a.y - v.y };
  const v2 = { x: b.x - v.x, y: b.y - v.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y), m2 = Math.hypot(v2.x, v2.y);
  if (!m1 || !m2) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) * 180 / Math.PI;
}
function gradosVertical(p0: Punto, p1: Punto): number {
  // ángulo del segmento respecto a la vertical hacia arriba (0,-1)
  const v = { x: p1.x - p0.x, y: p1.y - p0.y };
  const m = Math.hypot(v.x, v.y);
  if (!m) return 0;
  return Math.acos(Math.max(-1, Math.min(1, -v.y / m))) * 180 / Math.PI;
}

interface Props {
  trabajadorId: string;
  metodo: MetodoErgo;
  onAplicarPuntaje: (segKey: string, puntaje: number) => void;
  onFotoGuardada: (foto: FotoErgo) => void;
  onClose: () => void;
}

export default function MedidorAngulos({ trabajadorId, metodo, onAplicarPuntaje, onFotoGuardada, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camaraRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [modo, setModo] = useState<Modo>('vertical');
  const [enCurso, setEnCurso] = useState<Punto[]>([]);
  const [mediciones, setMediciones] = useState<Medicion[]>([]);

  const segmentos = SEGMENTOS_ANGULO.filter((k) => METODOS[metodo].campos.some((c) => c.key === k));
  const puntosNecesarios = modo === 'angulo' ? 3 : 2;

  const cargarImagen = (file: File) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { setImg(image); setMediciones([]); setEnCurso([]); URL.revokeObjectURL(url); };
    image.src = url;
  };

  // Redibujar
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !img) return;
    const escala = Math.min(1, MAX_W / img.naturalWidth);
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const dibujarPuntos = (pts: Punto[], color: string) => {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach((p, i) => { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
      ctx.stroke();
      pts.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); });
    };
    mediciones.forEach((m) => {
      dibujarPuntos(m.puntos, COLOR);
      const v = m.modo === 'angulo' ? m.puntos[1] : m.puntos[0];
      ctx.fillStyle = '#fff'; ctx.strokeStyle = COLOR; ctx.lineWidth = 3; ctx.font = 'bold 15px sans-serif';
      const txt = m.etiqueta ? `${m.etiqueta}: ${textoValor(m)}` : textoValor(m);
      ctx.strokeText(txt, v.x + 6, v.y - 6); ctx.fillText(txt, v.x + 6, v.y - 6);
    });
    dibujarPuntos(enCurso, '#e11d48');
  }, [img, mediciones, enCurso]);

  // Marca un punto a partir de coordenadas de cliente (sirve para ratón y táctil)
  const marcarEn = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current; if (!canvas || !img) return;
    const rect = canvas.getBoundingClientRect();
    const p = { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
    const pts = [...enCurso, p];
    if (pts.length < puntosNecesarios) { setEnCurso(pts); return; }
    const valor = modo === 'angulo' ? gradosIncluido(pts[0], pts[1], pts[2])
      : modo === 'vertical' ? gradosVertical(pts[0], pts[1])
      : Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    setMediciones((m) => [...m, { modo, puntos: pts, valor, etiqueta: '' }]);
    setEnCurso([]);
  };

  const click = (e: React.MouseEvent<HTMLCanvasElement>) => marcarEn(e.clientX, e.clientY);

  const setEtiqueta = (idx: number, etiqueta: string) => {
    setMediciones((m) => m.map((x, i) => i === idx ? { ...x, etiqueta } : x));
  };

  const asignar = (idx: number, seg: string) => {
    // Al asignar a un parámetro, si la medición no tiene etiqueta se usa el
    // nombre del parámetro (queda rotulada en la foto y en el PDF).
    const label = METODOS[metodo].campos.find((c) => c.key === seg)?.label ?? seg;
    setMediciones((m) => m.map((x, i) => i === idx ? { ...x, segmento: seg, etiqueta: x.etiqueta || (seg ? label : x.etiqueta) } : x));
  };
  const aplicar = (m: Medicion) => {
    if (!m.segmento) return;
    const p = anguloAPuntaje(metodo, m.segmento, m.valor);
    if (p != null) onAplicarPuntaje(m.segmento, p);
  };

  // Retiene la foto anotada en local (data URL). NO sube nada: la subida a
  // Storage se hace después desde la cola de fotos pendientes.
  const adjuntarFoto = () => {
    const canvas = canvasRef.current; if (!canvas || !img) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const sello = Date.now();
    onFotoGuardada({
      url: '',
      path: `ergonomia/${trabajadorId || 'sin-id'}/${sello}.jpg`,
      nombre: `foto_${sello}.jpg`,
      dataUrl,
      pendiente: true,
      mediciones: mediciones.map((m) => ({
        etiqueta: m.etiqueta || (m.modo === 'distancia' ? 'Distancia' : 'Ángulo'),
        valor: textoValor(m),
      })),
    });
    onClose();
  };

  const MODOS: { id: Modo; label: string; corto: string; icon: any }[] = [
    { id: 'vertical', label: 'Inclinación (2 pts)', corto: 'Inclinación', icon: Move },
    { id: 'angulo', label: 'Ángulo articular (3 pts)', corto: 'Ángulo', icon: Spline },
    { id: 'distancia', label: 'Distancia (2 pts)', corto: 'Distancia', icon: Ruler },
  ];

  return (
    <div className="fixed inset-0 z-[200] md:grid md:place-items-center md:p-4" style={{ background: 'rgba(13,27,42,0.6)' }} onClick={onClose}>
      <div
        className="bg-white w-full h-full flex flex-col md:h-auto md:rounded-2xl md:shadow-2xl md:w-[920px] md:max-w-full md:max-h-[92vh]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado (fijo) */}
        <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-slate-100 flex-shrink-0"
          style={{ paddingTop: 'calc(10px + env(safe-area-inset-top))' }}>
          <h2 className="m-0 text-base font-bold">Medir sobre foto</h2>
          <button onClick={onClose} className="grid place-items-center w-9 h-9 -mr-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={22} /></button>
        </div>

        {/* Cuerpo (desplazable) */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5">
          <div className="grid md:grid-cols-[1fr_280px] gap-4">
            <div>
              {!img ? (
                <div className="w-full aspect-[4/3] md:aspect-video border-2 border-dashed border-slate-300 rounded-xl grid place-items-center text-slate-400">
                  <div className="flex flex-col items-center gap-3 w-full px-6">
                    <button onClick={() => camaraRef.current?.click()} className="w-full max-w-xs inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white text-[15px] font-bold" style={{ background: COLOR }}>
                      <Upload size={18} /> Tomar foto con la cámara
                    </button>
                    <button onClick={() => fileRef.current?.click()} className="w-full max-w-xs inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-600 text-sm font-semibold">
                      Elegir de la galería
                    </button>
                  </div>
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  onClick={click}
                  className="w-full max-h-[52vh] md:max-h-none object-contain border border-slate-200 rounded-lg cursor-crosshair touch-manipulation select-none"
                />
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) cargarImagen(f); e.target.value = ''; }} />
              {/* capture=environment: en el teléfono abre directamente la cámara trasera */}
              <input ref={camaraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) cargarImagen(f); e.target.value = ''; }} />
              {img && (
                <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                  {MODOS.map((m) => (
                    <button key={m.id} onClick={() => { setModo(m.id); setEnCurso([]); }} className="inline-flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-lg text-[11.5px] font-semibold border leading-tight" style={modo === m.id ? { background: COLOR, color: '#fff', borderColor: COLOR } : { background: '#fff', color: '#475569', borderColor: '#e2e8f0' }}>
                      <m.icon size={16} /> <span className="text-center">{m.corto}</span>
                    </button>
                  ))}
                </div>
              )}
              {img && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button onClick={() => camaraRef.current?.click()} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-slate-200 text-slate-600"><Upload size={14} /> Otra foto</button>
                  {enCurso.length > 0 && <button onClick={() => setEnCurso([])} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-slate-200 text-slate-600"><RotateCcw size={14} /> Reiniciar punto</button>}
                </div>
              )}
              {img && <p className="text-[11.5px] text-slate-400 mt-2">Toca la foto para marcar {puntosNecesarios} puntos. La inclinación se mide respecto a la vertical; la distancia es referencial (en píxeles).</p>}
            </div>

            {/* Mediciones */}
            <div className="space-y-2">
              <div className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Mediciones</div>
              {mediciones.length === 0 && <div className="text-[12.5px] text-slate-400">Aún no hay mediciones.</div>}
              {mediciones.map((m, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold" style={{ color: COLOR }}>{m.etiqueta ? `${m.etiqueta}: ` : ''}{textoValor(m)}</span>
                    <button onClick={() => setMediciones((arr) => arr.filter((_, j) => j !== i))} className="grid place-items-center w-7 h-7 text-slate-300 hover:text-red-500"><X size={16} /></button>
                  </div>
                  <input
                    list="etiquetas-medidor"
                    value={m.etiqueta}
                    onChange={(e) => setEtiqueta(i, e.target.value)}
                    placeholder="Etiqueta: hombro, codo, monitor…"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded text-[12.5px] bg-white outline-none"
                  />
                  {m.modo !== 'distancia' && (
                    <div className="flex items-center gap-1.5">
                      <select value={m.segmento ?? ''} onChange={(e) => asignar(i, e.target.value)} className="flex-1 px-2 py-2 border border-slate-300 rounded text-[12.5px] bg-white">
                        <option value="">Sugerir puntaje a…</option>
                        {segmentos.map((s) => <option key={s} value={s}>{METODOS[metodo].campos.find((c) => c.key === s)?.label}</option>)}
                      </select>
                      <button onClick={() => aplicar(m)} disabled={!m.segmento} className="px-3 py-2 rounded text-[12.5px] font-bold text-white disabled:opacity-40" style={{ background: COLOR }}>Aplicar</button>
                    </div>
                  )}
                </div>
              ))}
              <datalist id="etiquetas-medidor">
                {ETIQUETAS_SUGERIDAS.map((e) => <option key={e} value={e} />)}
              </datalist>
              {mediciones.length > 0 && (
                <p className="text-[10.5px] text-slate-400 m-0">
                  Una misma foto puede tener varias mediciones y sugerir el puntaje de varios parámetros.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pie (fijo) */}
        <div className="flex gap-2 px-4 md:px-5 py-3 border-t border-slate-100 bg-slate-50 flex-shrink-0">
          <button onClick={onClose} className="flex-1 md:flex-none px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold">Cerrar</button>
          <button onClick={adjuntarFoto} disabled={!img} className="flex-1 md:flex-none md:ml-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-white rounded-lg text-sm font-bold disabled:opacity-50" style={{ background: COLOR }}>
            <Check size={16} /> Adjuntar foto
          </button>
        </div>
      </div>
    </div>
  );
}
