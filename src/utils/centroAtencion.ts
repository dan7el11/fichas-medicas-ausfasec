// Centro desde el que el médico está brindando atención. Se persiste por
// dispositivo (localStorage) para que el descuento de medicamentos de la
// consulta diaria salga del stock del lugar correcto y las estadísticas de
// consumo por centro sean exactas.
import type { CentroId } from '../types/inventario';
import { CENTROS } from '../types/inventario';

const KEY = 'centro-atencion';

export function getCentroAtencion(): CentroId {
  const v = localStorage.getItem(KEY);
  return v && v in CENTROS ? (v as CentroId) : 'planta_envasado';
}

export function setCentroAtencion(centro: CentroId): void {
  localStorage.setItem(KEY, centro);
}
