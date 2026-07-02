import { describe, it, expect } from 'vitest';
import { anguloAPuntaje } from './anguloAPuntaje';

describe('anguloAPuntaje', () => {
  it('brazo por rangos de flexión', () => {
    expect(anguloAPuntaje('RULA', 'brazo', 10)).toBe(1);
    expect(anguloAPuntaje('RULA', 'brazo', 30)).toBe(2);
    expect(anguloAPuntaje('RULA', 'brazo', 70)).toBe(3);
    expect(anguloAPuntaje('RULA', 'brazo', 120)).toBe(4);
  });

  it('antebrazo: 60-100° del codo da 1, fuera da 2', () => {
    expect(anguloAPuntaje('RULA', 'antebrazo', 80)).toBe(1);
    expect(anguloAPuntaje('RULA', 'antebrazo', 120)).toBe(2);
  });

  it('tronco por rangos de flexión', () => {
    expect(anguloAPuntaje('REBA', 'tronco', 0)).toBe(1);
    expect(anguloAPuntaje('REBA', 'tronco', 15)).toBe(2);
    expect(anguloAPuntaje('REBA', 'tronco', 40)).toBe(3);
    expect(anguloAPuntaje('REBA', 'tronco', 70)).toBe(4);
  });

  it('cuello difiere entre RULA y REBA', () => {
    expect(anguloAPuntaje('RULA', 'cuello', 15)).toBe(2);
    expect(anguloAPuntaje('REBA', 'cuello', 15)).toBe(1);
    expect(anguloAPuntaje('REBA', 'cuello', 30)).toBe(2);
  });

  it('devuelve null para segmentos sin ángulo', () => {
    expect(anguloAPuntaje('RULA', 'piernas', 45)).toBeNull();
    expect(anguloAPuntaje('REBA', 'acople', 45)).toBeNull();
  });

  it('ROSA: rodilla ~90° da 1, desviada da 2', () => {
    expect(anguloAPuntaje('ROSA', 'sillaAltura', 92)).toBe(1);
    expect(anguloAPuntaje('ROSA', 'sillaAltura', 70)).toBe(2);
  });

  it('ROSA: respaldo 95–110° da 1, fuera da 2', () => {
    expect(anguloAPuntaje('ROSA', 'respaldo', 100)).toBe(1);
    expect(anguloAPuntaje('ROSA', 'respaldo', 120)).toBe(2);
  });

  it('ROSA: cuello al monitor y muñeca al teclado', () => {
    expect(anguloAPuntaje('ROSA', 'monitor', 20)).toBe(1);
    expect(anguloAPuntaje('ROSA', 'monitor', 40)).toBe(2);
    expect(anguloAPuntaje('ROSA', 'teclado', 10)).toBe(1);
    expect(anguloAPuntaje('ROSA', 'teclado', 25)).toBe(2);
    expect(anguloAPuntaje('ROSA', 'telefono', 45)).toBeNull();
  });
});
