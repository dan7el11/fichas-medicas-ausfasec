/**
 * Calcula el Índice de Masa Corporal (IMC)
 * @param peso Peso en kilogramos (kg)
 * @param talla Talla en centímetros (cm)
 * @returns El valor del IMC redondeado a 2 decimales o 0 si los datos son inválidos
 */
export const calcularIMC = (peso: number, talla: number): number => {
  if (!peso || !talla || talla <= 0) return 0;
  
  // Convertimos la talla de centímetros a metros
  const tallaEnMetros = talla / 100;
  const imc = peso / (tallaEnMetros * tallaEnMetros);
  
  // Retornamos redondeando a 2 decimales
  return Math.round(imc * 100) / 100;
};
