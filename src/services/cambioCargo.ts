// Cambio de cargo de un trabajador, con su efecto en las evaluaciones.
//
// Guarda el cargo nuevo, deja el cambio anotado en el historial de la ficha y,
// si se pide, refresca la Sección G y las recomendaciones de las evaluaciones
// elegidas con el perfil de riesgo del cargo nuevo.
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { registrarAuditoria } from './auditoria';
import { getPerfilRiesgo } from './perfilesRiesgo';
import { cargoPorNombre } from '../constants/funcionesCargo';
import {
  factoresRiesgoDesdePerfil, recomendacionesDesdeMedidas, medidasDePerfil,
  type CambioCargo,
} from '../utils/cambioCargo';

export interface PeticionCambioCargo {
  trabajadorId: string;
  cargoAnterior: string;
  cargoNuevo: string;
  departamentoAnterior?: string;
  departamentoNuevo?: string;
  motivo?: string;
  usuarioId: string;
  nombreTrabajador: string;
  /**
   * Evaluaciones cuyo perfil de riesgo se refresca con el cargo nuevo.
   * Vacío = no se toca ninguna, que es lo razonable en un traslado: una
   * evaluación es un registro clínico con fecha y describía bien el puesto de
   * entonces. En una corrección sí se pasan todas.
   */
  evaluacionesAActualizar?: { id: string; factoresRiesgo?: any; recomendaciones?: string[]; recomendacionesOtras?: string }[];
  /**
   * true si el cargo estaba mal registrado (corrección) en vez de haber
   * cambiado de verdad (traslado). Solo afecta a cómo se anota y se audita.
   */
  esCorreccion?: boolean;
}

export interface ResultadoCambioCargo {
  evaluacionesActualizadas: number;
  /** Evaluaciones que no se pudieron actualizar, con el motivo. */
  fallidas: { id: string; motivo: string }[];
}

/**
 * Aplica el cambio de cargo.
 *
 * El orden importa: primero las evaluaciones y al final la ficha, para que un
 * fallo a mitad no deje al trabajador con un cargo que sus evaluaciones no
 * reflejan.
 */
export async function cambiarCargo(p: PeticionCambioCargo): Promise<ResultadoCambioCargo> {
  const perfilNuevo = await getPerfilRiesgo(p.cargoNuevo);
  const seleccionadas = p.evaluacionesAActualizar ?? [];
  const fallidas: ResultadoCambioCargo['fallidas'] = [];
  let actualizadas = 0;

  if (seleccionadas.length > 0 && !perfilNuevo) {
    throw new Error(`El cargo «${p.cargoNuevo}» no tiene perfil de riesgo, así que no hay con qué actualizar las evaluaciones.`);
  }

  if (perfilNuevo) {
    const recomendaciones = recomendacionesDesdeMedidas(medidasDePerfil(perfilNuevo));
    for (const ev of seleccionadas) {
      try {
        await updateDoc(doc(db, 'evaluaciones', ev.id), {
          factoresRiesgo: factoresRiesgoDesdePerfil(perfilNuevo, ev.factoresRiesgo ?? {}),
          recomendaciones: recomendaciones.recomendaciones,
          recomendacionesOtras: recomendaciones.recomendacionesOtras,
          // Rastro de que la Sección G se rehízo, con qué cargo y desde qué
          // estado: guardar el bloque anterior deja la corrección reversible,
          // que es lo mínimo al reescribir un registro clínico.
          perfilCargoActualizado: {
            cargoAnterior: p.cargoAnterior,
            cargoNuevo: p.cargoNuevo,
            esCorreccion: !!p.esCorreccion,
            fecha: new Date(),
            usuarioId: p.usuarioId,
            anterior: {
              factoresRiesgo: ev.factoresRiesgo ?? null,
              recomendaciones: ev.recomendaciones ?? [],
              recomendacionesOtras: ev.recomendacionesOtras ?? '',
            },
          },
          updatedAt: new Date(),
          updatedBy: p.usuarioId,
        });
        await registrarAuditoria('editar', 'evaluacion', ev.id,
          `${p.esCorreccion ? 'Corrigió' : 'Actualizó'} el perfil de riesgo de una evaluación de ${p.nombreTrabajador}: «${p.cargoAnterior}» → «${p.cargoNuevo}»`);
        actualizadas++;
      } catch (err) {
        console.error('No se pudo actualizar la evaluación', ev.id, err);
        fallidas.push({ id: ev.id, motivo: err instanceof Error ? err.message : 'error desconocido' });
      }
    }
  }

  const cambio: CambioCargo = {
    cargoAnterior: p.cargoAnterior,
    cargoNuevo: p.cargoNuevo,
    departamentoAnterior: p.departamentoAnterior || '',
    departamentoNuevo: p.departamentoNuevo || '',
    motivo: p.motivo || '',
    evaluacionesActualizadas: actualizadas,
    esCorreccion: !!p.esCorreccion,
    fecha: new Date(),
    usuarioId: p.usuarioId,
  };

  await updateDoc(doc(db, 'trabajadores', p.trabajadorId), {
    puestoTrabajo: p.cargoNuevo,
    ...(p.departamentoNuevo ? { departamento: p.departamentoNuevo } : {}),
    ...(cargoPorNombre(p.cargoNuevo)?.codigo ? { codigoCargo: cargoPorNombre(p.cargoNuevo)!.codigo } : {}),
    historialCargos: arrayUnion(cambio),
    updatedAt: new Date(),
    updatedBy: p.usuarioId,
  });

  await registrarAuditoria('editar', 'trabajador', p.trabajadorId,
    `${p.esCorreccion ? 'Corrigió el cargo mal registrado de' : 'Cambió el cargo de'} ${p.nombreTrabajador}: «${p.cargoAnterior}» → «${p.cargoNuevo}»`
    + (actualizadas ? ` (actualizó ${actualizadas} evaluación(es))` : ''));

  return { evaluacionesActualizadas: actualizadas, fallidas };
}
