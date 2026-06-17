import { describe, it, expect } from 'vitest';
import { validarSigno, validarPresion, validarSignosVitales } from './signosValidacion';

describe('validarSigno', () => {
  it('acepta un valor normal como ok', () => {
    expect(validarSigno('presionSistolica', '120').nivel).toBe('ok');
    expect(validarSigno('temperatura', '36.5').nivel).toBe('ok');
  });

  it('considera vacío como ok (no obliga a llenar)', () => {
    expect(validarSigno('temperatura', '').nivel).toBe('ok');
    expect(validarSigno('saturacion', undefined).nivel).toBe('ok');
  });

  it('marca error en valores imposibles', () => {
    expect(validarSigno('presionSistolica', '999').nivel).toBe('error');
    expect(validarSigno('temperatura', '500').nivel).toBe('error');
    expect(validarSigno('saturacion', '150').nivel).toBe('error');
    expect(validarSigno('peso', '0').nivel).toBe('error');
  });

  it('marca alerta en valores clínicamente notables pero posibles', () => {
    expect(validarSigno('presionSistolica', '160').nivel).toBe('alerta');
    expect(validarSigno('temperatura', '38.5').nivel).toBe('alerta');
    expect(validarSigno('saturacion', '90').nivel).toBe('alerta');
    expect(validarSigno('glucosaCapilar', '250').nivel).toBe('alerta');
  });

  it('rechaza texto no numérico', () => {
    expect(validarSigno('peso', 'abc').nivel).toBe('error');
  });

  it('acepta coma decimal', () => {
    expect(validarSigno('temperatura', '36,8').nivel).toBe('ok');
  });
});

describe('validarPresion', () => {
  it('acepta sistólica > diastólica', () => {
    expect(validarPresion('120', '80').nivel).toBe('ok');
  });
  it('rechaza diastólica ≥ sistólica', () => {
    expect(validarPresion('80', '120').nivel).toBe('error');
    expect(validarPresion('100', '100').nivel).toBe('error');
  });
  it('ignora cuando falta algún valor', () => {
    expect(validarPresion('120', '').nivel).toBe('ok');
  });
});

describe('validarSignosVitales', () => {
  it('reúne errores y alertas', () => {
    const r = validarSignosVitales({ presionSistolica: '999', temperatura: '38.5', peso: '70', talla: '170' });
    expect(r.hayError).toBe(true);
    expect(r.errores.some((e) => e.campo === 'presionSistolica')).toBe(true);
    expect(r.alertas.some((a) => a.campo === 'temperatura')).toBe(true);
  });

  it('no reporta errores cuando todo es normal', () => {
    const r = validarSignosVitales({ presionSistolica: '120', presionDiastolica: '80', temperatura: '36.5', peso: '70', talla: '170', saturacion: '98' });
    expect(r.hayError).toBe(false);
    expect(r.errores).toHaveLength(0);
  });
});
