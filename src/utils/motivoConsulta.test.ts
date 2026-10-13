import { describe, it, expect } from 'vitest';
import { MOTIVO_POR_TIPO, esMotivoPropuesto, TIPOS_EVALUACION_OCUP } from './catalogosEvaluacion';

describe('motivo de consulta propuesto por tipo', () => {
  it('cubre los cuatro tipos del formato', () => {
    TIPOS_EVALUACION_OCUP.forEach(t => {
      expect(MOTIVO_POR_TIPO[t.valor], t.valor).toBeTruthy();
    });
  });

  it('cada motivo nombra de qué evaluación se trata', () => {
    expect(MOTIVO_POR_TIPO.preocupacional).toMatch(/preocupacional/i);
    expect(MOTIVO_POR_TIPO.periodica).toMatch(/periódica/i);
    expect(MOTIVO_POR_TIPO.reintegro).toMatch(/reintegro/i);
    expect(MOTIVO_POR_TIPO.retiro).toMatch(/retiro/i);
  });

  it('son frases completas, no etiquetas', () => {
    Object.values(MOTIVO_POR_TIPO).forEach(m => {
      expect(m.length).toBeGreaterThan(40);
      expect(m.endsWith('.')).toBe(true);
    });
  });

  it('no se repite el mismo motivo en dos tipos', () => {
    const valores = Object.values(MOTIVO_POR_TIPO);
    expect(new Set(valores).size).toBe(valores.length);
  });
});

describe('esMotivoPropuesto', () => {
  it('reconoce los motivos que propone el sistema', () => {
    Object.values(MOTIVO_POR_TIPO).forEach(m => expect(esMotivoPropuesto(m)).toBe(true));
  });

  it('tolera espacios alrededor', () => {
    expect(esMotivoPropuesto(`  ${MOTIVO_POR_TIPO.retiro}  `)).toBe(true);
  });

  it('no reconoce lo que redactó el médico', () => {
    // Es lo que impide que el autocompletado pise una redacción propia.
    expect(esMotivoPropuesto('Paciente refiere lumbalgia de dos semanas.')).toBe(false);
    expect(esMotivoPropuesto('')).toBe(false);
    expect(esMotivoPropuesto(`${MOTIVO_POR_TIPO.retiro} Además refiere dolor lumbar.`)).toBe(false);
  });
});
