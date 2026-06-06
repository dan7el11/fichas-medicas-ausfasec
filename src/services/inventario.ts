import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { EstadoInventario, Consumo, Movimiento, CentroId, ConsumoItem } from '../types/inventario';

const DOC_PATH = 'inventarios/estado_actual';

const PREFIJO_CENTRO: Record<CentroId, string> = {
  planta_envasado: 'AUPE',
  vergel: 'AUVG',
  planta_ventanas: 'AUVT',
};

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function pad(n: number, len = 4): string {
  return String(n).padStart(len, '0');
}

// ── CRUD principal ───────────────────────────────────────────────────────────

export async function cargarEstado(): Promise<EstadoInventario> {
  const snap = await getDoc(doc(db, DOC_PATH));
  if (!snap.exists()) {
    return { inventario: [], consumos: [], movimientos: [], trabajadores: [], ultimaActualizacion: null };
  }
  const data = snap.data();
  return {
    inventario: data.inventario ?? [],
    consumos: data.consumos ?? [],
    movimientos: data.movimientos ?? [],
    trabajadores: data.trabajadores ?? [],
    ultimaActualizacion: data.ultimaActualizacion ?? null,
  };
}

export async function guardarEstado(estado: EstadoInventario): Promise<void> {
  await setDoc(doc(db, DOC_PATH), {
    ...estado,
    ultimaActualizacion: Timestamp.now(),
  });
}

// ── Generación de ID de transacción ─────────────────────────────────────────

export function generarTransaccionId(centro: CentroId, consumos: Consumo[]): string {
  const prefix = PREFIJO_CENTRO[centro];
  const today = new Date();
  const ddmm = `${pad(today.getDate(), 2)}${pad(today.getMonth() + 1, 2)}`;
  const mismodia = consumos.filter((c) => c.transaccionId?.startsWith(`${prefix}-${ddmm}-`));
  const serial = pad(mismodia.length + 1);
  return `${prefix}-${ddmm}-${serial}`;
}

// ── Operaciones de negocio ───────────────────────────────────────────────────

export async function registrarConsumos(
  items: ConsumoItem[],
  centro: CentroId,
  trabajador: string,
  registradoPor: string,
): Promise<string> {
  const estado = await cargarEstado();
  const transaccionId = generarTransaccionId(centro, estado.consumos);
  const fecha = hoy();
  const nextId = (estado.consumos.length > 0 ? Math.max(...estado.consumos.map((c) => c.id)) : 0) + 1;

  let idCounter = nextId;
  for (const item of items) {
    const med = estado.inventario.find((m) => m.codigo === item.medicamentoCodigo);
    if (!med) continue;
    if ((med.stocks[centro] ?? 0) < item.cantidad) throw new Error(`Stock insuficiente: ${med.nombre}`);
    med.stocks[centro] = (med.stocks[centro] ?? 0) - item.cantidad;
    estado.consumos.push({
      id: idCounter++,
      transaccionId,
      medicamentoCodigo: item.medicamentoCodigo,
      centro,
      cantidad: item.cantidad,
      trabajador,
      fecha,
      registradoPor,
      reportado: false,
      comentarioReporte: '',
    });
  }

  await guardarEstado(estado);
  return transaccionId;
}

export async function registrarMovimiento(
  medicamentoCodigo: string,
  origen: CentroId | 'PROVEEDOR',
  destino: CentroId,
  cantidad: number,
  usuario: string,
  observacion = '',
): Promise<void> {
  const estado = await cargarEstado();
  const med = estado.inventario.find((m) => m.codigo === medicamentoCodigo);
  if (!med) throw new Error('Medicamento no encontrado');

  if (origen !== 'PROVEEDOR') {
    if ((med.stocks[origen] ?? 0) < cantidad) throw new Error(`Stock insuficiente en origen`);
    med.stocks[origen] = (med.stocks[origen] ?? 0) - cantidad;
  }
  med.stocks[destino] = (med.stocks[destino] ?? 0) + cantidad;

  const nextId = (estado.movimientos.length > 0 ? Math.max(...estado.movimientos.map((m) => m.id)) : 0) + 1;
  estado.movimientos.push({ id: nextId, medicamentoCodigo, origen, destino, cantidad, fecha: hoy(), usuario, observacion });
  await guardarEstado(estado);
}

export async function editarConsumo(id: number, patch: Partial<Consumo>): Promise<void> {
  const estado = await cargarEstado();
  const idx = estado.consumos.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error('Consumo no encontrado');
  estado.consumos[idx] = { ...estado.consumos[idx], ...patch };
  await guardarEstado(estado);
}

export async function eliminarConsumo(id: number): Promise<void> {
  const estado = await cargarEstado();
  const consumo = estado.consumos.find((c) => c.id === id);
  if (!consumo) throw new Error('Consumo no encontrado');
  // Restaurar stock
  const med = estado.inventario.find((m) => m.codigo === consumo.medicamentoCodigo);
  if (med) med.stocks[consumo.centro] = (med.stocks[consumo.centro] ?? 0) + consumo.cantidad;
  estado.consumos = estado.consumos.filter((c) => c.id !== id);
  await guardarEstado(estado);
}

export async function editarMovimiento(id: number, patch: Partial<Movimiento>): Promise<void> {
  const estado = await cargarEstado();
  const idx = estado.movimientos.findIndex((m) => m.id === id);
  if (idx < 0) throw new Error('Movimiento no encontrado');
  estado.movimientos[idx] = { ...estado.movimientos[idx], ...patch };
  await guardarEstado(estado);
}

export async function eliminarMovimiento(id: number): Promise<void> {
  const estado = await cargarEstado();
  const mov = estado.movimientos.find((m) => m.id === id);
  if (!mov) throw new Error('Movimiento no encontrado');
  // Revertir stocks
  const med = estado.inventario.find((m) => m.codigo === mov.medicamentoCodigo);
  if (med) {
    if (mov.origen !== 'PROVEEDOR') med.stocks[mov.origen] = (med.stocks[mov.origen] ?? 0) + mov.cantidad;
    med.stocks[mov.destino] = (med.stocks[mov.destino] ?? 0) - mov.cantidad;
  }
  estado.movimientos = estado.movimientos.filter((m) => m.id !== id);
  await guardarEstado(estado);
}

export async function guardarMedicamento(med: import('../types/inventario').Medicamento): Promise<void> {
  const estado = await cargarEstado();
  const idx = estado.inventario.findIndex((m) => m.codigo === med.codigo);
  if (idx >= 0) estado.inventario[idx] = med;
  else estado.inventario.push(med);
  await guardarEstado(estado);
}

export async function eliminarMedicamento(codigo: string): Promise<void> {
  const estado = await cargarEstado();
  estado.inventario = estado.inventario.filter((m) => m.codigo !== codigo);
  await guardarEstado(estado);
}
