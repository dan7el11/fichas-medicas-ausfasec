import { describe, it, expect } from 'vitest';
import { estadoPermiso, duracionPermiso, calcularAusentismo, controlJustificativos, cuerpoCorreo, diasDePermiso } from './permisos';
import type { PermisoMedico } from '../types/permiso';

const dias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const permiso = (p: Partial<PermisoMedico>): PermisoMedico => ({
  tipo: 'reposo_interno', desde: dias(-1), hasta: dias(1), dias: 1, horas: 0, certAdjunto: false,
  apellidos: '', nombres: '', cedula: '', puesto: '', area: '', motivo: '',
  ...p,
} as unknown as PermisoMedico);

describe('duracionPermiso', () => {
  it('formatea días y horas según el tipo', () => {
    expect(duracionPermiso(permiso({ tipo: 'reposo_interno', dias: 3 }))).toBe('3 días');
    expect(duracionPermiso(permiso({ tipo: 'reposo_interno', dias: 1 }))).toBe('1 día');
    expect(duracionPermiso(permiso({ tipo: 'cita', horas: 2 }))).toBe('2 h');
  });
});

describe('estadoPermiso', () => {
  it('reposo interno vigente está activo', () => {
    expect(estadoPermiso(permiso({ tipo: 'reposo_interno', desde: dias(-1), hasta: dias(1) }))).toBe('activo');
  });
  it('reposo IESS sin certificado y reciente queda pendiente', () => {
    expect(estadoPermiso(permiso({ tipo: 'reposo_iess', certAdjunto: false, hasta: dias(-2) }))).toBe('pendiente');
  });
  it('reposo IESS sin certificado y muy vencido queda vencido', () => {
    expect(estadoPermiso(permiso({ tipo: 'reposo_iess', certAdjunto: false, hasta: dias(-20) }))).toBe('vencido');
  });
});

describe('calcularAusentismo', () => {
  it('suma días perdidos y casos de reposos recientes (excluye citas)', () => {
    const r = calcularAusentismo([
      permiso({ tipo: 'reposo_interno', dias: 3, desde: dias(-5) }),
      permiso({ tipo: 'reposo_iess', dias: 2, desde: dias(-10) }),
      permiso({ tipo: 'cita', dias: 0, desde: dias(-3) }),
    ]);
    expect(r.diasPerdidos).toBe(5);
    expect(r.nCasos).toBe(2);
    expect(r.duracionMedia).toBe('2.5');
  });
});

describe('controlJustificativos', () => {
  it('solo cuenta los permisos que requieren certificado', () => {
    const r = controlJustificativos([
      permiso({ tipo: 'reposo_iess', certAdjunto: true, hasta: dias(1) }),
      permiso({ tipo: 'reposo_iess', certAdjunto: false, hasta: dias(-2) }),
      permiso({ tipo: 'reposo_interno' }), // no requiere certificado → no cuenta
    ]);
    expect(r.total).toBe(2);
    expect(r.conCert).toBe(1);
  });
});

describe('diasDePermiso', () => {
  it('misma fecha de inicio y fin cuenta como 1 día', () => {
    const f = new Date('2026-03-10T08:00:00');
    expect(diasDePermiso(permiso({ dias: 0, desde: f, hasta: f }))).toBe(1);
  });
  it('rango de 3 días naturales cuenta 3 (inclusivo)', () => {
    expect(diasDePermiso(permiso({ dias: 0, desde: new Date('2026-03-10T08:00:00'), hasta: new Date('2026-03-12T08:00:00') }))).toBe(3);
  });
  it('respeta el campo dias cuando está registrado', () => {
    expect(diasDePermiso(permiso({ dias: 5 }))).toBe(5);
  });
});

describe('cuerpoCorreo', () => {
  it('por horas: incluye el conteo de horas y el inicio y fin del permiso', () => {
    const txt = cuerpoCorreo(permiso({
      tipo: 'reposo_interno', unidad: 'horas', dias: 0, horas: 2,
      horaDesde: '12:30', horaHasta: '14:30',
      desde: new Date('2026-03-10T08:00:00'), hasta: new Date('2026-03-10T08:00:00'),
    } as any));
    expect(txt).toContain('Horas otorgadas:  2');
    expect(txt).toContain('Hora de inicio:  12:30 pm');
    expect(txt).toContain('Hora de finalización:  2:30 pm');
    expect(txt).toContain('el mismo día');
    expect(txt).not.toContain('Días de reposo');
  });
  it('por días: cuenta inclusiva y sin bloque de horas', () => {
    const txt = cuerpoCorreo(permiso({
      dias: 0, desde: new Date('2026-03-10T08:00:00'), hasta: new Date('2026-03-10T08:00:00'),
    }));
    expect(txt).toContain('Días de reposo otorgados:  1');
    expect(txt).not.toContain('Horas otorgadas');
  });
});
