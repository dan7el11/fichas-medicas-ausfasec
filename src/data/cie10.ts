import datosCIE10 from './cie10.json';

export interface DiagnosticoCIE10 {
  codigo: string;
  descripcion: string;
}


export const catalogoCIE10: DiagnosticoCIE10[] = datosCIE10.map((item: any) => {
  // 1. Buscamos el código. Si no tiene el de 4 caracteres, usamos el de 3
  const codigoCrudo = item.COD_4 || item.COD_3 || '';
  
  // 2. ¡Magia extra! Como tus códigos no tienen punto (ej. A000), se lo inyectamos automáticamente aquí para la base de datos (A00.0)
  const codigoFormateado = codigoCrudo.length === 4 
    ? `${codigoCrudo.slice(0, 3)}.${codigoCrudo.slice(3)}` 
    : codigoCrudo;

  // 3. Buscamos la descripción (respetando los nombres exactos y el error ortográfico de tu archivo original)
  const texto = item["DESCRIPCION CODIGOS DE CUATRO CARACTERES"] || item["DESRIPCION CATEGORIAS DE TRES CARACTERES"] || '';

  return {
    codigo: codigoFormateado,
    // 4. Estética: Convertimos "COLERA DEBIDO A..." en "Colera debido a..." para que no se vea todo en mayúsculas gritando
    descripcion: texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase()
  };
});
