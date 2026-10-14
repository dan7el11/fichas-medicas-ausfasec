import { describe, it, expect } from 'vitest';
import { aFecha, aDia, fechaDeAtencion, fechaPorCorregir } from './fechaEvaluacion';

const ts = (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 });

describe('fecha de una evaluación', () => {
  it('toma el día elegido y conserva la hora de la atención original', () => {
    const original = new Date(2025, 9, 9, 8, 53);   // 9 oct 2025, 08:53
    const nueva = fechaDeAtencion('2025-10-02', ts(original));
    expect(aDia(nueva)).toBe('2025-10-02');
    expect([nueva.getHours(), nueva.getMinutes()]).toEqual([8, 53]);
  });

  it('en una evaluación nueva usa la hora de ahora', () => {
    const ahora = new Date(2026, 9, 14, 15, 30);
    const f = fechaDeAtencion('2026-10-10', undefined, ahora);
    expect(aDia(f)).toBe('2026-10-10');
    expect([f.getHours(), f.getMinutes()]).toEqual([15, 30]);
  });

  it('trabaja con el día local, no el de UTC', () => {
    // A las 21:00 en Ecuador ya es el día siguiente en UTC.
    const noche = new Date(2026, 9, 14, 21, 0);
    expect(aDia(fechaDeAtencion('2026-10-14', undefined, noche))).toBe('2026-10-14');
  });

  it('sin un día válido deja la fecha que había', () => {
    const original = new Date(2025, 0, 5, 10, 0);
    expect(fechaDeAtencion('', ts(original)).getTime()).toBe(original.getTime());
    expect(fechaDeAtencion('5/1/2025', ts(original)).getTime()).toBe(original.getTime());
  });

  it('entiende lo que guarda Firestore', () => {
    const d = new Date(2025, 4, 6, 7, 8);
    expect(aFecha(ts(d))?.getTime()).toBe(Math.floor(d.getTime() / 1000) * 1000);
    expect(aFecha({ toDate: () => d })).toBe(d);
    expect(aFecha(d)).toBe(d);
    expect(aDia(aFecha('2025-05-06')!)).toBe('2025-05-06');
    expect(aFecha(null)).toBeNull();
    expect(aFecha('no es fecha')).toBeNull();
  });

  describe('evaluaciones guardadas antes del arreglo', () => {
    it('corrige la que muestra el día de creación y no el de atención', () => {
      // Creada el 9, con la fecha de atención cambiada luego al 2.
      const ev = { fechaAtencion: '2025-10-02', fecha: ts(new Date(2025, 9, 9, 8, 53)) };
      const nueva = fechaPorCorregir(ev)!;
      expect(aDia(nueva)).toBe('2025-10-02');
      expect([nueva.getHours(), nueva.getMinutes()]).toEqual([8, 53]);
    });

    it('deja en paz la que ya coincide', () => {
      expect(fechaPorCorregir({ fechaAtencion: '2025-10-09', fecha: ts(new Date(2025, 9, 9, 8, 53)) })).toBeNull();
    });

    it('y las de formatos sin fecha de atención', () => {
      expect(fechaPorCorregir({ tipo: 'PERIODICA', fecha: ts(new Date(2025, 9, 9)) })).toBeNull();
      expect(fechaPorCorregir({ fechaAtencion: '', fecha: ts(new Date(2025, 9, 9)) })).toBeNull();
    });

    it('sin fecha guardada, usa la de creación para la hora', () => {
      const ev = { fechaAtencion: '2025-10-02', createdAt: ts(new Date(2025, 9, 9, 11, 15)) };
      const nueva = fechaPorCorregir(ev)!;
      expect(aDia(nueva)).toBe('2025-10-02');
      expect(nueva.getHours()).toBe(11);
    });
  });
});
