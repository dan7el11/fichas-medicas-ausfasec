import { describe, it, expect } from 'vitest';
import { resumirFuncion, resumirActividades, LARGO_ACTIVIDAD_MATRIZ } from './resumenFuncion';
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
