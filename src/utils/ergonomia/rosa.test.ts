import { describe, it, expect } from 'vitest';
import { calcularROSA, type EntradasROSA } from './rosa';

const base: EntradasROSA = {
  sillaAltura: 1, sillaProfundidad: 1, reposabrazos: 1, respaldo: 1, durSilla: 0,
  monitor: 1, durMonitor: 0, telefono: 1, durTelefono: 0,
  raton: 1, durRaton: 0, teclado: 1, durTeclado: 0,
};

describe('calcularROSA', () => {
  it('puesto ideal da puntaje 2 (insignificante)', () => {
    const r = calcularROSA(base);
    expect(r.detalle.silla).toBe(2);          // tabla silla [2][2] = 2
    expect(r.detalle.monitorTelefono).toBe(1); // B[1][1] = 1
    expect(r.detalle.ratonTeclado).toBe(1);    // C[1][1] = 1
    expect(r.puntajeFinal).toBe(2);
    expect(r.tone).toBe('success');
  });

  it('uso breve (duración -1 en todo) da el mínimo 1', () => {
    const r = calcularROSA({ ...base, durSilla: -1, durMonitor: -1, durTelefono: -1, durRaton: -1, durTeclado: -1 });
    expect(r.detalle.silla).toBe(1);
    expect(r.detalle.monitorTelefono).toBe(1); // B[0][0] = 1
    expect(r.puntajeFinal).toBe(1);
  });

  it('celda intermedia conocida: teléfono 3 × monitor 4 → 4', () => {
    const r = calcularROSA({ ...base, telefono: 3, monitor: 4 });
    expect(r.detalle.monitorTelefono).toBe(4);
  });

  it('celda intermedia conocida: ratón 3 × teclado 4 → 5', () => {
    const r = calcularROSA({ ...base, raton: 3, teclado: 4 });
    expect(r.detalle.ratonTeclado).toBe(5);
  });

  it('silla deficiente y larga duración: fila 7 × col 7 + 1 → 9', () => {
    const r = calcularROSA({ ...base, sillaAltura: 4, sillaProfundidad: 3, reposabrazos: 3, respaldo: 4, durSilla: 1 });
    expect(r.detalle.silla).toBe(9);
    expect(r.puntajeFinal).toBe(9);
    expect(r.nivel).toBe('Muy alto');
  });

  it('oficina muy deficiente llega al máximo de la tabla B (9)', () => {
    const r = calcularROSA({ ...base, monitor: 6, durMonitor: 1, telefono: 5, durTelefono: 1 });
    expect(r.detalle.monitorTelefono).toBe(9); // B[6][7] = 9
    expect(r.tone).toBe('danger');
  });

  it('el final es el máximo entre silla y periféricos', () => {
    const r = calcularROSA({ ...base, raton: 6, durRaton: 1, teclado: 6, durTeclado: 1 }); // C[7][7] = 9
    expect(r.detalle.ratonTeclado).toBe(9);
    expect(r.puntajeFinal).toBe(9);
  });
});
