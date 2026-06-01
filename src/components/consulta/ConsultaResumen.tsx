// Panel lateral: Resumen CIE-10 del día (morbilidad por capítulo + códigos frecuentes).
// Archivo NUEVO.
import type { AtencionMedica } from '../../types/atencion';
import { calcularResumenCie, calcularStats } from '../../services/atenciones';

const ACCENT = '#1d4fad';

export default function ConsultaResumen({ atenciones }: { atenciones: AtencionMedica[] }) {
  const { total, capitulos, codigos } = calcularResumenCie(atenciones);
  const stats = calcularStats(atenciones);
  const maxCod = Math.max(...codigos.map((c) => c.n), 1);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Morbilidad por capítulo */}
      <div className="bg-white border border-slate-200 rounded-[14px] p-[16px_18px] shadow-sm">
        <div className="flex items-baseline justify-between mb-0.5">
          <h3 className="m-0 text-[14px] font-bold text-slate-900">Resumen CIE-10</h3>
          <span className="text-[11.5px] text-slate-400">{total} diagnósticos</span>
        </div>
        <p className="mt-0 mb-3.5 text-[12px] text-slate-400">Morbilidad del día por capítulo</p>

        {total > 0 ? (
          <>
            <div className="flex h-[9px] rounded-full overflow-hidden mb-3.5 bg-slate-100">
              {capitulos.map((c) => (
                <div key={c.label} title={`${c.label}: ${c.n}`} style={{ width: `${(c.n / total) * 100}%`, background: c.color }} />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {capitulos.map((c) => (
                <div key={c.label} className="flex items-center gap-2.5">
                  <span className="w-[9px] h-[9px] rounded-[3px] flex-shrink-0" style={{ background: c.color }} />
                  <span className="flex-1 text-[12.5px] text-slate-700 truncate">{c.label}</span>
                  <span className="text-[12.5px] font-bold text-slate-900">{c.n}</span>
                  <span className="text-[11px] text-slate-400 min-w-[30px] text-right">{Math.round((c.n / total) * 100)}%</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[13px] text-slate-400 text-center py-4">Sin diagnósticos aún.</p>
        )}
      </div>

      {/* Códigos más frecuentes */}
      {codigos.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[14px] p-[16px_18px] shadow-sm">
          <h3 className="m-0 mb-3.5 text-[14px] font-bold text-slate-900">Códigos más frecuentes</h3>
          <div className="flex flex-col gap-3">
            {codigos.slice(0, 6).map((c) => (
              <div key={c.codigo}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[11.5px] font-bold rounded-md px-[7px] py-px min-w-[44px] text-center" style={{ color: c.color, background: `${c.color}14` }}>
                    {c.codigo}
                  </span>
                  <span className="flex-1 text-[12px] text-slate-700 truncate">{c.desc}</span>
                  <span className="text-[12px] font-bold text-slate-900">{c.n}</span>
                </div>
                <div className="h-[5px] rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(c.n / maxCod) * 100}%`, background: c.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3.5 pt-3.5 border-t border-slate-100 grid grid-cols-2 gap-2.5">
            <MiniStat label="Procedimientos" value={stats.procedimientos} />
            <MiniStat label="Reposos" value={stats.reposos} />
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-[10px] p-[10px_12px]">
      <div className="text-[20px] font-extrabold text-slate-900 tracking-tight">{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  );
}
