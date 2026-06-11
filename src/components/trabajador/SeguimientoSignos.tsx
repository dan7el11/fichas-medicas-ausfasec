// Pantalla de Seguimiento de signos (Presión · Peso · Glucosa). Archivo NUEVO.
// Embebible: <SeguimientoSignos trabajadorId tallaMetros nombreCompleto onBack />.
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, HeartPulse, Activity, Droplet, Plus, X, Check } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { MedicionSigno, TipoSigno } from '../../types/signo';
import { useToast } from '../Toast';
import { SIGNO_META } from '../../types/signo';
import {
  getMediciones, crearMedicion, porTipo, avg, fmtFechaHora, fmtFechaSola,
  clasePA, claseGlu, claseIMC, pesoNormalMax, toDate, TONE_STYLE, type Tone,
} from '../../services/signos';

const BRAND = '#0a6b3b';
const ICON: Record<TipoSigno, ReactNode> = { presion: <HeartPulse size={21} />, peso: <Activity size={21} />, glucosa: <Droplet size={21} /> };

interface Props { trabajadorId: string; tallaMetros?: number; nombreCompleto?: string; medicoId?: string; onBack?: () => void; }

export default function SeguimientoSignos({ trabajadorId, tallaMetros = 1.65, nombreCompleto, medicoId, onBack }: Props) {
  const [signo, setSigno] = useState<TipoSigno>('presion');
  const [meds, setMeds] = useState<MedicionSigno[]>([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState(false);

  const cargar = async () => { setCargando(true); try { setMeds(await getMediciones(trabajadorId)); } catch (e) { console.error(e); } finally { setCargando(false); } };
  useEffect(() => { cargar(); }, [trabajadorId]);

  const presion = useMemo(() => porTipo(meds, 'presion'), [meds]);
  const pesos = useMemo(() => porTipo(meds, 'peso'), [meds]);
  const glucosa = useMemo(() => porTipo(meds, 'glucosa'), [meds]);

  return (
    <div style={{ fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <div className="px-5 py-4">
        {onBack && <button onClick={onBack} className="inline-flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-slate-500 text-[13px] font-semibold mb-3.5 p-0 hover:text-slate-700"><ArrowLeft size={15} /> Volver a la ficha</button>}
        <div className="flex items-center gap-3 mb-[18px]">
          <div className="flex-1">
            <h2 className="m-0 text-[18px] font-extrabold tracking-tight">Seguimiento de signos</h2>
            {nombreCompleto && <div className="text-[13px] text-slate-500">{nombreCompleto}</div>}
          </div>
          <button onClick={() => setForm(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white border-none rounded-[9px] text-[13px] font-bold cursor-pointer" style={{ background: BRAND }}><Plus size={16} /> Registrar medición</button>
        </div>

        {/* Selector */}
        <div className="flex gap-2.5 mb-5">
          {(Object.keys(SIGNO_META) as TipoSigno[]).map((k) => {
            const m = SIGNO_META[k]; const on = signo === k;
            return (
              <button key={k} onClick={() => setSigno(k)} className="flex-1 flex items-center gap-2.5 p-[14px_16px] rounded-[14px] cursor-pointer text-left border"
                style={{ borderColor: on ? m.color : '#e8edf2', background: on ? `${m.color}0d` : '#fff', boxShadow: on ? `0 4px 16px ${m.color}1f` : '0 1px 2px rgba(13,27,42,0.04)' }}>
                <span className="grid place-items-center w-10 h-10 rounded-[11px]" style={{ background: on ? `${m.color}1a` : '#f2f5f8', color: on ? m.color : '#94a2b3' }}>{ICON[k]}</span>
                <div><div className="text-[14.5px] font-bold text-slate-900">{m.label}</div><div className="text-[11.5px] text-slate-400">{m.unidad}</div></div>
              </button>
            );
          })}
        </div>

        {cargando ? <div className="p-16 text-center text-slate-400 font-semibold">Cargando…</div>
          : signo === 'presion' ? <PanelPresion data={presion} />
          : signo === 'peso' ? <PanelPeso data={pesos} talla={tallaMetros} />
          : <PanelGlucosa data={glucosa} />}
      </div>

      {form && <FormMedicion signo={signo} talla={tallaMetros} trabajadorId={trabajadorId} medicoId={medicoId} onClose={() => setForm(false)} onSaved={() => { setForm(false); cargar(); }} />}
    </div>
  );
}

// ── Paneles ──────────────────────────────────────────────────────────────────
function PanelPresion({ data }: { data: MedicionSigno[] }) {
  if (data.length === 0) return <Vacio signo="presión arterial" />;
  const s = data.map((x) => x.sistolica ?? 0), d = data.map((x) => x.diastolica ?? 0);
  const avgS = Math.round(avg(s)), avgD = Math.round(avg(d)); const ult = data[data.length - 1];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1fr 300px' }}>
        <ChartCard title="Tendencia de presión arterial" series={[{ serie: s, color: '#dc2e3c', label: 'Sistólica' }, { serie: d, color: '#1d4fad', label: 'Diastólica' }]} labels={data.map((x) => toDate(x.fecha))} bands={[{ y: 140, label: 'HTA', color: '#dc2e3c' }, { y: 90, color: '#dc2e3c' }]} />
        <StatStack items={[
          { big: `${avgS}/${avgD}`, unidad: 'mmHg', label: 'Promedio', chip: clasePA(avgS, avgD) },
          { big: `${ult.sistolica}/${ult.diastolica}`, unidad: 'mmHg', label: 'Última medición', sub: fmtFechaHora(ult.fecha) },
          { big: `${Math.max(...s)}/${Math.max(...d)}`, label: 'Máxima registrada' },
          { big: `${data.length}`, label: 'Mediciones' },
        ]} />
      </div>
      <Tabla cols={['Fecha y hora', 'Sistólica', 'Diastólica', 'Contexto', 'Clasificación']}
        rows={[...data].reverse().map((x) => [fmtFechaHora(x.fecha), `${x.sistolica}`, `${x.diastolica}`, x.contexto ?? '—', <Chip c={clasePA(x.sistolica ?? 0, x.diastolica ?? 0)} />])} />
    </div>
  );
}

function PanelPeso({ data, talla }: { data: MedicionSigno[]; talla: number }) {
  if (data.length === 0) return <Vacio signo="peso" />;
  const serie = data.map((x) => x.peso ?? 0), serieIMC = data.map((x) => x.imc ?? 0);
  const ult = data[data.length - 1], primero = data[0];
  const acum = +((ult.peso ?? 0) - (primero.peso ?? 0)).toFixed(1);
  const maxNormal = pesoNormalMax(talla);
  const kgHasta = (ult.imc ?? 0) > 24.9 ? +((ult.peso ?? 0) - maxNormal).toFixed(1) : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1fr 300px' }}>
        <ChartCard title="Tendencia de peso" series={[{ serie, color: '#0f766e', label: 'Peso (kg)' }]} labels={data.map((x) => toDate(x.fecha))} />
        <StatStack items={[
          { big: `${ult.peso}`, unidad: 'kg', label: 'Peso actual', sub: fmtFechaSola(ult.fecha) },
          { big: `${ult.imc}`, unidad: 'kg/m²', label: 'IMC', chip: claseIMC(ult.imc ?? 0) },
          { big: `${acum > 0 ? '+' : ''}${acum}`, unidad: 'kg', label: 'Variación acumulada', sub: `desde ${fmtFechaSola(primero.fecha)}` },
          kgHasta > 0 ? { big: `${kgHasta}`, unidad: 'kg', label: 'Para IMC normal', sub: `meta ≤ ${maxNormal} kg` } : { big: 'Óptimo', label: 'IMC en rango normal' },
        ]} />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-[16px_18px] shadow-sm">
        <div className="text-[13px] font-bold mb-3">IMC en el tiempo · talla {talla} m</div>
        <Chart series={[{ serie: serieIMC, color: '#7c5cf2', label: '' }]} labels={data.map((x) => toDate(x.fecha))} bands={[{ y: 25, label: 'Sobrepeso' }, { y: 18.5 }]} height={120} />
      </div>
      <Tabla cols={['Fecha', 'Peso (kg)', 'IMC', 'Para IMC normal', 'Clasificación']}
        rows={[...data].reverse().map((x) => {
          const kg = (x.imc ?? 0) > 24.9 ? +((x.peso ?? 0) - maxNormal).toFixed(1) : 0;
          return [fmtFechaSola(x.fecha), `${x.peso}`, `${x.imc}`, kg > 0 ? `−${kg} kg` : '✓ en rango', <Chip c={claseIMC(x.imc ?? 0)} />];
        })} />
    </div>
  );
}

function PanelGlucosa({ data }: { data: MedicionSigno[] }) {
  if (data.length === 0) return <Vacio signo="glucosa" />;
  const serie = data.map((x) => x.glucosa ?? 0);
  const ayunas = data.filter((x) => x.contexto === 'Ayunas');
  const avgA = ayunas.length ? Math.round(avg(ayunas.map((x) => x.glucosa ?? 0))) : null;
  const ult = data[data.length - 1];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1fr 300px' }}>
        <ChartCard title="Tendencia de glucosa" series={[{ serie, color: '#a01f2a', label: 'Glucosa' }]} labels={data.map((x) => toDate(x.fecha))} bands={[{ y: 126, label: 'DM', color: '#a01f2a' }, { y: 100, color: '#e08a2c' }]} />
        <StatStack items={[
          { big: avgA != null ? `${avgA}` : '—', unidad: 'mg/dL', label: 'Promedio en ayunas', chip: avgA != null ? claseGlu(avgA, 'Ayunas') : undefined },
          { big: `${ult.glucosa}`, unidad: 'mg/dL', label: 'Última medición', sub: `${ult.contexto ?? ''} · ${fmtFechaHora(ult.fecha)}` },
          { big: `${Math.max(...serie)}`, unidad: 'mg/dL', label: 'Máxima registrada' },
          { big: `${data.length}`, label: 'Mediciones' },
        ]} />
      </div>
      <Tabla cols={['Fecha y hora', 'Glucosa', 'Contexto', 'Clasificación']}
        rows={[...data].reverse().map((x) => [fmtFechaHora(x.fecha), `${x.glucosa} mg/dL`, x.contexto ?? '—', <Chip c={claseGlu(x.glucosa ?? 0, x.contexto)} />])} />
    </div>
  );
}

// ── Formulario ───────────────────────────────────────────────────────────────
function FormMedicion({ signo, talla, trabajadorId, medicoId, onClose, onSaved }: { signo: TipoSigno; talla: number; trabajadorId: string; medicoId?: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const meta = SIGNO_META[signo];
  const ahora = new Date(); ahora.setSeconds(0, 0);
  const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const [sis, setSis] = useState(''); const [dia, setDia] = useState('');
  const [peso, setPeso] = useState(''); const [glu, setGlu] = useState('');
  const [ctx, setCtx] = useState<'Ayunas' | 'Postprandial'>('Ayunas');
  const [fecha, setFecha] = useState(meta.conHora ? isoLocal(ahora) : isoLocal(ahora).slice(0, 10));
  const [guardando, setGuardando] = useState(false);

  const valido = signo === 'presion' ? sis && dia : signo === 'peso' ? peso : glu;
  const guardar = async () => {
    if (!valido) return; setGuardando(true);
    const d = new Date(fecha + (meta.conHora ? '' : 'T08:00'));
    const base: any = { trabajadorId, tipo: signo, fecha: Timestamp.fromDate(d), medicoId: medicoId ?? '' };
    if (signo === 'presion') { base.sistolica = +sis; base.diastolica = +dia; }
    if (signo === 'peso') { const p = +peso; base.peso = p; base.imc = +(p / (talla * talla)).toFixed(1); }
    if (signo === 'glucosa') { base.glucosa = +glu; base.contexto = ctx; }
    try { await crearMedicion(base); onSaved(); } catch (e) { console.error(e); toast.error('No se pudo guardar.'); setGuardando(false); }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] grid place-items-center p-6" style={{ background: 'rgba(13,27,42,0.5)' }}>
      <div onClick={(e) => e.stopPropagation()} className="w-[440px] max-w-full bg-white rounded-[18px] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2.5 p-[18px_22px] border-b border-slate-100">
          <span className="grid place-items-center w-9 h-9 rounded-[10px]" style={{ background: `${meta.color}14`, color: meta.color }}>{ICON[signo]}</span>
          <div className="flex-1"><h3 className="m-0 text-[16px] font-extrabold">Registrar {meta.label.toLowerCase()}</h3><p className="m-0 mt-px text-[12px] text-slate-500">{meta.conHora ? 'Con fecha y hora exacta' : 'Con fecha'}</p></div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-slate-400 p-1"><X size={20} /></button>
        </div>
        <div className="p-[20px_22px] flex flex-col gap-4">
          {signo === 'presion' && <div className="grid grid-cols-2 gap-3">
            <Campo label="Sistólica (mmHg)"><input type="number" value={sis} onChange={(e) => setSis(e.target.value)} placeholder="120" className={inpCls} /></Campo>
            <Campo label="Diastólica (mmHg)"><input type="number" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="80" className={inpCls} /></Campo>
          </div>}
          {signo === 'peso' && <Campo label="Peso (kg)"><input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="72.5" className={inpCls} /></Campo>}
          {signo === 'glucosa' && <>
            <Campo label="Glucosa (mg/dL)"><input type="number" value={glu} onChange={(e) => setGlu(e.target.value)} placeholder="95" className={inpCls} /></Campo>
            <Campo label="Contexto"><div className="flex gap-1.5">
              {(['Ayunas', 'Postprandial'] as const).map((o) => <button key={o} onClick={() => setCtx(o)} className="flex-1 py-2.5 rounded-lg cursor-pointer text-[13px] font-semibold border" style={{ borderColor: ctx === o ? meta.color : '#dde4ec', background: ctx === o ? `${meta.color}0d` : '#fff', color: ctx === o ? meta.color : '#5a6a7a' }}>{o}</button>)}
            </div></Campo>
          </>}
          <Campo label={meta.conHora ? 'Fecha y hora' : 'Fecha'}>
            <input type={meta.conHora ? 'datetime-local' : 'date'} value={fecha} onChange={(e) => setFecha(e.target.value)} className={inpCls} />
          </Campo>
        </div>
        <div className="p-[16px_22px] border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-3.5 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-[9px] text-[13px] font-semibold cursor-pointer">Cancelar</button>
          <button onClick={guardar} disabled={!valido || guardando} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white border-none rounded-[9px] text-[13px] font-bold cursor-pointer disabled:opacity-50" style={{ background: BRAND }}><Check size={15} /> {guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Piezas visuales ──────────────────────────────────────────────────────────
interface Serie { serie: number[]; color: string; label: string; }
function ChartCard({ title, series, labels, bands }: { title: string; series: Serie[]; labels: Date[]; bands?: { y: number; label?: string; color?: string }[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-[16px_18px] shadow-sm">
      <div className="flex items-center gap-3.5 mb-3.5">
        <h3 className="m-0 text-[14.5px] font-bold">{title}</h3>
        <div className="ml-auto flex gap-3">{series.map((s) => <span key={s.label} className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 font-semibold"><span className="w-2.5 h-[3px] rounded-sm" style={{ background: s.color }} />{s.label}</span>)}</div>
      </div>
      <Chart series={series} labels={labels} bands={bands} height={180} />
    </div>
  );
}
function Chart({ series, labels, bands, height = 180 }: { series: Serie[]; labels: Date[]; bands?: { y: number; label?: string; color?: string }[]; height?: number }) {
  const W = 640, H = height, padL = 38, padR = 14, padT = 14, padB = 28;
  const all = series.flatMap((s) => s.serie);
  if (all.length === 0) return <div style={{ height: H }} className="grid place-items-center text-slate-300 text-[12px]">Sin datos</div>;
  let min = Math.min(...all), max = Math.max(...all);
  bands?.forEach((b) => { min = Math.min(min, b.y); max = Math.max(max, b.y); });
  const span = max - min || 1; min -= span * 0.12; max += span * 0.12;
  const n = labels.length;
  const X = (i: number) => padL + (n <= 1 ? 0.5 : i / (n - 1)) * (W - padL - padR);
  const Y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="block">
      {Array.from({ length: 5 }).map((_, i) => { const v = min + (i / 4) * (max - min); const y = Y(v); return <g key={i}><line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f0f3f6" /><text x={padL - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#94a2b3" fontFamily="monospace">{Math.round(v)}</text></g>; })}
      {bands?.map((b, i) => <g key={i}><line x1={padL} y1={Y(b.y)} x2={W - padR} y2={Y(b.y)} stroke={b.color || '#cbd5e1'} strokeDasharray="4 3" opacity={0.6} />{b.label && <text x={W - padR - 2} y={Y(b.y) - 3} textAnchor="end" fontSize={8.5} fontWeight={700} fill={b.color || '#94a2b3'}>{b.label}</text>}</g>)}
      {series.map((s, si) => <g key={si}><polyline points={s.serie.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />{s.serie.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r={3} fill="#fff" stroke={s.color} strokeWidth={2} />)}</g>)}
      {labels.map((d, i) => (n <= 6 || i % Math.ceil(n / 6) === 0 || i === n - 1) ? <text key={i} x={X(i)} y={H - 8} textAnchor="middle" fontSize={8.5} fill="#94a2b3">{d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}</text> : null)}
    </svg>
  );
}
function StatStack({ items }: { items: ({ big: string; unidad?: string; label: string; sub?: string; chip?: { label: string; tone: Tone } } | undefined)[] }) {
  return <div className="flex flex-col gap-2.5">{items.filter(Boolean).map((it, i) => (
    <div key={i} className="bg-white border border-slate-200 rounded-[13px] p-[13px_16px] shadow-sm">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">{it!.label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[26px] font-extrabold tracking-tight font-mono">{it!.big}</span>
        {it!.unidad && <span className="text-[12px] text-slate-400">{it!.unidad}</span>}
        {it!.chip && <span className="ml-auto"><Chip c={it!.chip} /></span>}
      </div>
      {it!.sub && <div className="text-[11.5px] text-slate-400 mt-1">{it!.sub}</div>}
    </div>
  ))}</div>;
}
function Tabla({ cols, rows }: { cols: string[]; rows: ReactNode[][] }) {
  const gt = `1.6fr ${cols.slice(1).map(() => '1fr').join(' ')}`;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="grid gap-2.5 p-[11px_18px] bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase text-slate-400 tracking-[0.4px]" style={{ gridTemplateColumns: gt }}>{cols.map((c) => <span key={c}>{c}</span>)}</div>
      {rows.map((r, i) => <div key={i} className="grid gap-2.5 p-[11px_18px] items-center text-[13px]" style={{ gridTemplateColumns: gt, borderTop: i > 0 ? '1px solid #f4f6f9' : 'none' }}>{r.map((cell, j) => <span key={j} style={{ color: j === 0 ? '#5a6a7a' : '#0d1b2a', fontWeight: j === 0 ? 500 : 600, fontFamily: j > 0 && typeof cell === 'string' ? 'ui-monospace, monospace' : undefined }}>{cell}</span>)}</div>)}
    </div>
  );
}
function Chip({ c }: { c: { label: string; tone: Tone } }) {
  const t = TONE_STYLE[c.tone];
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap" style={{ background: t.bg, color: t.fg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: t.bar }} />{c.label}</span>;
}
function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="block text-[11px] font-bold tracking-[0.4px] uppercase text-slate-400 mb-1.5">{label}</span>{children}</label>;
}
function Vacio({ signo }: { signo: string }) {
  return <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm"><p className="text-slate-400 text-[13px]">Sin mediciones de {signo}. Pulsa «Registrar medición» para empezar.</p></div>;
}
const inpCls = 'w-full p-[10px_12px] rounded-[9px] border border-slate-300 text-[14px] text-slate-900 bg-white outline-none focus:border-emerald-500 box-border';
