import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  descargarBlob, entregarArchivo, compartirArchivo, puedeCompartirArchivo,
  esAppInstalada, conExtension, esFalloDeCarga,
} from './entregarArchivo';

const nav = navigator as any;

/** Simula la app instalada en la pantalla de inicio (`display: standalone`). */
function comoAppInstalada(instalada: boolean) {
  window.matchMedia = vi.fn((q: string) => ({
    matches: instalada && q.includes('standalone'),
    media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as any;
}

/** Simula un navegador que sabe (o no) compartir archivos. */
function conCompartir(opciones: { puede: boolean; resultado?: 'ok' | 'AbortError' | 'NotAllowedError' }) {
  const compartidos: any[] = [];
  nav.canShare = vi.fn(() => opciones.puede);
  nav.share = vi.fn(async (datos: any) => {
    compartidos.push(datos);
    if (opciones.resultado && opciones.resultado !== 'ok') {
      const e = new Error('no'); e.name = opciones.resultado; throw e;
    }
  });
  return compartidos;
}

describe('entrega de archivos generados en el navegador', () => {
  let creadas: string[];
  let liberadas: string[];
  let enElDocumento: boolean | null;
  let pinchadas: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    creadas = []; liberadas = []; enElDocumento = null; pinchadas = [];
    let n = 0;
    URL.createObjectURL = vi.fn(() => { const u = `blob:prueba/${n++}`; creadas.push(u); return u; });
    URL.revokeObjectURL = vi.fn((u: string) => { liberadas.push(u); });
    HTMLAnchorElement.prototype.click = vi.fn(function (this: HTMLAnchorElement) {
      enElDocumento = document.body.contains(this);
      pinchadas.push(this.download);
    });
    comoAppInstalada(false);
    delete nav.share; delete nav.canShare; delete nav.standalone;
  });

  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  describe('descargarBlob', () => {
    it('pincha un ancla que está dentro del documento', () => {
      descargarBlob(new Blob(['x']), 'ficha.xlsx');
      expect(enElDocumento).toBe(true);
    });

    it('no deja el ancla suelta en la página', () => {
      descargarBlob(new Blob(['x']), 'ficha.xlsx');
      expect(document.querySelectorAll('a[download]').length).toBe(0);
    });

    it('lleva el nombre del archivo', () => {
      descargarBlob(new Blob(['x']), 'Ficha_Ocupacional.xlsx');
      expect(pinchadas).toEqual(['Ficha_Ocupacional.xlsx']);
    });

    it('no libera la URL antes de que la descarga arranque', () => {
      descargarBlob(new Blob(['x']), 'ficha.xlsx');
      expect(liberadas).toEqual([]);
      vi.advanceTimersByTime(60_000);
      expect(liberadas).toEqual(creadas);
    });
  });

  describe('esAppInstalada', () => {
    it('reconoce la app en la pantalla de inicio', () => {
      comoAppInstalada(true);
      expect(esAppInstalada()).toBe(true);
    });
    it('reconoce el indicador propio de iOS', () => {
      nav.standalone = true;
      expect(esAppInstalada()).toBe(true);
    });
    it('y una pestaña normal del navegador no lo es', () => {
      expect(esAppInstalada()).toBe(false);
    });
  });

  describe('en el navegador de escritorio', () => {
    it('descarga, sin abrir ninguna hoja de compartir', async () => {
      const compartidos = conCompartir({ puede: true });
      expect(await entregarArchivo(new Blob(['x']), 'ficha.xlsx')).toBe('descargado');
      expect(compartidos).toEqual([]);
      expect(pinchadas).toEqual(['ficha.xlsx']);
    });
  });

  describe('en la app instalada, donde la descarga no hace nada', () => {
    beforeEach(() => comoAppInstalada(true));

    it('comparte el archivo en lugar de descargarlo', async () => {
      const compartidos = conCompartir({ puede: true });
      expect(await entregarArchivo(new Blob(['x']), 'ficha.xlsx')).toBe('compartido');
      expect(compartidos).toHaveLength(1);
      expect(compartidos[0].files[0].name).toBe('ficha.xlsx');
      expect(pinchadas).toEqual([]);   // no se intenta la descarga muerta
    });

    it('si el usuario cierra la hoja, no lo trata como un fallo', async () => {
      conCompartir({ puede: true, resultado: 'AbortError' });
      expect(await compartirArchivo(new Blob(['x']), 'ficha.xlsx')).toBe('cancelado');
    });

    it('si se perdió el gesto del toque, avisa de que hace falta otro', async () => {
      conCompartir({ puede: true, resultado: 'NotAllowedError' });
      expect(await entregarArchivo(new Blob(['x']), 'ficha.xlsx')).toBe('sin-salida');
    });

    it('y sin compartir disponible, lo dice en vez de dar por buena la descarga', async () => {
      expect(await entregarArchivo(new Blob(['x']), 'ficha.xlsx')).toBe('sin-salida');
    });
  });

  describe('puedeCompartirArchivo', () => {
    it('es falso sin la API', () => {
      expect(puedeCompartirArchivo(new Blob(['x']), 'a.pdf')).toBe(false);
    });
    it('y falso si el navegador rechaza ese archivo', () => {
      conCompartir({ puede: false });
      expect(puedeCompartirArchivo(new Blob(['x']), 'a.pdf')).toBe(false);
    });
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
    expect(esFalloDeCarga(new Error('ChunkLoadError'))).toBe(true);
  });
  it('y no confunde cualquier otro error con eso', () => {
    expect(esFalloDeCarga(new Error('No se pudo leer la evaluación'))).toBe(false);
    expect(esFalloDeCarga('algo')).toBe(false);
  });
});
