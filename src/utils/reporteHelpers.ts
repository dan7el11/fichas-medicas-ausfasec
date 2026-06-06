import type { EvaluacionMedica, ExamenComplementarioDoc } from '../types';
import type { PermisoMedico } from '../types/permiso';
import type { AtencionMedica } from '../types/atencion';

export function toDate(value: any): Date {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  return new Date(NaN);
}

// ── Capítulos ICD-10 ─────────────────────────────────────────────────────────
const CAPS: Record<string, { label: string; color: string }> = {
  A: { label: 'Infecciosas', color: '#10a05a' }, B: { label: 'Infecciosas', color: '#10a05a' },
  E: { label: 'Endocrino / metabólico', color: '#e08a2c' },
  F: { label: 'Salud mental', color: '#e3496a' },
  G: { label: 'Neurológico', color: '#7c5cf2' },
  H: { label: 'Ojo / oído', color: '#0e9bbf' },
  I: { label: 'Circulatorio', color: '#dc2e3c' },
  J: { label: 'Respiratorio', color: '#1d4fad' },
  K: { label: 'Digestivo', color: '#b45309' },
  L: { label: 'Piel', color: '#d97706' },
  M: { label: 'Musculoesquelético', color: '#0f766e' },
  N: { label: 'Genitourinario', color: '#9333ea' },
  R: { label: 'Síntomas y signos', color: '#64748b' },
  S: { label: 'Traumatismos', color: '#a01f2a' }, T: { label: 'Traumatismos', color: '#a01f2a' },
  Z: { label: 'Otros / certificados', color: '#94a2b3' },
};
function capDe(cie: string) { return CAPS[(cie || '?')[0]] ?? { label: 'Otros', color: '#94a2b3' }; }

// ── Top diagnósticos ICD-10 (evaluaciones + consultas) ──────────────────────
export interface DiagItem { cie: string; desc: string; n: number; pct: number; color: string; capitulo: string; }

export function topDiagnosticos(
  evaluaciones: EvaluacionMedica[],
  atenciones: AtencionMedica[],
  topN = 10,
): DiagItem[] {
  const map = new Map<string, { desc: string; n: number; color: string; capitulo: string }>();
  evaluaciones.forEach((e) =>
    (e.diagnosticos ?? []).forEach((d) => {
      if (!d.cie) return;
      const cap = capDe(d.cie);
      const prev = map.get(d.cie) ?? { desc: d.descripcion, n: 0, color: cap.color, capitulo: cap.label };
      prev.n++;
      map.set(d.cie, prev);
    }),
  );
  atenciones.forEach((a) => {
    if (!a.cieCodigo) return;
    const cap = capDe(a.cieCodigo);
    const prev = map.get(a.cieCodigo) ?? { desc: a.cieDescripcion || a.cieCodigo, n: 0, color: cap.color, capitulo: cap.label };
    prev.n++;
    map.set(a.cieCodigo, prev);
  });
  const total = [...map.values()].reduce((s, v) => s + v.n, 0) || 1;
  return [...map.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, topN)
    .map(([cie, v]) => ({ cie, ...v, pct: Math.round((v.n / total) * 100) }));
}

// ── Morbilidad por capítulo ICD-10 ──────────────────────────────────────────
export interface CapItem { label: string; color: string; n: number; pct: number; }

export function morbilidadCapitulos(
  evaluaciones: EvaluacionMedica[],
  atenciones: AtencionMedica[],
): CapItem[] {
  const map = new Map<string, { color: string; n: number }>();
  evaluaciones.forEach((e) =>
    (e.diagnosticos ?? []).forEach((d) => {
      if (!d.cie) return;
      const cap = capDe(d.cie);
      const prev = map.get(cap.label) ?? { color: cap.color, n: 0 };
      prev.n++;
      map.set(cap.label, prev);
    }),
  );
  atenciones.forEach((a) => {
    if (!a.cieCodigo) return;
    const cap = capDe(a.cieCodigo);
    const prev = map.get(cap.label) ?? { color: cap.color, n: 0 };
    prev.n++;
    map.set(cap.label, prev);
  });
  const total = [...map.values()].reduce((s, v) => s + v.n, 0) || 1;
  return [...map.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([label, v]) => ({ label, color: v.color, n: v.n, pct: Math.round((v.n / total) * 100) }));
}

// ── Ausentismo por área ──────────────────────────────────────────────────────
export interface AreaAusentismo { area: string; dias: number; nCasos: number; }

export function ausentismoPorArea(permisos: PermisoMedico[]): AreaAusentismo[] {
  const map = new Map<string, { dias: number; nCasos: number }>();
  permisos
    .filter((p) => p.tipo !== 'cita')
    .forEach((p) => {
      const area = p.area || 'Sin área';
      const prev = map.get(area) ?? { dias: 0, nCasos: 0 };
      prev.dias += p.dias || 0;
      prev.nCasos++;
      map.set(area, prev);
    });
  return [...map.entries()]
    .sort((a, b) => b[1].dias - a[1].dias)
    .map(([area, v]) => ({ area, ...v }));
}

// ── Desglose por tipo de permiso ─────────────────────────────────────────────
export interface TipoPermisoStat { tipo: string; label: string; n: number; dias: number; }
const TIPO_LABEL: Record<string, string> = {
  reposo_interno: 'Reposo interno', reposo_iess: 'Reposo IESS', cita: 'Cita médica',
};

export function distribucionTipoPermiso(permisos: PermisoMedico[]): TipoPermisoStat[] {
  const map = new Map<string, { n: number; dias: number }>();
  permisos.forEach((p) => {
    const prev = map.get(p.tipo) ?? { n: 0, dias: 0 };
    prev.n++;
    prev.dias += p.tipo !== 'cita' ? (p.dias || 0) : 0;
    map.set(p.tipo, prev);
  });
  return [...map.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([tipo, v]) => ({ tipo, label: TIPO_LABEL[tipo] ?? tipo, ...v }));
}

// ── Tendencia mensual de permisos (últimos N meses) ──────────────────────────
export interface MesTendencia { label: string; diasPerdidos: number; nCasos: number; }

export function tendenciaMensual(permisos: PermisoMedico[], meses = 12): MesTendencia[] {
  const now = new Date();
  return Array.from({ length: meses }, (_, i) => {
    const ref = new Date(now.getFullYear(), now.getMonth() - (meses - 1 - i), 1);
    const yyyy = ref.getFullYear();
    const mm = ref.getMonth();
    const label = ref.toLocaleDateString('es-EC', { month: 'short', year: '2-digit' });
    const reposos = permisos.filter((p) => {
      if (p.tipo === 'cita') return false;
      const d = toDate(p.desde);
      return !isNaN(d.getTime()) && d.getFullYear() === yyyy && d.getMonth() === mm;
    });
    return { label, diasPerdidos: reposos.reduce((s, p) => s + (p.dias || 0), 0), nCasos: reposos.length };
  });
}

// ── Perfil metabólico-cardiovascular ─────────────────────────────────────────
export interface PerfilMetabolico {
  nBase: number;
  hta: { n: number; pct: number };
  sobrepeso: { n: number; pct: number };
  obesidad: { n: number; pct: number };
  glucosaAlterada: { n: number; pct: number };
  riesgoMultiple: { n: number; pct: number };
  tabaco: { n: number; pct: number };
  alcohol: { n: number; pct: number };
}

export function perfilMetabolico(evaluaciones: EvaluacionMedica[]): PerfilMetabolico {
  // Last evaluation per worker
  const ultimas = new Map<string, EvaluacionMedica>();
  evaluaciones.forEach((e) => {
    const prev = ultimas.get(e.trabajadorId);
    if (!prev || toDate(e.fecha) > toDate(prev.fecha)) ultimas.set(e.trabajadorId, e);
  });
  const evs = [...ultimas.values()];
  const nBase = evs.length;

  let hta = 0, sobrepeso = 0, obesidad = 0, gluAlterada = 0, riesgoMultiple = 0, tab = 0, alc = 0;
  evs.forEach((e) => {
    const sv = e.signosVitales;
    const sis = parseFloat(sv?.presionSistolica || '0');
    const dia = parseFloat(sv?.presionDiastolica || '0');
    const imc = parseFloat(String(sv?.imc ?? '0'));
    const glu = parseFloat(sv?.glucosaCapilar || '0');

    const isHTA = sis >= 140 || dia >= 90;
    const isExcPeso = imc >= 25;
    const isGlu = glu >= 100 && glu > 0;

    if (isHTA) hta++;
    if (imc >= 25 && imc < 30) sobrepeso++;
    if (imc >= 30) obesidad++;
    if (isGlu) gluAlterada++;
    if ([isHTA, isExcPeso, isGlu].filter(Boolean).length >= 2) riesgoMultiple++;

    const habs = e.habitosToxicos ?? [];
    if (habs.some((h) => h.tipo === 'tabaco' && h.consume)) tab++;
    if (habs.some((h) => h.tipo === 'alcohol' && h.consume)) alc++;
  });

  const pct = (n: number) => (nBase ? Math.round((n / nBase) * 100) : 0);
  return {
    nBase,
    hta: { n: hta, pct: pct(hta) },
    sobrepeso: { n: sobrepeso, pct: pct(sobrepeso) },
    obesidad: { n: obesidad, pct: pct(obesidad) },
    glucosaAlterada: { n: gluAlterada, pct: pct(gluAlterada) },
    riesgoMultiple: { n: riesgoMultiple, pct: pct(riesgoMultiple) },
    tabaco: { n: tab, pct: pct(tab) },
    alcohol: { n: alc, pct: pct(alc) },
  };
}

// ── Exámenes patológicos por tipo ─────────────────────────────────────────────
export interface ExamenTipoStat { tipo: string; total: number; patologicos: number; pct: number; }

export function patologicosPorTipo(examenes: ExamenComplementarioDoc[]): ExamenTipoStat[] {
  const map = new Map<string, { total: number; patologicos: number }>();
  examenes.forEach((e) => {
    const prev = map.get(e.tipoExamen) ?? { total: 0, patologicos: 0 };
    prev.total++;
    if (e.estado === 'patologico') prev.patologicos++;
    map.set(e.tipoExamen, prev);
  });
  return [...map.entries()]
    .sort((a, b) => b[1].patologicos - a[1].patologicos)
    .map(([tipo, v]) => ({ tipo, ...v, pct: v.total ? Math.round((v.patologicos / v.total) * 100) : 0 }));
}

// ── Tendencia de consultas mensual ───────────────────────────────────────────
export interface MesConsultas { label: string; total: number; ocupacionales: number; }

export function tendenciaConsultas(atenciones: AtencionMedica[], meses = 6): MesConsultas[] {
  const now = new Date();
  return Array.from({ length: meses }, (_, i) => {
    const ref = new Date(now.getFullYear(), now.getMonth() - (meses - 1 - i), 1);
    const yyyy = ref.getFullYear();
    const mm = ref.getMonth();
    const label = ref.toLocaleDateString('es-EC', { month: 'short', year: '2-digit' });
    const mes = atenciones.filter((a) => {
      const d = toDate(a.fecha);
      return !isNaN(d.getTime()) && d.getFullYear() === yyyy && d.getMonth() === mm;
    });
    return { label, total: mes.length, ocupacionales: mes.filter((a) => a.relacion === 'Ocupacional').length };
  });
}
