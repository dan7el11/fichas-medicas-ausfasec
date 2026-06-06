export type CentroId = 'planta_envasado' | 'vergel' | 'planta_ventanas';

export const CENTROS: Record<CentroId, string> = {
  planta_envasado: 'Planta Envasado',
  vergel: 'Consultorio Vergel',
  planta_ventanas: 'Planta Ventanas',
};

export interface Medicamento {
  codigo: string;
  tipo: 'NUEVA COMPRA' | 'STOCK ANTERIOR';
  nombre: string;
  sobrenombre: string;
  lote: string;
  fechaExpiracion: string; // 'YYYY-MM-DD'
  precio: number;
  stockInicial: number;
  stocks: Record<CentroId, number>;
}

export interface ConsumoItem {
  medicamentoCodigo: string;
  cantidad: number;
}

export interface Consumo {
  id: number;
  transaccionId: string;
  medicamentoCodigo: string;
  centro: CentroId;
  cantidad: number;
  trabajador: string;
  fecha: string; // 'YYYY-MM-DD'
  registradoPor: string;
  reportado: boolean;
  comentarioReporte: string;
}

export interface Movimiento {
  id: number;
  medicamentoCodigo: string;
  origen: CentroId | 'PROVEEDOR';
  destino: CentroId;
  cantidad: number;
  fecha: string; // 'YYYY-MM-DD'
  usuario: string;
  observacion?: string;
}

export interface EstadoInventario {
  inventario: Medicamento[];
  consumos: Consumo[];
  movimientos: Movimiento[];
  trabajadores: string[];
  ultimaActualizacion: any;
}
