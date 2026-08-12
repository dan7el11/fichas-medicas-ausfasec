import { describe, it, expect } from 'vitest';
import {
  resumirFuncion, resumirActividades, textoActividad, textosActividades,
  LARGO_ACTIVIDAD_MATRIZ, FUNCIONES_HISTORIA_LABORAL,
} from './resumenFuncion';
import { PERFILES_RIESGO_CARGO } from '../constants/perfilRiesgoCargo';

describe('resumirFuncion', () => {
  it('deja intacta una función que ya cabe', () => {
    expect(resumirFuncion('Elaborar los roles de pago')).toBe('Elaborar los roles de pago');
  });

  it('corta en la primera pausa fuerte de la frase', () => {
    const t = 'Coordinar y gestionar la recepción de documentos, así como el envío de correspondencia a las agencias';
    const r = resumirFuncion(t);
    expect(r).toBe('Coordinar y gestionar la recepción de documentos…');
    expect(r.length).toBeLessThanOrEqual(LARGO_ACTIVIDAD_MATRIZ + 1);
  });

  it('si no hay pausa, corta en el último espacio y marca el recorte', () => {
    const t = 'Realizar mantenimiento preventivo y correctivo de todos los equipos industriales de la planta envasadora';
    const r = resumirFuncion(t);
    expect(r.endsWith('…')).toBe(true);
    expect(r.length).toBeLessThanOrEqual(LARGO_ACTIVIDAD_MATRIZ + 1);
    // No parte una palabra por la mitad.
    expect(t.startsWith(r.slice(0, -1))).toBe(true);
  });

  it('no deja signos de puntuación colgando antes de los puntos suspensivos', () => {
    const r = resumirFuncion('Supervisar la operación diaria del taller de mantenimiento general y de sus equipos');
    expect(r).not.toMatch(/[,;:. ]…$/);
  });

  it('tolera texto vacío o solo espacios', () => {
    expect(resumirFuncion('')).toBe('');
    expect(resumirFuncion('   ')).toBe('');
  });

  it('normaliza los espacios de sobra', () => {
    expect(resumirFuncion('Elaborar   los  roles')).toBe('Elaborar los roles');
  });

  it('respeta un límite distinto', () => {
    expect(resumirFuncion('Elaborar los roles de compensaciones económicas', 20).length).toBeLessThanOrEqual(21);
  });
});

describe('resumirActividades', () => {
  it('acorta todas las actividades del perfil de un cargo', () => {
    const perfil = PERFILES_RIESGO_CARGO.find(p => p.actividades.some(a => a.length > LARGO_ACTIVIDAD_MATRIZ))!;
    const cortas = resumirActividades(perfil.actividades);
    expect(cortas).toHaveLength(perfil.actividades.length);
    cortas.forEach(a => expect(a.length).toBeLessThanOrEqual(LARGO_ACTIVIDAD_MATRIZ + 1));
  });

  it('ninguna actividad del catálogo queda vacía al resumirse', () => {
    PERFILES_RIESGO_CARGO.forEach(p => {
      resumirActividades(p.actividades).forEach(a => expect(a.trim()).not.toBe(''));
    });
  });

  it('tolera una lista vacía', () => {
    expect(resumirActividades([])).toEqual([]);
  });
});

describe('textoActividad', () => {
  const completas = ['Elaborar comunicaciones internas y externas, relacionadas con los procesos del departamento comercial'];
  const resumidas = ['Elaborar comunicaciones internas y externas'];

  it('devuelve la redacción revisada tal cual, sin recortarla', () => {
    expect(textoActividad(completas, resumidas, 0)).toBe('Elaborar comunicaciones internas y externas');
  });

  it('no recorta una redacción revisada larga: es una frase completa', () => {
    const larga = ['Coordinar y gestionar la recepción, envío de GLP en cilindros de forma oportuna a los distribuidores del Austro, incluidos los operativos sociales designados por el Estado'];
    expect(textoActividad(larga, larga, 0)).toBe(larga[0]);
    expect(textoActividad(larga, larga, 0)).not.toContain('…');
  });

  it('cae en el recorte automático solo si no hay redacción revisada', () => {
    expect(textoActividad(completas, undefined, 0).endsWith('…')).toBe(true);
    expect(textoActividad(completas, ['   '], 0).endsWith('…')).toBe(true);
  });

  it('normaliza los espacios de sobra de la redacción revisada', () => {
    expect(textoActividad(['x'], ['Elaborar   informes'], 0)).toBe('Elaborar informes');
  });

  it('devuelve vacío cuando no hay actividad en ese índice', () => {
    expect(textoActividad(completas, resumidas, 5)).toBe('');
    expect(textoActividad(undefined, undefined, 0)).toBe('');
  });
});

describe('textosActividades', () => {
  it('devuelve una entrada por actividad, sin puntos suspensivos', () => {
    PERFILES_RIESGO_CARGO.forEach(p => {
      const textos = textosActividades(p.actividades, p.actividadesResumen);
      expect(textos, p.cargo).toHaveLength(p.actividades.length);
      textos.forEach(a => {
        expect(a.trim(), p.cargo).not.toBe('');
        expect(a, `${p.cargo}: ${a}`).not.toContain('…');
      });
    });
  });

  it('el límite recorta el número de actividades, no su texto', () => {
    const p = PERFILES_RIESGO_CARGO.find(x => x.actividades.length > FUNCIONES_HISTORIA_LABORAL)!;
    const textos = textosActividades(p.actividades, p.actividadesResumen, FUNCIONES_HISTORIA_LABORAL);
    expect(textos).toHaveLength(FUNCIONES_HISTORIA_LABORAL);
    expect(textos[0]).toBe(p.actividadesResumen![0]);
  });

  it('sin límite las devuelve todas; con lista vacía, ninguna', () => {
    expect(textosActividades(['a', 'b'], ['a', 'b'])).toHaveLength(2);
    expect(textosActividades([], [])).toEqual([]);
    expect(textosActividades(undefined, undefined)).toEqual([]);
  });
});
