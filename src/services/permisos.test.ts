import { describe, it, expect } from 'vitest';
import { estadoPermiso, duracionPermiso, calcularAusentismo, controlJustificativos } from './permisos';
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
