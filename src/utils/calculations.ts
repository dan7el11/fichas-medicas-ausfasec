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

/**
 * Valida una cédula ecuatoriana usando el algoritmo de módulo 10.
 * Retorna true si es válida, false en caso contrario.
 */
export function validarCedula(cedula: string): boolean {
  const c = cedula.trim();
  if (!/^\d{10}$/.test(c)) return false;

  const provincia = parseInt(c.slice(0, 2), 10);
  if (provincia < 1 || provincia > 24) return false;

  const tercerDigito = parseInt(c[2], 10);
  if (tercerDigito >= 6) return false; // personas naturales: dígito 3 < 6

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let val = parseInt(c[i], 10) * coeficientes[i];
    if (val >= 10) val -= 9;
    suma += val;
  }

  const digitoVerificador = (10 - (suma % 10)) % 10;
  return digitoVerificador === parseInt(c[9], 10);
}
