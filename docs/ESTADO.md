# Estado del proyecto

Última actualización: 21 de noviembre de 2026 · Preparada para Cloudflare Workers + Supabase (base de datos
creada) y con imagen nueva «gamer». Auditoría completa en `docs/AUDITORIA.md`; despliegue en
`docs/DESPLIEGUE-CLOUDFLARE.md`.

## Qué hay

| Área | Estado |
| --- | --- |
| Identidad visual (tema oscuro «noche azulada» con oro y cian, tipografías Spectral y Barlow Condensed, emblema y logotipo propios, botones y marcos dorados, cuadros y tablas con podio; tokens en `src/app/globals.css`) | Hecho |
| Portada de venta (arte oficial de LoL, la plataforma en acción, premios reales de la base de datos, pasos, torneos y liga al día solo si hay datos) y acceso simplificado; *skills* de diseño en `.claude/skills` y taste-skill como *plugin* | Hecho |
| Explorador `/torneos` (búsqueda, estado, formato, tipo, fechas, orden, paginación) | Hecho |
| Detalle de torneo (información, participantes, calendario, cuadro o clasificación, reglas, premios, campeón, anuncios, inscripción según rol y fase) | Hecho |
| Página de partido (marcador, plantillas, MVP, historial de resultados, evidencias privadas, disputas; formularios según rol) | Hecho |
| Cuentas (registro, acceso, cierre, recuperación, verificación de correo, cambio de contraseña, sesiones, eliminación anonimizada) | Hecho (correo: ver «Sin probar») |
| Perfil público del jugador (Riot ID declarado, avatar, bio, equipos, historial, estadísticas) | Hecho |
| Equipos (crear, editar, logotipo, invitar, aceptar/rechazar, expulsar, salir, capitanía, disolver, historial) | Hecho |
| Panel `/dashboard` (resumen, torneos, partidos, equipos, invitaciones, notificaciones, perfil, ajustes) | Hecho |
| Administración `/admin` (torneos: crear, editar, publicar, cerrar inscripciones, semillas, iniciar, cancelar, eliminar borrador; inscripciones; partidos y horarios; disputas; usuarios; equipos; anuncios; páginas legales; auditoría; ajustes) | Hecho |
| Motor: eliminación simple y doble (BYE, avance, reinicio de gran final, correcciones seguras), liga (ida/vuelta, una jornada por semana, BO2 con empate y puntos 3/1/0 configurables, desempates) y **sistema suizo como los Worlds** (3 victorias pasan, 3 derrotas eliminan, cruces por balance sin repetir rival, decisivos al BO3 y eliminatoria automática con los clasificados) | Hecho y probado |
| Inscripciones (fechas, plazas, individual o por equipo, titulares y suplentes, lista de espera con promoción, aprobación manual o automática, Riot ID obligatorio) | Hecho y probado |
| Notificaciones en la aplicación (+ correo si hay SMTP) | Hecho |
| SEO (metadatos por página, Open Graph, sitemap, robots, canónicas, noindex en zonas privadas) | Hecho |
| Seguridad (permisos en servidor, CSRF, límites, CSP, cabeceras, auditoría, concurrencia optimista) | Hecho |
| Despliegue en **Cloudflare Workers** (OpenNext, `wrangler.jsonc`, Hyperdrive, conexión por petición, caché de imágenes en el borde) | Hecho; probado en local con `workerd` (ver «Sin probar») |
| Base de datos en **Supabase** (migraciones aplicadas y registradas, RLS en todas las tablas, API REST cerrada, índices) | Hecho y verificado |
| Correo por **Resend** (API HTTP, para Cloudflare) o SMTP (para Node) | Hecho (Resend sin probar con una clave real) |
| Despliegue alternativo (Dockerfile, docker-compose con PostgreSQL y Caddy, guía Hostinger) | Escrito; ver «Sin probar» |

## Cómo se ha verificado

- `npm run check`: tipos, lint y **126 pruebas** (Vitest). Incluyen el motor de cuadros y ligas (todos los
  tamaños con BYE, doble eliminación completa, correcciones bloqueadas y permitidas, desempates), las reglas
  de fases, inscripciones y permisos, y pruebas de integración contra un Postgres real en memoria:
  registro e inicio de sesión con Better Auth (hash, cuenta suspendida, cookie), equipos (duplicados, tamaño
  máximo, invitaciones), inscripciones duplicadas y jugadores en dos equipos, lista de espera, aprobación
  manual sin superar plazas, torneos privados, generación con BYE, resultados comunicados y validados,
  cierre del torneo, **edición simultánea detectada**, correcciones, disputas, liga y límite de peticiones
  (incluso con peticiones simultáneas). Desde noviembre, además: RLS en todas las tablas y API de Supabase
  cerrada (con roles como los de Supabase), sesión comprobada en las 24 páginas privadas y envío por Resend.
- **Worker de Cloudflare en local** (`opennextjs-cloudflare preview`, motor `workerd`) contra un PostgreSQL 16
  real: 10 de 11 pruebas e2e (la de recuperación de contraseña oculta el formulario en producción sin correo,
  a propósito), 0 conexiones abiertas al terminar y 0 errores en el registro.
- **Supabase**: el esquema creado es idéntico al de las migraciones (comparado por huella) y los asesores de
  seguridad y rendimiento están revisados (ver `docs/AUDITORIA.md`).
- `npm run test:e2e`: **11 pruebas** de Playwright con Chrome sobre una base propia rellenada con el seed:
  registro, cierre de sesión, contraseña incorrecta, validación en el navegador, recuperación sin revelar
  cuentas, redirecciones y 404 de permisos, borradores ocultos, creación de equipo con **subida de
  logotipo**, nombre repetido, invitación, inscripción del capitán y aprobación de la organización, resultado
  comunicado por el capitán y validado (el cuadro avanza), creación y publicación de un torneo.
- `npm run build`: compilación de producción correcta.
- **Modo producción con el controlador `pg` real**: `next start` contra un servidor con protocolo PostgreSQL
  (PGlite por socket): `scripts/migrate.mjs` (dos veces, idempotente), registro, sesión, `/api/health`, CSP
  activa y creación de un equipo por acción de servidor sin errores en consola.
- Revisión en el navegador: portada, explorador, cuadros de eliminación simple y doble, clasificación de liga,
  partido (registrar resultado y ver el avance), panel y administración; 49 rutas sin errores; sin
  desbordamiento horizontal a 375 px en las páginas principales; menú móvil.
- **Imagen nueva**: revisada en escritorio (1440 px) y móvil (375-390 px) en portada, explorador, cuadros,
  liga, partido, equipo, jugador, noticias, legales, acceso, panel y administración, sin desbordamiento
  horizontal. Contraste WCAG AA (≥ 4,5:1) de todos los colores de texto sobre todos los fondos; el más justo,
  el gris secundario sobre las tarjetas claras, da 5,6:1. Pruebas e2e contra el Worker local (`workerd` +
  PostgreSQL 16 a través del *binding* de Hyperdrive): 10 de 11; la de recuperar contraseña necesita modo
  desarrollo o un servicio de correo, porque en producción sin correo la página lo dice en vez de mostrar el
  formulario.

## Sin probar (dicho con claridad)

- **Cloudflare de verdad**: el Worker se ha compilado y probado en local con `workerd`, pero aún no en la
  cuenta de Cloudflare: la conexión Hyperdrive ↔ Supabase, el envío con Resend y la caché de imágenes con
  dominio propio están sin probar. Lo primero tras desplegar: `/api/health`.
- **Docker**: este ordenador no tiene Docker. El `Dockerfile` y el `docker-compose.yml` siguen la
  configuración que sí se ha probado (compilación, `next start`, migraciones con `pg`), pero la imagen no se
  ha construido nunca. Será lo primero que se compruebe en el VPS.
- **PostgreSQL 17**: el camino de producción se ha probado contra un PostgreSQL 16 real (en Node y en
  `workerd`). La base de Supabase es PostgreSQL 17 y tiene el esquema aplicado, pero la aplicación aún no se
  ha conectado a ella.
- **Correo real**: sin SMTP configurado. En desarrollo los enlaces de verificación y recuperación se escriben
  en la consola del servidor; el envío por SMTP está escrito pero no se ha ejecutado.
- **Accesibilidad**: etiquetas, foco visible, navegación por teclado, «saltar al contenido», regiones y
  diálogos nativos están cuidados, pero no se ha pasado una auditoría automática (axe) ni un lector de
  pantalla real.
- **Rendimiento con mucho volumen**: probado con decenas de equipos y partidos, no con miles.

## Lo que NO existe todavía

- Verificación del Riot ID con la API de Riot (se declara y se muestra como «no verificado»).
- Cambio de correo electrónico desde la cuenta (se pide por Contacto).
- Fase de grupos + eliminatoria, tercer puesto, sistema suizo (el modelo de fases lo permite).
- Inicio de sesión con Discord u otros proveedores.
- Inglés (la arquitectura está preparada; ver `docs/ARQUITECTURA.md`, «Idioma»).
- CSP con *nonces* (hoy `unsafe-inline` para los scripts que inyecta Next).

## Decisiones que he tomado (revísalas)

1. **Better Auth** en lugar de Auth.js: es su sucesor mantenido y trae lo pedido (hash, sesiones en base de
   datos, verificación, recuperación, CSRF, límites).
2. **Drizzle** como único ORM, con **PGlite** en local: nada que instalar para desarrollar ni para las pruebas.
3. **Imágenes dentro de PostgreSQL**, reducidas en el navegador: una pieza menos que desplegar y respaldar.
4. **Torneo privado = enlace de invitación** (`?codigo=`), renovable. Sin él solo lo ven la organización, los
   administradores y los participantes.
5. **El rol de organizador lo da un administrador**; el primer administrador, con `npm run admin:grant`.
6. **Estados de partido**: tus seis estados se corresponden con `pending` (pendiente), `scheduled`
   (programado), `in_progress` («en disputa» en el sentido de *en juego*; se muestra «En juego»),
   `awaiting_validation` (pendiente de validación), `confirmed` (confirmado) y `disputed` («disputado con
   incidencia»; se muestra «Con incidencia»). Hay un séptimo, `void`, para partidos que no se disputan
   (dos BYE o reinicio de gran final no necesario).
7. **Los resultados los valida siempre la organización**, aunque los dos capitanes coincidan (el rival puede
   marcar «Estoy de acuerdo» para agilizarlo).
8. **Desempate final por semilla** (orden de aprobación o el que fije la organización), señalado en la tabla.
9. **Eliminar la cuenta anonimiza** en lugar de borrar la fila, para no romper cuadros ni la auditoría.
10. **Todas las páginas se renderizan en cada petición** (dependen de la sesión y de resultados en vivo).
11. **Cloudflare Workers + Supabase** como despliegue principal (lo elegiste tú); Docker/VPS queda como
    alternativa. Exige **Workers Paid** (5 $/mes): el plan gratuito corta a 10 ms de CPU y comprobar una
    contraseña gasta unos 80 ms.
12. **Sin *proxy* (middleware) de Next.js**: en Cloudflare rompía las peticiones con cookies. Cada página
    privada comprueba la sesión con su ruta exacta (lo vigila una prueba).
13. **RLS sin políticas** en todas las tablas: la aplicación no usa la API REST de Supabase, así que se cierra.
14. **Arte oficial de League of Legends solo en la portada**: se carga desde Data Dragon, el CDN público de
    Riot para proyectos de la comunidad, como permite su política para fans («Legal Jibber Jabber»), con su
    aviso en el pie (`common.notAffiliated`). Son las ilustraciones de las *skins* de los Mundiales (lista en
    `src/components/landing/lol-art.ts`). La paleta, el emblema, el logotipo y los banners siguen siendo
    propios; ningún logotipo de Riot.

## Datos locales

La base de desarrollo (`.data/pg`) contiene el seed de demostración (cuentas `@demo.kingslegend.test`,
contraseña en `scripts/seed.ts`) y una cuenta de prueba creada durante la verificación
(`prueba.local@kingslegend.test`, administradora). Para empezar de cero: para el servidor, borra `.data/` y,
si quieres, `npm run db:seed`.

## Lo que necesito de ti para publicarla

Paso a paso en `docs/DESPLIEGUE-CLOUDFLARE.md`:

1. Cloudflare → **Workers Paid** (5 $/mes).
2. **Hyperdrive** con la cadena de conexión de Supabase y la caché desactivada; su ID en `wrangler.jsonc`.
3. En el Worker `claudekingslegend`: variable de compilación `NEXT_PUBLIC_SITE_URL` y secreto
   `BETTER_AUTH_SECRET`.
4. Fusionar la rama `claude/great-cannon-uadmuu` en la rama que despliega Cloudflare.
5. Registrarte y hacerte administrador (SQL en la guía).
6. Recomendado: Resend para el correo, dominio propio y **revisión legal** de privacidad y términos.
