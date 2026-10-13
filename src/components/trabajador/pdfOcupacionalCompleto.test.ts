import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import { dibujarPagina1Ocupacional } from './paginaUnoOcupacionalPdf';
import { dibujarMatrizRiesgos } from './paginaDosOcupacionalPdf';
import { dibujarPagina3Ocupacional } from './paginaTresOcupacionalPdf';
import { crearCromo } from './cromoOcupacionalPdf';
import { PERFILES_RIESGO_CARGO } from '../../constants/perfilRiesgoCargo';

const empresa = { institucion: 'AUSTROGAS', ruc: '190070301001', ciu: '4661', establecimiento: 'MEDICINA OCUPACIONAL' };
const logoPdf = { data: '', format: 'PNG' };
const fmtFecha = (f: any) => (f ? '2026-01-01' : '-');
const fmtHora = (f: any) => (f ? '09:30' : '-');

/**
 * Las tres páginas en el mismo orden que el botón de la ficha. Es el camino que
 * fallaba en silencio: cualquier excepción aquí dejaba al usuario sin visor y
 * sin aviso, porque el manejador del botón no la recogía.
 */
function generar(ev: any, trabajador: any): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cromo = crearCromo(pdf, logoPdf);

  cromo.y = dibujarPagina1Ocupacional(pdf, { ev, trabajador, empresa, logoPdf, fmtFecha } as any);

  pdf.addPage('a4', 'landscape');
  cromo.reiniciar();
  cromo.cab('Página: 2 de 3', true);
  cromo.sec('G. FACTORES DE RIESGO DEL TRABAJO ACTUAL');
  cromo.y = dibujarMatrizRiesgos(pdf, cromo.y, {
    fr: ev.factoresRiesgo || {},
    puestoTrabajo: trabajador.puestoTrabajo,
    margen: cromo.M, anchoUtil: cromo.CW,
  });

  pdf.addPage('a4', 'portrait');
  cromo.reiniciar();
  dibujarPagina3Ocupacional(pdf, cromo, { ev, trabajador, fmtFecha, fmtHora });
  return pdf;
}

const perfil = PERFILES_RIESGO_CARGO[0];
const trabajador = { primerApellido: 'Jiménez', primerNombre: 'José', cedula: '1204208001', sexo: 'M', puestoTrabajo: perfil.cargo };

/**
 * Formas reales que toma una evaluación guardada: las nuevas traen el formato
 * unificado completo, pero en Firestore siguen las de los formatos anteriores,
 * con campos ausentes, nulos o con el tipo equivocado.
 */
const guardadas: Record<string, any> = {
  'completa del formato unificado': {
    formato: 'ocupacional-unificado', tipoEvaluacion: 'retiro', fecha: { seconds: 1760000000 },
    datosPersonales: { grupoSanguineo: 'O +', lateralidad: 'DERECHO', fechaNacimiento: '1982-06-15' },
    signosVitales: { presionSistolica: '130', presionDiastolica: '85', talla: '172' },
    examenFisicoHallazgos: [{ codigo: '8b', region: 'Tórax', subregion: 'Corazón', descripcion: 'soplo' }],
    factoresRiesgo: {
      puestoArea: perfil.cargo, actividadesJornada: perfil.actividades,
      actividadesResumen: perfil.actividadesResumen, riesgoActividades: perfil.riesgoActividades,
      medidasActividades: (perfil.medidasActividades ?? []).map(m => m.join('; ')),
    },
    antecedentesEmpleos: [{ empresa: 'AUSTROGAS', actividades: 'Funciones', tiempoMeses: '78', esActual: true }],
    examenesComplementarios: [{ nombre: 'Biometría', fecha: '2026-01-02', resultado: 'Normal' }],
    diagnosticos: [{ cie: 'I10', descripcion: 'Hipertensión esencial', tipo: 'definitivo' }],
    aptitudMedica: 'aptoObservacion', recomendaciones: ['Dieta baja en sal'], retiroEvaluacionRealizada: true,
  },
  'vacía': {},
  'formato antiguo SO-RE-38': { tipo: 'PERIODICA', fecha: { seconds: 1700000000 }, signosVitales: {}, diagnosticos: [] },
  'unificada sin factoresRiesgo': { formato: 'ocupacional-unificado', tipoEvaluacion: 'periodica' },
  'factoresRiesgo vacío': { formato: 'ocupacional-unificado', factoresRiesgo: {} },
  'solo arreglos por categoría': { factoresRiesgo: { fisicos: ['Ruido'], actividades: 'Barrer; Limpiar' } },
  'actividades sin resumen': { factoresRiesgo: { actividadesJornada: ['Barrer'], riesgoActividades: { Ruido: [0] } } },
  'hallazgos nulos': { examenFisicoHallazgos: null, factoresRiesgo: {} },
  'empleos con entradas nulas': { antecedentesEmpleos: [null, { empresa: 'A' }, undefined] },
  'exámenes y diagnósticos nulos': { examenesComplementarios: [null, {}], diagnosticos: [null, { descripcion: 'X' }] },
  'colecciones con el tipo equivocado': {
    antecedentesEmpleos: 'AUSTROGAS', examenesComplementarios: {}, diagnosticos: 'I10',
    recomendaciones: 'Reposo', factoresRiesgo: {},
  },
  'muchos empleos y exámenes': {
    antecedentesEmpleos: Array.from({ length: 12 }, (_, i) => ({ empresa: `E${i}`, actividades: 'A'.repeat(200), tiempoMeses: 12 })),
    examenesComplementarios: Array.from({ length: 15 }, (_, i) => ({ nombre: `Ex${i}`, resultado: 'Normal' })),
    factoresRiesgo: {},
  },
};

describe('PDF ocupacional completo sobre evaluaciones guardadas', () => {
  Object.entries(guardadas).forEach(([nombre, ev]) => {
    it(`genera las tres páginas con una evaluación ${nombre}`, () => {
      const pdf = generar(ev, trabajador);
      // Las tres hojas del formato; las tablas largas pueden añadir alguna más.
      expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(3);
      // Y el blob del visor se puede construir, que es lo que consume el iframe.
      expect(pdf.output('blob').size).toBeGreaterThan(1000);
    });
  });

  it('también sin trabajador cargado del todo', () => {
    expect(() => generar({ factoresRiesgo: {} }, { primerApellido: 'X', primerNombre: 'Y' })).not.toThrow();
  });

  it('cubre los 42 cargos del perfil de riesgos', () => {
    PERFILES_RIESGO_CARGO.forEach(p => {
      const ev = {
        formato: 'ocupacional-unificado',
        factoresRiesgo: {
          puestoArea: p.cargo, actividadesJornada: p.actividades, actividadesResumen: p.actividadesResumen,
          riesgoActividades: p.riesgoActividades,
          medidasActividades: (p.medidasActividades ?? []).map(m => m.join('; ')),
        },
      };
      expect(() => generar(ev, { ...trabajador, puestoTrabajo: p.cargo }), p.cargo).not.toThrow();
    });
  });
});
