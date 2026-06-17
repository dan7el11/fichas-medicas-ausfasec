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

## Fase 2 — Quitar la marca AUSTROGAS / hacerlo configurable  ✅ HECHO

- **HECHO.** La identidad de la empresa (institución, RUC, CIU, establecimiento,
  prefijo del N° de archivo, logo y dominio de correo) se centralizó en un
  contexto (`EmpresaContext`) que carga la configuración una sola vez y la
  entrega a toda la app. Se reemplazaron los ~14 puntos donde "AUSTROGAS" estaba
  incrustado: encabezado, login, página de inicio, panel admin, PDF de la matriz
  de reportes, los formularios SO-RE-38/40 (FichaTrabajador) y los certificados
  de permisos.
- **HECHO.** La pantalla de Configuración permite editar todos esos campos,
  incluido un logo por URL (`logoUrl`); si se deja vacío usa el logo por defecto.
- **HECHO.** El título de la pestaña del navegador se ajusta a la empresa.
- **Pendiente menor:** el logo *impreso dentro de los PDF* sigue usando el logo
  embebido (`LOGO_EMPRESA`); cambiarlo por empresa requiere cargar la imagen de
  forma asíncrona en jsPDF (queda para Fase 4).
- **Pendiente menor:** los valores por defecto en `EmpresaContext` siguen siendo
  los de AUSTROGAS como respaldo seguro; se pueden dejar neutros una vez
  confirmado que la instancia AUSTROGAS tiene su configuración guardada.

**Estado:** completado salvo los dos pendientes menores anotados.

## Fase 3 — Proceso repetible de despliegue por cliente  ✅ HECHO

- **HECHO.** Manual completo paso a paso en
  `docs/MANUAL_INSTALACION_NUEVA_EMPRESA.md`: crear el proyecto Firebase,
  activar Auth/Firestore/Storage, publicar reglas, conectar la app (`.env`),
  publicar la app, crear el primer admin, configurar la empresa y cargar
  trabajadores por CSV. Escrito para seguirse sin ser programador (método web
  donde se puede).
- **HECHO.** `firebase.json` incluye configuración de **Firebase Hosting** (con
  ruteo SPA), de modo que publicar la app es un solo comando
  (`firebase deploy --only hosting`).
- **HECHO.** `.env.example` documentado campo por campo (de dónde sale cada
  valor).
- La carga inicial de trabajadores por CSV ya existía en el Panel de
  Administración; queda documentado su formato exacto.
- **HECHO (asistente).** Nuevo asistente de configuración guiado dentro de la
  app (`/configuracion-inicial`, `src/pages/ConfiguracionInicial.tsx`): en 4
  pasos pide datos de la empresa, sube el logo (a Storage) y carga los
  trabajadores por CSV. Accesos desde Inicio (admin) y desde la pantalla de
  Configuración. Hace el onboarding de cada empresa mucho más armónico.

**Estado:** completado.

## Fase 4 — Endurecimiento mínimo para inspirar confianza  ✅ EN BUENA PARTE

- **HECHO.** Validación de rangos médicos en signos vitales: nuevo módulo
  `src/utils/signosValidacion.ts` (única fuente de verdad) que distingue valores
  imposibles (error, ej. 999/999) de valores clínicamente notables (alerta).
  Conectado al formulario de signos vitales con mensajes por campo y resumen, y
  con pruebas unitarias (`signosValidacion.test.ts`, 11 casos).
- **HECHO.** Respaldo / exportación completa: `src/services/respaldo.ts` lee
  todas las colecciones y descarga un JSON; botón "Descargar respaldo" en el
  Panel de Administración.
- **HECHO (parcial).** Errores visibles al usuario: el respaldo avisa en caso de
  fallo; muchos flujos ya usan toasts. Queda repasar servicios que solo hacen
  `console.error` para mostrar mensaje al usuario.
- **Pendiente menor:** respaldo automático/programado (hoy es manual) y pruebas
  en más utilidades.

**Estado:** los dos puntos de mayor valor (validación de rangos y respaldo)
están completos.

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
