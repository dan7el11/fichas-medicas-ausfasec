import { describe, it, expect } from 'vitest';
import { CATALOGO_MEDIDAS, medidaCompleta, buscarMedida } from './medidasPreventivas';
import { PERFILES_RIESGO_CARGO } from './perfilRiesgoCargo';
import { MATRIZ_RIESGOS, esFactorAnalizable } from '../utils/catalogosEvaluacion';

const ETIQUETAS = new Set(CATALOGO_MEDIDAS.map(m => m.etiqueta));
const FACTORES = new Set(
  MATRIZ_RIESGOS.flatMap(c => c.subgrupos.flatMap(g => g.items)).filter(esFactorAnalizable),
);

describe('catálogo de medidas preventivas', () => {
  it('carga las medidas del análisis, sin etiquetas repetidas', () => {
    expect(CATALOGO_MEDIDAS.length).toBeGreaterThanOrEqual(30);
    expect(ETIQUETAS.size).toBe(CATALOGO_MEDIDAS.length);
  });

  it('cada medida tiene etiqueta corta y redacción clínica más extensa', () => {
    CATALOGO_MEDIDAS.forEach(m => {
      expect(m.etiqueta.trim()).not.toBe('');
      expect(m.completa.trim()).not.toBe('');
      expect(m.completa.length).toBeGreaterThanOrEqual(m.etiqueta.length);
      expect(m.eje.trim()).not.toBe('');
    });
  });

  it('las etiquetas son cortas de verdad: caben en la fila de la matriz', () => {
    CATALOGO_MEDIDAS.forEach(m => expect(m.etiqueta.length, m.etiqueta).toBeLessThanOrEqual(50));
  });

  it('los factores que exigen cada medida existen en la matriz del formato', () => {
    const desconocidos = new Set<string>();
    CATALOGO_MEDIDAS.forEach(m => m.factores.forEach(f => { if (!FACTORES.has(f)) desconocidos.add(f); }));
    expect([...desconocidos]).toEqual([]);
  });
});

describe('medidaCompleta', () => {
  it('devuelve la redacción clínica de una etiqueta conocida', () => {
    const m = CATALOGO_MEDIDAS[0];
    expect(medidaCompleta(m.etiqueta)).toBe(m.completa);
  });
  it('devuelve la propia etiqueta si no está en el catálogo', () => {
    expect(medidaCompleta('Medida escrita a mano')).toBe('Medida escrita a mano');
  });
  it('buscarMedida no encuentra lo que no existe', () => {
    expect(buscarMedida('No existe')).toBeUndefined();
  });
});

describe('medidas por actividad en el perfil de cada cargo', () => {
  it('todos los cargos traen medidas alineadas con sus actividades', () => {
    PERFILES_RIESGO_CARGO.forEach(p => {
      expect(p.medidasActividades, p.cargo).toBeDefined();
      expect(p.medidasActividades!.length, p.cargo).toBe(p.actividades.length);
    });
  });

  it('cada actividad lleva hasta seis medidas, y ninguna se queda sin', () => {
    // El análisis asigna seis por función salvo en unas pocas donde el
    // catálogo solo justifica cinco; ninguna queda vacía.
    PERFILES_RIESGO_CARGO.forEach(p => {
      p.medidasActividades!.forEach((m, i) => {
        expect(m.length, `${p.cargo} / actividad ${i + 1}`).toBeGreaterThan(0);
        expect(m.length, `${p.cargo} / actividad ${i + 1}`).toBeLessThanOrEqual(6);
      });
    });
  });

  it('no se repite una medida dentro de la misma actividad', () => {
    PERFILES_RIESGO_CARGO.forEach(p => {
      p.medidasActividades!.forEach((m, i) => {
        expect(new Set(m).size, `${p.cargo} / actividad ${i + 1}`).toBe(m.length);
      });
    });
  });

  it('todas las medidas usadas están en el catálogo', () => {
    const desconocidas = new Set<string>();
    PERFILES_RIESGO_CARGO.forEach(p =>
      p.medidasActividades!.forEach(m => m.forEach(e => { if (!ETIQUETAS.has(e)) desconocidas.add(e); })));
    expect([...desconocidas]).toEqual([]);
  });

  it('el resumen de actividades está alineado y sin huecos', () => {
    PERFILES_RIESGO_CARGO.forEach(p => {
      expect(p.actividadesResumen, p.cargo).toBeDefined();
      expect(p.actividadesResumen!.length, p.cargo).toBe(p.actividades.length);
      p.actividadesResumen!.forEach(a => expect(a.trim()).not.toBe(''));
    });
  });

  it('el resumen nunca es más largo que la función completa', () => {
    PERFILES_RIESGO_CARGO.forEach(p => {
      p.actividadesResumen!.forEach((r, i) => {
        expect(r.length, `${p.cargo} / ${i + 1}`).toBeLessThanOrEqual(p.actividades[i].length);
      });
    });
  });
});
