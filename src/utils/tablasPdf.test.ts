import { describe, it, expect } from 'vitest';
import { conFilasMinimas, FILAS_MINIMAS_PAGINA3, FILAS_MINIMAS_HISTORIA_LABORAL } from './tablasPdf';

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

describe('FILAS_MINIMAS_HISTORIA_LABORAL', () => {
  it('el recuadro de antecedentes laborales usa menos filas que el resto', () => {
    expect(FILAS_MINIMAS_HISTORIA_LABORAL).toBe(4);
    expect(FILAS_MINIMAS_HISTORIA_LABORAL).toBeLessThan(FILAS_MINIMAS_PAGINA3);
  });

  it('deja el trabajo actual y tres filas en blanco para los anteriores', () => {
    const actual = [['AUSTROGAS', 'Funciones del cargo', '36']];
    const r = conFilasMinimas(actual, 3, FILAS_MINIMAS_HISTORIA_LABORAL);
    expect(r).toHaveLength(4);
    expect(r[0]).toEqual(actual[0]);
    expect(r.slice(1)).toEqual([['', '', ''], ['', '', ''], ['', '', '']]);
  });

  it('sigue creciendo si hay más empleos que filas', () => {
    const muchos = Array.from({ length: 6 }, (_, i) => [`E${i}`, '', '']);
    expect(conFilasMinimas(muchos, 3, FILAS_MINIMAS_HISTORIA_LABORAL)).toHaveLength(6);
  });
});
