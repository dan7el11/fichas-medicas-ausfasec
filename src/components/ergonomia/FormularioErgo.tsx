// Formulario data-driven de evaluación ergonómica (sirve para RULA y REBA).
// Controlado por el padre: recibe `base` (puntaje base por segmento) y `adj`
// (ajustes activos), calcula el valor efectivo y emite {vals, resultado}. Que
// `base` sea controlado permite que el medidor de ángulos fije puntajes.
import { useEffect, useMemo } from 'react';
import { METODOS } from '../../utils/ergonomia/definiciones';
import type { MetodoErgo, ResultadoErgo } from '../../types/ergonomia';

interface Props {
  metodo: MetodoErgo;
  base: Record<string, number>;
  setBase: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  adj: Record<string, boolean>;
  setAdj: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onChange: (vals: Record<string, number>, resultado: ResultadoErgo) => void;
}

export default function FormularioErgo({ metodo, base, setBase, adj, setAdj, onChange }: Props) {
  const def = METODOS[metodo];

  const { vals, resultado } = useMemo(() => {
    const out: Record<string, number> = {};
    def.campos.forEach((c) => {
      let v = base[c.key] ?? c.opciones[0].valor;
      (c.ajustes ?? []).forEach((a) => { if (adj[`${c.key}.${a.key}`]) v += a.delta; });
      out[c.key] = Math.max(c.min, Math.min(c.max, v));
    });
    return { vals: out, resultado: def.calcular(out) };
  }, [base, adj, def]);

  useEffect(() => { onChange(vals, resultado); }, [vals, resultado, onChange]);

  const grupos: [string, typeof def.campos][] = [];
  def.campos.forEach((c) => {
    const g = grupos.find(([n]) => n === c.grupo);
    if (g) g[1].push(c); else grupos.push([c.grupo, [c]]);
  });

  return (
    <div className="space-y-4">
      {grupos.map(([grupo, campos]) => (
        <div key={grupo} className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[12px] font-bold uppercase tracking-wide text-slate-500">{grupo}</div>
          <div className="p-4 grid md:grid-cols-2 gap-4">
            {campos.map((c) => (
              <div key={c.key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[13px] font-semibold text-slate-700">{c.label}</label>
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">= {vals[c.key]}</span>
                </div>
                <select
                  value={base[c.key] ?? c.opciones[0].valor}
                  onChange={(e) => setBase((p) => ({ ...p, [c.key]: Number(e.target.value) }))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-[12.5px] bg-white outline-none focus:ring-2 focus:ring-emerald-600/30"
                >
                  {c.opciones.map((o) => <option key={o.valor} value={o.valor}>{o.valor} · {o.label}</option>)}
                </select>
                {c.ajustes && c.ajustes.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    {c.ajustes.map((a) => (
                      <label key={a.key} className="inline-flex items-center gap-1 text-[11.5px] text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!adj[`${c.key}.${a.key}`]}
                          onChange={(e) => setAdj((p) => ({ ...p, [`${c.key}.${a.key}`]: e.target.checked }))}
                        />
                        {a.label} <span className="text-slate-400">({a.delta > 0 ? '+' : ''}{a.delta})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
