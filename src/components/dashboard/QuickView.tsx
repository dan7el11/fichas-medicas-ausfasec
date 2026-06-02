import type { Trabajador, EvaluacionMedica } from '../../types';
import {
  apellidos,
  areaColors,
  areaDeTrabajador,
  aptitudLabel,
  fmtDate,
  iniciales,
  lastEval,
  nombres,
  sortEvaluacionesDesc,
  TONE_STYLES,
  venceEn,
  workerStatus,
} from '../../utils/medicalHelpers';

interface QuickViewProps {
  trabajador: Trabajador;
  evals: EvaluacionMedica[];
  onOpenFull: () => void;
  onNewEval: () => void;
  onViewEval?: (evalId: string) => void;
}

export default function QuickView({
  trabajador: w,
  evals,
  onOpenFull,
  onNewEval,
  onViewEval,
}: QuickViewProps) {
  const status = workerStatus(evals);
  const le = lastEval(evals);
  const sorted = sortEvaluacionesDesc(evals);
  const ac = areaColors(w);
  const tones = TONE_STYLES[status.tone];

  return (
    <div className="px-7 pt-5 pb-8">
      {/* Hero */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4">
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
          <div className="flex gap-2">
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
          <div
            className="w-1 self-stretch rounded-[2px]"
            style={{ background: tones.bar }}
          />
          <div className="flex-1">
            <div
              className="text-[10px] font-bold tracking-[0.7px] uppercase"
              style={{ color: tones.fg }}
            >
              Estado actual
            </div>
            <div className="text-[17px] font-bold mt-0.5" style={{ color: tones.fg }}>
              {status.label}
            </div>
            {le && (
              <div className="text-[11px] text-slate-700 mt-0.5">
                Última: {le.numeroHistoriaClinica ? `HC ${le.numeroHistoriaClinica}` : 'Evaluación'} ·{' '}
                {fmtDate(le.fecha)}
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
            <div
              className="text-[22px] font-bold tracking-[-0.4px]"
              style={{ color: tones.fg }}
            >
              {evals.length}
            </div>
            <div className="text-[10px] text-slate-500">evaluaciones en historial</div>
          </div>
        </div>
      </div>

      {/* Historial mini-cards */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="m-0 text-sm font-bold">Historial de evaluaciones</h3>
          <span className="text-[11px] text-slate-500">
            {evals.length} registro{evals.length !== 1 ? 's' : ''}
          </span>
        </div>
        {sorted.map((ev, i) => {
          const label = aptitudLabel(ev);
          const tone =
            label === 'Apto' ? 'success' : label === 'No apto' ? 'danger' : 'warning';
          const t = TONE_STYLES[tone];
          return (
            <div
              key={ev.id}
              className="px-5 py-3 grid items-center gap-4 text-xs"
              style={{
                gridTemplateColumns: '140px 1fr 1fr 100px',
                borderBottom: i === sorted.length - 1 ? 'none' : '1px solid #f4f6f9',
              }}
            >
              <div>
                <div className="text-[13px] font-semibold">
                  HC {ev.numeroHistoriaClinica || '—'}
                </div>
                <div className="text-[11px] text-slate-500">{fmtDate(ev.fecha)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 tracking-[0.4px] uppercase font-semibold">
                  Aptitud
                </div>
                <span
                  className="inline-block mt-0.5 text-[11px] px-2 py-0.5 rounded-[10px] font-semibold"
                  style={{ background: t.bg, color: t.fg }}
                >
                  {label}
                </span>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 tracking-[0.4px] uppercase font-semibold">
                  Vigencia
                </div>
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
        })}
        {evals.length === 0 && (
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
        )}
      </div>
    </div>
  );
}
