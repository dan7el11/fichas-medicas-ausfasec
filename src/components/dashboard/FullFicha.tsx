import { useState } from 'react';
import type { Trabajador, EvaluacionMedica } from '../../types';
import { RIESGO_COLORS, RIESGOS_POR_PUESTO } from '../../constants/medical';
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

interface FullFichaProps {
  trabajador: Trabajador;
  evals: EvaluacionMedica[];
  onClose: () => void;
  onNewEval: () => void;
  onNewEvalRetiro?: () => void;
  onPrintPdf?: () => void;
  onEdit?: () => void;
  onViewEval?: (evalId: string) => void;
}

export default function FullFicha({
  trabajador: w,
  evals,
  onClose,
  onNewEval,
  onNewEvalRetiro,
  onPrintPdf,
  onEdit,
  onViewEval,
}: FullFichaProps) {
  const [menuEvalOpen, setMenuEvalOpen] = useState(false);
  const status = workerStatus(evals);
  const le = lastEval(evals);
  const sorted = sortEvaluacionesDesc(evals);
  const ac = areaColors(w);
  const tones = TONE_STYLES[status.tone];
  const area = areaDeTrabajador(w);

  const riesgos =
    RIESGOS_POR_PUESTO[w.puestoTrabajo] ?? [
      'Ergonómico: postura sedente',
      'Psicosocial: carga laboral',
    ];

  const aptosCount = evals.filter((e) => e.aptitudMedica === 'apto').length;
  const restriccionesCount = evals.filter(
    (e) => e.aptitudMedica === 'aptoLimitaciones' || e.aptitudMedica === 'aptoObservacion',
  ).length;
  const noAptoCount = evals.filter((e) => e.aptitudMedica === 'noApto').length;

  return (
    <div>
      {/* Sub-topbar */}
      <div className="bg-white border-b border-slate-200 px-7 py-2.5 flex items-center gap-2.5 text-xs">
        <button
          onClick={onClose}
          className="bg-transparent border-none cursor-pointer flex items-center gap-1.5 text-slate-500 text-xs px-2 py-1 rounded-[5px] hover:bg-slate-50"
        >
          ← Volver a vista rápida
        </button>
        <span className="text-slate-400">/</span>
        <span className="text-slate-700">{area}</span>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 font-semibold">
          {w.primerApellido} {w.primerNombre.split(' ')[0]}
        </span>
        <div className="ml-auto flex gap-1.5">
          <button
            onClick={onPrintPdf}
            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-[5px] text-[11px] cursor-pointer text-slate-700 hover:bg-slate-50"
          >
            Imprimir PDF
          </button>
          <button
            onClick={onEdit}
            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-[5px] text-[11px] cursor-pointer text-slate-700 hover:bg-slate-50"
          >
            Editar datos
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuEvalOpen((o) => !o)}
              className="px-3 py-1.5 text-white border-none rounded-[5px] text-[11px] font-semibold cursor-pointer flex items-center gap-1"
              style={{ background: '#0a6b3b' }}
            >
              + Nueva evaluación <span style={{ opacity: 0.7, fontSize: 9 }}>▾</span>
            </button>
            {menuEvalOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuEvalOpen(false)} />
                <div className="absolute right-0 mt-1 z-40 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden" style={{ minWidth: 190 }}>
                  <button
                    onClick={() => { setMenuEvalOpen(false); onNewEval(); }}
                    className="w-full text-left px-3 py-2.5 text-[12px] font-semibold flex items-center gap-2 hover:bg-blue-50 cursor-pointer border-none bg-transparent"
                  >
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">PERIÓDICA</span> SO-RE-38
                  </button>
                  {onNewEvalRetiro && (
                    <button
                      onClick={() => { setMenuEvalOpen(false); onNewEvalRetiro(); }}
                      className="w-full text-left px-3 py-2.5 text-[12px] font-semibold flex items-center gap-2 hover:bg-orange-50 cursor-pointer border-none bg-transparent border-t border-slate-100"
                    >
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">RETIRO</span> SO-RE-40
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="px-7 pt-5">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="grid items-stretch" style={{ gridTemplateColumns: '320px 1fr' }}>
            <div
              className="p-5 border-r border-slate-200"
              style={{ background: `linear-gradient(135deg, ${ac.bg} 0%, #ffffff 100%)` }}
            >
              <div className="flex gap-3.5 items-start mb-3.5">
                <div
                  className="w-[60px] h-[60px] rounded-[14px] text-white grid place-items-center text-xl font-bold flex-shrink-0"
                  style={{ background: ac.fg }}
                >
                  {iniciales(w)}
                </div>
                <div>
                  <h1 className="m-0 text-lg font-bold tracking-[-0.3px] leading-[1.15]">
                    {apellidos(w)}
                  </h1>
                  <div className="text-[13px] text-slate-700">{nombres(w)}</div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 text-xs">
                <KV label="Cédula" value={<span className="font-mono">{w.cedula}</span>} />
                <KV label="Sexo" value={w.sexo === 'M' ? 'Masculino' : 'Femenino'} />
                <KV label="Puesto" value={w.puestoTrabajo} />
                <KV
                  label="Área"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: ac.dot }}
                      />
                      {area}
                    </span>
                  }
                />
              </div>
            </div>

            <div className="p-5 flex flex-col">
              <div>
                <div className="text-[10px] font-bold text-slate-500 tracking-[0.7px] uppercase">
                  Estado actual
                </div>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: tones.bar }}
                  />
                  <span
                    className="text-[22px] font-bold tracking-[-0.3px]"
                    style={{ color: tones.fg }}
                  >
                    {status.label}
                  </span>
                </div>
                {le && (
                  <div className="text-xs text-slate-700 mt-1">
                    Última: <strong>HC {le.numeroHistoriaClinica || '—'}</strong> ·{' '}
                    {fmtDate(le.fecha)}
                    {status.dias != null && (
                      <>
                        {' · '}
                        {status.dias >= 0 ? (
                          <span
                            style={{
                              color: status.dias <= 30 ? '#8a4a0a' : '#3a4a5e',
                            }}
                          >
                            vigente {status.dias} días más
                          </span>
                        ) : (
                          <span style={{ color: '#a01f2a' }}>
                            vencida hace {Math.abs(status.dias)} días
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2.5 mt-auto pt-5">
                <Mini label="Evaluaciones" value={evals.length} sub="en historial" />
                <Mini label="Aptos" value={aptosCount} sub="del total" />
                <Mini label="Restricciones" value={restriccionesCount} sub="del total" />
                <Mini
                  label="No aptos"
                  value={noAptoCount}
                  sub="del total"
                  tone={noAptoCount > 0 ? 'danger' : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resumen clínico de la última evaluación */}
      {le && (
        <section className="px-7 pt-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="m-0 text-sm font-bold">Resumen clínico — última evaluación</h3>
              <span className="text-[11px] text-slate-500">{fmtDate((le as any).fecha)}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { l: 'P.A.', v: `${(le as any).signosVitales?.presionSistolica || '-'}/${(le as any).signosVitales?.presionDiastolica || '-'} mmHg` },
                { l: 'F.C.', v: `${(le as any).signosVitales?.frecuenciaCardiaca || '-'} lpm` },
                { l: 'Peso', v: `${(le as any).signosVitales?.peso || '-'} kg` },
                { l: 'IMC', v: `${(le as any).signosVitales?.imc || '-'}`, hi: true },
                { l: 'Talla', v: `${(le as any).signosVitales?.talla || '-'} cm` },
                { l: 'Temp.', v: `${(le as any).signosVitales?.temperatura || '-'} °C` },
                { l: 'SAT O₂', v: `${(le as any).signosVitales?.saturacion || '-'} %` },
                { l: 'Perím. Abd.', v: `${(le as any).signosVitales?.perimetroAbdominal || '-'} cm` },
              ].map((s, i) => (
                <div key={i} className={`p-2 rounded-lg text-center ${s.hi ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'}`}>
                  <p className="text-[10px] text-slate-500 mb-0.5">{s.l}</p>
                  <p className={`text-xs font-bold ${s.hi ? 'text-blue-700' : 'text-slate-800'}`}>{s.v}</p>
                </div>
              ))}
            </div>
            {(le as any).diagnosticos?.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Diagnósticos</p>
                <div className="space-y-1">
                  {(le as any).diagnosticos.map((dx: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-slate-700">{dx.descripcion}</span>
                      {dx.cie && <span className="text-slate-400 text-[10px]">CIE: {dx.cie}</span>}
                      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold ${dx.tipo === 'definitivo' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {dx.tipo === 'definitivo' ? 'DEF' : 'PRE'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray((le as any).recomendaciones) && (le as any).recomendaciones.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Recomendaciones</p>
                <p className="text-xs text-slate-700">
                  {(le as any).recomendaciones.join(' · ')}{(le as any).recomendacionesOtras ? ` · ${(le as any).recomendacionesOtras}` : ''}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      <section
        className="px-7 pt-4 pb-7 grid gap-4"
        style={{ gridTemplateColumns: '1fr 320px' }}
      >
        {/* Timeline */}
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
          <h3 className="m-0 mb-3.5 text-sm font-bold">Historial cronológico</h3>
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-100" />
            {sorted.map((ev, i) => {
              const label = aptitudLabel(ev);
              const tone =
                label === 'Apto'
                  ? 'success'
                  : label === 'No apto'
                  ? 'danger'
                  : 'warning';
              const t = TONE_STYLES[tone];
              return (
                <div
                  key={ev.id}
                  className="grid gap-3 py-2.5 relative"
                  style={{ gridTemplateColumns: '24px 1fr' }}
                >
                  <div
                    className="w-4 h-4 rounded-full border-[3px] border-white mt-0.5 relative z-[1]"
                    style={{ background: t.dot }}
                  />
                  <div className="bg-slate-50 border border-slate-100 rounded-lg px-3.5 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold">
                            HC {ev.numeroHistoriaClinica || '—'}
                          </span>
                          <span
                            className="text-[10px] px-1.5 py-px rounded-lg font-semibold"
                            style={{ background: t.bg, color: t.fg }}
                          >
                            {label}
                          </span>
                          {i === 0 && (
                            <span className="text-[9px] px-1.5 py-px rounded-lg bg-slate-900 text-white font-bold tracking-[0.4px] uppercase">
                              Actual
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {fmtDate(ev.fecha)} · vigencia hasta{' '}
                          {fmtDate(venceEn(ev.fecha))}
                        </div>
                      </div>
                      <button
                        onClick={() => ev.id && onViewEval?.(ev.id)}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-[5px] text-[11px] cursor-pointer text-slate-700 hover:bg-slate-50"
                      >
                        Ver detalle
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div className="p-6 text-center text-slate-500 text-xs">
                Sin evaluaciones registradas.
              </div>
            )}
          </div>
        </div>

        {/* Riesgos + acciones */}
        <div className="flex flex-col gap-3.5">
          <div className="bg-white rounded-xl border border-slate-200 px-[18px] py-4">
            <h3 className="m-0 mb-1 text-[13px] font-bold">Riesgos del puesto</h3>
            <div className="text-[11px] text-slate-500 mb-3">
              Asociados a <strong className="text-slate-900">{w.puestoTrabajo}</strong>
            </div>
            <div className="flex flex-col gap-1.5">
              {riesgos.map((r, i) => {
                const [cat, desc] = r.split(': ');
                const c = RIESGO_COLORS[cat] ?? '#94a2b3';
                return (
                  <div
                    key={i}
                    className="flex gap-2 items-start p-1.5 px-2 rounded-md bg-slate-50"
                  >
                    <span
                      className="w-[3px] self-stretch rounded-[2px] flex-shrink-0"
                      style={{ background: c }}
                    />
                    <div>
                      <div
                        className="text-[10px] font-bold uppercase tracking-[0.5px]"
                        style={{ color: c }}
                      >
                        {cat}
                      </div>
                      <div className="text-xs text-slate-900">{desc || cat}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 px-[18px] py-4">
            <h3 className="m-0 mb-3 text-[13px] font-bold">Próximas acciones</h3>
            <div className="flex flex-col gap-2">
              {le && status.dias != null && status.dias <= 90 && (
                <div
                  className="p-2.5 rounded-lg"
                  style={{
                    background: '#fff4e3',
                    border: '1px solid #f5d4a0',
                  }}
                >
                  <div className="text-[11px] font-bold" style={{ color: '#8a4a0a' }}>
                    ⏱ Agendar evaluación periódica
                  </div>
                  <div className="text-[11px] text-slate-700 mt-0.5">
                    Vence el {fmtDate(venceEn(le.fecha))}
                  </div>
                </div>
              )}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-semibold text-slate-900">
                  Revisar exámenes complementarios
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Audiometría + espirometría
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-[60px] text-[11px] text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-slate-900 font-medium">{value}</span>
    </div>
  );
}

function Mini({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone?: 'danger';
}) {
  const fg = tone === 'danger' ? '#a01f2a' : '#0d1b2a';
  return (
    <div className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
      <div className="text-[10px] text-slate-500 font-semibold tracking-[0.4px] uppercase">
        {label}
      </div>
      <div
        className="text-[22px] font-bold tracking-[-0.4px] mt-0.5"
        style={{ color: fg }}
      >
        {value}
      </div>
      <div className="text-[10px] text-slate-500">{sub}</div>
    </div>
  );
}
