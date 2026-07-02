import { describe, it, expect } from 'vitest';
import { parrafosInterpretacion } from './interpretacion';
import type { EvaluacionErgonomica } from '../../types/ergonomia';

const evBase = (extra: Partial<EvaluacionErgonomica>): EvaluacionErgonomica => ({
  trabajadorId: 't1', apellidos: 'Pérez', nombres: 'Ana', cedula: '1712345678',
  puesto: 'Asistente', area: 'TTHH', fecha: new Date(), tarea: 'Trabajo en computador',
  entradas: {}, fotos: [], observaciones: '', recomendaciones: '',
  medicoId: 'm', medicoNombre: 'Dr. X', createdAt: new Date(),
  metodo: 'ROSA',
  resultado: { metodo: 'ROSA', puntajeFinal: 6, nivel: 'Alto', accion: 'Intervenir.', tone: 'danger', detalle: {} },
  ...extra,
} as EvaluacionErgonomica);

describe('parrafosInterpretacion', () => {
  it('ROSA: explica la escala, el puntaje y el componente dominante (silla)', () => {
    const ev = evBase({
      resultado: { metodo: 'ROSA', puntajeFinal: 6, nivel: 'Alto', accion: 'Intervenir.', tone: 'danger',
        detalle: { silla: 6, monitorTelefono: 3, ratonTeclado: 2, perifericos: 3 } },
    });
    const p = parrafosInterpretacion(ev);
    expect(p.length).toBeGreaterThanOrEqual(3);
    expect(p[0]).toContain('ROSA');
    expect(p[1]).toContain('6');
    expect(p[2]).toContain('silla');
  });

  it('ROSA: identifica ratón/teclado como dominante cuando corresponde', () => {
    const ev = evBase({
      resultado: { metodo: 'ROSA', puntajeFinal: 7, nivel: 'Alto', accion: 'Intervenir.', tone: 'danger',
        detalle: { silla: 3, monitorTelefono: 4, ratonTeclado: 7, perifericos: 7 } },
    });
    const p = parrafosInterpretacion(ev);
    expect(p[2]).toContain('ratón');
  });

  it('NIOSH: menciona RWL, carga real y recomendaciones de rediseño', () => {
    const ev = evBase({
      metodo: 'NIOSH', entradas: { pesoCarga: 20 },
      resultado: { metodo: 'NIOSH', puntajeFinal: 1.85, nivel: 'Riesgo aumentado', accion: 'Rediseñar.', tone: 'warning',
        detalle: { RWL: 10.8, LI: 1.85 } },
    });
    const p = parrafosInterpretacion(ev);
    expect(p[1]).toContain('10.8');
    expect(p[1]).toContain('20');
    expect(p.some((x) => x.includes('multiplicador'))).toBe(true);
  });

  it('RULA: señala el grupo dominante', () => {
    const ev = evBase({
      metodo: 'RULA',
      resultado: { metodo: 'RULA', puntajeFinal: 5, nivel: 'Medio', accion: 'Cambiar pronto.', tone: 'warning',
        detalle: { posturaA: 4, puntajeA: 5, posturaB: 3, puntajeB: 3 } },
    });
    const p = parrafosInterpretacion(ev);
    expect(p[2]).toContain('grupo A');
  });

  it('menciona las fotos adjuntas cuando existen', () => {
    const ev = evBase({ fotos: [{ url: 'u', path: 'p', nombre: 'f.jpg', mediciones: [{ etiqueta: 'Codo', valor: '95°' }] }] });
    const p = parrafosInterpretacion(ev);
    expect(p[p.length - 1]).toContain('fotografía');
  });
});
