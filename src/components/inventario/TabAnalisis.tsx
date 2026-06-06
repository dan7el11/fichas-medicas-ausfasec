import type { Medicamento, Consumo } from '../../types/inventario';
import { topMedicamentos, topTrabajadores, demandaPorDia } from '../../utils/inventarioHelpers';
import { COLORS, FONTS } from '../../theme';

interface Props {
  inventario: Medicamento[];
  consumos: Consumo[];
}

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
        <span style={{ color: COLORS.ink, fontWeight: 500 }}>{label}</span>
        <span style={{ fontFamily: FONTS.mono, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 6, background: COLORS.line, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

function SecCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20 }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, fontFamily: FONTS.serif, color: COLORS.ink }}>{title}</h3>
      {children}
    </div>
  );
}

export default function TabAnalisis({ inventario, consumos }: Props) {
  const topMeds = topMedicamentos(consumos, inventario, 10);
  const topTrabs = topTrabajadores(consumos, 10);
  const demanda = demandaPorDia(consumos, 30);
  const maxDemanda = Math.max(...demanda.map((d) => d.total), 1);

  const totalUnidades = consumos.reduce((s, c) => s + c.cantidad, 0);
  const mesPrefix = new Date().toISOString().slice(0, 7);
  const consMes = consumos.filter((c) => c.fecha?.startsWith(mesPrefix));
  const unidadesMes = consMes.reduce((s, c) => s + c.cantidad, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total transacciones', value: consumos.length, color: COLORS.brand },
          { label: 'Unidades despachadas', value: totalUnidades, color: COLORS.ok },
          { label: 'Consumos este mes', value: consMes.length, color: '#1d4fad' },
          { label: 'Unidades este mes', value: unidadesMes, color: '#0e7490' },
        ].map((k) => (
          <div key={k.label} style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, marginBottom: 4 }}>{k.label.toUpperCase()}</div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 26, fontWeight: 700, color: k.color }}>{k.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SecCard title="Top 10 medicamentos más consumidos">
          {topMeds.length === 0
            ? <p style={{ color: COLORS.faint, fontSize: 13 }}>Sin datos</p>
            : topMeds.map((m, i) => (
                <HBar key={m.codigo} label={m.nombre} value={m.total} max={topMeds[0].total} color={COLORS.brand} />
              ))}
        </SecCard>

        <SecCard title="Top 10 trabajadores con mayor consumo">
          {topTrabs.length === 0
            ? <p style={{ color: COLORS.faint, fontSize: 13 }}>Sin datos</p>
            : topTrabs.map((t) => (
                <HBar key={t.trabajador} label={t.trabajador} value={t.total} max={topTrabs[0].total} color='#7c5cf2' />
              ))}
        </SecCard>
      </div>

      <SecCard title="Demanda diaria (últimos 30 días)">
        {demanda.every((d) => d.total === 0)
          ? <p style={{ color: COLORS.faint, fontSize: 13 }}>Sin consumos en los últimos 30 días</p>
          : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, overflowX: 'auto', paddingBottom: 4 }}>
              {demanda.map((d, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 26 }}>
                  <div style={{
                    width: 20, background: d.total > 0 ? COLORS.brand : COLORS.line, borderRadius: '3px 3px 0 0',
                    height: maxDemanda > 0 ? `${Math.round((d.total / maxDemanda) * 80)}px` : '2px',
                    minHeight: 2, transition: 'height 0.3s',
                  }} />
                  {d.total > 0 && <span style={{ fontSize: 9, color: COLORS.faint, fontFamily: FONTS.mono }}>{d.total}</span>}
                  <span style={{ fontSize: 8, color: COLORS.faint, writingMode: 'vertical-lr', transform: 'rotate(180deg)', lineHeight: 1.2 }}>{d.dia}</span>
                </div>
              ))}
            </div>
          )}
      </SecCard>
    </div>
  );
}
