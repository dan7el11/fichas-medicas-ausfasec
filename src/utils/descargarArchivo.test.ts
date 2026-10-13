import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { descargarBlob, conExtension, esFalloDeCarga } from './descargarArchivo';

describe('descargarBlob', () => {
  let creadas: string[];
  let liberadas: string[];
  let enElDocumento: boolean | null;

  beforeEach(() => {
    vi.useFakeTimers();
    creadas = []; liberadas = []; enElDocumento = null;
    let n = 0;
    URL.createObjectURL = vi.fn(() => { const u = `blob:prueba/${n++}`; creadas.push(u); return u; });
    URL.revokeObjectURL = vi.fn((u: string) => { liberadas.push(u); });
    // El navegador sólo dispara la descarga de un ancla que esté en el
    // documento: se comprueba justo en el click, como lo haría él.
    HTMLAnchorElement.prototype.click = vi.fn(function (this: HTMLAnchorElement) {
      enElDocumento = document.body.contains(this);
    });
  });

  afterEach(() => vi.useRealTimers());

  it('pincha un ancla que está dentro del documento', () => {
    descargarBlob(new Blob(['x']), 'ficha.xlsx');
    expect(enElDocumento).toBe(true);
  });

  it('no deja el ancla suelta en la página', () => {
    descargarBlob(new Blob(['x']), 'ficha.xlsx');
    expect(document.querySelectorAll('a[download]').length).toBe(0);
  });

  it('lleva el nombre del archivo', () => {
    const anclas: string[] = [];
    HTMLAnchorElement.prototype.click = vi.fn(function (this: HTMLAnchorElement) { anclas.push(this.download); });
    descargarBlob(new Blob(['x']), 'Ficha_Ocupacional.xlsx');
    expect(anclas).toEqual(['Ficha_Ocupacional.xlsx']);
  });

  it('no libera la URL antes de que la descarga arranque', () => {
    descargarBlob(new Blob(['x']), 'ficha.xlsx');
    // Esto era el fallo: liberarla en la misma vuelta cancelaba la descarga.
    expect(liberadas).toEqual([]);
    vi.advanceTimersByTime(60_000);
    expect(liberadas).toEqual(creadas);
  });
});

describe('conExtension', () => {
  it('añade la extensión que falta', () => {
    expect(conExtension('ficha', '.xlsx')).toBe('ficha.xlsx');
    expect(conExtension('ficha', 'xlsx')).toBe('ficha.xlsx');
  });
  it('no la duplica', () => {
    expect(conExtension('ficha.xlsx', '.xlsx')).toBe('ficha.xlsx');
    expect(conExtension('ficha.XLSX', '.xlsx')).toBe('ficha.XLSX');
  });
});

describe('esFalloDeCarga', () => {
  it('reconoce el trozo de aplicación que ya no está en el servidor', () => {
    expect(esFalloDeCarga(new TypeError('Failed to fetch dynamically imported module: /assets/exceljs.min-abc.js'))).toBe(true);
    expect(esFalloDeCarga(new Error('error loading dynamically imported module'))).toBe(true);
    expect(esFalloDeCarga(new Error('ChunkLoadError'))).toBe(true);
  });
  it('y no confunde cualquier otro error con eso', () => {
    expect(esFalloDeCarga(new Error('No se pudo leer la evaluación'))).toBe(false);
    expect(esFalloDeCarga('algo')).toBe(false);
  });
});
