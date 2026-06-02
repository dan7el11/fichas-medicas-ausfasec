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
  onOpenFull: () => void;
  onNewEval: () => void;
  onViewEval?: (evalId: string) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
      <h3 className="m-0 text-sm font-bold text-slate-800">{children}</h3>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="px-5 py-5 text-center text-slate-400 text-xs">{text}</div>
  );
}

export default function QuickView({
  trabajador: w,
  evals,
  examenes = [],
  onOpenFull,
  onNewEval,
  onViewEval,
}: QuickViewProps) {
  const status = workerStatus(evals);
  const sorted = sortEvaluacionesDesc(evals);
  const lastEv = sorted[0] ?? null;
  const ac = areaColors(w);
  const tones = TONE_STYLES[status.tone];

  // Extract clinical data from last evaluation
  const signosVitales = lastEv?.signosVitales ?? null;
  const diagnosticos: any[] = lastEv?.diagnosticos ?? [];
  const aptitud = lastEv ? aptitudLabel(lastEv) : null;
  const observaciones: string = lastEv?.aptitudObservacion ?? '';
  const recomendaciones: string[] = lastEv?.recomendaciones ?? [];

  return (
    <div className="px-7 pt-5 pb-8 flex flex-col gap-4">

      {/* ─── Hero: datos del trabajador ─── */}
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
              style={{ background: 'var(--brand-primary, #0a6b3b)' }}
            >
              + Nueva evaluación
            </button>
          </div>
        </div>

        {/* Estado actual */}
        <div
          className="mt-4 p-3.5 rounded-[10px] flex items-center gap-4"
          style={{
            border: `1px solid ${tones.bar}40`,
            background: `${tones.bg}b3`,
          }}
        >
          <div className="w-1 self-stretch rounded-[2px]" style={{ background: tones.bar }} />
          <div className="flex-1">
            <div className="text-[10px] font-bold tracking-[0.7px] uppercase" style={{ color: tones.fg }}>
              Estado actual
            </div>
            <div className="text-[17px] font-bold mt-0.5" style={{ color: tones.fg }}>
              {status.label}
            </div>
            {lastEv && (
              <div className="text-[11px] text-slate-700 mt-0.5">
                Última: {lastEv.numeroHistoriaClinica ? `HC ${lastEv.numeroHistoriaClinica}` : 'Evaluación'} ·{' '}
                {fmtDate(lastEv.fecha)}
                {status.dias != null && (
                  <>
                    {' · '}
                    {status.dias >= 0 ? (
                      <>vence en {status.dias} días</>
                    ) : (
                      <>vencida hace {Math.abs(status.dias)} días</>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[22px] font-bold tracking-[-0.4px]" style={{ color: tones.fg }}>
              {evals.length}
            </div>
            <div className="text-[10px] text-slate-500">evaluaciones en historial</div>
          </div>
        </div>
      </div>

      {/* ─── Última consulta médica ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <SectionTitle>Última consulta médica</SectionTitle>

        {!lastEv ? (
          <EmptyRow text="Sin consultas registradas aún." />
        ) : (
          <div className="p-5 flex flex-col gap-4">
            {/* Aptitud */}
            {aptitud && (
              <div className="flex items-start gap-3">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-[0.4px] mb-1">Aptitud</div>
                  <span
                    className="inline-block text-[12px] px-3 py-1 rounded-full font-bold"
                    style={{
                      background:
                        aptitud === 'Apto' ? '#d1fae5' : aptitud === 'No apto' ? '#fee2e2' : '#fef3c7',
                      color:
                        aptitud === 'Apto' ? '#065f46' : aptitud === 'No apto' ? '#991b1b' : '#92400e',
                    }}
                  >
                    {aptitud}
                  </span>
                </div>
                {observaciones && (
                  <div className="flex-1 text-xs text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <p className="m-0"><span className="font-semibold">Observaciones:</span> {observaciones}</p>
                  </div>
                )}
              </div>
            )}

            {/* Signos Vitales */}
            {signosVitales && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-[0.4px] mb-2">Constantes vitales</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'PA', value: signosVitales.presionSistolica && signosVitales.presionDiastolica ? `${signosVitales.presionSistolica}/${signosVitales.presionDiastolica}` : null, unit: 'mmHg' },
                    { label: 'FC', value: signosVitales.frecuenciaCardiaca, unit: 'lpm' },
                    { label: 'FR', value: signosVitales.frecuenciaRespiratoria, unit: 'rpm' },
                    { label: 'Temp', value: signosVitales.temperatura, unit: '°C' },
                    { label: 'SpO2', value: signosVitales.saturacion, unit: '%' },
                    { label: 'Peso', value: signosVitales.peso, unit: 'kg' },
                    { label: 'Talla', value: signosVitales.talla, unit: 'cm' },
                    { label: 'IMC', value: signosVitales.imc && signosVitales.imc > 0 ? signosVitales.imc : null, unit: '' },
                  ].map(({ label, value, unit }) =>
                    value != null && value !== '' ? (
                      <div key={label} className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-center">
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">{label}</div>
                        <div className="text-[14px] font-bold text-slate-800">{String(value)}</div>
                        {unit && <div className="text-[9px] text-slate-400">{unit}</div>}
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {/* Diagnósticos */}
            {diagnosticos.length > 0 && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-[0.4px] mb-2">Diagnósticos</div>
                <div className="flex flex-col gap-1.5">
                  {diagnosticos.map((d: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                      {d.codigo && (
                        <span className="font-mono text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">{d.codigo}</span>
                      )}
                      <span className="flex-1 text-slate-800">{d.descripcion ?? d.nombre ?? String(d)}</span>
                      {d.tipo && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${d.tipo === 'DEF' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {d.tipo}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendaciones */}
            {recomendaciones.length > 0 && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-[0.4px] mb-1">Recomendaciones</div>
                <ul className="m-0 pl-4 text-xs text-slate-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 list-disc">
                  {recomendaciones.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => lastEv.id && (onViewEval ? onViewEval(lastEv.id) : onOpenFull())}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white hover:bg-slate-50 cursor-pointer"
              >
                Ver evaluación completa ↗
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Exámenes planificados / recientes ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="m-0 text-sm font-bold text-slate-800">Exámenes</h3>
          <span className="text-[11px] text-slate-500">{examenes.length} registro{examenes.length !== 1 ? 's' : ''}</span>
        </div>
        {examenes.length === 0 ? (
          <EmptyRow text="Sin exámenes registrados." />
        ) : (
          <div>
            {examenes.slice(0, 5).map((ex: any, i: number) => {
              const esPatologico = ex.resultado === 'patológico' || ex.resultado === 'patologico' || ex.patologico === true;
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
                  {ex.resultado && !esPatologico && (
                    <span className="text-[10px] text-slate-500 capitalize">{ex.resultado}</span>
                  )}
                  {ex.estado && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ex.estado === 'pendiente' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {ex.estado}
                    </span>
                  )}
                </div>
              );
            })}
            {examenes.length > 5 && (
              <div className="px-5 py-2 text-center text-[11px] text-slate-500 border-t border-slate-100">
                +{examenes.length - 5} más · <button onClick={onOpenFull} className="bg-transparent border-none text-blue-600 cursor-pointer text-[11px] underline">Ver todos en ficha completa</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Historial de evaluaciones ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="m-0 text-sm font-bold text-slate-800">Historial de evaluaciones</h3>
          <span className="text-[11px] text-slate-500">{evals.length} registro{evals.length !== 1 ? 's' : ''}</span>
        </div>
        {sorted.length === 0 ? (
          <div className="p-9 text-center text-slate-500 text-xs">
            Sin evaluaciones todavía.{' '}
            <button
              onClick={onNewEval}
              className="bg-transparent border-none font-semibold cursor-pointer underline text-xs"
              style={{ color: 'var(--brand-primary, #0a6b3b)' }}
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
                  <span className="inline-block mt-0.5 text-[11px] px-2 py-0.5 rounded-[10px] font-semibold" style={{ background: t.bg, color: t.fg }}>
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
      </div>
    </div>
  );
}
