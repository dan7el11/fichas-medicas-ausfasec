// Examen físico regional tal como lo dispone la hoja oficial
// (SNS-MSP/HCU-form.123/2025, Sección F).
//
// La hoja no es una rejilla uniforme: son CINCO bloques verticales puestos uno
// junto a otro, cada uno con su propio número de filas y sus propios anchos de
// columna, todos terminando a la misma altura. Por eso se describe aquí bloque
// a bloque, con las medidas tomadas del formato (en mm).

export interface SubregionFisica {
  /** Letra dentro de la región (a, b, c…). */
  letra: string;
  nombre: string;
}

export interface RegionFisica {
  numero: number;
  /** Rótulo rotado 90° de la columna izquierda del bloque. */
  rotulo: string;
  items: SubregionFisica[];
}

export interface BloqueExamenFisico {
  /** Anchos en mm: rótulo rotado | nombre de la subregión | casilla de marca. */
  anchos: [number, number, number];
  regiones: RegionFisica[];
}

/** Alto total (mm) que ocupa la rejilla en la hoja oficial. */
export const ALTO_EXAMEN_FISICO = 34.4;

export const BLOQUES_EXAMEN_FISICO: BloqueExamenFisico[] = [
  {
    anchos: [2.9, 17.0, 6.0],
    regiones: [
      { numero: 1, rotulo: '1. Piel', items: [
        { letra: 'a', nombre: 'Cicatrices' },
        { letra: 'b', nombre: 'Piel y Faneras' },
      ] },
      { numero: 2, rotulo: '2. Ojos', items: [
        { letra: 'a', nombre: 'Párpados' },
        { letra: 'b', nombre: 'Conjuntivas' },
        { letra: 'c', nombre: 'Pupilas' },
        { letra: 'd', nombre: 'Córnea' },
        { letra: 'e', nombre: 'Motilidad' },
      ] },
    ],
  },
  {
    anchos: [11.2, 20.4, 5.3],
    regiones: [
      { numero: 3, rotulo: '3. Oído', items: [
        { letra: 'a', nombre: 'C. auditivo externo' },
        { letra: 'b', nombre: 'Pabellón' },
        { letra: 'c', nombre: 'Tímpanos' },
      ] },
      { numero: 4, rotulo: '4. Oro faringe', items: [
        { letra: 'a', nombre: 'Labios' },
        { letra: 'b', nombre: 'Lengua' },
        { letra: 'c', nombre: 'Faringe' },
        { letra: 'd', nombre: 'Amígdalas' },
        { letra: 'e', nombre: 'Dentadura' },
      ] },
    ],
  },
  {
    anchos: [8.8, 20.9, 5.6],
    regiones: [
      { numero: 5, rotulo: '5. Nariz', items: [
        { letra: 'a', nombre: 'Tabique' },
        { letra: 'b', nombre: 'Cornetes' },
        { letra: 'c', nombre: 'Mucosas' },
        { letra: 'd', nombre: 'Senos paranasales' },
      ] },
      { numero: 6, rotulo: '6. Cuello', items: [
        { letra: 'a', nombre: 'Tiroides / masas' },
        { letra: 'b', nombre: 'Movilidad' },
      ] },
      { numero: 7, rotulo: '7. Tórax', items: [
        { letra: 'a', nombre: 'Mamas' },
      ] },
    ],
  },
  {
    anchos: [14.2, 17.8, 5.7],
    regiones: [
      { numero: 8, rotulo: '8. Tórax', items: [
        { letra: 'a', nombre: 'Pulmones' },
        { letra: 'b', nombre: 'Corazón' },
        { letra: 'c', nombre: 'Parrilla costal' },
      ] },
      { numero: 9, rotulo: '9. Abdomen', items: [
        { letra: 'a', nombre: 'Vísceras' },
        { letra: 'b', nombre: 'Pared abdominal' },
      ] },
      { numero: 10, rotulo: '10. Columna', items: [
        { letra: 'a', nombre: 'Flexibilidad' },
        { letra: 'b', nombre: 'Desviación' },
        { letra: 'c', nombre: 'Dolor' },
      ] },
    ],
  },
  {
    anchos: [7.7, 47.6, 4.3],
    regiones: [
      { numero: 11, rotulo: '11. Pelvis', items: [
        { letra: 'a', nombre: 'Pelvis' },
        { letra: 'b', nombre: 'Genitales' },
      ] },
      { numero: 12, rotulo: '12. Extre', items: [
        { letra: 'a', nombre: 'Vascular' },
        { letra: 'b', nombre: 'Miembros superiores' },
        { letra: 'c', nombre: 'Miembros inferiores' },
      ] },
      { numero: 13, rotulo: '13. Neurológico', items: [
        { letra: 'a', nombre: 'Fuerza' },
        { letra: 'b', nombre: 'Sensibilidad' },
        { letra: 'c', nombre: 'Marcha' },
        { letra: 'd', nombre: 'Reflejos' },
      ] },
    ],
  },
];

/** Filas de cada bloque (las de más filas marcan el alto de fila más apretado). */
export const filasDeBloque = (b: BloqueExamenFisico): number =>
  b.regiones.reduce((n, r) => n + r.items.length, 0);

const norm = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * ¿La evaluación tiene marcada esta casilla?
 *
 * Ojo con los códigos: al alinear el catálogo con la hoja oficial cambió la
 * numeración (el corazón pasó de 7b a 8b, la parrilla costal de 8b a 8c y la
 * piel y faneras de 1c a 1b). Un hallazgo antiguo con código «8b» significa
 * «parrilla costal», no «corazón», así que el código por sí solo es ambiguo:
 * cuando el hallazgo trae el nombre de la subregión, ese nombre manda.
 */
export function tieneHallazgo(hallazgos: any[] | undefined, codigo: string, nombreSubregion: string): boolean {
  const objetivo = norm(nombreSubregion);
  return (hallazgos ?? []).some((h: any) => {
    const sub = norm(h?.subregion);
    if (sub) return sub === objetivo;
    return h?.codigo === codigo;
  });
}
