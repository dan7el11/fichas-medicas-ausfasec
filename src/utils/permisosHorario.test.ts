import { describe, it, expect } from 'vitest';
import { horasEntre, fmtHora12, rangoHorarioTexto, fechasLaborables, fechasDeIntervalos } from './permisosHorario';

describe('horasEntre', () => {
  it('calcula horas decimales entre dos horas', () => {
    expect(horasEntre('12:30', '14:30')).toBe(2);
    expect(horasEntre('08:00', '09:30')).toBe(1.5);
    expect(horasEntre('08:15', '09:00')).toBe(0.8); // 45 min = 0.75 → redondeo 1 decimal
  });
  it('devuelve 0 para rangos inválidos o vacíos', () => {
    expect(horasEntre('14:00', '12:00')).toBe(0);
    expect(horasEntre('', '10:00')).toBe(0);
    expect(horasEntre('10:00', '10:00')).toBe(0);
  });
});

describe('fmtHora12', () => {
  it('convierte 24 h a 12 h con am/pm', () => {
    expect(fmtHora12('14:30')).toBe('2:30 pm');
    expect(fmtHora12('12:30')).toBe('12:30 pm');
    expect(fmtHora12('00:15')).toBe('12:15 am');
    expect(fmtHora12('09:05')).toBe('9:05 am');
  });
});

describe('rangoHorarioTexto', () => {
  it('arma el texto desde–hasta en 12 h', () => {
    expect(rangoHorarioTexto('12:30', '14:30')).toBe('desde 12:30 pm hasta 2:30 pm');
  });
  it('vacío si falta alguna hora', () => {
    expect(rangoHorarioTexto('12:30', '')).toBe('');
  });
});

describe('fechasLaborables', () => {
  it('excluye sábados y domingos', () => {
    // 2025-06-02 (lun) a 2025-06-06 (vie) = 5 días laborables
    expect(fechasLaborables('2025-06-02', '2025-06-06')).toHaveLength(5);
    // Incluyendo fin de semana: 2025-06-02 (lun) a 2025-06-08 (dom) = 5 laborables
    expect(fechasLaborables('2025-06-02', '2025-06-08')).toHaveLength(5);
  });
  it('un solo día laborable', () => {
    expect(fechasLaborables('2025-06-04', '2025-06-04')).toEqual(['2025-06-04']);
  });
  it('un fin de semana no aporta sesiones', () => {
    expect(fechasLaborables('2025-06-07', '2025-06-08')).toEqual([]); // sáb-dom
  });
  it('rango inválido → []', () => {
    expect(fechasLaborables('2025-06-10', '2025-06-01')).toEqual([]);
    expect(fechasLaborables('', '2025-06-01')).toEqual([]);
  });
});

describe('fechasDeIntervalos', () => {
  it('cuenta el ejemplo del usuario: L-V + L-M = 8 sesiones', () => {
    const fechas = fechasDeIntervalos([
      { desde: '2025-06-02', hasta: '2025-06-06' }, // lun-vie = 5
      { desde: '2025-06-09', hasta: '2025-06-11' }, // lun-mié = 3
    ]);
    expect(fechas).toHaveLength(8);
  });
  it('no duplica fechas solapadas entre intervalos', () => {
    const fechas = fechasDeIntervalos([
      { desde: '2025-06-02', hasta: '2025-06-04' }, // lun-mié
      { desde: '2025-06-03', hasta: '2025-06-05' }, // mar-jue → solapa mar, mié
    ]);
    expect(fechas).toEqual(['2025-06-02', '2025-06-03', '2025-06-04', '2025-06-05']);
  });
  it('ignora intervalos incompletos', () => {
    expect(fechasDeIntervalos([{ desde: '2025-06-02', hasta: '' }])).toEqual([]);
  });
});
