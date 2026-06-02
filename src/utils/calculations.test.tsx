import { describe, it, expect } from 'vitest';
import { calcularIMC, validarCedula } from './calculations';

// ── calcularIMC ────────────────────────────────────────────────────────────

describe('calcularIMC', () => {
  it('calcula IMC correctamente', () => {
    expect(calcularIMC(70, 170)).toBe(24.22);
  });

  it('retorna 0 si el peso es 0', () => {
    expect(calcularIMC(0, 170)).toBe(0);
  });

  it('retorna 0 si la talla es 0', () => {
    expect(calcularIMC(70, 0)).toBe(0);
  });

  it('retorna 0 si ambos son 0', () => {
    expect(calcularIMC(0, 0)).toBe(0);
  });

  it('clasifica obesidad (IMC > 30)', () => {
    expect(calcularIMC(100, 170)).toBeGreaterThan(30);
  });

  it('clasifica bajo peso (IMC < 18.5)', () => {
    expect(calcularIMC(50, 175)).toBeLessThan(18.5);
  });
});

// ── validarCedula ──────────────────────────────────────────────────────────

describe('validarCedula', () => {
  it('acepta cédula ecuatoriana válida', () => {
    expect(validarCedula('1713175071')).toBe(true);
  });

  it('rechaza cédula con dígito verificador incorrecto', () => {
    expect(validarCedula('1713175072')).toBe(false);
  });

  it('rechaza cédula de menos de 10 dígitos', () => {
    expect(validarCedula('123456789')).toBe(false);
  });

  it('rechaza cédula con letras', () => {
    expect(validarCedula('17131750AB')).toBe(false);
  });

  it('rechaza provincia inválida (00)', () => {
    expect(validarCedula('0013175071')).toBe(false);
  });

  it('rechaza provincia inválida (> 24)', () => {
    expect(validarCedula('2513175071')).toBe(false);
  });

  it('rechaza tercer dígito >= 6 (no persona natural)', () => {
    expect(validarCedula('1763175071')).toBe(false);
  });

  it('rechaza cadena vacía', () => {
    expect(validarCedula('')).toBe(false);
  });
});
