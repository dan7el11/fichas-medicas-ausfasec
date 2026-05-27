# Export — Rediseño Dashboard (Master-Detail)

Este paquete porta el prototipo HTML (`Fichas Médicas - Prototipo.html` / variante B) al stack real del repo:
**Vite + React 18 + TypeScript + Tailwind + React Router + Firebase + lucide-react**.

> ⚠️ **No es un reemplazo completo del repo.** Es un set de archivos drop-in que **reemplaza/redefine `Dashboard.tsx`** y agrega componentes, constantes y helpers para el rediseño. El resto del repo (Login, NuevaEvaluacion, DetalleTrabajador, NuevoTrabajador, UserProfile, AuthContext, firebase.ts, types/index.ts) **NO se toca**.

---

## Estructura del paquete

```
export/
├── index.html                              # reemplaza el de la raíz (añade fuentes Google)
├── tailwind.config.js                      # reemplaza el actual (añade tokens de marca)
└── src/
    ├── index.css                           # reemplaza el actual (añade vars CSS)
    ├── constants/
    │   └── medical.ts                      # NUEVO — AREAS, PUESTOS_POR_AREA, AREA_COLORS, RIESGOS, etc.
    ├── utils/
    │   └── medicalHelpers.ts               # NUEVO — iniciales, fmtDate, workerStatus, etc.
    ├── components/
    │   └── dashboard/                      # NUEVO
    │       ├── TopBar.tsx
    │       ├── Sidebar.tsx
    │       ├── QuickView.tsx
    │       └── FullFicha.tsx
    └── pages/
        └── Dashboard.tsx                   # REEMPLAZA el actual
```

---

## Cómo integrar

### 1. Copiar archivos al repo
Desde la raíz del repo, copia todo el contenido de `export/` sobre tu árbol actual. Vas a sobreescribir:

- `index.html`
- `tailwind.config.js`
- `src/index.css`
- `src/pages/Dashboard.tsx`

Y vas a agregar (no existían):

- `src/constants/medical.ts`
- `src/utils/medicalHelpers.ts`
- `src/components/dashboard/*.tsx`

### 2. Instalar dependencias (ya están todas)
`react-router-dom`, `firebase`, `lucide-react` ya están en tu `package.json`. No hace falta instalar nada nuevo.

### 3. Verificar
```bash
npm run dev
```

Login → entra al sistema → deberías ver el master-detail con sidebar a la izquierda y la vista rápida a la derecha.

---

## Decisiones de adaptación al repo existente

| Aspecto del prototipo | Cómo se mapea al repo |
|---|---|
| `WORKERS` mock con `area` y `edad` | `Trabajador` de Firestore NO tiene `area` ni `edad`. `area` se **deriva del puesto** vía `PUESTOS_POR_AREA` en `deriveAreaFromPuesto()`. `edad` se omite (no estaba en `types/index.ts`). Si después agregas el campo, ajusta `medicalHelpers.ts` y `QuickView.tsx`/`FullFicha.tsx`. |
| `lastEval`, `workerStatus` | Reescritos en `medicalHelpers.ts` para operar sobre el `EvaluacionMedica` real, mapeando el enum `aptitudMedica` (`apto` / `aptoObservacion` / `aptoLimitaciones` / `noApto`) al label legible. |
| Tipos `Pre-empleo` / `Periódico` etc. | El tipo `EvaluacionMedica` actual NO tiene un campo `tipoEvaluacion`. El filtro está cableado pero **inactivo** — déjalo así o agrega `tipoEvaluacion: TipoEvaluacion` al tipo y descomenta la línea marcada en `Dashboard.tsx`. |
| Modales de **Nueva evaluación** y **Nuevo trabajador** | El repo ya tiene **páginas dedicadas** (`/evaluar/:id` y `/nuevo-trabajador`). Los botones del dashboard navegan ahí en vez de abrir modal. Si prefieres modal, hay que extraerlos del prototipo a `components/dashboard/`. |
| Ver ficha completa (botón "Ver ficha completa ↗") | Pasa el `view='full'` interno (muestra `FullFicha` inline). El otro botón "Imprimir PDF"/"Editar datos" navega a `/trabajador/:id` que ya tiene la página completa. |
| Color primario `#0a6b3b` | Expuesto como `--brand-primary` en `index.css` + `brand.primary` en Tailwind. Todos los componentes lo consumen vía `var(--brand-primary, #0a6b3b)`. |
| Tweaks panel del prototipo | **Removido** — era solo para iterar en diseño. Si quieres mantener controles de densidad / agrupar por área en producción, pásalos como props o como settings de usuario en Firestore. |

---

## Lo que **NO** está incluido

- Modal de **Nueva evaluación** dentro del dashboard. El repo usa página dedicada `/evaluar/:trabajadorId` (`NuevaEvaluacion.tsx`).
- Modal de **Nuevo trabajador** dentro del dashboard. Idem — usa `/nuevo-trabajador`.
- Página individual del trabajador (`DetalleTrabajador.tsx`) — el repo ya tiene la suya. Si quieres aplicar el mismo lenguaje visual (hero + tabs + timeline) ahí, dímelo y porto `FullFicha.tsx` también a esa ruta.
- Tests.

---

## Próximos pasos sugeridos

1. **Agregar `tipoEvaluacion`** al tipo `EvaluacionMedica` y guardar el valor desde `NuevaEvaluacion.tsx`. Con eso, el filtro "Tipo eval." del sidebar se activa automáticamente.
2. **Persistir el área** en `Trabajador` (campo `area: Area`) y guardarla desde `NuevoTrabajador.tsx`. Más confiable que derivarla del puesto.
3. Aplicar la misma estética (hero + timeline + tarjetas) a **`DetalleTrabajador.tsx`** para consistencia entre el dashboard y la página individual.
4. Mover el botón **Cerrar sesión** flotante a un menú dentro de la `TopBar` (avatar dropdown) si quieres limpiar la UI.

---

## Comandos útiles

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build

# Vista previa del build
npm run preview
```

---

¿Dudas o quieres que adapte algún otro flujo (página individual, modales internos, etc.)? Avísame.
