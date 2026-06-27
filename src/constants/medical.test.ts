import { describe, it, expect } from 'vitest';
import { normalizarTexto, deriveAreaFromPuesto, colorsDeArea } from './medical';

describe('normalizarTexto', () => {
  it('pasa a minúsculas y quita tildes', () => {
    expect(normalizarTexto('José PÉREZ')).toBe('jose perez');
    expect(normalizarTexto('  Logística  ')).toBe('logistica');
  });
  it('tolera vacío/undefined', () => {
    expect(normalizarTexto('')).toBe('');
    expect(normalizarTexto(undefined as any)).toBe('');
  });
});

describe('deriveAreaFromPuesto', () => {
  it('reconoce puestos del catálogo', () => {
    expect(deriveAreaFromPuesto('Soldador')).toBe('Mantenimiento');
    expect(deriveAreaFromPuesto('Conductor de tanquero')).toBe('Logística');
    expect(deriveAreaFromPuesto('Médico ocupacional')).toBe('Seguridad y Salud');
  });
  it('clasifica puestos de texto libre por palabra clave', () => {
    expect(deriveAreaFromPuesto('Enfermera del dispensario')).toBe('Seguridad y Salud');
    expect(deriveAreaFromPuesto('Contador general')).toBe('Administración');
    expect(deriveAreaFromPuesto('Vendedor de campo')).toBe('Comercial');
  });
  it('cae en Operaciones cuando no reconoce nada', () => {
    expect(deriveAreaFromPuesto('xyz123')).toBe('Operaciones');
  });
});

describe('colorsDeArea', () => {
  it('devuelve color estable para la misma área', () => {
    expect(colorsDeArea('Planificación')).toEqual(colorsDeArea('Planificación'));
  });
  it('devuelve un objeto con bg/fg/dot', () => {
    const c = colorsDeArea('TTHH');
    expect(c).toHaveProperty('bg');
    expect(c).toHaveProperty('fg');
    expect(c).toHaveProperty('dot');
  });
});
