# Despliegue en Cloudflare Workers + Supabase

Guía para publicar Kings Legend con **Cloudflare Workers** (la aplicación) y **Supabase** (la base de datos
PostgreSQL). Es la opción principal desde noviembre de 2026; la del VPS sigue en `docs/DESPLIEGUE.md`.

```
Navegador ──► Cloudflare Worker «claudekingslegend» (Next.js con OpenNext)
                    │
                    ▼
              Hyperdrive (grupo de conexiones de Cloudflare)
                    │
                    ▼
              Supabase · PostgreSQL 17 · proyecto «ClaudeKingsLegend» (Irlanda, eu-west-1)
```

## 0. Antes de empezar: el plan de Cloudflare

Necesitas **Workers Paid (5 $/mes)**. El plan gratuito corta cada petición a los **10 ms de CPU**, y solo
comprobar una contraseña al iniciar sesión gasta unos **80 ms** (se cifra con scrypt para que no se pueda
descifrar si alguien roba la base). Con el plan gratuito, nadie podría registrarse ni entrar (error 1102).
También renderizar páginas con cuadros o clasificaciones pasa a menudo de 10 ms.

Cloudflare → *Workers & Pages* → *Plans* → **Workers Paid**. Incluye 10 millones de peticiones y 30 millones
de ms de CPU al mes, más que suficiente para una liga.

## 1. La base de datos (ya creada)

La base ya está creada en tu proyecto de Supabase **ClaudeKingsLegend**: 27 tablas, 19 tipos enumerados,
91 índices, seguridad a nivel de fila en todas las tablas y las migraciones registradas para que la
aplicación no intente aplicarlas otra vez. No tienes que ejecutar nada.

Lo único que necesitas de Supabase es la **cadena de conexión**:

1. Supabase → proyecto *ClaudeKingsLegend* → botón **Connect** (arriba).
2. Copia la de **Direct connection**:
   `postgresql://postgres:[YOUR-PASSWORD]@db.yipkuufmyggzgjrkwuew.supabase.co:5432/postgres`
3. Sustituye `[YOUR-PASSWORD]` por la contraseña de la base de datos. Si no la recuerdas:
   *Project Settings → Database → Reset database password* (usa una larga y sin símbolos raros).

> Si en el paso 2 Hyperdrive no consigue conectar (la conexión directa de Supabase solo tiene IPv6 en el
> plan gratuito), usa en su lugar la de **Session pooler** del mismo botón *Connect*
> (`postgres.yipkuufmyggzgjrkwuew@aws-…-eu-west-1.pooler.supabase.com:5432`).

## 2. Hyperdrive

Hyperdrive mantiene abiertas las conexiones con Supabase desde la red de Cloudflare. Sin él, cada consulta
tendría que abrir una conexión nueva cifrada hasta Irlanda.

1. Cloudflare → *Storage & Databases* → **Hyperdrive** → *Create configuration*.
2. Nombre: `kings-legend-supabase`. Pega la cadena de conexión del paso 1.
3. **Desactiva la caché (Caching: off).** Es importante: con la caché activada, Hyperdrive podría devolver
   durante un minuto datos antiguos (una sesión ya cerrada, un resultado sin actualizar).
4. Crea la configuración y copia su **ID**.
5. Añade el ID a `wrangler.jsonc`, en la raíz del repositorio (puedes editarlo desde GitHub o pasármelo y
   lo hago yo). Debe quedar así:

   ```jsonc
     "observability": { "enabled": true },
     "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "EL_ID_QUE_HAS_COPIADO" }]
   }
   ```

Con línea de comandos, en lugar del panel:

```bash
npx wrangler hyperdrive create kings-legend-supabase --caching-disabled --connection-string="postgresql://postgres:CONTRASEÑA@db.yipkuufmyggzgjrkwuew.supabase.co:5432/postgres"
```

## 3. Variables y secretos del Worker

Cloudflare → *Workers & Pages* → **claudekingslegend** → *Settings*.

**Variables de compilación** (*Build* → *Variables and secrets*). Se incrustan al compilar:

| Nombre | Valor |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | La dirección exacta de la web, con `https://` y sin barra final. Al principio, la de `workers.dev` que ves en *Settings → Domains & Routes* (p. ej. `https://claudekingslegend.TU-SUBDOMINIO.workers.dev`). Si después pones un dominio propio, cámbiala y vuelve a desplegar. |

**Variables y secretos de ejecución** (*Variables and Secrets*):

| Nombre | Tipo | Valor |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | **Secret** | 48 caracteres aleatorios. Genera uno con `openssl rand -base64 48` o en un gestor de contraseñas. Si lo cambias, se cierran todas las sesiones. |
| `MAIL_FROM` | Text (opcional) | Remitente de los correos: `Kings Legend <tu-cuenta@gmail.com>` con Gmail, o una dirección de tu dominio con Resend (paso 6). |
| `SMTP_HOST` | Text (opcional) | `smtp.gmail.com` (correo con Gmail, paso 6). |
| `SMTP_PORT` | Text (opcional) | `465` |
| `SMTP_USER` | Text (opcional) | Tu dirección de Gmail completa. |
| `SMTP_PASSWORD` | **Secret** (opcional) | La *contraseña de aplicación* de Gmail (16 letras, paso 6). Nunca la contraseña normal de tu cuenta. |
| `RESEND_API_KEY` | **Secret** (opcional) | Clave de [Resend](https://resend.com), si usas Resend en lugar de Gmail (paso 6). |
| `GOOGLE_CLIENT_ID` | Text (opcional) | ID de cliente OAuth de Google, para «Continuar con Google» (paso 6 bis). |
| `GOOGLE_CLIENT_SECRET` | **Secret** (opcional) | Secreto de ese cliente OAuth. |

`wrangler.jsonc` lleva `keep_vars: true`: un despliegue no borra lo que configures en el panel.

La URL tiene que coincidir exactamente con la que usas en el navegador: el inicio de sesión rechaza
peticiones de otros orígenes (protección CSRF).

## 4. Compilación y despliegue

En *Settings → Build* deja la configuración por defecto:

| Campo | Valor |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

`npm run build` detecta que está en Cloudflare (variable `WORKERS_CI`) y compila el Worker con OpenNext; en
cualquier otro sitio hace un `next build` normal. `npx wrangler deploy` detecta OpenNext y despliega.

Los cambios están en la rama `claude/great-cannon-uadmuu`. Cloudflare despliega la rama de producción
(normalmente `main`): cuando hayas hecho los pasos 2 y 3, fusiona la rama y Cloudflare desplegará solo.

## 5. Comprobar y crear el primer administrador

1. Abre `https://TU-URL/api/health`. Debe responder `{"status":"ok","database":"ok",…}`. Si responde
   `503`, mira el apartado «Problemas frecuentes».
2. Crea tu cuenta en `/registro`.
3. Hazte administrador. En Supabase → *SQL Editor*:

   ```sql
   update users set role = 'admin' where email = 'tu@correo.com';
   ```

   (O pídemelo y lo hago desde aquí.) Desde `/admin/usuarios` podrás nombrar organizadores.
4. Revisa `/admin/ajustes` (correo de contacto, redes) y `/admin/contenido` (privacidad y términos: necesitan
   una revisión legal antes de abrir la liga al público).

## 6. Correo (recomendado)

Sin correo la web funciona, pero no hay verificación de cuentas ni **recuperación de contraseña** (la página
«¿Has olvidado la contraseña?» dice que no está disponible). Hay dos formas; con las dos el correo lleva un
enlace para elegir una contraseña nueva que caduca en 1 hora y sirve una sola vez.

### Opción A: una cuenta de Gmail (gratis, sin dominio propio)

El Worker envía por SMTP con la cuenta de Gmail (sockets TCP de Cloudflare, paquete `worker-mailer`). Lo
mejor es crear una cuenta de Gmail solo para la liga (p. ej. `kingslegend.liga@gmail.com`).

1. En esa cuenta de Google activa la **verificación en dos pasos** (myaccount.google.com → *Seguridad*).
   Sin ella Google no deja crear contraseñas de aplicación.
2. Entra en **myaccount.google.com/apppasswords**, escribe un nombre (p. ej. «Kings Legend») y pulsa
   *Crear*. Google enseña una contraseña de 16 letras una sola vez: cópiala.
3. En el Worker (*Variables and Secrets*) añade `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`,
   `SMTP_USER=` la dirección de Gmail, `MAIL_FROM=Kings Legend <esa-misma-dirección>` y, como **Secret**,
   `SMTP_PASSWORD=` las 16 letras (sin espacios).
4. Vuelve a desplegar. `/admin/ajustes` mostrará «Configurado (SMTP)». Pruébalo en `/recuperar` con tu
   propio correo (si no llega, mira también en *Spam*).

Gmail permite unos 500 correos al día, de sobra para una liga. `MAIL_FROM` tiene que ser la misma dirección
de Gmail: Google no deja enviar en nombre de otra. Si un correo falla, en *Observability → Logs* verás
«[correo] no se ha podido enviar…» con el motivo (sin el destinatario ni el enlace).

### Opción B: Resend (con dominio propio)

1. Crea una cuenta en resend.com y verifica tu dominio (te da registros DNS para añadir en Cloudflare).
2. Crea una API key y guárdala como secreto `RESEND_API_KEY`; define `MAIL_FROM` con una dirección de ese
   dominio.
3. Vuelve a desplegar. `/admin/ajustes` mostrará «Configurado (Resend)».

El plan gratuito de Resend permite 100 correos al día y 3.000 al mes. Sin dominio verificado, Resend solo
envía a tu propia dirección, así que no sirve para los jugadores. Si están definidas las dos opciones, se usa
Resend.

## 6 bis. Entrar con Google

Con esto aparece el botón **«Continuar con Google»** en el acceso y en el registro. Quien entra por primera
vez con Google tiene la cuenta creada al momento (Google ya ha comprobado su correo) y va a completar su
perfil. Si ya tenía cuenta con ese mismo correo, se enlaza con ella. Quien solo usa Google puede crearse
además una contraseña desde «¿Has olvidado la contraseña?» (hace falta el correo del paso 6).

1. Entra en **console.cloud.google.com** con tu cuenta de Google y crea un proyecto (p. ej. «Kings Legend»).
2. *APIs y servicios* → **Pantalla de consentimiento de OAuth** (o *Google Auth Platform* → *Branding*):
   tipo **Externo**, nombre de la aplicación «Kings Legend», tu correo de asistencia y, en *Dominios
   autorizados*, el de la web (p. ej. `workers.dev` o tu dominio). Permisos: `openid`, `email` y `profile`
   (los básicos; no hace falta verificación de Google).
3. **Publica la aplicación** (*Audiencia* → *Publicar aplicación*, estado «En producción»). Mientras está
   «En prueba», solo pueden entrar los correos que añadas como usuarios de prueba.
4. *Credenciales* (o *Clientes*) → **Crear cliente OAuth** → tipo **Aplicación web**:
   - *Orígenes de JavaScript autorizados*: la dirección de la web, p. ej.
     `https://claudekingslegend.TU-SUBDOMINIO.workers.dev`
   - *URIs de redireccionamiento autorizados*: esa misma dirección seguida de `/api/auth/callback/google`, p. ej.
     `https://claudekingslegend.TU-SUBDOMINIO.workers.dev/api/auth/callback/google`
5. Copia el **ID de cliente** a `GOOGLE_CLIENT_ID` (Text) y el **secreto de cliente** a
   `GOOGLE_CLIENT_SECRET` (**Secret**) en *Variables and Secrets* del Worker, y vuelve a desplegar.
   `/admin/ajustes` mostrará «Entrar con Google: Configurado».

Si cambias a un dominio propio, añade el nuevo origen y la nueva URI de redirección en el mismo cliente de
Google (puedes dejar las dos).

## 7. Montar la liga

1. `/admin/torneos/nuevo` → formato **Liga**, por equipos, plazas mínimas y máximas, fechas de inscripción
   y de inicio.
2. Reglas: **ida** o **ida y vuelta**, partidas por enfrentamiento (al mejor de 1, 3, 5 o 7), puntos por
   victoria, derrota y derrota por incomparecencia, y el orden de los desempates (enfrentamiento directo,
   diferencia de partidas, partidas ganadas, series ganadas).
3. Aprobación de inscripciones manual o automática, lista de espera y si se exige Riot ID.
4. **Publicar** → los capitanes inscriben a sus equipos (titulares y suplentes) → apruebas → al **iniciar**
   se genera el calendario completo (método del círculo) y la clasificación se calcula sola con cada
   resultado validado.

## 8. Dominio propio (opcional)

*Settings → Domains & Routes → Add → Custom domain* (el dominio tiene que estar en Cloudflare). Después cambia
`NEXT_PUBLIC_SITE_URL` y vuelve a desplegar. Con dominio propio, además, las imágenes públicas (logotipos,
avatares) se guardan en la caché de Cloudflare y no se vuelven a leer de Supabase.

## 9. Migraciones futuras

Cuando cambie el esquema (`npm run db:generate` crea un archivo nuevo en `drizzle/`), hay que aplicarlo a
Supabase **antes** de desplegar el código que lo usa. Dos formas:

- Pídemelo: lo aplico con la conexión de Supabase de Claude y lo registro en `drizzle.__drizzle_migrations`.
- Desde tu ordenador (PowerShell), con la cadena de conexión del paso 1:

  ```powershell
  $env:DATABASE_URL="postgresql://postgres:CONTRASEÑA@db.yipkuufmyggzgjrkwuew.supabase.co:5432/postgres?sslmode=require&uselibpqcompat=true"
  npm.cmd run db:migrate
  ```

  (Si tu red no tiene IPv6, usa la cadena de *Session pooler*.)

Toda tabla nueva debe llevar `.enableRLS()` en su definición: una prueba lo comprueba (ver
`src/server/db/schema.test.ts`).

## 10. Probar el Worker en tu ordenador

```bash
npm run preview:cf
```

Compila el Worker y lo ejecuta con `workerd` (el mismo motor que Cloudflare) en `http://localhost:8787`. Lee
las variables de un archivo `.dev.vars` (no se sube al repositorio), por ejemplo:

```
DATABASE_URL=postgres://usuario:contraseña@127.0.0.1:5432/base
BETTER_AUTH_SECRET=una-cadena-aleatoria-de-al-menos-32-caracteres
BETTER_AUTH_URL=http://localhost:8787
```

## 11. Problemas frecuentes

| Síntoma | Causa y solución |
| --- | --- |
| Error **1102** («Worker exceeded resource limits») al entrar o registrarse | Estás en el plan gratuito (10 ms de CPU). Pasa a Workers Paid (paso 0). |
| `/api/health` responde `503` | Falta Hyperdrive en `wrangler.jsonc` (paso 2) o la cadena de conexión es incorrecta. En *Observability → Logs* verás «Falta la base de datos…» o el error de conexión. |
| Hyperdrive no puede conectar con Supabase | Usa la cadena de *Session pooler* en lugar de la directa (paso 1) y revisa la contraseña. |
| El inicio de sesión falla sin mensaje claro | `NEXT_PUBLIC_SITE_URL` no coincide con la dirección del navegador (con o sin `www`, `http` frente a `https`). Corrígela y vuelve a desplegar. |
| Tras una semana sin visitas, la web da error de base de datos | El plan gratuito de Supabase **pausa** el proyecto tras 7 días sin actividad. Reactívalo en el panel de Supabase; con la liga en marcha no debería pasar. |
| «Demasiados intentos. Espera unos minutos.» | Límite de intentos de acceso (10 cada 5 minutos por IP). Es intencionado. |
| Google dice **«Error 400: redirect_uri_mismatch»** | La URI de redirección del cliente de Google no coincide letra a letra con `NEXT_PUBLIC_SITE_URL` + `/api/auth/callback/google` (paso 6 bis). |
| Google dice **«Acceso bloqueado: la aplicación no ha completado el proceso de verificación»** | La pantalla de consentimiento sigue «En prueba». Publícala (paso 6 bis, punto 3) o añade ese correo como usuario de prueba. |
| No llega el correo de recuperación | Mira *Spam*. En *Observability → Logs* busca «[correo]». Con Gmail, `535 … Username and Password not accepted` es que `SMTP_PASSWORD` no es una contraseña de aplicación o tiene espacios. |

## 12. Qué no está probado todavía

Todo esto se ha comprobado en local con `workerd` y un PostgreSQL real (ver `docs/AUDITORIA.md`), pero aún
no en tu cuenta de Cloudflare: el envío con Resend, el envío real a Gmail (el envío SMTP desde `workerd` sí se
ha probado, contra un servidor SMTP local), el inicio de sesión con un cliente real de Google (se ha probado
hasta la redirección a Google y la vuelta con error) y la caché de imágenes con dominio propio. Lo primero que hay que mirar tras el primer despliegue es `/api/health`.
