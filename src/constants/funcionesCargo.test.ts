import { describe, it, expect } from 'vitest';
import { PERFILES_CARGO, perfilDeCargo, funcionesDeCargo, CARGOS_CATALOGO, FUNCIONES_AUTOCOMPLETAR, MAX_ACTIVIDADES } from './funcionesCargo';
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
