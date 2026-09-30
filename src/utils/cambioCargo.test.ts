import { describe, it, expect } from 'vitest';
import {
  compararPerfiles, factoresRiesgoDesdePerfil, recomendacionesDesdeMedidas,
  medidasDePerfil, factoresDePerfil,
} from './cambioCargo';
import { PERFILES_RIESGO_CARGO } from '../constants/perfilRiesgoCargo';
import { OPCIONES_RECOMENDACIONES } from './catalogosEvaluacion';
import { MAX_ACTIVIDADES } from '../constants/funcionesCargo';
import type { PerfilRiesgoCargo } from '../types/perfilRiesgo';

const perfil = (p: Partial<PerfilRiesgoCargo> = {}): PerfilRiesgoCargo => ({
  cargo: 'CARGO', departamento: 'DEPTO',
  actividades: ['Actividad A', 'Actividad B'],
  riesgoActividades: { Ruido: [0] },
  ...p,
});

describe('factoresDePerfil / medidasDePerfil', () => {
  it('devuelven los factores y medidas sin repetir y ordenados', () => {
    const p = perfil({
      riesgoActividades: { Ruido: [0], Iluminación: [1] },
      medidasActividades: [['Audiometría anual', 'Pausas activas y estiramientos'], ['Audiometría anual']],
    });
    expect(factoresDePerfil(p)).toEqual(['Iluminación', 'Ruido']);
    expect(medidasDePerfil(p)).toEqual(['Audiometría anual', 'Pausas activas y estiramientos']);
  });

  it('toleran un perfil ausente', () => {
    expect(factoresDePerfil(null)).toEqual([]);
    expect(medidasDePerfil(null)).toEqual([]);
  });
});

describe('compararPerfiles', () => {
  it('separa lo que entra, lo que sale y lo que sigue', () => {
    const antes = perfil({ riesgoActividades: { Ruido: [0], Vibración: [0] } });
    const despues = perfil({ riesgoActividades: { Ruido: [0], 'Manejo manual de cargas': [0] } });
    const c = compararPerfiles(antes, despues);
    expect(c.factoresNuevos).toEqual(['Manejo manual de cargas']);
    expect(c.factoresQueSalen).toEqual(['Vibración']);
    expect(c.factoresQueSiguen).toEqual(['Ruido']);
    expect(c.sinCambios).toBe(false);
  });

  it('detecta que dos cargos exponen a lo mismo', () => {
    const p = perfil({ medidasActividades: [['Audiometría anual'], []] });
    expect(compararPerfiles(p, p).sinCambios).toBe(true);
  });

  it('un cargo sin perfil previo deja todo como nuevo', () => {
    const c = compararPerfiles(null, perfil({ medidasActividades: [['Audiometría anual'], []] }));
    expect(c.factoresNuevos).toEqual(['Ruido']);
    expect(c.factoresQueSalen).toEqual([]);
    expect(c.medidasNuevas).toEqual(['Audiometría anual']);
    expect(c.actividadesAnteriores).toBe(0);
    expect(c.actividadesNuevas).toBe(2);
  });

  it('funciona con dos cargos reales del catálogo', () => {
    const [a, b] = PERFILES_RIESGO_CARGO;
    const c = compararPerfiles(a, b);
    expect(c.factoresNuevos.length + c.factoresQueSalen.length).toBeGreaterThan(0);
    // Ningún factor puede estar a la vez en dos grupos.
    expect(c.factoresNuevos.filter(f => c.factoresQueSalen.includes(f))).toEqual([]);
    expect(c.factoresNuevos.filter(f => c.factoresQueSiguen.includes(f))).toEqual([]);
  });
});

describe('factoresRiesgoDesdePerfil', () => {
  it('arma la Sección G con el cargo, sus actividades y su matriz', () => {
    const p = perfil({
      cargo: 'OPERADOR',
      riesgoActividades: { Ruido: [0, 1] },
      medidasActividades: [['Audiometría anual'], ['Pausas activas y estiramientos']],
    });
    const fr = factoresRiesgoDesdePerfil(p);
    expect(fr.puestoArea).toBe('OPERADOR');
    expect(fr.actividadesJornada).toEqual(['Actividad A', 'Actividad B']);
    expect(fr.riesgoActividades).toEqual({ Ruido: [0, 1] });
    expect(fr.medidasActividades).toEqual(['Audiometría anual', 'Pausas activas y estiramientos']);
  });

  it('deriva los arreglos por categoría que leen los informes', () => {
    const fr = factoresRiesgoDesdePerfil(perfil({ riesgoActividades: { Ruido: [0] } }));
    expect(fr.fisicos).toContain('Ruido');
    expect(fr.ergonomicos).toEqual([]);
  });

  it('descarta las marcas de columnas que no existen', () => {
    const fr = factoresRiesgoDesdePerfil(perfil({ riesgoActividades: { Ruido: [0, 9] } }));
    expect(fr.riesgoActividades).toEqual({ Ruido: [0] });
  });

  it('no pasa del máximo de actividades del formato', () => {
    const muchas = Array.from({ length: 12 }, (_, i) => `Actividad ${i}`);
    const fr = factoresRiesgoDesdePerfil(perfil({ actividades: muchas }));
    expect(fr.actividadesJornada).toHaveLength(MAX_ACTIVIDADES);
    expect(fr.actividadesResumen).toHaveLength(MAX_ACTIVIDADES);
  });

  it('conserva los campos previos que no le corresponden', () => {
    const fr = factoresRiesgoDesdePerfil(perfil(), { tiempoTrabajoMeses: '36' });
    expect(fr.tiempoTrabajoMeses).toBe('36');
  });

  it('deja el respaldo en texto plano para los formatos antiguos', () => {
    const fr = factoresRiesgoDesdePerfil(perfil({ medidasActividades: [['Audiometría anual'], []] }));
    expect(fr.actividades).toBe('Actividad A; Actividad B');
    expect(fr.medidasPreventivas).toContain('Audiometría anual');
  });

  it('sirve para cualquier cargo del catálogo', () => {
    PERFILES_RIESGO_CARGO.forEach(p => {
      const fr = factoresRiesgoDesdePerfil(p);
      expect(fr.actividadesJornada.length, p.cargo).toBeGreaterThan(0);
      expect(fr.medidasActividades.length, p.cargo).toBe(fr.actividadesJornada.length);
      Object.values(fr.riesgoActividades as Record<string, number[]>).forEach(idxs =>
        idxs.forEach(i => expect(i).toBeLessThan(fr.actividadesJornada.length)));
    });
  });
});

describe('recomendacionesDesdeMedidas', () => {
  it('propone las opciones del formulario que se desprenden de las medidas', () => {
    const r = recomendacionesDesdeMedidas(['Ergonomía del puesto con PVD', 'Pausas activas y estiramientos']);
    expect(r.recomendaciones).toContain('Ergonomía laboral');
    expect(r.recomendaciones).toContain('Higiene postural');
    expect(r.recomendaciones).toContain('Pausas activas frecuentes');
  });

  it('solo usa opciones que existen en el catálogo del formulario', () => {
    const todas = PERFILES_RIESGO_CARGO.flatMap(p => (p.medidasActividades ?? []).flat());
    const r = recomendacionesDesdeMedidas(todas);
    r.recomendaciones.forEach(x => expect(OPCIONES_RECOMENDACIONES).toContain(x));
  });

  it('respeta el orden del catálogo, no el de las medidas', () => {
    const r = recomendacionesDesdeMedidas(['Pausas activas y estiramientos', 'Ergonomía del puesto con PVD']);
    const i = (x: string) => r.recomendaciones.indexOf(x);
    expect(i('Ergonomía laboral')).toBeLessThan(i('Pausas activas frecuentes'));
  });

  it('el texto libre lleva la redacción clínica, no la etiqueta corta', () => {
    const r = recomendacionesDesdeMedidas(['Audiometría anual']);
    expect(r.recomendacionesOtras.length).toBeGreaterThan('Audiometría anual'.length);
  });

  it('no repite una medida que aparece en varias actividades', () => {
    const r = recomendacionesDesdeMedidas(['Audiometría anual', 'Audiometría anual']);
    const veces = r.recomendacionesOtras.split('Audiometría').length - 1;
    expect(veces).toBeLessThanOrEqual(1);
  });

  it('sin medidas no propone nada', () => {
    const r = recomendacionesDesdeMedidas([]);
    expect(r.recomendaciones).toEqual([]);
    expect(r.recomendacionesOtras).toBe('');
  });

  it('todo cargo del catálogo produce alguna recomendación', () => {
    PERFILES_RIESGO_CARGO.forEach(p => {
      const r = recomendacionesDesdeMedidas(medidasDePerfil(p));
      expect(r.recomendaciones.length, p.cargo).toBeGreaterThan(0);
    });
  });
});
