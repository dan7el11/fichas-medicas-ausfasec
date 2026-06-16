# Seguridad y despliegue

Esta guía explica cómo **probar** y **publicar** las reglas de seguridad
(`firestore.rules` y `storage.rules`) y cómo montar una instancia nueva para una
empresa (modelo single-tenant: un proyecto Firebase por empresa).

> ⚠️ Importante: las reglas que están en el repositorio **no tienen efecto**
> hasta que se publican con `firebase deploy`. Escribirlas no cambia nada en
> producción por sí solo.

---

## 1. Requisitos

- Node.js instalado.
- Firebase CLI:
  ```bash
  npm install -g firebase-tools
  firebase login
  ```

## 2. Probar las reglas localmente (recomendado antes de publicar)

Con el emulador puedes verificar que las reglas no rompen la app sin tocar los
datos reales:

```bash
firebase emulators:start --only firestore,storage
```

Levanta la app apuntando al emulador y comprueba los flujos clave:
- Iniciar sesión y ver el listado de trabajadores.
- Crear/editar un trabajador, una evaluación y una atención.
- Guardar una atención **con medicación** (debe descontar del inventario).
- Subir un archivo de examen y un certificado de permiso.

## 3. Publicar las reglas en producción

Publica **solo** las reglas (no toca el código ni el hosting):

```bash
firebase deploy --only firestore:rules,storage
```

Si el proyecto activo no es el correcto:

```bash
firebase use <id-del-proyecto>
```

### Qué cambia al publicar estas reglas

- **Se cierra el acceso sin sesión.** Antes, cualquiera con la API key podía
  leer/escribir. Ahora se exige haber iniciado sesión.
- **Nadie puede auto-asignarse el rol `admin`.** El primer admin se establece a
  mano (ver punto 5).
- **El trabajo clínico diario no cambia:** cualquier usuario autenticado del
  equipo sigue pudiendo leer y escribir trabajadores, evaluaciones, atenciones,
  permisos, exámenes, signos e inventario.

---

## 4. Montar una instancia nueva para una empresa (single-tenant)

1. **Crear un proyecto Firebase nuevo** (uno por empresa) en la consola.
2. Habilitar **Authentication** (Email/Password) y **Firestore** y **Storage**.
3. Copiar las credenciales del proyecto a un archivo `.env` (ver `.env.example`).
4. Publicar las reglas: `firebase deploy --only firestore:rules,storage`.
5. Publicar los índices: `firebase deploy --only firestore:indexes`.
6. Crear el **usuario administrador** (ver punto 5).
7. Cargar la **configuración de la empresa** (nombre, RUC, etc.) desde la
   pantalla de Configuración.
8. Cargar los **trabajadores** (importación CSV en el Panel de Administración).
9. Desplegar la app (p. ej. `firebase deploy --only hosting` si se usa Firebase
   Hosting, o subir el resultado de `npm run build` al hosting elegido).

## 5. Crear el primer administrador (manual y seguro)

Como las reglas impiden auto-asignarse `admin`, el primer admin se crea a mano:

1. El usuario inicia sesión una vez en la app (esto crea su cuenta de Auth).
2. En la consola de Firebase → **Firestore** → colección `usuarios`, abrir (o
   crear) el documento cuyo id es el **UID** de ese usuario.
3. Agregar/editar el campo `rol` con el valor `admin`.

A partir de ahí, ese usuario puede gestionar a los demás.

> Nota técnica: el código todavía tiene un "bootstrap" antiguo que intentaba
> asignar `admin` automáticamente a correos que contienen "admin". Con estas
> reglas ese intento es rechazado (es justamente la vulnerabilidad que cerramos).
> Ese código debería eliminarse en la Fase 2/4; mientras tanto, es inofensivo
> (falla silenciosamente y se continúa).

---

## 6. Limitaciones actuales (pendientes de fases siguientes)

- El aislamiento entre empresas depende de usar **un proyecto por empresa**. No
  hay separación por `empresaId` dentro de una misma base (eso sería el Camino A,
  multi-tenant).
- `configuracion` e `inventarios` permiten escritura a cualquier usuario
  autenticado para no romper flujos existentes. Se pueden endurecer a solo-admin
  una vez confirmado que sus pantallas están restringidas a admin en la interfaz.
