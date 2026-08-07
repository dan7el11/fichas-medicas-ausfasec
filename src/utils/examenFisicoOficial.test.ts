import { describe, it, expect } from 'vitest';
import {
  BLOQUES_EXAMEN_FISICO, filasDeBloque, tieneHallazgo, ALTO_EXAMEN_FISICO,
} from './examenFisicoOficial';
import { REGIONES_EXAMEN_FISICO } from './catalogosEvaluacion';

describe('rejilla oficial del examen físico', () => {
  it('los cinco bloques suman el ancho útil de la hoja (196 mm)', () => {
    const total = BLOQUES_EXAMEN_FISICO.reduce((s, b) => s + b.anchos[0] + b.anchos[1] + b.anchos[2], 0);
    expect(total).toBeGreaterThan(194);
    expect(total).toBeLessThan(196.5);
  });

  it('cubre las 13 regiones numeradas, sin huecos ni repeticiones', () => {
    const numeros = BLOQUES_EXAMEN_FISICO.flatMap(b => b.regiones.map(r => r.numero));
    expect(numeros).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it('el bloque más alto tiene 9 filas y el alto total es el de la hoja', () => {
    const filas = BLOQUES_EXAMEN_FISICO.map(filasDeBloque);
    expect(filas).toEqual([7, 8, 7, 8, 9]);
    expect(ALTO_EXAMEN_FISICO).toBeCloseTo(34.4, 1);
  });

  it('coincide con el catálogo que usa el formulario de captura', () => {
    const delPdf = BLOQUES_EXAMEN_FISICO.flatMap(b => b.regiones).map(r => ({
      numero: r.numero, items: r.items.map(i => `${i.letra}:${i.nombre}`),
    }));
    const delFormulario = [...REGIONES_EXAMEN_FISICO]
      .sort((a, b) => a.numero - b.numero)
      .map(r => ({ numero: r.numero, items: r.subregiones.map(s => `${s.codigo}:${s.nombre}`) }));
    expect(delPdf).toEqual(delFormulario);
  });

  it('7. Tórax solo lleva mamas; el corazón y la parrilla costal van en 8. Tórax', () => {
    const regiones = BLOQUES_EXAMEN_FISICO.flatMap(b => b.regiones);
    expect(regiones.find(r => r.numero === 7)!.items.map(i => i.nombre)).toEqual(['Mamas']);
    expect(regiones.find(r => r.numero === 8)!.items.map(i => i.nombre))
      .toEqual(['Pulmones', 'Corazón', 'Parrilla costal']);
  });
});

describe('tieneHallazgo', () => {
  it('marca la casilla por código cuando el hallazgo no trae subregión', () => {
    expect(tieneHallazgo([{ codigo: '8a' }], '8a', 'Pulmones')).toBe(true);
    expect(tieneHallazgo([{ codigo: '8a' }], '8b', 'Corazón')).toBe(false);
  });

  it('el nombre de la subregión manda sobre el código renumerado', () => {
    // Hallazgo antiguo: «8b» era la parrilla costal, hoy «8b» es el corazón.
    const antiguo = [{ codigo: '8b', subregion: 'Parrilla costal' }];
    expect(tieneHallazgo(antiguo, '8b', 'Corazón')).toBe(false);
    expect(tieneHallazgo(antiguo, '8c', 'Parrilla costal')).toBe(true);
  });

  it('reconoce el corazón guardado con la numeración vieja (7b)', () => {
    const antiguo = [{ codigo: '7b', subregion: 'Corazón' }];
    expect(tieneHallazgo(antiguo, '8b', 'Corazón')).toBe(true);
  });

  it('tolera tildes y mayúsculas en el nombre guardado', () => {
    expect(tieneHallazgo([{ codigo: 'x', subregion: 'piel y faneras' }], '1b', 'Piel y Faneras')).toBe(true);
    expect(tieneHallazgo([{ codigo: 'x', subregion: 'TIROIDES / MASAS' }], '6a', 'Tiroides / masas')).toBe(true);
  });

  it('sin hallazgos no marca nada', () => {
    expect(tieneHallazgo(undefined, '1a', 'Cicatrices')).toBe(false);
    expect(tieneHallazgo([], '1a', 'Cicatrices')).toBe(false);
  });
});
