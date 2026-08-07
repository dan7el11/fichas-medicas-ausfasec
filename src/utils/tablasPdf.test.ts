import { describe, it, expect } from 'vitest';
import { conFilasMinimas, FILAS_MINIMAS_PAGINA3 } from './tablasPdf';

describe('conFilasMinimas', () => {
  it('rellena desde arriba hasta el mínimo, con filas vacías del mismo ancho', () => {
    const r = conFilasMinimas([['ACME', 'Soldadura', '12']], 3);
    expect(r).toHaveLength(FILAS_MINIMAS_PAGINA3);
    expect(r[0]).toEqual(['ACME', 'Soldadura', '12']);
    expect(r[1]).toEqual(['', '', '']);
    expect(r[FILAS_MINIMAS_PAGINA3 - 1]).toEqual(['', '', '']);
  });

  it('deja la tabla llena de vacías cuando no hay datos', () => {
    const r = conFilasMinimas([], 9);
    expect(r).toHaveLength(FILAS_MINIMAS_PAGINA3);
    expect(r.every(f => (f as string[]).length === 9)).toBe(true);
  });

  it('crece por encima del mínimo si hay más datos', () => {
    const datos = Array.from({ length: 10 }, (_, i) => [`E${i}`, '', '']);
    const r = conFilasMinimas(datos, 3);
    expect(r).toHaveLength(10);
    expect(r[9]).toEqual(['E9', '', '']);
  });

  it('no muta el arreglo recibido', () => {
    const datos = [['A', 'B']];
    conFilasMinimas(datos, 2);
    expect(datos).toHaveLength(1);
  });

  it('acepta un mínimo distinto', () => {
    expect(conFilasMinimas([['x']], 1, 3)).toHaveLength(3);
  });
});
