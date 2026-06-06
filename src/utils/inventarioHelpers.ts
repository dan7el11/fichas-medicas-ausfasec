import type { Medicamento, Consumo, Movimiento, CentroId } from '../types/inventario';
import { CENTROS } from '../types/inventario';

// ── Expiración ───────────────────────────────────────────────────────────────

export type EstadoExpiracion = 'expirado' | 'proximo' | 'ok';

export function checkExpiracion(fechaExpiracion: string, diasAviso = 90): EstadoExpiracion {
  if (!fechaExpiracion) return 'ok';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const exp = new Date(fechaExpiracion + 'T00:00:00');
  const diff = Math.floor((exp.getTime() - hoy.getTime()) / 86400000);
  if (diff < 0) return 'expirado';
  if (diff <= diasAviso) return 'proximo';
  return 'ok';
}

export function diasParaExpirar(fechaExpiracion: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const exp = new Date(fechaExpiracion + 'T00:00:00');
  return Math.floor((exp.getTime() - hoy.getTime()) / 86400000);
}

export function fmtFecha(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${meses[parseInt(m) - 1]} ${y}`;
}

// ── Texto ────────────────────────────────────────────────────────────────────

export function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function matchBusqueda(med: Medicamento, q: string): boolean {
  if (!q) return true;
  const n = normalizarTexto(q);
  return (
    normalizarTexto(med.nombre).includes(n) ||
    normalizarTexto(med.sobrenombre).includes(n) ||
    normalizarTexto(med.codigo).includes(n)
  );
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

export interface StockKpis {
  totalMedicamentos: number;
  expirados: number;
  proximosVencer: number;
  sinStock: number;
}

export function calcularKpis(inventario: Medicamento[]): StockKpis {
  let expirados = 0, proximosVencer = 0, sinStock = 0;
  inventario.forEach((m) => {
    const est = checkExpiracion(m.fechaExpiracion);
    if (est === 'expirado') expirados++;
    else if (est === 'proximo') proximosVencer++;
    const totalStock = Object.values(m.stocks).reduce((s, v) => s + (v ?? 0), 0);
    if (totalStock === 0) sinStock++;
  });
  return { totalMedicamentos: inventario.length, expirados, proximosVencer, sinStock };
}

export function consumosMes(consumos: Consumo[]): number {
  const prefix = new Date().toISOString().slice(0, 7);
  return consumos.filter((c) => c.fecha?.startsWith(prefix)).length;
}

// ── Análisis ─────────────────────────────────────────────────────────────────

export interface TopMed { codigo: string; nombre: string; total: number; }

export function topMedicamentos(consumos: Consumo[], inventario: Medicamento[], n = 10): TopMed[] {
  const map = new Map<string, number>();
  consumos.forEach((c) => map.set(c.medicamentoCodigo, (map.get(c.medicamentoCodigo) ?? 0) + c.cantidad));
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([codigo, total]) => {
      const med = inventario.find((m) => m.codigo === codigo);
      return { codigo, nombre: med?.nombre ?? codigo, total };
    });
}

export interface TopTrab { trabajador: string; total: number; }

export function topTrabajadores(consumos: Consumo[], n = 10): TopTrab[] {
  const map = new Map<string, number>();
  consumos.forEach((c) => map.set(c.trabajador, (map.get(c.trabajador) ?? 0) + c.cantidad));
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([trabajador, total]) => ({ trabajador, total }));
}

export interface DemandaDia { dia: string; total: number; }

export function demandaPorDia(consumos: Consumo[], dias = 30): DemandaDia[] {
  const hoy = new Date();
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() - (dias - 1 - i));
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
    const total = consumos.filter((c) => c.fecha === iso).reduce((s, c) => s + c.cantidad, 0);
    return { dia: label, total };
  });
}

// ── CSV Export ───────────────────────────────────────────────────────────────

function escapeCsv(v: unknown): string {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportarConsumosCSV(consumos: Consumo[], inventario: Medicamento[]): void {
  const header = ['ID', 'Transacción', 'Medicamento', 'Centro', 'Cantidad', 'Trabajador', 'Fecha', 'Registrado por'];
  const rows = consumos.map((c) => {
    const med = inventario.find((m) => m.codigo === c.medicamentoCodigo);
    return [
      c.id, c.transaccionId, med?.nombre ?? c.medicamentoCodigo,
      CENTROS[c.centro] ?? c.centro, c.cantidad, c.trabajador, c.fecha, c.registradoPor,
    ].map(escapeCsv).join(',');
  });
  const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `consumos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export function exportarMovimientosCSV(movimientos: Movimiento[], inventario: Medicamento[]): void {
  const header = ['ID', 'Medicamento', 'Origen', 'Destino', 'Cantidad', 'Fecha', 'Usuario'];
  const rows = movimientos.map((m) => {
    const med = inventario.find((x) => x.codigo === m.medicamentoCodigo);
    const origen = m.origen === 'PROVEEDOR' ? 'Proveedor' : (CENTROS[m.origen as CentroId] ?? m.origen);
    return [
      m.id, med?.nombre ?? m.medicamentoCodigo, origen,
      CENTROS[m.destino] ?? m.destino, m.cantidad, m.fecha, m.usuario,
    ].map(escapeCsv).join(',');
  });
  const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `movimientos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}
