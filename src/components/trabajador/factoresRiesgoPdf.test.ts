import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import { dibujarFactoresRiesgoPdf } from './factoresRiesgoPdf';
import { RIESGOS_PSICOSOCIALES } from '../../utils/catalogosEvaluacion';

const fr = {
  puestoArea: 'Operador de planta',
  actividades: 'Envasado de GLP',
  tiempoTrabajoMeses: '24',
  fisicos: ['Ruido', 'Vibración'],
  mecanicos: ['Caída de objetos'],
  quimicos: ['Gaseosos'],
  biologicos: [],
  ergonomicos: ['Posturas forzadas'],
  psicosociales: ['Turnos rotativos'],
  medidasPreventivas: 'Uso de EPP',
};

describe('dibujarFactoresRiesgoPdf', () => {
  it('dibuja las dos tablas sin fallar y avanza la posición vertical', () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const y = dibujarFactoresRiesgoPdf(pdf, fr, { M: 7, CW: 196, y: 20, puestoDefault: 'Operador' });
    expect(y).toBeGreaterThan(20);
  });

  it('el encabezado rotado es al menos tan alto como el rótulo más largo (una sola línea, sin desbordes)', () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    pdf.setFontSize(4.6); pdf.setFont('helvetica', 'normal');
    const masLargo = Math.max(...RIESGOS_PSICOSOCIALES.map(t => pdf.getTextWidth(t)));

    const y0 = 20;
    const yFinal = dibujarFactoresRiesgoPdf(pdf, fr, { M: 7, CW: 196, y: y0, puestoDefault: '', filas: 3, altoFila: 5 });
    // Dos tablas: cada una debe medir al menos (rótulo más largo + grupos + filas).
    const minimoPorTabla = masLargo + 4 + 5 + 3 * 5;
    expect(yFinal - y0).toBeGreaterThanOrEqual(2 * minimoPorTabla);
  });

  it('respeta el alto mínimo pedido para estirar la tabla (formato preocupacional)', () => {
    const pdf1 = new jsPDF({ unit: 'mm', format: 'a4' });
    const normal = dibujarFactoresRiesgoPdf(pdf1, fr, { M: 7, CW: 196, y: 20, puestoDefault: '', filas: 3, altoFila: 5 }) - 20;
    const pdf2 = new jsPDF({ unit: 'mm', format: 'a4' });
    const estirada = dibujarFactoresRiesgoPdf(pdf2, fr, { M: 7, CW: 196, y: 20, puestoDefault: '', filas: 3, altoFila: 5, altoEncabezado: 60 }) - 20;
    expect(estirada).toBeGreaterThan(normal);
  });

  it('ambos recuadros quedan en la misma página (regresión: la 2ª tabla saltaba a una página huérfana)', () => {
    // Caso real del SO-RE-38: la sección E empieza cerca de los 167 mm y los
    // dos recuadros compactos (2 filas) caben hasta los 285 mm. El margen
    // inferior por defecto de autotable (40 mm) partía la segunda tabla.
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    dibujarFactoresRiesgoPdf(pdf, fr, { M: 7, CW: 196, y: 167, puestoDefault: 'Chofer', filas: 2, altoFila: 5 });
    expect(pdf.getNumberOfPages()).toBe(1);
  });

  it('si no caben los dos recuadros, ambos pasan JUNTOS a la página siguiente', () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const yFinal = dibujarFactoresRiesgoPdf(pdf, fr, { M: 7, CW: 196, y: 250, puestoDefault: 'Chofer', filas: 2, altoFila: 5 });
    expect(pdf.getNumberOfPages()).toBe(2);
    // Ambas tablas dibujadas en la página nueva: la posición final queda muy
    // por debajo del alto de las dos tablas juntas desde el inicio de página.
    expect(yFinal).toBeGreaterThan(80);
    expect(yFinal).toBeLessThan(285);
  });

  it('no marca X para factores no seleccionados (humo: evaluación vacía)', () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const y = dibujarFactoresRiesgoPdf(pdf, undefined, { M: 7, CW: 196, y: 20, puestoDefault: 'Puesto' });
    expect(y).toBeGreaterThan(20);
  });
});
