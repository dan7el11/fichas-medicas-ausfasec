// Fusión pura y secuencial de antecedentes (formato unificado): el expediente
// previo del trabajador se conserva; los valores nuevos que vengan informados
// lo actualizan; los empleos se acumulan sin duplicar. Nada se borra por venir
// vacío en una evaluación posterior.
import type { ExpedienteAntecedentes } from '../types';

const norm = (s: any) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const vacioStr = (v: any) => v == null || String(v).trim() === '';
const vacioArr = (v: any) => !Array.isArray(v) || v.length === 0;
const vacioObj = (v: any) => v == null || (typeof v === 'object' && Object.values(v).every((x) => x === '' || x == null || x === false || (Array.isArray(x) && x.length === 0)));

/** Empleos: se acumulan (base + nuevos), la versión nueva gana ante duplicados. */
function unirEmpleos(previa: any[] | undefined, nueva: any[] | undefined): any[] {
  const mapa = new Map<string, any>();
  const clave = (e: any) => `${norm(e.empresa)}|${norm(e.puesto)}`;
  (previa ?? []).forEach((e) => { const k = clave(e); if (k !== '|') mapa.set(k, e); });
  (nueva ?? []).forEach((e) => { const k = clave(e); if (k !== '|') mapa.set(k, e); });
  return [...mapa.values()];
}

/** Toma el valor nuevo si viene informado (no vacío); si no, conserva el previo. */
function preferir<T>(previo: T | undefined, nuevo: T | undefined, vacio: (v: any) => boolean): T | undefined {
  return !vacio(nuevo) ? nuevo : previo;
}

export function fusionarAntecedentes(
  previo: ExpedienteAntecedentes | null,
  nuevos: Partial<ExpedienteAntecedentes>,
): ExpedienteAntecedentes {
  const p = previo ?? ({} as ExpedienteAntecedentes);
  const habitosInformados = nuevos.habitosToxicos?.some((h: any) => h.consume || h.exConsumidor);
  return {
    trabajadorId: p.trabajadorId || (nuevos.trabajadorId as string) || '',
    datosPersonales: preferir(p.datosPersonales, nuevos.datosPersonales, vacioObj),
    condicionEspecial: preferir(p.condicionEspecial, nuevos.condicionEspecial, vacioObj),
    antecedentesClinicosTexto: preferir(p.antecedentesClinicosTexto, nuevos.antecedentesClinicosTexto, vacioStr) ?? '',
    antecedentesFamiliaresTexto: preferir(p.antecedentesFamiliaresTexto, nuevos.antecedentesFamiliaresTexto, vacioStr) ?? '',
    antecedentesGineco: preferir(p.antecedentesGineco, nuevos.antecedentesGineco, vacioObj),
    antecedentesReproductivos: preferir(p.antecedentesReproductivos, nuevos.antecedentesReproductivos, vacioObj),
    habitosToxicos: preferir(p.habitosToxicos, habitosInformados ? nuevos.habitosToxicos : undefined, vacioArr) ?? p.habitosToxicos ?? nuevos.habitosToxicos,
    estiloVida: preferir(p.estiloVida, nuevos.estiloVida, vacioObj),
    antecedentesEmpleos: unirEmpleos(p.antecedentesEmpleos, nuevos.antecedentesEmpleos),
  };
}
