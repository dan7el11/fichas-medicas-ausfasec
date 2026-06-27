import { describe, it, expect } from 'vitest';
import {
  topDiagnosticos, morbilidadCapitulos, ausentismoPorArea,
  distribucionTipoPermiso, perfilMetabolico,
} from './reporteHelpers';
import type { EvaluacionMedica } from '../types';
import type { AtencionMedica } from '../types/atencion';
import type { PermisoMedico } from '../types/permiso';

const evalCon = (diags: { cie: string; descripcion: string }[]): EvaluacionMedica =>
  ({ trabajadorId: 't', fecha: new Date(), diagnosticos: diags } as unknown as EvaluacionMedica);

const atCon = (cieCodigo: string): AtencionMedica =>
  ({ cieCodigo, cieDescripcion: cieCodigo, relacion: 'Común', fecha: new Date() } as unknown as AtencionMedica);

describe('topDiagnosticos', () => {
  it('cuenta y combina diagnósticos de evaluaciones y atenciones', () => {
    const top = topDiagnosticos(
      [evalCon([{ cie: 'J00x', descripcion: 'Rinofaringitis' }])],
      [atCon('J00x'), atCon('K30x')],
    );
    const j00 = top.find((d) => d.cie === 'J00x');
    expect(j00?.n).toBe(2);
    expect(top.find((d) => d.cie === 'K30x')?.n).toBe(1);
  });

  it('ordena de mayor a menor y respeta topN', () => {
    const top = topDiagnosticos([], [atCon('A'), atCon('A'), atCon('B')], 1);
    expect(top).toHaveLength(1);
    expect(top[0].cie).toBe('A');
  });

  it('ignora diagnósticos sin código', () => {
    const top = topDiagnosticos([evalCon([{ cie: '', descripcion: 'x' }])], []);
    expect(top).toHaveLength(0);
  });
});

describe('morbilidadCapitulos', () => {
  it('agrupa por capítulo CIE-10', () => {
    const caps = morbilidadCapitulos([], [atCon('J00x'), atCon('J20x'), atCon('K30x')]);
    const resp = caps.find((c) => c.label === 'Respiratorio');
    expect(resp?.n).toBe(2);
  });
});

describe('ausentismoPorArea', () => {
  const permiso = (area: string, tipo: string, dias: number): PermisoMedico =>
    ({ area, tipo, dias, desde: new Date(), apellidos: '', nombres: '' } as unknown as PermisoMedico);

  it('suma días por área y excluye las citas', () => {
    const r = ausentismoPorArea([
      permiso('Planificación', 'reposo_interno', 3),
      permiso('Planificación', 'reposo_iess', 2),
      permiso('TTHH', 'cita', 5),
    ]);
    const plan = r.find((a) => a.area === 'Planificación');
    expect(plan?.dias).toBe(5);
    expect(plan?.nCasos).toBe(2);
    expect(r.find((a) => a.area === 'TTHH')).toBeUndefined();
  });
});

describe('distribucionTipoPermiso', () => {
  it('cuenta por tipo y suma días (sin contar citas)', () => {
    const p = (tipo: string, dias: number): PermisoMedico => ({ tipo, dias } as unknown as PermisoMedico);
    const r = distribucionTipoPermiso([p('reposo_interno', 3), p('reposo_interno', 1), p('cita', 0)]);
    const ri = r.find((x) => x.tipo === 'reposo_interno');
    expect(ri?.n).toBe(2);
    expect(ri?.dias).toBe(4);
  });
});

describe('perfilMetabolico', () => {
  const ev = (trabajadorId: string, fecha: Date, sv: any, habitos: any[] = []): EvaluacionMedica =>
    ({ trabajadorId, fecha, signosVitales: sv, habitosToxicos: habitos } as unknown as EvaluacionMedica);

  it('detecta hipertensión, sobrepeso y obesidad sobre la última evaluación de cada trabajador', () => {
    const r = perfilMetabolico([
      ev('t1', new Date('2024-01-01'), { presionSistolica: '120', presionDiastolica: '80', imc: '22' }),
      ev('t1', new Date('2025-01-01'), { presionSistolica: '150', presionDiastolica: '95', imc: '27' }), // última de t1
      ev('t2', new Date('2025-01-01'), { presionSistolica: '120', presionDiastolica: '80', imc: '32' }),
    ]);
    expect(r.nBase).toBe(2);            // dos trabajadores
    expect(r.hta.n).toBe(1);           // t1
    expect(r.sobrepeso.n).toBe(1);     // t1 (imc 27)
    expect(r.obesidad.n).toBe(1);      // t2 (imc 32)
  });

  it('cuenta consumo de tabaco', () => {
    const r = perfilMetabolico([
      ev('t1', new Date(), { presionSistolica: '120', presionDiastolica: '80', imc: '22' }, [{ tipo: 'tabaco', consume: true }]),
    ]);
    expect(r.tabaco.n).toBe(1);
  });
});
