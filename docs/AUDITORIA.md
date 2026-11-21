# Auditoría de Kings Legend

21 de noviembre de 2026 · Objetivo: publicar la plataforma de la liga en **Cloudflare Workers** con la base de
datos en **Supabase**, y revisar seguridad, base de datos y rendimiento.

## 1. Resumen

La aplicación estaba bien construida: capas claras (dominio puro, servicios con permisos, consultas,
acciones finas), permisos siempre en el servidor, auditoría de cambios, concurrencia optimista y un motor de
cuadros y ligas con pruebas. Pero **estaba pensada para un servidor Node (VPS con Docker)** y no podía
funcionar en Cloudflare + Supabase tal como estaba:

- El despliegue en Cloudflare fallaba (nombre del Worker y versión de Next.js).
- En un Worker, el inicio de sesión y las páginas privadas habrían fallado: Better Auth reutilizaba la
  conexión de la primera petición y un *proxy* de Node rompía cualquier petición con cookies.
- Next.js 16.3.8 tenía una vulnerabilidad **crítica** publicada.
- Supabase publica las tablas en una API REST: había que cerrarla expresamente.

Todo eso está corregido, probado y documentado. **Lo que queda depende de ti** (sección 6): pasar a
Workers Paid, crear Hyperdrive, poner tres variables y fusionar la rama.

## 2. Base de datos creada en Supabase

Proyecto **ClaudeKingsLegend** (`yipkuufmyggzgjrkwuew`, PostgreSQL 17, Irlanda `eu-west-1`).

| Migración | Contenido |
| --- | --- |
| `0000_initial` | 19 tipos enumerados (estados), 27 tablas, 68 claves foráneas, restricciones de integridad (fechas, plazas, marcadores, una inscripción por jugador y torneo, una disputa abierta por partido…) e índices. |
| `0001_supabase_rls_indices` | Seguridad a nivel de fila (RLS) en las 27 tablas, cierre de la API REST de Supabase y 15 índices nuevos. |

Las dos están registradas en `drizzle.__drizzle_migrations` con el mismo *hash* que calcula Drizzle, así que
`npm run db:migrate` no las volverá a aplicar.

**Verificación.** El esquema de Supabase se comparó con el que generan las migraciones del repositorio, por
categorías y con huella MD5: 288 columnas, 122 restricciones, 19 enumerados, 91 índices y 27 tablas con RLS,
idénticos.

**Modelo de datos** (detalle en `docs/ARQUITECTURA.md`):

| Grupo | Tablas |
| --- | --- |
| Cuentas (Better Auth) | `users` (rol, suspensión), `sessions`, `accounts` (hash de la contraseña), `verifications` |
| Personas y equipos | `profiles` (Riot ID, posición, privacidad), `media` (imágenes), `teams`, `team_members`, `team_invitations` |
| Torneos y ligas | `tournaments`, `tournament_rules` (formato, al mejor de, puntos, desempates, ida/vuelta), `tournament_registrations`, `tournament_registration_members`, `tournament_participants` |
| Competición | `tournament_stages`, `tournament_rounds` (rondas o jornadas), `matches`, `match_games`, `match_results`, `result_evidence`, `disputes` |
| Plataforma | `notifications`, `announcements`, `audit_logs`, `platform_settings`, `content_pages`, `rate_limits` |

La clasificación de la liga, el campeón y el ranking **no se guardan**: se calculan a partir de los
resultados confirmados, así que nunca se desincronizan.

**Asesores de Supabase después de crearla:**

- Seguridad: solo «RLS activado sin políticas» (informativo) en las 27 tablas. Es lo buscado: nadie entra por
  la API REST y la aplicación, que se conecta como `postgres` (con `BYPASSRLS`), sí.
- Rendimiento: «índices sin usar» (la base está vacía) y 22 claves foráneas sin índice en columnas de tipo
  «quién lo hizo» (`reviewed_by_id`, `author_id`…). Esos índices solo servirían al borrar usuarios, y la
  aplicación nunca borra usuarios (los anonimiza), así que no compensan.

## 3. Hallazgos y correcciones

### Críticos (impedían publicar o eran un riesgo serio)

| # | Hallazgo | Corrección | Verificado |
| --- | --- | --- | --- |
| C1 | **Next.js 16.3.8 con vulnerabilidad crítica** y varias altas (ejecución remota de código en el optimizador de imágenes, denegación de servicio con acciones de servidor, fugas de caché…). | Next.js 16.4.6 (y `eslint-config-next` a juego). | `npm audit`: ya no aparece ninguna crítica ni alta. |
| C2 | **El despliegue en Cloudflare fallaba**: Cloudflare generó una configuración que apuntaba a un Worker `kings-legend` (el nombre del `package.json`), pero el tuyo es `claudekingslegend`. Además, el adaptador OpenNext 1.20 exige Next.js ≥ 16.4.5. | `wrangler.jsonc` y `open-next.config.ts` en el repositorio, con el nombre correcto y sin el enlace al propio Worker, que no hace falta. Next.js actualizado (C1). | Compilación del Worker en local y en la integración continua. |
| C3 | **La API REST de Supabase**: Supabase publica el esquema `public` con los roles `anon` y `authenticated`, y la clave que lo permite es pública por diseño. Las tablas de la app no tenían RLS. Con los permisos por defecto de este proyecto, `anon` recibía permisos sobre las tablas creadas por `postgres` (TRUNCATE, REFERENCES, TRIGGER) y lectura y escritura completas sobre las creadas por `supabase_admin`: según cómo se creara una tabla, hashes de contraseñas y tokens de sesión quedaban al alcance de cualquiera. | RLS sin políticas en las 27 tablas, permisos retirados a `anon`/`authenticated` (también sobre tablas futuras) y una prueba que falla si una tabla nueva olvida `.enableRLS()`. | Prueba con roles como los de Supabase: `anon` recibe *permission denied*. En Supabase: 0 permisos para `anon`/`authenticated`. |
| C4 | **Better Auth guardaba la conexión de la primera petición** para siempre (y la base de datos era un *pool* global). Un Worker no puede usar conexiones abiertas por otra petición: a partir de la segunda, sesiones e inicios de sesión fallaban. | Conexión por petición en Cloudflare (`getDb`) y un intermediario para Better Auth que en cada uso delega en la conexión de la petición en curso (`getLongLivedDb`). | Provocándolo a propósito en `workerd`: 4 de 5 pruebas de acceso fallan y Cloudflare cancela las peticiones («the Worker's code had hung»). Con la corrección: 10 de 11 pruebas e2e (sección 5). |
| C5 | **El *proxy* de Next.js 16 (middleware de Node) rompía el Worker**: el soporte de OpenNext es experimental y fallaba en cuanto la petición llevaba una cookie. Todas las páginas de quien hubiera iniciado sesión daban error 500 (119 errores en la prueba). | Proxy eliminado. Cada página de `/dashboard` y `/admin` ya comprobaba la sesión en el servidor; ahora además redirige con su ruta exacta, y una prueba nueva impide que una página privada lo olvide. | Redirección exacta (`/acceso?next=%2Fdashboard%2Fequipos`) en Node y en `workerd`; 25 comprobaciones automáticas. |

### Importantes

| # | Hallazgo | Corrección o decisión |
| --- | --- | --- |
| I1 | **CPU en Cloudflare.** Comprobar una contraseña (scrypt) gasta unos 80 ms; el plan gratuito de Workers corta a los 10 ms. | Hace falta **Workers Paid (5 $/mes)**. No es un fallo del código: bajar el coste del cifrado haría las contraseñas más fáciles de romper. |
| I2 | **PGlite (la base de desarrollo, en WASM) se metía en el Worker**: 18,7 MB (4,2 MB comprimido). | Se sustituye por un módulo vacío al compilar para Cloudflare: **9,2 MB (2,4 MB comprimido)**. Arranca antes. |
| I3 | **Caché de Hyperdrive.** Por defecto guarda las lecturas hasta 60 s: tras cerrar sesión, la sesión seguiría valiendo un minuto y los resultados se verían con retraso. | La guía exige crear Hyperdrive con la caché desactivada. |
| I4 | **IP del cliente para el límite de intentos**: se leía `x-forwarded-for`, que en Cloudflare puede falsear el propio cliente para saltarse el límite. | En Cloudflare se usa `cf-connecting-ip` (la pone Cloudflare); detrás de Caddy, `x-forwarded-for` como antes. |
| I5 | **Correo en Cloudflare.** El envío SMTP (nodemailer) no es fiable desde un Worker, y sin correo no hay recuperación de contraseña. | Nuevo proveedor **Resend** (API HTTP) con `RESEND_API_KEY`, con pruebas. SMTP sigue para Docker/VPS. |
| I6 | **Índices.** Consultas frecuentes sin índice: inscripciones por equipo o jugador, torneos de un jugador, partidos de una fase, enlaces del cuadro, evidencias por imagen, disputas de un partido, anuncios de un torneo, referencias a imágenes. | 15 índices nuevos (parciales cuando la columna suele ser nula). |
| I7 | **Supabase gratuito**: 500 MB de base (las imágenes se guardan en ella, hasta 3 MB cada una, ya reducidas en el navegador), 5 GB de tráfico de salida al mes y **pausa tras 7 días sin actividad**. | Suficiente para una liga. Vigila el tamaño en el panel. Si crece, Supabase Pro (25 $/mes) o mover las imágenes a R2. |

### Mejoras de rendimiento

| Mejora | Efecto |
| --- | --- |
| La página de un torneo pedía los participantes hasta **4 veces** (directamente, en el cuadro, en la clasificación y en el campeón), y la clasificación hacía 3 consultas **una detrás de otra**. | Lecturas memorizadas durante la petición y lanzadas a la vez. Liga en curso: de 9 consultas con 4 esperas encadenadas a la base, a 7 en paralelo. Liga terminada: de 12 consultas con 6 esperas a 7 en paralelo. |
| Cada logotipo y avatar se leía de Supabase en **cada visita**. | Con dominio propio, las imágenes públicas se guardan en la caché de Cloudflare (nunca las evidencias, que son privadas): menos consultas y menos tráfico de Supabase. |
| Los recursos estáticos se revalidaban en cada visita. | `public/_headers`: los archivos de `_next/static` (con hash en el nombre) se guardan un año. |
| El Worker se ejecutaría en el centro de datos más cercano al visitante, lejos de la base (Irlanda), y cada página hace varias consultas seguidas. | *Smart Placement*: Cloudflare lo ejecuta cerca de la base cuando eso acelera la respuesta. |

### Calidad

- **Pruebas: de 96 a 126.** RLS en todas las tablas y API de Supabase cerrada (con roles como los de
  Supabase), sesión comprobada en las 24 páginas privadas, y envío por Resend.
- **Integración continua**: ahora también compila el Worker de Cloudflare (`npm run build:cf`).
- Prueba e2e del borrador privado más robusta (tenía una carrera: navegaba sin esperar al cierre de sesión).

## 4. Seguridad: estado general

| Área | Estado |
| --- | --- |
| Permisos | En el servidor, en cada servicio y página (`src/domain/permissions.ts`, `docs/PERMISOS.md`). |
| Contraseñas y sesiones | scrypt; sesiones en base de datos; cookie HttpOnly, Secure y SameSite=Lax; CSRF por origen. |
| Base de datos | Sin SQL concatenado (Drizzle parametriza). RLS + permisos retirados frente a la API de Supabase. |
| Límite de intentos | En Postgres; IP real de Cloudflare (I4). |
| Cabeceras | CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `noindex` en zonas privadas. Comprobado que el Worker las envía. |
| Dependencias | Sin vulnerabilidades críticas ni altas. Quedan 7 moderadas en herramientas de compilación (`drizzle-kit`, `glob`), que no se ejecutan en la web. |
| Pendiente | CSP con *nonces* (hoy `unsafe-inline` para los scripts de Next) y revisión legal de privacidad y términos. |

## 5. Cómo se ha verificado

1. `npm run check`: tipos, lint y **126 pruebas** (dominio e integración contra PostgreSQL en memoria).
2. `npm run build` (Node) y `next start` contra un **PostgreSQL 16 real**: salud, portada, explorador,
   redirección exacta y cabeceras de seguridad.
3. Pruebas e2e en modo desarrollo: **11 de 11**.
4. **Worker de Cloudflare en local** (`opennextjs-cloudflare preview`, con `workerd`, el motor de Cloudflare)
   contra PostgreSQL real, con los datos de demostración: **10 de 11** pruebas e2e (registro, sesión, equipos
   con logotipo, inscripción y aprobación, resultado validado y avance del cuadro, publicación de torneo,
   permisos). La que falta, la de recuperación de contraseña, falla porque en producción sin correo
   configurado ese formulario se oculta a propósito. Al terminar, **0 conexiones abiertas** en PostgreSQL
   (Cloudflare cierra las de cada petición al acabar) y **0 errores** en el registro del Worker.
5. Supabase: esquema idéntico al del repositorio (huella por categorías) y asesores revisados.

**No verificado todavía** (necesita tu cuenta): despliegue real en Cloudflare, Hyperdrive ↔ Supabase, envío
con Resend y caché de imágenes con dominio propio.

## 6. Lo que tienes que hacer tú

Paso a paso en `docs/DESPLIEGUE-CLOUDFLARE.md`. En resumen:

1. Cloudflare → **Workers Paid** (5 $/mes).
2. Supabase → *Connect* → copia la cadena de conexión directa (con tu contraseña).
3. Cloudflare → **Hyperdrive** → crea la configuración con esa cadena y **la caché desactivada**. Pásame el
   ID (o añádelo a `wrangler.jsonc`).
4. Worker `claudekingslegend` → variable de compilación `NEXT_PUBLIC_SITE_URL` y secreto
   `BETTER_AUTH_SECRET`.
5. **Fusiona la rama `claude/great-cannon-uadmuu`** en la rama que despliega Cloudflare (normalmente
   `main`).
6. Abre `/api/health`, regístrate y hazte administrador (SQL en la guía, o pídemelo).
7. Recomendado: Resend para el correo, dominio propio y revisión legal de privacidad y términos.

## 7. Costes (orientativos, noviembre de 2026)

| Concepto | Plan | Coste |
| --- | --- | --- |
| Cloudflare Workers | **Paid** (imprescindible, ver I1) | 5 $/mes (10 M de peticiones y 30 M de ms de CPU incluidos) |
| Hyperdrive | Incluido en Workers | 0 $ |
| Supabase | Free (500 MB, 5 GB de salida/mes, pausa tras 7 días sin uso) | 0 $; Pro: 25 $/mes |
| Resend (correo) | Free (100/día, 3.000/mes) | 0 $ |
| Dominio | `.es` o `.com` | ~10–20 €/año |

**Mínimo: unos 5 $/mes más el dominio.** Detalle y alternativas en `docs/COSTES.md`.

## 8. Recomendaciones para después

1. **Copias de seguridad**: comprueba en Supabase → *Database → Backups* qué incluye tu plan. Si no hay
   copias diarias, haz un volcado periódico (`pg_dump` con la cadena de conexión directa).
2. **CSP con *nonces*** en lugar de `unsafe-inline`.
3. **Verificación del Riot ID** con la API de Riot (hoy se declara y se muestra como «no verificado»).
4. **Auditoría de accesibilidad** automática (axe) y con lector de pantalla.
5. **Imágenes en R2** si la base se acerca a los 500 MB del plan gratuito.
6. Si la liga crece mucho: prueba de carga y Supabase Pro.
