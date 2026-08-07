import { describe, it, expect } from 'vitest';
import { edadDesde, partesFecha, MARGEN, ANCHO_UTIL } from './paginaUnoOcupacionalPdf';
import { tipoEvaluacionClave } from '../../utils/medicalHelpers';

describe('medidas de la hoja', () => {
  it('usa el margen y el ancho útil del formato (A4 vertical)', () => {
    expect(MARGEN * 2 + ANCHO_UTIL).toBe(210);
  });
});

describe('edadDesde', () => {
  const ref = new Date('2026-08-07T12:00:00');
  it('calcula los años cumplidos', () => {
    expect(edadDesde('1982-06-15', ref)).toBe('44');
  });
  it('descuenta el año si aún no cumple', () => {
    expect(edadDesde('1982-12-31', ref)).toBe('43');
  });
  it('devuelve vacío sin fecha o con fecha inválida', () => {
    expect(edadDesde('', ref)).toBe('');
    expect(edadDesde(undefined, ref)).toBe('');
    expect(edadDesde('no es fecha', ref)).toBe('');
  });
});

describe('partesFecha', () => {
  it('separa año, mes y día para las tres casillas del formato', () => {
    expect(partesFecha('1982-06-15')).toEqual(['1982', '06', '15']);
  });
  it('devuelve casillas vacías si no hay fecha', () => {
    expect(partesFecha('')).toEqual(['', '', '']);
    expect(partesFecha(null)).toEqual(['', '', '']);
  });
});

describe('tipoEvaluacionClave', () => {
  it('marca INGRESO para las preocupacionales (el label lleva guion y antes fallaba)', () => {
    expect(tipoEvaluacionClave({ tipoEvaluacion: 'preocupacional' } as any)).toBe('preocupacional');
    expect(tipoEvaluacionClave({ tipoEvaluacion: 'Pre-ocupacional' } as any)).toBe('preocupacional');
    expect(tipoEvaluacionClave({ tipoEvaluacion: 'ingreso' } as any)).toBe('preocupacional');
  });
  it('reconoce los otros tres tipos', () => {
    expect(tipoEvaluacionClave({ tipoEvaluacion: 'retiro' } as any)).toBe('retiro');
    expect(tipoEvaluacionClave({ tipo: 'RETIRO' } as any)).toBe('retiro');
    expect(tipoEvaluacionClave({ tipoEvaluacion: 'reintegro' } as any)).toBe('reintegro');
    expect(tipoEvaluacionClave({ tipoEvaluacion: 'periodica' } as any)).toBe('periodica');
  });
  it('cae en periódico cuando no hay tipo guardado', () => {
    expect(tipoEvaluacionClave({} as any)).toBe('periodica');
  });
  it('marca una sola casilla por evaluación', () => {
    const claves = ['preocupacional', 'periodica', 'reintegro', 'retiro'] as const;
    claves.forEach(c => {
      const clave = tipoEvaluacionClave({ tipoEvaluacion: c } as any);
      expect(claves.filter(k => k === clave)).toHaveLength(1);
    });
  });
});
