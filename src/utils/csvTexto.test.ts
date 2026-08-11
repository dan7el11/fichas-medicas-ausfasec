import { describe, it, expect } from 'vitest';
import { leerCsv, campo, siNo, soloNumero, normalizarFechaCsv, convertirCsv } from './csvTexto';

describe('leerCsv', () => {
  it('parte por punto y coma y limpia espacios', () => {
    const f = leerCsv(' ACME ; Soldadura ; 18 ');
    expect(f).toHaveLength(1);
    expect(f[0].campos).toEqual(['ACME', 'Soldadura', '18']);
  });
  it('ignora líneas en blanco y conserva el nº de línea real', () => {
    const f = leerCsv('A;B\n\n\nC;D');
    expect(f.map(x => x.linea)).toEqual([1, 4]);
  });
  it('descarta el encabezado si lo pegaron junto a los datos', () => {
    const f = leerCsv('Empresa;actividades;tiempo\nACME;Soldadura;18');
    expect(f).toHaveLength(1);
    expect(f[0].campos[0]).toBe('ACME');
  });
  it('no confunde un dato con el encabezado si va después', () => {
    const f = leerCsv('ACME;Soldadura\nEmpresa X;Otra cosa');
    expect(f).toHaveLength(2);
  });
});

describe('campo', () => {
  it('devuelve cadena vacía si la línea venía corta', () => {
    const f = leerCsv('ACME;Soldadura')[0];
    expect(campo(f, 1)).toBe('Soldadura');
    expect(campo(f, 7)).toBe('');
  });
});

describe('siNo', () => {
  it('reconoce las formas afirmativas habituales', () => {
    ['si', 'Sí', 'SI', 's', 'x', 'X', '1', 'true'].forEach(v => expect(siNo(v), v).toBe(true));
  });
  it('todo lo demás es no', () => {
    ['no', 'N', '', '0', 'false', 'quizá'].forEach(v => expect(siNo(v), v).toBe(false));
  });
});

describe('soloNumero', () => {
  it('extrae el número de un texto libre', () => {
    expect(soloNumero('18 meses')).toBe('18');
    expect(soloNumero('2,5 años')).toBe('2.5');
    expect(soloNumero('sin dato')).toBe('');
  });
});

describe('normalizarFechaCsv', () => {
  it('acepta los formatos usuales y los deja en aaaa-mm-dd', () => {
    expect(normalizarFechaCsv('2026-03-05')).toBe('2026-03-05');
    expect(normalizarFechaCsv('05/03/2026')).toBe('2026-03-05');
    expect(normalizarFechaCsv('5-3-2026')).toBe('2026-03-05');
  });
  it('rechaza días que no existen', () => {
    expect(normalizarFechaCsv('31/02/2026')).toBe('');
    expect(normalizarFechaCsv('2026-13-01')).toBe('');
  });
  it('devuelve vacío si no hay fecha', () => {
    expect(normalizarFechaCsv('')).toBe('');
    expect(normalizarFechaCsv('marzo')).toBe('');
  });
});

describe('convertirCsv', () => {
  it('separa los registros buenos de las advertencias', () => {
    const r = convertirCsv<{ n: string }>('A;1\nB\nC;3', f =>
      f.campos.length < 2 ? 'faltan campos' : { n: campo(f, 0) });
    expect(r.registros.map(x => x.n)).toEqual(['A', 'C']);
    expect(r.advertencias).toEqual(['Línea 2: faltan campos']);
  });
  it('sin texto no devuelve nada ni se queja', () => {
    const r = convertirCsv('', () => 'nunca');
    expect(r.registros).toEqual([]);
    expect(r.advertencias).toEqual([]);
  });
});
