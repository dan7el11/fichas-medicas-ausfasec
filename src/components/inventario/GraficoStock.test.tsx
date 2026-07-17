import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GraficoStock from './GraficoStock';
import type { Medicamento, Consumo } from '../../types/inventario';

const hoyISO = () => new Date().toISOString().slice(0, 10);

const med = (codigo: string, nombre: string, stocks: Partial<Medicamento['stocks']>): Medicamento => ({
  codigo, tipo: 'NUEVA COMPRA', nombre, sobrenombre: '', lote: '', fechaExpiracion: '2030-01-01',
  precio: 1, stockInicial: 100,
  stocks: { planta_envasado: 0, vergel: 0, planta_ventanas: 0, ...stocks },
});

const consumo = (codigo: string, cantidad: number): Consumo => ({
  id: 1, transaccionId: 't', medicamentoCodigo: codigo, centro: 'planta_envasado',
  cantidad, trabajador: 'X', fecha: hoyISO(), registradoPor: 'M', reportado: false, comentarioReporte: '',
});

describe('GraficoStock', () => {
  it('ordena por riesgo: el agotado aparece antes que el que tiene stock', () => {
    const html = renderToStaticMarkup(
      <GraficoStock
        centro="general"
        inventario={[med('A', 'Paracetamol', { planta_envasado: 80 }), med('B', 'Ibuprofeno', {})]}
        consumos={[]}
      />,
    );
    expect(html.indexOf('Ibuprofeno')).toBeLessThan(html.indexOf('Paracetamol'));
    expect(html).toContain('Agotado');
  });

  it('marca crítico cuando la cobertura al ritmo de consumo es corta', () => {
    // Stock 5 y consumo 30 u. en 30 días → 1 u./día → cobertura 5 días → crítico
    const html = renderToStaticMarkup(
      <GraficoStock centro="general" inventario={[med('A', 'Diclofenaco', { vergel: 5 })]} consumos={[consumo('A', 30)]} />,
    );
    expect(html).toContain('Crítico');
    expect(html).toContain('≈5 d');
  });

  it('solo cuenta el consumo del centro elegido', () => {
    // Consumo registrado en planta_envasado: al mirar vergel no debe contar
    const html = renderToStaticMarkup(
      <GraficoStock centro="vergel" inventario={[med('A', 'Loratadina', { vergel: 50 })]} consumos={[consumo('A', 30)]} />,
    );
    expect(html).toContain('OK');
    expect(html).toContain('Sin consumo reciente');
  });

  it('indica cuántos medicamentos hay en total cuando recorta la lista', () => {
    const muchos = Array.from({ length: 20 }, (_, i) => med(`M${i}`, `Med ${i}`, { vergel: i + 1 }));
    const html = renderToStaticMarkup(<GraficoStock centro="general" inventario={muchos} consumos={[]} />);
    expect(html).toContain('Ver todos los medicamentos (20)');
  });
});
