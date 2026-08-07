// El formulario de signos vitales se monta ANTES de que el padre termine de
// cargar la evaluación que se está editando (la lectura de Firestore es
// asíncrona). Estas pruebas fijan que los datos que llegan tarde se adopten en
// lugar de perderse, que era el motivo por el que al editar se borraban los SV.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import SignosVitalesForm from './SignosVitalesForm';
import type { SignosVitales } from '../types';

const vacios = (): SignosVitales => ({
  presionSistolica: '', presionDiastolica: '', temperatura: '', frecuenciaCardiaca: '',
  frecuenciaRespiratoria: '', saturacion: '', peso: '', talla: '', imc: 0,
  perimetroAbdominal: '', glucosaCapilar: '',
});

/** Padre que replica el patrón real: estado propio + carga diferida. */
function Padre({ cargados }: { cargados: SignosVitales | null }) {
  const [signos, setSignos] = useState<SignosVitales>(vacios());
  return (
    <>
      <button onClick={() => cargados && setSignos(cargados)}>cargar</button>
      <SignosVitalesForm initialData={signos} onDataChange={setSignos} />
      <output data-testid="fc">{signos.frecuenciaCardiaca}</output>
      <output data-testid="peso">{signos.peso}</output>
    </>
  );
}

const campo = (name: string) => document.querySelector(`input[name="${name}"]`) as HTMLInputElement;

describe('SignosVitalesForm', () => {
  it('adopta los signos que llegan después del montaje (edición)', () => {
    const guardados: SignosVitales = {
      ...vacios(), presionSistolica: '130', presionDiastolica: '85',
      frecuenciaCardiaca: '72', peso: '80', talla: '175', perimetroAbdominal: '95',
    };
    render(<Padre cargados={guardados} />);

    // Antes de cargar, el formulario está vacío.
    expect(screen.getByTestId('fc').textContent).toBe('');

    fireEvent.click(screen.getByText('cargar'));

    // Ya no se pierden: ni en la caja ni en lo que el padre recibe de vuelta.
    expect(campo('frecuenciaCardiaca').value).toBe('72');
    expect(campo('peso').value).toBe('80');
    expect(campo('talla').value).toBe('175');
    expect(screen.getByTestId('fc').textContent).toBe('72');
    expect(screen.getByTestId('peso').textContent).toBe('80');
  });

  it('no pisa lo que el médico acaba de escribir con un campo vacío del padre', () => {
    render(<Padre cargados={{ ...vacios(), talla: '170' }} />);
    fireEvent.change(campo('peso'), { target: { value: '68' } });
    fireEvent.click(screen.getByText('cargar'));

    expect(campo('peso').value).toBe('68');   // se conserva
    expect(campo('talla').value).toBe('170'); // se añade lo que sí venía
  });

  it('calcula el IMC con los datos recibidos', () => {
    const onDataChange = vi.fn();
    render(<SignosVitalesForm initialData={{ ...vacios(), peso: '70', talla: '170' }} onDataChange={onDataChange} />);
    const llamadas = onDataChange.mock.calls;
    const ultimo = llamadas[llamadas.length - 1][0] as SignosVitales;
    expect(ultimo.imc).toBeGreaterThan(23);
    expect(ultimo.imc).toBeLessThan(25);
  });

  it('no entra en bucle cuando el padre devuelve un objeto nuevo en cada render', () => {
    const onDataChange = vi.fn();
    const { rerender } = render(<SignosVitalesForm initialData={{ ...vacios(), peso: '70' }} onDataChange={onDataChange} />);
    const llamadasIniciales = onDataChange.mock.calls.length;
    // Mismo contenido, objeto distinto: no debe disparar más actualizaciones.
    rerender(<SignosVitalesForm initialData={{ ...vacios(), peso: '70' }} onDataChange={onDataChange} />);
    expect(onDataChange.mock.calls.length).toBe(llamadasIniciales);
  });
});
