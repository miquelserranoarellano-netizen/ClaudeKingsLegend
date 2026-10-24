# Estado del proyecto

Última actualización: 23 de octubre de 2026 · Primera versión funcional completa, verificada en local.

## Qué hay

| Área | Estado |
| --- | --- |
| Portada (cifras reales, abiertos, en curso, próximos, resultados, próximos partidos, ranking, cómo participar, noticias, estados vacíos) | Hecho |
| Explorador `/torneos` (búsqueda, estado, formato, tipo, fechas, orden, paginación) | Hecho |
| Detalle de torneo (información, participantes, calendario, cuadro o clasificación, reglas, premios, campeón, anuncios, inscripción según rol y fase) | Hecho |
| Página de partido (marcador, plantillas, MVP, historial de resultados, evidencias privadas, disputas; formularios según rol) | Hecho |
| Cuentas (registro, acceso, cierre, recuperación, verificación de correo, cambio de contraseña, sesiones, eliminación anonimizada) | Hecho (correo: ver «Sin probar») |
| Perfil público del jugador (Riot ID declarado, avatar, bio, equipos, historial, estadísticas) | Hecho |
| Equipos (crear, editar, logotipo, invitar, aceptar/rechazar, expulsar, salir, capitanía, disolver, historial) | Hecho |
| Panel `/dashboard` (resumen, torneos, partidos, equipos, invitaciones, notificaciones, perfil, ajustes) | Hecho |
| Administración `/admin` (torneos: crear, editar, publicar, cerrar inscripciones, semillas, iniciar, cancelar, eliminar borrador; inscripciones; partidos y horarios; disputas; usuarios; equipos; anuncios; páginas legales; auditoría; ajustes) | Hecho |
| Motor: eliminación simple y doble (BYE, avance, reinicio de gran final, correcciones seguras), liga (ida/vuelta, puntos y desempates configurables) | Hecho y probado |
| Inscripciones (fechas, plazas, individual o por equipo, titulares y suplentes, lista de espera con promoción, aprobación manual o automática, Riot ID obligatorio) | Hecho y probado |
| Notificaciones en la aplicación (+ correo si hay SMTP) | Hecho |
| SEO (metadatos por página, Open Graph, sitemap, robots, canónicas, noindex en zonas privadas) | Hecho |
| Seguridad (permisos en servidor, CSRF, límites, CSP, cabeceras, auditoría, concurrencia optimista) | Hecho |
| Despliegue (Dockerfile, docker-compose con PostgreSQL y Caddy, migraciones, health check, guía Hostinger, costes, CI) | Escrito; ver «Sin probar» |

## Cómo se ha verificado

- `npm run check`: tipos, lint y **96 pruebas** (Vitest). Incluyen el motor de cuadros y ligas (todos los
  tamaños con BYE, doble eliminación completa, correcciones bloqueadas y permitidas, desempates), las reglas
  de fases, inscripciones y permisos, y pruebas de integración contra un Postgres real en memoria:
  registro e inicio de sesión con Better Auth (hash, cuenta suspendida, cookie), equipos (duplicados, tamaño
  máximo, invitaciones), inscripciones duplicadas y jugadores en dos equipos, lista de espera, aprobación
  manual sin superar plazas, torneos privados, generación con BYE, resultados comunicados y validados,
  cierre del torneo, **edición simultánea detectada**, correcciones, disputas, liga y límite de peticiones
  (incluso con peticiones simultáneas).
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

## Sin probar (dicho con claridad)

- **Docker**: este ordenador no tiene Docker. El `Dockerfile` y el `docker-compose.yml` siguen la
  configuración que sí se ha probado (compilación, `next start`, migraciones con `pg`), pero la imagen no se
  ha construido nunca. Será lo primero que se compruebe en el VPS.
- **PostgreSQL de verdad**: el camino de producción se ha probado contra PGlite hablando el protocolo de
  Postgres, no contra un servidor PostgreSQL 17 real.
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

## Datos locales

La base de desarrollo (`.data/pg`) contiene el seed de demostración (cuentas `@demo.kingslegend.test`,
contraseña en `scripts/seed.ts`) y una cuenta de prueba creada durante la verificación
(`prueba.local@kingslegend.test`, administradora). Para empezar de cero: para el servidor, borra `.data/` y,
si quieres, `npm run db:seed`.

## Lo que necesito de ti para publicarla

1. Instalar **Git**, crear el repositorio privado en **GitHub** y subir el código (`docs/TRABAJO-EN-EQUIPO.md`).
2. Contratar el **VPS KVM 2** de Hostinger con la plantilla Ubuntu + Docker y un **dominio**.
3. Seguir `docs/DESPLIEGUE.md` (o darme acceso con el MCP de Hostinger o por SSH y lo hago contigo).
4. Opcional: un buzón SMTP para la verificación de correo y la recuperación de contraseñas.
5. Antes del lanzamiento: logotipo definitivo y **revisión legal** de privacidad y términos.
