import { describe, it, expect } from 'vitest';
import {
  fraseTiempo, fraseClinico, fraseQuirurgico, fraseAlergia,
  resumirAntecedentes, TEXTO_SIN_ANTECEDENTES,
} from './resumenAntecedentes';
import type { AntecedenteClinico, AntecedenteQuirurgico, Alergia } from '../types';

const clinico = (p: Partial<AntecedenteClinico> = {}): AntecedenteClinico => ({
  enfermedad: '', desdeCuando: '', tomaMedicacion: false, medicacionNombre: '',
  medicacionDosis: '', medicacionFrecuencia: '', seguimientoEspecialista: false,
  especialista: '', complicaciones: '', ...p,
});
const quirurgico = (p: Partial<AntecedenteQuirurgico> = {}): AntecedenteQuirurgico => ({
  procedimiento: '', fechaAproximada: '', complicaciones: '', recuperacionCompleta: true, secuelas: '', ...p,
});
const alergia = (p: Partial<Alergia> = {}): Alergia => ({
  alergeno: '', intensidadReaccion: '', sintomas: '', tratamientoHabitual: '',
  seguimientoEspecialista: false, especialista: '', ...p,
});

describe('fraseTiempo', () => {
  it('trata una duración como «desde hace»', () => {
    expect(fraseTiempo('6 años')).toBe('desde hace 6 años');
  });
  it('trata un año suelto como «desde»', () => {
    expect(fraseTiempo('2018')).toBe('desde 2018');
  });
  it('respeta el texto que ya trae preposición', () => {
    expect(fraseTiempo('desde la infancia')).toBe('desde la infancia');
    expect(fraseTiempo('hace 3 meses')).toBe('desde hace 3 meses');
  });
  it('devuelve vacío si no hay dato', () => {
    expect(fraseTiempo('')).toBe('');
    expect(fraseTiempo(undefined)).toBe('');
  });
});

describe('fraseClinico', () => {
  it('arma la línea del ejemplo clínico completo', () => {
    const f = fraseClinico(clinico({
      enfermedad: 'HTA', desdeCuando: '6 años', tomaMedicacion: true,
      medicacionNombre: 'Losartán', medicacionDosis: '50 mg', medicacionFrecuencia: 'cada día',
      adherencia: 'buena',
    } as any));
    expect(f).toBe('HTA desde hace 6 años, en tratamiento con Losartán 50 mg cada día, con buena adherencia');
  });
  it('indica cuando no hay tratamiento', () => {
    expect(fraseClinico(clinico({ enfermedad: 'Gastritis' }))).toBe('Gastritis, sin tratamiento farmacológico');
  });
  it('añade seguimiento y complicaciones', () => {
    const f = fraseClinico(clinico({
      enfermedad: 'DM2', seguimientoEspecialista: true, especialista: 'Endocrinología',
      complicaciones: 'hospitalización en 2023',
    }));
    expect(f).toContain('en seguimiento por Endocrinología');
    expect(f).toContain('complicaciones: hospitalización en 2023');
  });
  it('ignora complicaciones dichas como «ninguna»', () => {
    expect(fraseClinico(clinico({ enfermedad: 'Asma', complicaciones: 'Ninguna' }))).not.toContain('complicaciones');
  });
  it('descarta el antecedente sin enfermedad', () => {
    expect(fraseClinico(clinico({ desdeCuando: '2 años' }))).toBe('');
  });
});

describe('fraseQuirurgico', () => {
  it('arma la línea con fecha y recuperación completa', () => {
    expect(fraseQuirurgico(quirurgico({ procedimiento: 'Apendicectomía', fechaAproximada: '2019' })))
      .toBe('Apendicectomía (2019), sin complicaciones, recuperación completa');
  });
  it('detalla las secuelas cuando la recuperación no fue completa', () => {
    const f = fraseQuirurgico(quirurgico({
      procedimiento: 'Meniscectomía', recuperacionCompleta: false, secuelas: 'dolor residual',
    }));
    expect(f).toContain('con secuelas: dolor residual');
  });
  it('descarta el antecedente sin procedimiento', () => {
    expect(fraseQuirurgico(quirurgico({ fechaAproximada: '2019' }))).toBe('');
  });
});

describe('fraseAlergia', () => {
  it('incluye alérgeno, intensidad, síntomas y tratamiento', () => {
    const f = fraseAlergia(alergia({
      alergeno: 'penicilina', intensidadReaccion: 'severa', sintomas: 'urticaria',
      tratamientoHabitual: 'antihistamínico',
    }));
    expect(f).toBe('Alergia a penicilina (severa), urticaria, tratada con antihistamínico');
  });
  it('descarta la alergia sin alérgeno', () => {
    expect(fraseAlergia(alergia({ sintomas: 'rinitis' }))).toBe('');
  });
});

describe('resumirAntecedentes', () => {
  it('usa el texto genérico cuando los tres bloques son No', () => {
    expect(resumirAntecedentes({ clinicosQ: false, quirurgicosQ: false, alergiasQ: false }))
      .toBe(TEXTO_SIN_ANTECEDENTES);
  });
  it('devuelve vacío si no se respondió nada', () => {
    expect(resumirAntecedentes({})).toBe('');
  });
  it('une los tres bloques en una sola línea terminada en punto', () => {
    const texto = resumirAntecedentes({
      clinicosQ: true,
      clinicos: [clinico({ enfermedad: 'HTA', desdeCuando: '6 años', tomaMedicacion: true, medicacionNombre: 'Losartán', adherencia: 'buena' } as any)],
      alergiasQ: true,
      alergias: [alergia({ alergeno: 'penicilina' })],
      quirurgicosQ: true,
      quirurgicos: [quirurgico({ procedimiento: 'Apendicectomía', fechaAproximada: '2019' })],
    });
    expect(texto).toBe(
      'HTA desde hace 6 años, en tratamiento con Losartán, con buena adherencia; ' +
      'Alergia a penicilina; ' +
      'Apendicectomía (2019), sin complicaciones, recuperación completa.',
    );
  });
  it('deja constancia de los bloques negados cuando otros sí tienen detalle', () => {
    const texto = resumirAntecedentes({
      clinicosQ: true, clinicos: [clinico({ enfermedad: 'Asma' })],
      quirurgicosQ: false, alergiasQ: false,
    });
    expect(texto).toContain('no refiere antecedentes alergias ni quirúrgicos');
  });
  it('ignora las filas vacías del formulario', () => {
    expect(resumirAntecedentes({ clinicosQ: true, clinicos: [clinico()] })).toBe('');
  });
});
