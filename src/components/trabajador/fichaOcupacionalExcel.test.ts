import { describe, it, expect, beforeAll } from 'vitest';
import type { Workbook } from 'exceljs';
import { construirFichaExcel } from './fichaOcupacionalExcel';
import { PERFILES_RIESGO_CARGO } from '../../constants/perfilRiesgoCargo';
import { MATRIZ_RIESGOS, esFactorAnalizable } from '../../utils/catalogosEvaluacion';
import { FILAS_MINIMAS_HISTORIA_LABORAL } from '../../utils/tablasPdf';
import { BLOQUES_EXAMEN_FISICO } from '../../utils/examenFisicoOficial';

const empresa = { institucion: 'AUSTROGAS', ruc: '190070301001', ciu: '4661', establecimiento: 'MEDICINA OCUPACIONAL' };
const perfil = PERFILES_RIESGO_CARGO[0];

const ev = {
  tipoEvaluacion: 'retiro', formato: 'ocupacional-unificado',
  fechaAtencion: '2026-08-05',
  datosPersonales: { grupoSanguineo: 'O +', lateralidad: 'DERECHO', fechaNacimiento: '1982-06-15', gruposPrioritarios: ['Adulto mayor'] },
  antecedentesClinicosTexto: 'HTA en tratamiento.',
  habitosToxicos: [{ tipo: 'tabaco', consume: true, tiempoConsumo: '10 años' }],
  signosVitales: { presionSistolica: '130', presionDiastolica: '85', peso: '78', talla: '172', imc: 26.37 },
  examenFisicoHallazgos: [{ codigo: '8b', region: 'Tórax', subregion: 'Corazón', descripcion: 'soplo' }],
  factoresRiesgo: {
    puestoArea: perfil.cargo,
    actividadesJornada: perfil.actividades, actividadesResumen: perfil.actividadesResumen,
    riesgoActividades: perfil.riesgoActividades,
    medidasActividades: (perfil.medidasActividades ?? []).map(m => m.join('; ')),
  },
  antecedentesEmpleos: [{ empresa: 'AUSTROGAS', actividades: 'Funciones', tiempoMeses: '78', esActual: true }],
  diagnosticos: [{ cie: 'I10', descripcion: 'Hipertensión esencial', tipo: 'definitivo' }],
  aptitudMedica: 'aptoObservacion',
  recomendaciones: ['Dieta baja en sal'],
  retiroEvaluacionRealizada: true,
};
const trabajador = { primerApellido: 'Jiménez', primerNombre: 'José', cedula: '1204208001', sexo: 'M', puestoTrabajo: perfil.cargo };

/** Todos los textos de una hoja, para buscar por contenido. */
const textos = (wb: Workbook, hoja: string): string[] => {
  const out: string[] = [];
  wb.getWorksheet(hoja)!.eachRow(row => row.eachCell(c => {
    const v = c.value;
    if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
  }));
  return out;
};
const contarX = (wb: Workbook, hoja: string) => textos(wb, hoja).filter(t => t.trim() === 'X').length;

const H1 = '1. Datos y examen físico';
const H2 = '2. Factores de riesgo';
const H3 = '3. Historia laboral y cierre';

describe('ficha ocupacional en Excel', () => {
  let llena: Workbook;
  let plantilla: Workbook;

  beforeAll(async () => {
    llena = await construirFichaExcel({ ev, trabajador, empresa });
    plantilla = await construirFichaExcel({ empresa });
  }, 60_000);

  it('trae las tres hojas del formato más la de instrucciones', () => {
    expect(llena.worksheets.map(w => w.name)).toEqual(['Cómo usar', H1, H2, H3]);
  });

  it('cada hoja se imprime en A4 ajustada al ancho', () => {
    [H1, H2, H3].forEach(h => {
      const ps = llena.getWorksheet(h)!.pageSetup;
      expect(ps.paperSize, h).toBe(9);
      expect(ps.fitToWidth, h).toBe(1);
    });
    // La matriz de riesgos va horizontal, como la página 2 del PDF.
    expect(llena.getWorksheet(H2)!.pageSetup.orientation).toBe('landscape');
    expect(llena.getWorksheet(H1)!.pageSetup.orientation).toBe('portrait');
  });

  it('la hoja 1 lleva las secciones A a F en orden', () => {
    const t = textos(llena, H1).join('\n');
    ['A. DATOS DEL ESTABLECIMIENTO', 'B. MOTIVO DE CONSULTA', 'C. ANTECEDENTES PERSONALES',
     'D. ENFERMEDAD O PROBLEMA ACTUAL', 'E. CONSTANTES VITALES', 'F. EXAMEN FÍSICO REGIONAL',
    ].forEach(s => expect(t, s).toContain(s));
  });

  it('la hoja 3 lleva las secciones H a P', () => {
    const t = textos(llena, H3).join('\n');
    ['H. ANTECEDENTES DE EMPLEOS', 'I. ACTIVIDADES EXTRA LABORALES', 'J. RESULTADOS DE EXÁMENES',
     'K. DIAGNÓSTICO', 'L. APTITUD MÉDICA', 'M. RECOMENDACIONES', 'O. DATOS DEL PROFESIONAL',
    ].forEach(s => expect(t, s).toContain(s));
  });

  it('vuelca los datos de la evaluación', () => {
    const t1 = textos(llena, H1);
    expect(t1).toContain('Jiménez');
    expect(t1).toContain('O +');
    expect(t1).toContain('DERECHO');
    expect(t1).toContain('44');            // edad calculada
    expect(t1).toContain('130/85');        // presión arterial
    expect(t1).toContain('HTA en tratamiento.');
    expect(textos(llena, H3)).toContain('Hipertensión esencial');
  });

  it('marca el tipo de evaluación y la aptitud', () => {
    // El retiro imprime su propia sección, como en el PDF.
    expect(textos(llena, H3).join('\n')).toContain('N. RETIRO');
    expect(contarX(llena, H3)).toBeGreaterThan(0);
  });

  it('la matriz usa los mismos factores que el PDF, sin las líneas «Otros»', () => {
    const t = textos(llena, H2);
    const analizables = MATRIZ_RIESGOS.flatMap(c => c.subgrupos.flatMap(g => g.items)).filter(esFactorAnalizable);
    analizables.forEach(f => expect(t, f).toContain(f));
    expect(t.filter(x => x.startsWith('Otros'))).toEqual([]);
  });

  it('la matriz trae las actividades y sus medidas preventivas', () => {
    const t = textos(llena, H2).join('\n');
    expect(t).toContain('MEDIDAS PREVENTIVAS');
    expect(t).toContain(perfil.actividadesResumen![0]);
    expect(t).toContain(perfil.medidasActividades![0][0]);
  });

  it('el examen físico lleva las 13 regiones y marca el hallazgo', () => {
    const t = textos(llena, H1);
    BLOQUES_EXAMEN_FISICO.flatMap(b => b.regiones).forEach(r => expect(t, r.rotulo).toContain(r.rotulo));
    expect(t).toContain('b. Corazón');
    expect(contarX(llena, H1)).toBeGreaterThan(0);
  });

  it('el recuadro de historia laboral reserva sus filas', () => {
    const t = textos(llena, H3);
    expect(t).toContain('AUSTROGAS');
    // Cabecera (2 filas) + al menos las filas mínimas del recuadro.
    const hoja = llena.getWorksheet(H3)!;
    expect(hoja.rowCount).toBeGreaterThan(FILAS_MINIMAS_HISTORIA_LABORAL + 2);
  });

  it('la plantilla en blanco no trae ninguna marca ni dato del paciente', () => {
    [H1, H2, H3].forEach(h => expect(contarX(plantilla, h), h).toBe(0));
    const t = textos(plantilla, H1);
    expect(t).not.toContain('Jiménez');
    expect(t).not.toContain('O +');
    // Pero sí los rótulos del formato y los datos de la institución.
    expect(t).toContain('GRUPO SANGUÍNEO');
    expect(t).toContain('AUSTROGAS');
  });

  it('la plantilla conserva la estructura completa, igual que la llena', () => {
    [H1, H2, H3].forEach(h => {
      const rotulosLlena = textos(llena, h).filter(x => /^[A-P]\. /.test(x));
      const rotulosPlantilla = textos(plantilla, h).filter(x => /^[A-P]\. /.test(x));
      expect(rotulosPlantilla, h).toEqual(rotulosLlena);
    });
  });

  it('la hoja de instrucciones advierte que el documento oficial es el PDF', () => {
    expect(textos(llena, 'Cómo usar').join('\n')).toContain('PDF');
  });
});
