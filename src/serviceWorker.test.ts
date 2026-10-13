import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Pruebas del service worker de la PWA (`public/sw.js`).
 *
 * Se carga el archivo real en un entorno de mentira porque el worker no se
 * registra en desarrollo (`import.meta.env.PROD`), así que nada de lo que se
 * prueba con `vite dev` pasa por él: los fallos que causa sólo salen en
 * producción, que es justo donde no se puede depurar a gusto.
 */
const ORIGEN = 'https://fichas-medicas.web.app';

interface Entorno {
  fetchEvent(url: string, opciones?: { mode?: string; method?: string }): { interceptada: boolean };
  pedidasALaRed: string[];
}

function cargarServiceWorker(): Entorno {
  const codigo = readFileSync(resolve(__dirname, '../public/sw.js'), 'utf8');
  const oyentes: Record<string, (e: any) => void> = {};
  const pedidasALaRed: string[] = [];

  const self = {
    addEventListener: (tipo: string, fn: (e: any) => void) => { oyentes[tipo] = fn; },
    location: { origin: ORIGEN },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  const almacen = {
    match: vi.fn(async () => undefined),
    put: vi.fn(async () => undefined),
  };
  const caches = {
    open: vi.fn(async () => almacen),
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
  };
  const fetch = vi.fn(async (req: any) => {
    const url = typeof req === 'string' ? req : req.url;
    pedidasALaRed.push(url);
    // Un service worker no puede leer un blob de la página: si llega aquí,
    // falla, y antes eso acababa devolviendo index.html en su lugar.
    if (url.startsWith('blob:')) throw new TypeError('Failed to fetch');
    return { ok: true, clone: () => ({}) };
  });
  const Response = { error: () => ({ tipo: 'error' }) };

  // eslint-disable-next-line no-new-func
  new Function('self', 'caches', 'fetch', 'Response', codigo)(self, caches, fetch, Response);

  return {
    pedidasALaRed,
    fetchEvent(url, opciones = {}) {
      let interceptada = false;
      oyentes.fetch({
        request: { url, method: opciones.method ?? 'GET', mode: opciones.mode ?? 'no-cors' },
        respondWith: () => { interceptada = true; },
      });
      return { interceptada };
    },
  };
}

describe('service worker de la PWA', () => {
  let sw: Entorno;
  beforeEach(() => { sw = cargarServiceWorker(); });

  describe('no se mete con las URL de blob que genera la app', () => {
    // El PDF del visor y la ficha en Excel salen como blob del propio
    // navegador. `new URL('blob:https://sitio/id').origin` devuelve
    // `https://sitio`, así que el filtro por origen no los dejaba pasar.
    const blob = `blob:${ORIGEN}/8f3a1c2e-uuid`;

    it('ni cuando se abre en el visor o en otra pestaña (navegación)', () => {
      expect(sw.fetchEvent(blob, { mode: 'navigate' }).interceptada).toBe(false);
    });

    it('ni cuando se pide como subrecurso', () => {
      expect(sw.fetchEvent(blob).interceptada).toBe(false);
    });

    it('y no intenta pedirlo a la red, que es lo que fallaba', () => {
      sw.fetchEvent(blob, { mode: 'navigate' });
      sw.fetchEvent(blob);
      expect(sw.pedidasALaRed).toEqual([]);
    });
  });

  it('tampoco toca data: ni otros esquemas', () => {
    expect(sw.fetchEvent('data:application/pdf;base64,JVBER', { mode: 'navigate' }).interceptada).toBe(false);
    expect(sw.fetchEvent('filesystem:https://x/tmp/a', { mode: 'navigate' }).interceptada).toBe(false);
  });

  it('sigue atendiendo la navegación de la app', () => {
    expect(sw.fetchEvent(`${ORIGEN}/trabajador/abc`, { mode: 'navigate' }).interceptada).toBe(true);
  });

  it('sigue cacheando los archivos propios', () => {
    expect(sw.fetchEvent(`${ORIGEN}/assets/FichaTrabajador-abc123.js`).interceptada).toBe(true);
    expect(sw.fetchEvent(`${ORIGEN}/logo.png`).interceptada).toBe(true);
  });

  it('no toca Firestore ni Storage', () => {
    expect(sw.fetchEvent('https://firestore.googleapis.com/v1/proyectos').interceptada).toBe(false);
    expect(sw.fetchEvent('https://firebasestorage.googleapis.com/v0/b/x/o/foto.jpg').interceptada).toBe(false);
  });

  it('no toca lo que no sea GET', () => {
    expect(sw.fetchEvent(`${ORIGEN}/assets/x.js`, { method: 'POST' }).interceptada).toBe(false);
  });
});
