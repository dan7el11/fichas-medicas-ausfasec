// Fusión de antecedentes de TODAS las evaluaciones previas de un trabajador.
//
// Reglas (pedidas por el usuario):
//  - Los antecedentes registrados antes no se modifican: solo se AÑADEN los
//    nuevos que aparezcan en evaluaciones posteriores.
//  - No se duplican: si el mismo antecedente aparece en varias evaluaciones,
//    se conserva la versión MÁS RECIENTE (que puede traer datos actualizados,
//    p. ej. cambio de medicación).
//  - El usuario decide qué conservar: el resultado precarga el formulario,
//    donde cada entrada puede editarse o eliminarse antes de guardar.
//
// Los estados puntuales (hábitos, estilo de vida, gineco/reproductivos, datos
// personales) no son listas acumulables: se toma el más reciente registrado.

export interface AntecedentesCombinados {
  antecedentesClinicosQ: boolean | null;
  antecedentesClinicosLista: any[];
  antecedentesQuirurgicosQ: boolean | null;
  antecedentesQuirurgicosLista: any[];
  alergiasTiene: boolean | null;
  alergias: any[];
  antecedentesFamiliares: any[];
  medicacionesHabituales: any[];
  antecedentesEmpleos: any[];
  edadInicioLaboral: string;
  habitosToxicos: any[] | null;
  estiloVida: any | null;
  antecedentesGineco: any | null;
  antecedentesReproductivos: any | null;
  datosPersonales: any | null;
  talla: string;
}

const norm = (s: any) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Ordena evaluaciones de la más reciente a la más antigua (fecha Firestore o Date). */
export function ordenarEvaluacionesDesc(evals: any[]): any[] {
  const t = (f: any): number => {
    if (!f) return 0;
    if (typeof f.seconds === 'number') return f.seconds * 1000;
    const d = f instanceof Date ? f : new Date(f);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };
  return [...evals].sort((a, b) => t(b.fecha) - t(a.fecha));
}

/** Une listas de varias evaluaciones (más reciente primero) sin duplicados. */
function unirListas(evals: any[], campo: string, clave: (item: any) => string): any[] {
  const vistos = new Set<string>();
  const resultado: any[] = [];
  // Se recorre de la más reciente a la más antigua: ante un duplicado gana la
  // versión más nueva; los antiguos no duplicados se conservan (solo añadir).
  for (const ev of evals) {
    const lista: any[] = Array.isArray(ev?.[campo]) ? ev[campo] : [];
    for (const item of lista) {
      const k = clave(item);
      if (!k || vistos.has(k)) continue;
      vistos.add(k);
      resultado.push(item);
    }
  }
  return resultado;
}

/** Primer valor no vacío recorriendo de la evaluación más reciente a la más antigua. */
function masReciente<T>(evals: any[], obtener: (ev: any) => T | null | undefined, esValido: (v: T) => boolean = (v) => v != null): T | null {
  for (const ev of evals) {
    const v = obtener(ev);
    if (v != null && esValido(v)) return v;
  }
  return null;
}

/**
 * Combina los antecedentes de todas las evaluaciones previas (cualquier tipo:
 * preocupacional, periódica, retiro) para precargar una evaluación nueva.
 */
export function combinarAntecedentes(evaluaciones: any[]): AntecedentesCombinados {
  const evals = ordenarEvaluacionesDesc(evaluaciones);

  const clinicos = unirListas(evals, 'antecedentesClinicosLista', (i) => norm(i.enfermedad));
  const quirurgicos = unirListas(evals, 'antecedentesQuirurgicosLista', (i) => norm(i.procedimiento));
  const alergias = unirListas(evals, 'alergias', (i) => norm(i.alergeno));
  const familiares = unirListas(evals, 'antecedentesFamiliares', (i) => `${norm(i.tipo)}|${norm(i.parentesco)}|${norm(i.descripcion)}`);
  const medicaciones = unirListas(evals, 'medicacionesHabituales', (i) => norm(i.nombre));
  const empleos = unirListas(evals, 'antecedentesEmpleos', (i) => `${norm(i.empresa)}|${norm(i.puesto)}`);

  // La respuesta Sí/No se deriva de las listas fusionadas: si hay entradas es
  // Sí; si no hay pero alguna evaluación respondió explícitamente, se respeta
  // la respuesta más reciente; si nunca se respondió queda sin contestar.
  const flag = (lista: any[], campoQ: string): boolean | null => {
    if (lista.length > 0) return true;
    const resp = masReciente<boolean>(evals, (ev) => (typeof ev?.[campoQ] === 'boolean' ? ev[campoQ] : null));
    return resp;
  };

  return {
    antecedentesClinicosQ: flag(clinicos, 'antecedentesClinicosQ'),
    antecedentesClinicosLista: clinicos,
    antecedentesQuirurgicosQ: flag(quirurgicos, 'antecedentesQuirurgicosQ'),
    antecedentesQuirurgicosLista: quirurgicos,
    alergiasTiene: flag(alergias, 'alergiasTiene'),
    alergias,
    antecedentesFamiliares: familiares,
    medicacionesHabituales: medicaciones,
    antecedentesEmpleos: empleos,
    edadInicioLaboral: masReciente<string>(evals, (ev) => ev?.edadInicioLaboral, (v) => String(v).trim() !== '') ?? '',
    habitosToxicos: masReciente<any[]>(evals, (ev) => (Array.isArray(ev?.habitosToxicos) && ev.habitosToxicos.length > 0 ? ev.habitosToxicos : null)),
    estiloVida: masReciente<any>(evals, (ev) => ev?.estiloVida ?? null),
    antecedentesGineco: masReciente<any>(evals, (ev) => ev?.antecedentesGineco ?? null),
    antecedentesReproductivos: masReciente<any>(evals, (ev) => ev?.antecedentesReproductivos ?? null),
    datosPersonales: masReciente<any>(evals, (ev) => ev?.datosPersonales ?? null),
    talla: masReciente<string>(evals, (ev) => ev?.signosVitales?.talla, (v) => String(v).trim() !== '') ?? '',
  };
}
