import type { Trabajador, EvaluacionMedica } from '../../types';
import {
  apellidos,
  areaColors,
  areaDeTrabajador,
  aptitudLabel,
  fmtDate,
  iniciales,
  nombres,
  sortEvaluacionesDesc,
  TONE_STYLES,
  venceEn,
  workerStatus,
} from '../../utils/medicalHelpers';

interface QuickViewProps {
  trabajador: Trabajador;
  evals: EvaluacionMedica[];
  examenes?: any[];
  reposos?: any[];
  onOpenFull: () => void;
  onNewEval: () => void;
  onNewReposo?: () => void;
  onViewEval?: (evalId: string) => void;
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────
function Sparkline({ values, color = '#3b82f6', width = 80, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastX = width;
  const lastY = height - ((values[values.length - 1] - min) / range) * (height - 4) - 2;
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3" fill={color} />
    </svg>
  );
}

// ─── Clasificaciones ──────────────────────────────────────────────────────────
function paClass(sist: number, diast: number): 'normal' | 'prehipert' | 'hipert' {
  if (sist >= 140 || diast >= 90) return 'hipert';
  if (sist >= 120 || diast >= 80) return 'prehipert';
  return 'normal';
}

function imcClass(imc: number): 'bajo' | 'normal' | 'sobrepeso' | 'obesidad' {
  if (imc < 18.5) return 'bajo';
  if (imc < 25) return 'normal';
  if (imc < 30) return 'sobrepeso';
  return 'obesidad';
}

const PA_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  normal:    { label: 'Normal',          bg: '#d1fae5', color: '#065f46' },
  prehipert: { label: 'Prehipertensión', bg: '#fef3c7', color: '#92400e' },
  hipert:    { label: 'Hipertensión',    bg: '#fee2e2', color: '#991b1b' },
};
const IMC_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  bajo:      { label: 'Bajo peso',  bg: '#dbeafe', color: '#1e3a8a' },
  normal:    { label: 'Normal',     bg: '#d1fae5', color: '#065f46' },
  sobrepeso: { label: 'Sobrepeso', bg: '#fef3c7', color: '#92400e' },
  obesidad:  { label: 'Obesidad',  bg: '#fee2e2', color: '#991b1b' },
};

const TIPO_REPOSO: Record<string, string> = {
  reposo: 'Reposo médico',
  incapacidad: 'Incapacidad laboral',
  permiso: 'Permiso médico',
};

// ─── Helper ───────────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">{children}</div>;
}

function CardHeader({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
      <h3 className="m-0 text-sm font-bold text-slate-800">{title}</h3>
      <div className="flex items-center gap-2">
        {count != null && (
          <span className="text-[11px] text-slate-500">{count} registro{count !== 1 ? 's' : ''}</span>
        )}
        {action}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-5 py-6 text-center text-slate-400 text-xs">{text}</div>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function QuickView({
  trabajador: w,
  evals,
  examenes = [],
  reposos = [],
  onOpenFull,
  onNewEval,
  onNewReposo,
  onViewEval,
}: QuickViewProps) {
  const status = workerStatus(evals);
  const sorted = sortEvaluacionesDesc(evals);
  const lastEv = sorted[0] ?? null;
  const ac = areaColors(w);
  const tones = TONE_STYLES[status.tone];

  // — Datos clínicos de la última evaluación —
  const sv = lastEv?.signosVitales ?? null;
  const diagnosticos: any[] = lastEv?.diagnosticos ?? [];
  const aptitud = lastEv ? aptitudLabel(lastEv) : null;
  const observaciones: string = lastEv?.aptitudObservacion ?? '';
  const limitaciones: string = lastEv?.aptitudLimitaciones ?? '';
  const recomendaciones: string[] = lastEv?.recomendaciones ?? [];
  const meds: any[] = lastEv?.medicacionesHabituales ?? [];

  // — Tendencias históricas (todas las evaluaciones, más recientes al final para sparkline) —
  const evAsc = [...sorted].reverse();
  const pasSist = evAsc.map((e) => parseInt(e.signosVitales?.presionSistolica || '0')).filter(Boolean);
  const pasDiast = evAsc.map((e) => parseInt(e.signosVitales?.presionDiastolica || '0')).filter(Boolean);
  const pesos = evAsc.map((e) => parseFloat(e.signosVitales?.peso || '0')).filter(Boolean);
  const imcs = evAsc.map((e) => parseFloat(String(e.signosVitales?.imc || '0'))).filter(Boolean);
  const glucosas = evAsc
    .map((e) => parseFloat(e.signosVitales?.glucosaCapilar || '0'))
    .filter(Boolean);

  // Clasificaciones actuales
  const lastSist = sv ? parseInt(sv.presionSistolica || '0') : 0;
  const lastDiast = sv ? parseInt(sv.presionDiastolica || '0') : 0;
  const lastImc = sv ? parseFloat(String(sv.imc || '0')) : 0;
  const lastGlucosa = sv ? parseFloat(sv.glucosaCapilar || '0') : 0;
  const currentPA = lastSist > 0 && lastDiast > 0 ? paClass(lastSist, lastDiast) : null;
  const currentIMC = lastImc > 0 ? imcClass(lastImc) : null;
  const showPATrend = currentPA === 'prehipert' || currentPA === 'hipert';
  const showIMCTrend = currentIMC === 'sobrepeso' || currentIMC === 'obesidad';

  return (
    <div className="px-7 pt-5 pb-8 flex flex-col gap-4">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="text-[11px] text-slate-500 mb-2.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: ac.dot }} />
          <span>{areaDeTrabajador(w)}</span>
          <span>·</span>
          <span>{w.puestoTrabajo}</span>
        </div>
        <div className="flex items-start gap-4">
          <div
            className="w-[60px] h-[60px] rounded-[14px] grid place-items-center text-xl font-bold flex-shrink-0"
            style={{ background: ac.bg, color: ac.fg }}
          >
            {iniciales(w)}
          </div>
          <div className="flex-1">
            <h1 className="m-0 text-[22px] font-bold tracking-[-0.4px]">
              {apellidos(w)} {nombres(w)}
            </h1>
            <div className="flex gap-4 mt-2 text-xs text-slate-700 flex-wrap">
              <span>
                <span className="text-slate-500">Cédula</span>{' '}
                <span className="font-mono ml-1">{w.cedula}</span>
              </span>
              <span>
                <span className="text-slate-500">Sexo</span>{' '}
                <span className="ml-1">{w.sexo === 'M' ? 'Masculino' : 'Femenino'}</span>
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={onOpenFull}
              className="px-3 py-2 bg-white border border-slate-300 rounded-[7px] text-xs cursor-pointer text-slate-700 hover:bg-slate-50"
            >
              Ver ficha completa ↗
            </button>
            <button
              onClick={onNewEval}
              className="px-3.5 py-2 text-white border-none rounded-[7px] text-xs font-semibold cursor-pointer"
              style={{ background: '#0a6b3b' }}
            >
              + Nueva evaluación
            </button>
          </div>
        </div>

        {/* Estado actual */}
        <div
          className="mt-4 p-3.5 rounded-[10px] flex items-center gap-4"
          style={{ border: `1px solid ${tones.bar}40`, background: `${tones.bg}b3` }}
        >
          <div className="w-1 self-stretch rounded-[2px]" style={{ background: tones.bar }} />
          <div className="flex-1">
            <div className="text-[10px] font-bold tracking-[0.7px] uppercase" style={{ color: tones.fg }}>Estado actual</div>
            <div className="text-[17px] font-bold mt-0.5" style={{ color: tones.fg }}>{status.label}</div>
            {lastEv && (
              <div className="text-[11px] text-slate-700 mt-0.5">
                Última: {lastEv.numeroHistoriaClinica ? `HC ${lastEv.numeroHistoriaClinica}` : 'Evaluación'} · {fmtDate(lastEv.fecha)}
                {status.dias != null && (
                  <> · {status.dias >= 0 ? <>vence en {status.dias} días</> : <>vencida hace {Math.abs(status.dias)} días</>}</>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[22px] font-bold tracking-[-0.4px]" style={{ color: tones.fg }}>{evals.length}</div>
            <div className="text-[10px] text-slate-500">evaluaciones</div>
          </div>
        </div>
      </div>

      {/* ── Seguimiento de constantes vitales ─────────────────── */}
      <Card>
        <CardHeader title="Seguimiento clínico" />
        {!sv ? (
          <Empty text="Sin datos de constantes vitales. Registra una evaluación." />
        ) : (
          <div className="p-5 flex flex-col gap-4">
            {/* Fila superior: PA + Peso/IMC */}
            <div className="grid grid-cols-2 gap-4">

              {/* Presión arterial */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-[0.4px] mb-1">Presión arterial</div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[24px] font-bold text-slate-900 leading-none">
                      {sv.presionSistolica || '—'}/{sv.presionDiastolica || '—'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">mmHg</div>
                  </div>
                  {pasSist.length >= 2 && (
                    <Sparkline values={pasSist} color={currentPA === 'hipert' ? '#ef4444' : currentPA === 'prehipert' ? '#f59e0b' : '#10b981'} />
                  )}
                </div>
                {currentPA && (
                  <span
                    className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: PA_LABELS[currentPA].bg, color: PA_LABELS[currentPA].color }}
                  >
                    {PA_LABELS[currentPA].label}
                  </span>
                )}
                {showPATrend && pasSist.length >= 2 && (
                  <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                    Seguimiento PA recomendado · {pasSist.length} mediciones
                  </div>
                )}
              </div>

              {/* Peso / IMC */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-[0.4px] mb-1">Peso / IMC</div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[24px] font-bold text-slate-900 leading-none">
                      {sv.peso || '—'} <span className="text-[14px] font-normal text-slate-500">kg</span>
                    </div>
                    <div className="text-[13px] font-semibold text-slate-700 mt-0.5">IMC {lastImc > 0 ? lastImc : '—'}</div>
                  </div>
                  {pesos.length >= 2 && (
                    <Sparkline values={pesos} color={currentIMC === 'obesidad' ? '#ef4444' : currentIMC === 'sobrepeso' ? '#f59e0b' : '#10b981'} />
                  )}
                </div>
                {currentIMC && (
                  <span
                    className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: IMC_LABELS[currentIMC].bg, color: IMC_LABELS[currentIMC].color }}
                  >
                    {IMC_LABELS[currentIMC].label}
                  </span>
                )}
                {showIMCTrend && imcs.length >= 2 && (
                  <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                    Seguimiento peso recomendado · {imcs.length} mediciones
                  </div>
                )}
              </div>
            </div>

            {/* Glucosa capilar (solo si hay datos) */}
            {(lastGlucosa > 0 || glucosas.length > 0) && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-[0.4px] mb-1">Glucosa capilar</div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[24px] font-bold text-slate-900 leading-none">
                      {lastGlucosa > 0 ? lastGlucosa : '—'} <span className="text-[14px] font-normal text-slate-500">mg/dL</span>
                    </div>
                    {lastGlucosa >= 126 && (
                      <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        Hiperglucemia
                      </span>
                    )}
                    {lastGlucosa > 0 && lastGlucosa >= 100 && lastGlucosa < 126 && (
                      <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        Prediabetes
                      </span>
                    )}
                  </div>
                  {glucosas.length >= 2 && (
                    <Sparkline values={glucosas} color={lastGlucosa >= 126 ? '#ef4444' : lastGlucosa >= 100 ? '#f59e0b' : '#10b981'} />
                  )}
                </div>
                {glucosas.length >= 2 && (
                  <div className="mt-2 text-[10px] text-slate-500">{glucosas.length} mediciones registradas</div>
                )}
              </div>
            )}

            {/* Aptitud + observaciones */}
            {aptitud && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-[0.4px] mb-1">Aptitud</div>
                  <span
                    className="inline-block text-[12px] px-3 py-1 rounded-full font-bold"
                    style={{
                      background: aptitud === 'Apto' ? '#d1fae5' : aptitud === 'No apto' ? '#fee2e2' : '#fef3c7',
                      color: aptitud === 'Apto' ? '#065f46' : aptitud === 'No apto' ? '#991b1b' : '#92400e',
                    }}
                  >
                    {aptitud}
                  </span>
                </div>
                {(observaciones || limitaciones) && (
                  <div className="flex-1 text-xs text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100">
                    {observaciones && <p className="m-0"><span className="font-semibold">Observaciones:</span> {observaciones}</p>}
                    {limitaciones && <p className="m-0 mt-1"><span className="font-semibold">Limitaciones:</span> {limitaciones}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Últimos 5 diagnósticos ────────────────────────────── */}
      <Card>
        <CardHeader title="Diagnósticos recientes" />
        {diagnosticos.length === 0 ? (
          <Empty text="Sin diagnósticos en la última evaluación." />
        ) : (
          <div className="max-h-[200px] overflow-y-auto">
            {diagnosticos.slice(0, 5).map((d: any, i: number) => (
              <div
                key={i}
                className="px-5 py-3 flex items-center gap-3 text-xs"
                style={{ borderBottom: i < Math.min(diagnosticos.length, 5) - 1 ? '1px solid #f4f6f9' : 'none' }}
              >
                {d.cie && (
                  <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded flex-shrink-0">{d.cie}</span>
                )}
                <span className="flex-1 text-slate-800">{d.descripcion ?? String(d)}</span>
                {d.tipo && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                      d.tipo === 'definitivo' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {d.tipo === 'definitivo' ? 'DEF' : 'PRE'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Medicamentos recetados ────────────────────────────── */}
      <Card>
        <CardHeader title="Medicamentos recetados" />
        {meds.length === 0 ? (
          <Empty text="Sin medicamentos registrados en la última evaluación." />
        ) : (
          <div>
            {meds.map((m: any, i: number) => (
              <div
                key={i}
                className="px-5 py-3 flex items-center gap-3 text-xs"
                style={{ borderBottom: i < meds.length - 1 ? '1px solid #f4f6f9' : 'none' }}
              >
                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 grid place-items-center text-[14px] flex-shrink-0">💊</div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-800">{m.nombre}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {m.dosis && <span>{m.dosis}</span>}
                    {m.frecuencia && <span> · {m.frecuencia}</span>}
                    {m.horario && <span> · {m.horario}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {recomendaciones.length > 0 && (
          <div className="px-5 pb-4">
            <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-[0.4px] mb-1.5 mt-3">Recomendaciones</div>
            <ul className="m-0 pl-4 text-xs text-slate-700 flex flex-col gap-1 list-disc">
              {recomendaciones.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}
      </Card>

      {/* ── Reposos / Incapacidades médicas ───────────────────── */}
      <Card>
        <CardHeader
          title="Reposos / Incapacidades"
          count={reposos.length}
          action={
            onNewReposo && (
              <button
                onClick={onNewReposo}
                className="text-[11px] px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer text-slate-700"
              >
                + Nuevo
              </button>
            )
          }
        />
        {reposos.length === 0 ? (
          <Empty text="Sin reposos registrados." />
        ) : (
          <div>
            {reposos.slice(0, 5).map((r: any, i: number) => (
              <div
                key={r.id ?? i}
                className="px-5 py-3 flex items-start gap-3 text-xs"
                style={{ borderBottom: i < Math.min(reposos.length, 5) - 1 ? '1px solid #f4f6f9' : 'none' }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-slate-800">{TIPO_REPOSO[r.tipo] ?? r.tipo}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                      {r.diasReposo} día{r.diasReposo !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {r.fechaInicio} → {r.fechaFin}
                  </div>
                  {r.diagnostico && (
                    <div className="text-[11px] text-slate-700 mt-0.5 italic">{r.diagnostico}</div>
                  )}
                </div>
                {r.codigoCIE && (
                  <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded flex-shrink-0">{r.codigoCIE}</span>
                )}
              </div>
            ))}
            {reposos.length > 5 && (
              <div className="px-5 py-2 text-center text-[11px] text-slate-500 border-t border-slate-100">
                +{reposos.length - 5} más ·{' '}
                <button onClick={onOpenFull} className="bg-transparent border-none text-blue-600 cursor-pointer text-[11px] underline">
                  Ver en ficha completa
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Exámenes planificados / recientes ─────────────────── */}
      <Card>
        <CardHeader title="Exámenes" count={examenes.length} />
        {examenes.length === 0 ? (
          <Empty text="Sin exámenes registrados." />
        ) : (
          <div>
            {examenes.slice(0, 5).map((ex: any, i: number) => {
              const esPatologico =
                ex.resultado === 'patológico' || ex.resultado === 'patologico' || ex.patologico === true;
              return (
                <div
                  key={ex.id ?? i}
                  className="px-5 py-3 flex items-center gap-3 text-xs"
                  style={{ borderBottom: i < Math.min(examenes.length, 5) - 1 ? '1px solid #f4f6f9' : 'none' }}
                >
                  <div className="flex-1">
                    <div className="font-semibold text-slate-800">{ex.tipo ?? ex.nombre ?? 'Examen'}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {ex.fecha?.seconds ? fmtDate({ seconds: ex.fecha.seconds }) : ex.fecha ? fmtDate(ex.fecha) : '—'}
                      {ex.laboratorio && ` · ${ex.laboratorio}`}
                    </div>
                  </div>
                  {esPatologico && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠ Patológico</span>
                  )}
                  {ex.estado && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        ex.estado === 'pendiente' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {ex.estado}
                    </span>
                  )}
                </div>
              );
            })}
            {examenes.length > 5 && (
              <div className="px-5 py-2 text-center text-[11px] text-slate-500 border-t border-slate-100">
                +{examenes.length - 5} más ·{' '}
                <button onClick={onOpenFull} className="bg-transparent border-none text-blue-600 cursor-pointer text-[11px] underline">
                  Ver todos
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Historial de evaluaciones ─────────────────────────── */}
      <Card>
        <CardHeader title="Historial de evaluaciones" count={evals.length} />
        {sorted.length === 0 ? (
          <div className="p-9 text-center text-slate-500 text-xs">
            Sin evaluaciones.{' '}
            <button
              onClick={onNewEval}
              className="bg-transparent border-none font-semibold cursor-pointer underline text-xs"
              style={{ color: '#0a6b3b' }}
            >
              Registrar la primera
            </button>
          </div>
        ) : (
          sorted.map((ev, i) => {
            const label = aptitudLabel(ev);
            const tone = label === 'Apto' ? 'success' : label === 'No apto' ? 'danger' : 'warning';
            const t = TONE_STYLES[tone];
            return (
              <div
                key={ev.id}
                className="px-5 py-3 grid items-center gap-4 text-xs"
                style={{
                  gridTemplateColumns: '140px 1fr 1fr 80px',
                  borderBottom: i === sorted.length - 1 ? 'none' : '1px solid #f4f6f9',
                }}
              >
                <div>
                  <div className="text-[13px] font-semibold">HC {ev.numeroHistoriaClinica || '—'}</div>
                  <div className="text-[11px] text-slate-500">{fmtDate(ev.fecha)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 tracking-[0.4px] uppercase font-semibold">Aptitud</div>
                  <span
                    className="inline-block mt-0.5 text-[11px] px-2 py-0.5 rounded-[10px] font-semibold"
                    style={{ background: t.bg, color: t.fg }}
                  >
                    {label}
                  </span>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 tracking-[0.4px] uppercase font-semibold">Vigencia</div>
                  <div className="text-xs mt-0.5">{fmtDate(venceEn(ev.fecha))}</div>
                </div>
                <div className="text-right">
                  <button
                    onClick={() => {
                      if (!ev.id) return;
                      if (onViewEval) onViewEval(ev.id);
                      else onOpenFull();
                    }}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-[11px] cursor-pointer hover:bg-slate-50"
                  >
                    Ver
                  </button>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
