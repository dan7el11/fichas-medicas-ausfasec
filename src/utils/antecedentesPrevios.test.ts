import { describe, it, expect } from 'vitest';
import { combinarAntecedentes, ordenarEvaluacionesDesc } from './antecedentesPrevios';

const f = (dias: number) => ({ seconds: 1_700_000_000 + dias * 86400, nanoseconds: 0 });

describe('ordenarEvaluacionesDesc', () => {
  it('ordena de la más reciente a la más antigua', () => {
    const evals = [{ id: 'a', fecha: f(1) }, { id: 'b', fecha: f(10) }, { id: 'c', fecha: f(5) }];
    expect(ordenarEvaluacionesDesc(evals).map(e => e.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('combinarAntecedentes', () => {
  it('añade antecedentes nuevos sin borrar los antiguos', () => {
    const preocupacional = {
      fecha: f(0),
      antecedentesClinicosQ: true,
      antecedentesClinicosLista: [{ enfermedad: 'Hipertensión arterial', desdeCuando: '2019' }],
    };
    const periodica = {
      fecha: f(30),
      antecedentesClinicosQ: true,
      antecedentesClinicosLista: [{ enfermedad: 'Diabetes tipo II', desdeCuando: '2024' }],
    };
    const m = combinarAntecedentes([preocupacional, periodica]);
    expect(m.antecedentesClinicosQ).toBe(true);
    expect(m.antecedentesClinicosLista.map(a => a.enfermedad).sort()).toEqual(['Diabetes tipo II', 'Hipertensión arterial']);
  });

  it('no duplica y conserva la versión más reciente del mismo antecedente', () => {
    const vieja = {
      fecha: f(0),
      antecedentesClinicosLista: [{ enfermedad: 'Hipertensión Arterial', medicacionNombre: 'Enalapril' }],
    };
    const nueva = {
      fecha: f(60),
      antecedentesClinicosLista: [{ enfermedad: 'hipertensión arterial', medicacionNombre: 'Losartán' }],
    };
    const m = combinarAntecedentes([vieja, nueva]);
    expect(m.antecedentesClinicosLista).toHaveLength(1);
    expect(m.antecedentesClinicosLista[0].medicacionNombre).toBe('Losartán');
  });

  it('deduplica alergias, quirúrgicos, familiares y empleos por su clave', () => {
    const a = {
      fecha: f(0),
      alergias: [{ alergeno: 'Penicilina' }],
      antecedentesQuirurgicosLista: [{ procedimiento: 'Apendicectomía' }],
      antecedentesFamiliares: [{ tipo: 'Enfermedad Metabólica', parentesco: 'Madre', descripcion: 'Diabetes' }],
      antecedentesEmpleos: [{ empresa: 'ACME', puesto: 'Soldador' }],
    };
    const b = {
      fecha: f(10),
      alergias: [{ alergeno: 'penicilina' }, { alergeno: 'Mariscos' }],
      antecedentesQuirurgicosLista: [{ procedimiento: 'APENDICECTOMÍA' }],
      antecedentesFamiliares: [
        { tipo: 'Enfermedad Metabólica', parentesco: 'Madre', descripcion: 'Diabetes' },
        { tipo: 'Enfermedad Metabólica', parentesco: 'Padre', descripcion: 'Diabetes' },
      ],
      antecedentesEmpleos: [{ empresa: 'acme', puesto: 'soldador' }],
    };
    const m = combinarAntecedentes([a, b]);
    expect(m.alergias).toHaveLength(2);
    expect(m.antecedentesQuirurgicosLista).toHaveLength(1);
    expect(m.antecedentesFamiliares).toHaveLength(2);
    expect(m.antecedentesEmpleos).toHaveLength(1);
  });

  it('respeta la respuesta explícita "No" más reciente cuando no hay entradas', () => {
    const m = combinarAntecedentes([
      { fecha: f(0), antecedentesClinicosQ: true, antecedentesClinicosLista: [] },
      { fecha: f(5), antecedentesClinicosQ: false, antecedentesClinicosLista: [] },
    ]);
    expect(m.antecedentesClinicosQ).toBe(false);
  });

  it('toma hábitos, gineco, edad de inicio laboral y talla de la evaluación más reciente que los tenga', () => {
    const m = combinarAntecedentes([
      { fecha: f(0), habitosToxicos: [{ tipo: 'tabaco', consume: true }], edadInicioLaboral: '18', antecedentesGineco: { gestas: '2' }, signosVitales: { talla: '165' } },
      { fecha: f(20), habitosToxicos: [], signosVitales: { talla: '' } },
    ]);
    expect(m.habitosToxicos?.[0]).toMatchObject({ tipo: 'tabaco', consume: true });
    expect(m.edadInicioLaboral).toBe('18');
    expect(m.antecedentesGineco).toMatchObject({ gestas: '2' });
    expect(m.talla).toBe('165');
  });

  it('devuelve vacíos/null cuando no hay evaluaciones', () => {
    const m = combinarAntecedentes([]);
    expect(m.antecedentesClinicosQ).toBeNull();
    expect(m.antecedentesClinicosLista).toEqual([]);
    expect(m.habitosToxicos).toBeNull();
  });
});
