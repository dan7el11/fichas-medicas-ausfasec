# Plan de comercialización — Camino B (una instalación por empresa)

> Objetivo: pasar de "MVP interno de una sola empresa" a un producto
> **instalable por empresa (single-tenant)** listo para un primer cliente
> piloto, de forma legal y segura, sin reingeniería mayor.

## Decisión de arquitectura

En el Camino B, el aislamiento de datos más limpio y defendible legalmente es
**un proyecto de Firebase separado por cada empresa**. Cada cliente tiene su
propia base de datos, su propio login y sus propios respaldos, físicamente
aparte. Esto simplifica las reglas de seguridad (no hay que filtrar por empresa)
y reduce el riesgo de fuga de datos entre clientes. El costo es operativo:
administrar N proyectos, perfectamente manejable para los primeros 1–5 clientes.

---

## Fase 0 — Fundación legal (antes de tocar código)

- **Resolver la propiedad intelectual.** Confirmar por escrito que el sistema es
  legalmente tuyo para venderlo. Si se construyó como empleado de AUSTROGAS, con
  su tiempo o recursos, podría pertenecerles. **Si no se resuelve a tu favor, el
  plan se detiene aquí.**
- **Definir cómo contratar** (persona natural con RUC al inicio).
- **Contrato de servicio** + **acuerdo de tratamiento de datos** acorde a la Ley
  Orgánica de Protección de Datos Personales (datos de salud = categoría
  sensible). Conviene consulta con abogado.

**Esfuerzo:** bajo en horas, pero depende de terceros (semanas de calendario).
Arrancar ya, en paralelo a la Fase 1.

## Fase 1 — Seguridad mínima viable *(bloqueante técnico #1)*

- Escribir `firestore.rules` (denegar por defecto; requerir autenticación;
  impedir auto-promoción a admin). **HECHO** — ver archivo en la raíz.
- Escribir `storage.rules` para los archivos de exámenes y permisos. **HECHO.**
- Probar las reglas con el emulador antes de publicarlas. Ver
  `docs/SEGURIDAD_Y_DESPLIEGUE.md`.

**Estado:** reglas escritas; falta probar y publicar (`firebase deploy`).

## Fase 2 — Quitar la marca AUSTROGAS / hacerlo configurable

- Centralizar nombre, RUC, CIU, establecimiento, logo, textos de certificados y
  número de archivo en la configuración de Firestore (`useEmpresa` +
  pantalla de Configuración), usándola de forma consistente en los ~14 lugares
  donde hoy "AUSTROGAS" está incrustado (incluyendo PDF y certificados).
- Logo configurable (subible), no archivo fijo.
- Identificar catálogos en código (áreas, puestos, riesgos) para configuración.

**Esfuerzo:** medio. Sin dependencias; en paralelo a la Fase 1.

## Fase 3 — Proceso repetible de despliegue por cliente

- Checklist paso a paso: crear proyecto Firebase, variables de entorno, publicar
  reglas, desplegar (Firebase Hosting), crear admin inicial, cargar
  configuración de empresa. Base inicial en `docs/SEGURIDAD_Y_DESPLIEGUE.md`.
- Carga inicial de trabajadores por CSV (ya existe en AdminPanel).

**Esfuerzo:** medio (mucho es documentar y probar el proceso una vez).
**Dependencia:** Fases 1 y 2.

## Fase 4 — Endurecimiento mínimo para inspirar confianza

- Validación de rangos médicos en signos vitales (no aceptar 999/999, etc.).
- Errores visibles al usuario en flujos críticos (no solo `console.error`).
- Respaldo / exportación completa de datos de la instancia.
- Ampliar pruebas en cálculos críticos.

**Esfuerzo:** medio. Priorizar validación de rangos y respaldo.

## Fase 5 — Piloto con un cliente real

- Conseguir UNA empresa piloto (cobrar poco a cambio de retroalimentación y
  referencia). Acordar expectativas de soporte realistas. Iterar.

## Fase 6 — Operación y precio

- Implementación única **$300–1.000** + mensualidad **$30–150** (referencia
  SBU ~$470). Ajustar por tamaño de empresa.
- Proceso de soporte y mantenimiento (incluye actualizar formularios oficiales
  SO-RE del MSP/IESS cuando cambien).

---

## Secuencia y dependencias

```
Fase 0 (legal) ──────────► (en paralelo, no bloquea código)
        │
Fase 1 (seguridad) ──┬──► Fase 3 (despliegue) ──► Fase 5 (piloto) ──► Fase 6 (operación)
Fase 2 (des-marca) ──┘            │
                          Fase 4 (endurecimiento) ──► (alimenta el piloto)
```

Camino crítico técnico: **Seguridad → Des-marca → Despliegue → Piloto.**
La Fase 0 corre en paralelo pero debe estar resuelta antes de cobrar.

## Qué NO hacer todavía

- No construir multi-tenancy real (Camino A; después de validar con clientes).
- No perseguir 100% de cobertura de pruebas ni refactorizar archivos grandes ahora.
- No agregar funciones nuevas hasta tener el piloto.

## Plazo honesto

Fases 1–4 (trabajo técnico): **algunas semanas de trabajo enfocado.**
Fase 0: depende de terceros. Fase 5: depende de ti y del mercado.
Primer cliente real bien atendido: **2 a 4 meses** con foco.
