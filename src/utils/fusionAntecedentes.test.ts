import { describe, it, expect } from 'vitest';
import { fusionarAntecedentes } from './fusionAntecedentes';
import type { ExpedienteAntecedentes } from '../types';

describe('fusionarAntecedentes (secuencial, formato unificado)', () => {
  it('crea el expediente desde cero en la primera evaluación', () => {
    const r = fusionarAntecedentes(null, {
      trabajadorId: 'T1',
      antecedentesClinicosTexto: 'Hipertensión arterial en tratamiento con Enalapril.',
    });
    expect(r.trabajadorId).toBe('T1');
    expect(r.antecedentesClinicosTexto).toContain('Hipertensión');
  });

  it('actualiza el texto cuando la evaluación nueva lo trae, y lo conserva cuando no', () => {
    const previo: ExpedienteAntecedentes = { trabajadorId: 'T1', antecedentesClinicosTexto: 'HTA.' };
    const r1 = fusionarAntecedentes(previo, { antecedentesFamiliaresTexto: 'Madre diabética.' });
    expect(r1.antecedentesClinicosTexto).toBe('HTA.');              // se conserva
    expect(r1.antecedentesFamiliaresTexto).toBe('Madre diabética.'); // se añade
    const r2 = fusionarAntecedentes(previo, { antecedentesClinicosTexto: 'HTA + DM2.' });
    expect(r2.antecedentesClinicosTexto).toBe('HTA + DM2.');         // gana el nuevo
  });

  it('acumula empleos anteriores sin duplicar', () => {
    const previo: ExpedienteAntecedentes = {
      trabajadorId: 'T1',
      antecedentesEmpleos: [{ empresa: 'ACME', puesto: 'Soldador' } as any],
    };
    const r = fusionarAntecedentes(previo, {
      antecedentesEmpleos: [
        { empresa: 'acme', puesto: 'soldador', observaciones: 'act.' } as any, // dup → actualiza
        { empresa: 'Otra', puesto: 'Chofer' } as any,                          // nuevo
      ],
    });
    expect(r.antecedentesEmpleos).toHaveLength(2);
  });

  it('conserva gineco y hábitos si la evaluación nueva no los trae', () => {
    const previo: ExpedienteAntecedentes = {
      trabajadorId: 'T1',
      antecedentesGineco: { gestas: '2' } as any,
      habitosToxicos: [{ tipo: 'tabaco', consume: true }] as any,
    };
    const r = fusionarAntecedentes(previo, {});
    expect(r.antecedentesGineco).toMatchObject({ gestas: '2' });
    expect(r.habitosToxicos?.[0]).toMatchObject({ consume: true });
  });

  it('conserva el detalle clínico cuando la evaluación nueva no responde el bloque', () => {
    const previo: ExpedienteAntecedentes = {
      trabajadorId: 'T1',
      antecedentesClinicosQ: true,
      antecedentesClinicosLista: [{ enfermedad: 'HTA' } as any],
    };
    const r = fusionarAntecedentes(previo, { antecedentesFamiliaresTexto: 'Padre HTA.' });
    expect(r.antecedentesClinicosQ).toBe(true);
    expect(r.antecedentesClinicosLista).toHaveLength(1);
  });

  it('un «No» explícito vacía la lista heredada de ese bloque', () => {
    const previo: ExpedienteAntecedentes = {
      trabajadorId: 'T1',
      antecedentesQuirurgicosQ: true,
      antecedentesQuirurgicosLista: [{ procedimiento: 'Apendicectomía' } as any],
    };
    const r = fusionarAntecedentes(previo, { antecedentesQuirurgicosQ: false, antecedentesQuirurgicosLista: [] });
    expect(r.antecedentesQuirurgicosQ).toBe(false);
    expect(r.antecedentesQuirurgicosLista).toEqual([]);
  });

  it('el detalle nuevo reemplaza al anterior en el mismo bloque', () => {
    const previo: ExpedienteAntecedentes = {
      trabajadorId: 'T1',
      alergiasTiene: true,
      alergias: [{ alergeno: 'polen' } as any],
    };
    const r = fusionarAntecedentes(previo, { alergiasTiene: true, alergias: [{ alergeno: 'penicilina' } as any] });
    expect(r.alergias).toHaveLength(1);
    expect(r.alergias?.[0]).toMatchObject({ alergeno: 'penicilina' });
  });

  it('actualiza datos personales cuando vienen informados', () => {
    const previo: ExpedienteAntecedentes = { trabajadorId: 'T1', datosPersonales: { grupoSanguineo: 'O+' } as any };
    const r = fusionarAntecedentes(previo, { datosPersonales: { grupoSanguineo: 'A+' } as any });
    expect(r.datosPersonales).toMatchObject({ grupoSanguineo: 'A+' });
  });
});
