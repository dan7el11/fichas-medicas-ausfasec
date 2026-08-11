import { describe, it, expect } from 'vitest';
import {
  esFechaReal, validarFecha, validarFechaNacimiento, validarFechasEvaluacion, hoyIso, mesesEntre,
} from './validacionFechas';

const HOY = new Date('2026-08-07T12:00:00');

describe('esFechaReal', () => {
  it('acepta una fecha del calendario', () => {
    expect(esFechaReal('2026-02-28')).toBe(true);
    expect(esFechaReal('2024-02-29')).toBe(true); // bisiesto
  });
  it('rechaza días que no existen', () => {
    expect(esFechaReal('2026-02-30')).toBe(false);
    expect(esFechaReal('2025-02-29')).toBe(false);
    expect(esFechaReal('2026-13-01')).toBe(false);
  });
  it('rechaza lo que no tenga el formato aaaa-mm-dd', () => {
    expect(esFechaReal('07/08/2026')).toBe(false);
    expect(esFechaReal('')).toBe(false);
  });
});

describe('validarFecha', () => {
  it('una fecha vacía no es un error aquí', () => {
    expect(validarFecha('', { etiqueta: 'Fecha' }, HOY)).toBeNull();
  });
  it('rechaza el año imposible que dejaba pasar el input de fecha', () => {
    expect(validarFecha('0202-05-06', { etiqueta: 'Fecha de atención' }, HOY))
      .toContain('anterior a 1900');
  });
  it('rechaza fechas futuras salvo que se permitan', () => {
    expect(validarFecha('2027-01-01', { etiqueta: 'Fecha de atención' }, HOY)).toContain('futura');
    expect(validarFecha('2026-09-01', { etiqueta: 'Reintegro', permitirFuturo: true }, HOY)).toBeNull();
  });
  it('acota también el futuro permitido', () => {
    expect(validarFecha('2050-01-01', { etiqueta: 'Reintegro', permitirFuturo: true }, HOY))
      .toContain('demasiado lejos');
  });
  it('aplica el límite inferior con su descripción', () => {
    const m = validarFecha('2020-01-01', { etiqueta: 'Último día laboral', min: '2021-05-01', minEtiqueta: 'la fecha de ingreso' }, HOY);
    expect(m).toContain('la fecha de ingreso');
  });
  it('avisa cuando la fecha no existe', () => {
    expect(validarFecha('2026-02-31', { etiqueta: 'Fecha' }, HOY)).toContain('no existe');
  });
});

describe('validarFechaNacimiento', () => {
  it('rechaza nacimientos futuros y edades imposibles', () => {
    expect(validarFechaNacimiento('2027-01-01', HOY)).toContain('futura');
    expect(validarFechaNacimiento('1850-01-01', HOY)).toContain('anterior a 1900');
    expect(validarFechaNacimiento('1901-01-01', HOY)).toContain('120 años');
  });
  it('acepta una fecha normal', () => {
    expect(validarFechaNacimiento('1982-06-15', HOY)).toBeNull();
  });
});

describe('validarFechasEvaluacion', () => {
  const base = {
    fechaAtencion: '2026-08-05', fechaIngresoTrabajo: '2020-01-15',
    fechaReingreso: '', fechaUltimoDia: '', fechaNacimiento: '1982-06-15',
  };
  it('no se queja de un bloque coherente', () => {
    expect(validarFechasEvaluacion(base, HOY)).toEqual([]);
  });
  it('detecta que se ingresó a trabajar antes de nacer', () => {
    const e = validarFechasEvaluacion({ ...base, fechaIngresoTrabajo: '1970-01-01' }, HOY);
    expect(e.join(' ')).toContain('la fecha de nacimiento');
  });
  it('detecta una salida anterior al ingreso', () => {
    const e = validarFechasEvaluacion({ ...base, fechaUltimoDia: '2019-01-01' }, HOY);
    expect(e.join(' ')).toContain('Último día laboral');
  });
  it('acumula varios errores a la vez', () => {
    const e = validarFechasEvaluacion({
      ...base, fechaAtencion: '2030-01-01', fechaIngresoTrabajo: '0202-01-01',
    }, HOY);
    expect(e.length).toBeGreaterThanOrEqual(2);
  });
  it('admite un reintegro previsto para los próximos días', () => {
    expect(validarFechasEvaluacion({ ...base, fechaReingreso: '2026-08-20' }, HOY)).toEqual([]);
  });
});

describe('mesesEntre', () => {
  it('cuenta meses completos', () => {
    expect(mesesEntre('2020-01-15', '2026-08-05')).toBe('78');
    expect(mesesEntre('2026-01-15', '2026-08-15')).toBe('7');
  });
  it('no cuenta el mes si aún no se cumple el día', () => {
    expect(mesesEntre('2026-01-20', '2026-02-19')).toBe('0');
    expect(mesesEntre('2026-01-20', '2026-02-20')).toBe('1');
  });
  it('devuelve vacío si falta una fecha o el orden es imposible', () => {
    expect(mesesEntre('', '2026-08-05')).toBe('');
    expect(mesesEntre('2026-08-05', '2020-01-15')).toBe('');
    expect(mesesEntre('2026-02-31', '2026-08-05')).toBe('');
  });
});

describe('hoyIso', () => {
  it('da la fecha local en aaaa-mm-dd', () => {
    expect(hoyIso(HOY)).toBe('2026-08-07');
  });
});
