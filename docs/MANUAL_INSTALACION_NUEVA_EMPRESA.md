# Manual de instalación para una empresa nueva

Guía paso a paso para montar el sistema de fichas médicas para **una empresa
cliente**. El modelo es *single-tenant*: **cada empresa tiene su propio proyecto
de Firebase** (su propia base de datos, login y archivos, separados de los demás
clientes). Repite este manual completo por cada empresa nueva.

> Pensado para seguirse sin ser programador. Donde se puede, se usa la **página
> web de Firebase** en vez de comandos.

---

## ✅ Checklist rápido (resumen)

Para cada empresa nueva:

- [ ] 1. Crear el proyecto en Firebase
- [ ] 2. Activar Authentication, Firestore y Storage
- [ ] 3. Publicar las reglas de seguridad (Firestore + Storage)
- [ ] 4. Conectar la app con el proyecto (archivo `.env`)
- [ ] 5. Publicar la app (hosting)
- [ ] 6. Crear el primer usuario administrador
- [ ] 7. Configurar los datos de la empresa (nombre, RUC, logo…)
- [ ] 8. Cargar los trabajadores (CSV)
- [ ] 9. Entregar accesos y hacer una prueba final

---

## 1. Crear el proyecto en Firebase

1. Entra a **https://console.firebase.google.com**.
2. Clic en **Agregar proyecto**.
3. Pon un nombre que identifique al cliente (ej. `fichas-empresa-x`). Acepta los
   pasos. Puedes desactivar Google Analytics (no es necesario).
4. Espera a que se cree y ábrelo.

## 2. Activar Authentication, Firestore y Storage

Dentro del proyecto, en el menú izquierdo (**Compilación / Build**):

- **Authentication** → *Comenzar* → pestaña **Sign-in method** → activa
  **Correo electrónico/contraseña** → Guardar.
- **Firestore Database** → *Crear base de datos* → elige **modo producción** →
  ubicación (deja la sugerida o `nam5`/`us-central`) → Habilitar.
- **Storage** → *Comenzar* → acepta el modo producción → Listo.

## 3. Publicar las reglas de seguridad

> Las reglas son las mismas para todas las empresas. Aquí van por la web; el
> contenido exacto está en los archivos `firestore.rules` y `storage.rules` del
> proyecto (cópialo de ahí, o de `docs/SEGURIDAD_Y_DESPLIEGUE.md`).

- **Firestore Database** → pestaña **Reglas** → borra todo → pega el contenido de
  `firestore.rules` → **Publicar**.
- **Storage** → pestaña **Reglas** → borra todo → pega el contenido de
  `storage.rules` → **Publicar**.

Qué logran: nadie sin iniciar sesión puede leer/escribir datos, y ningún usuario
puede auto-asignarse el rol de administrador.

## 4. Conectar la app con el proyecto (`.env`)

1. En Firebase: engranaje **⚙ → Configuración del proyecto**.
2. Baja a **Tus apps**. Si no hay una app web, clic en el ícono **`</>`** y
   regístrala (sin hosting por ahora). Si ya hay, ábrela.
3. Verás un bloque **`firebaseConfig`** con varios valores (`apiKey`,
   `authDomain`, etc.).
4. En el código del sistema, copia el archivo `.env.example` a uno nuevo llamado
   `.env` y pega cada valor en el campo correspondiente (las instrucciones están
   dentro del propio `.env.example`).

## 5. Publicar la app (hosting)

Tienes dos opciones. Elige una.

### Opción A — Firebase Hosting (todo dentro de Firebase, recomendada)

Requiere la herramienta de Firebase una sola vez:
```bash
npm install -g firebase-tools
firebase login
```
Luego, dentro de la carpeta del proyecto:
```bash
npm install
npm run build
firebase deploy --only hosting --project EL-ID-DEL-PROYECTO
```
Al terminar te da una dirección web (`https://EL-ID.web.app`) que es la app del
cliente. (El `firebase.json` ya está configurado para esto, incluido el ruteo de
la aplicación.)

> Puedes publicar también las reglas por aquí en vez de por la web:
> `firebase deploy --only firestore:rules,storage --project EL-ID-DEL-PROYECTO`

### Opción B — Otro hosting (Netlify, Vercel…)

1. `npm install` y luego `npm run build` (genera la carpeta `dist`).
2. Sube el contenido de `dist` a tu hosting.
3. Configura que **todas las rutas** redirijan a `index.html` (ya hay un archivo
   `public/_redirects` que Netlify entiende automáticamente).

## 6. Crear el primer usuario administrador

Las reglas impiden auto-asignarse admin, así que el primero se crea a mano:

1. Pide al médico/responsable que **inicie sesión una vez** en la app con su
   correo y contraseña (esto crea su cuenta).
   - Si aún no tiene cuenta: Firebase → **Authentication** → **Usuarios** →
     *Agregar usuario* (correo + contraseña).
2. Firebase → **Firestore Database** → colección `usuarios` → abre el documento
   cuyo id es el **UID** de ese usuario (lo ves en Authentication → Usuarios).
   - Si el documento no existe, créalo con ese id.
3. Agrega un campo: nombre `rol`, tipo *string*, valor **`admin`**. Guarda.

Ese usuario ya es administrador y puede gestionar a los demás.

## 7. Configurar los datos de la empresa

En la app, inicia sesión y entra a **Configuración** (ruta `/configuracion`).
Completa:

- **Nombre de la institución** (aparece en encabezados, login y formularios).
- **RUC**, **CIU**, **Establecimiento / Área médica**.
- **Prefijo del N° de archivo** (ej. siglas del cliente).
- **Dominio de correo** (para el ejemplo del login).
- **URL del logo** (opcional; si se deja vacío usa el logo por defecto).

Guarda. A partir de ahí, el nombre y datos del cliente aparecen en toda la app y
en los PDF (SO-RE-38/40, matriz de reportes, certificados de permisos).

## 8. Cargar los trabajadores (CSV)

En **Panel de Administración** (ruta `/admin`) → pestaña Trabajadores →
importar CSV.

- Columnas (en este orden): `primerApellido, segundoApellido, primerNombre,
  segundoNombre, cedula, sexo, puestoTrabajo, departamento`.
- Obligatorias: **primerApellido, primerNombre, cedula**.
- `sexo` debe ser **M** o **F**.
- `departamento` es el **área** del trabajador (aparece en los filtros del
  sistema; ej. *Planificación*, *TTHH*, *Seguridad y Ambiente*).
- Las cédulas repetidas se omiten automáticamente.
- El importador ofrece descargar una **plantilla** con el formato correcto.

## 9. Entregar accesos y prueba final

- Comparte con el cliente la dirección web de su app y sus credenciales.
- Verifica de punta a punta: iniciar sesión, crear un trabajador, registrar una
  atención **con medicación** (debe descontar del inventario), generar un PDF y
  subir un archivo de examen.

---

## Mantenimiento por cliente

- **Respaldos:** programa una exportación periódica de los datos (Firestore
  permite exportar). Es lo primero que pregunta un cliente serio.
- **Actualizaciones de la app:** cuando publiques mejoras, repite el paso 5
  (build + deploy) en el proyecto de cada cliente.
- **Formularios oficiales:** si el MSP/IESS cambia los formatos SO-RE, hay que
  actualizar las plantillas de PDF y volver a publicar.

## Notas y límites

- El aislamiento entre empresas se basa en **un proyecto Firebase por empresa**.
  No mezclar clientes en el mismo proyecto.
- Plan gratuito de Firebase (Spark): suele alcanzar para una clínica pequeña.
  Si se superan los límites, hay que pasar al plan Blaze (pago por uso).
