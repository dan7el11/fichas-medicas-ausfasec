import { describe, it, expect } from 'vitest';
import { calcularCobertura, perfilBaseDeCargo, idDeCargo, CARGOS_PENDIENTES_ANALISIS } from './perfilesRiesgo';
import type { PerfilRiesgoGuardado } from '../types/perfilRiesgo';
import { CARGOS } from '../constants/funcionesCargo';

const sinGuardados = new Map<string, PerfilRiesgoGuardado>();

describe('idDeCargo', () => {
  it('ignora tildes, mayúsculas y el sufijo /A', () => {
    expect(idDeCargo('TÉCNICO/A AMBIENTAL')).toBe(idDeCargo('tecnico ambiental'));
  });
  it('no devuelve cadena vacía', () => {
    expect(idDeCargo('')).toBe('sin-cargo');
  });
});

describe('perfilBaseDeCargo', () => {
  it('encuentra el perfil aunque el cargo venga escrito distinto', () => {
    const uno = CARGOS[0].cargo;
    expect(perfilBaseDeCargo(uno)).not.toBeNull();
    expect(perfilBaseDeCargo(uno.toLowerCase())).not.toBeNull();
  });
  it('devuelve null para un cargo desconocido', () => {
    expect(perfilBaseDeCargo('CARGO INEXISTENTE XYZ')).toBeNull();
  });
});

describe('calcularCobertura', () => {
  it('marca con análisis los cargos del catálogo', () => {
    const filas = calcularCobertura([], sinGuardados);
    const conocido = filas.find(f => f.cargo === CARGOS[0].cargo)!;
    expect(conocido.estado).toBe('con-analisis');
    expect(conocido.factores).toBeGreaterThan(0);
    expect(conocido.fueraDeCatalogo).toBe(false);
  });

  it('detecta cargos usados por trabajadores que no tienen análisis', () => {
    const filas = calcularCobertura(['SOLDADOR DE PLANTA', 'SOLDADOR DE PLANTA'], sinGuardados);
    const nuevo = filas.find(f => f.cargo === 'SOLDADOR DE PLANTA')!;
    expect(nuevo.estado).toBe('sin-analisis');
    expect(nuevo.trabajadores).toBe(2);
    expect(nuevo.fueraDeCatalogo).toBe(true);
  });

  it('cuenta trabajadores aunque el cargo esté escrito con otras tildes', () => {
    const cargo = CARGOS.find(c => /É|Á|Ó/.test(c.cargo))?.cargo ?? CARGOS[0].cargo;
    const filas = calcularCobertura([cargo, cargo.toLowerCase()], sinGuardados);
    expect(filas.find(f => f.cargo === cargo)!.trabajadores).toBe(2);
  });

  it('marca como editado el cargo con perfil guardado, y usa sus datos', () => {
    const cargo = CARGOS[1].cargo;
    const guardados = new Map<string, PerfilRiesgoGuardado>([[idDeCargo(cargo), {
      cargo, departamento: 'X', actividades: ['A', 'B'], riesgoActividades: { Ruido: [0] },
    }]]);
    const fila = calcularCobertura([], guardados).find(f => f.cargo === cargo)!;
    expect(fila.estado).toBe('personalizado');
    expect(fila.actividades).toBe(2);
    expect(fila.factores).toBe(1);
  });

  it('ordena primero lo que falta analizar y luego por nº de trabajadores', () => {
    const filas = calcularCobertura(['CARGO NUEVO A', 'CARGO NUEVO B', 'CARGO NUEVO B'], sinGuardados);
    expect(filas[0].cargo).toBe('CARGO NUEVO B');
    expect(filas[1].cargo).toBe('CARGO NUEVO A');
    expect(filas.slice(0, 2).every(f => f.estado === 'sin-analisis')).toBe(true);
  });

  it('lista los cargos que el análisis dejó pendientes, aunque nadie los tenga asignado', () => {
    const filas = calcularCobertura([], sinGuardados);
    CARGOS_PENDIENTES_ANALISIS.forEach(cargo => {
      const fila = filas.find(f => idDeCargo(f.cargo) === idDeCargo(cargo));
      expect(fila, cargo).toBeDefined();
      expect(fila!.estado).toBe('sin-analisis');
    });
  });

  it('ignora los cargos vacíos de trabajadores sin puesto registrado', () => {
    const base = calcularCobertura([], sinGuardados).length;
    expect(calcularCobertura(['', '   '], sinGuardados)).toHaveLength(base);
  });
});
