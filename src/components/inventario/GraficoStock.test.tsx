import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GraficoStock from './GraficoStock';
import type { Medicamento, Consumo } from '../../types/inventario';

const med = (codigo: string, nombre: string, sobrenombre: string, stocks: Partial<Medicamento['stocks']>): Medicamento => ({
  codigo, tipo: 'NUEVA COMPRA', nombre, sobrenombre, lote: '', fechaExpiracion: '2030-01-01',
  precio: 1, stockInicial: 100,
  stocks: { planta_envasado: 0, vergel: 0, planta_ventanas: 0, ...stocks },
});

const consumo = (codigo: string, cantidad: number, centro: Consumo['centro'] = 'planta_envasado'): Consumo => ({
  id: 1, transaccionId: 't', medicamentoCodigo: codigo, centro,
  cantidad, trabajador: 'X', fecha: '2026-01-10', registradoPor: 'M', reportado: false, comentarioReporte: '',
});

describe('GraficoStock (líneas, % de stock restante)', () => {
  it('calcula el % relativo (stock / stock+consumido) y muestra la advertencia del 20 %', () => {
    // Stock 10, consumido 90 → 10 % restante → bajo el umbral
    const html = renderToStaticMarkup(
      <GraficoStock centro="general" inventario={[med('A', 'Paracetamol', '', { planta_envasado: 10 })]} consumos={[consumo('A', 90)]} />,
    );
    expect(html).toContain('10%');
    expect(html).toContain('Reponer (≤20 %)');
    expect(html).toContain('1 por reponer');
  });

  it('incluye el nombre genérico junto al comercial', () => {
    const html = renderToStaticMarkup(
      <GraficoStock centro="general" inventario={[med('A', 'Ibuprofeno 400 mg', 'Apronax', { vergel: 5 })]} consumos={[]} />,
    );
    expect(html).toContain('Ibuprofeno 400 mg (Apronax)');
  });

  it('ordena del más crítico al más holgado (menor % primero)', () => {
    const html = renderToStaticMarkup(
      <GraficoStock centro="general"
        inventario={[
          med('OK', 'Loratadina', '', { vergel: 100 }),              // 100 %
          med('CRIT', 'Diclofenaco', '', { planta_envasado: 5 }),    // 5/(5+95) = 5 %
        ]}
        consumos={[consumo('CRIT', 95)]} />,
    );
    expect(html.indexOf('Diclofenaco')).toBeLessThan(html.indexOf('Loratadina'));
  });

  it('en un centro solo cuenta stock y consumo de ese centro, y avisa de los omitidos', () => {
    const html = renderToStaticMarkup(
      <GraficoStock centro="vergel"
        inventario={[
          med('A', 'Loratadina', '', { vergel: 50 }),
          med('B', 'Salbutamol', '', { planta_envasado: 30 }), // sin stock ni consumo en vergel
        ]}
        consumos={[consumo('A', 50, 'planta_envasado')]} />,   // consumo de OTRO centro: no cuenta
    );
    expect(html).toContain('100%');       // 50/(50+0) en vergel
    expect(html).not.toContain('Salbutamol');
    expect(html).toContain('1 medicamento sin stock ni consumo en este ámbito');
  });
});
