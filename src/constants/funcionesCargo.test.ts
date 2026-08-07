import { describe, it, expect } from 'vitest';
import {
  PERFILES_CARGO, perfilDeCargo, funcionesDeCargo, CARGOS_CATALOGO,
  FUNCIONES_AUTOCOMPLETAR, MAX_ACTIVIDADES, CARGOS, buscarCargos, cargoPorNombre,
  normalizarBusqueda,
} from './funcionesCargo';
import { MATRIZ_RIESGOS } from '../utils/catalogosEvaluacion';

describe('catálogo de funciones por cargo', () => {
  it('carga los perfiles del consolidado institucional', () => {
    expect(PERFILES_CARGO.length).toBeGreaterThanOrEqual(40);
    expect(CARGOS_CATALOGO.length).toBe(PERFILES_CARGO.length);
    PERFILES_CARGO.forEach(p => {
      expect(p.cargo.trim()).not.toBe('');
      expect(p.funciones.length).toBeGreaterThan(0);
    });
  });

  it('encuentra el cargo aunque cambien tildes o mayúsculas', () => {
    const uno = PERFILES_CARGO[0];
    const variante = uno.cargo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    expect(perfilDeCargo(variante)?.cargo).toBe(uno.cargo);
    expect(perfilDeCargo(uno.cargo)?.cargo).toBe(uno.cargo);
  });

  it('devuelve las primeras 6 funciones como actividades sugeridas', () => {
    const conMuchas = PERFILES_CARGO.find(p => p.funciones.length > FUNCIONES_AUTOCOMPLETAR)!;
    const sug = funcionesDeCargo(conMuchas.cargo);
    expect(sug).toHaveLength(FUNCIONES_AUTOCOMPLETAR);
    expect(sug[0]).toBe(conMuchas.funciones[0]);
    // Nunca más actividades de las que admite la matriz oficial.
    expect(funcionesDeCargo(conMuchas.cargo, 20).length).toBeLessThanOrEqual(20);
    expect(FUNCIONES_AUTOCOMPLETAR).toBeLessThanOrEqual(MAX_ACTIVIDADES);
  });

  it('devuelve vacío para un cargo desconocido', () => {
    expect(funcionesDeCargo('CARGO QUE NO EXISTE XYZ')).toEqual([]);
    expect(perfilDeCargo('')).toBeNull();
  });
});

describe('buscador de cargos', () => {
  it('asigna un código único a cada cargo', () => {
    expect(CARGOS.length).toBe(PERFILES_CARGO.length);
    const codigos = CARGOS.map(c => c.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    codigos.forEach(c => expect(c).toMatch(/^[A-Z]{3,4}-\d{2}$/));
  });

  it('normaliza tildes, espacios y signos', () => {
    expect(normalizarBusqueda('TÉCNICO/A DE SEGURIDAD')).toBe('tecnicodeseguridad');
    expect(normalizarBusqueda('  env-03 ')).toBe('env03');
  });

  it('encuentra por nombre sin tildes ni espacios', () => {
    const uno = CARGOS[0];
    const tecleado = normalizarBusqueda(uno.cargo).slice(0, 8);
    expect(buscarCargos(tecleado).map(c => c.codigo)).toContain(uno.codigo);
  });

  it('encuentra por código, con o sin guion', () => {
    const uno = CARGOS[3];
    expect(buscarCargos(uno.codigo)[0].codigo).toBe(uno.codigo);
    expect(buscarCargos(uno.codigo.replace('-', '').toLowerCase())[0].codigo).toBe(uno.codigo);
  });

  it('encuentra por departamento', () => {
    const res = buscarCargos('talento humano');
    expect(res.length).toBeGreaterThan(0);
    expect(res.every(c => c.departamento === 'TALENTO HUMANO' || normalizarBusqueda(c.cargo).includes('talentohumano'))).toBe(true);
  });

  it('no sugiere nada con menos de dos caracteres útiles ni para texto desconocido', () => {
    expect(buscarCargos('')).toEqual([]);
    expect(buscarCargos('zzzqqq')).toEqual([]);
  });

  it('resuelve el cargo guardado en el trabajador', () => {
    const uno = CARGOS[1];
    expect(cargoPorNombre(uno.cargo)?.codigo).toBe(uno.codigo);
    expect(cargoPorNombre('NO EXISTE')).toBeNull();
  });
});

describe('matriz oficial de factores de riesgo', () => {
  it('tiene las 6 categorías del formato, con subcategorías solo en DE SEGURIDAD', () => {
    expect(MATRIZ_RIESGOS.map(c => c.categoria)).toEqual(
      ['FÍSICO', 'DE SEGURIDAD', 'QUÍMICO', 'BIOLÓGICO', 'ERGONÓMICO', 'PSICOSOCIAL'],
    );
    const seguridad = MATRIZ_RIESGOS.find(c => c.categoria === 'DE SEGURIDAD')!;
    expect(seguridad.subgrupos.map(g => g.subcategoria)).toEqual(['LOCATIVOS', 'MECÁNICOS', 'ELÉCTRICOS', 'OTROS']);
    MATRIZ_RIESGOS.filter(c => c.categoria !== 'DE SEGURIDAD').forEach(c => {
      expect(c.subgrupos.every(g => !g.subcategoria)).toBe(true);
    });
  });

  it('cada categoría cierra con su fila «Otros», como la hoja oficial', () => {
    MATRIZ_RIESGOS.forEach(c => {
      const ultimo = c.subgrupos[c.subgrupos.length - 1].items.slice(-1)[0];
      expect(ultimo).toMatch(/^Otros/);
    });
  });

  it('no repite factores dentro de una categoría', () => {
    MATRIZ_RIESGOS.forEach(c => {
      const items = c.subgrupos.flatMap(g => g.items);
      expect(new Set(items).size).toBe(items.length);
    });
  });
});
