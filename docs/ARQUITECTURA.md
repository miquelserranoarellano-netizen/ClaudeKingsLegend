# Arquitectura

## 1. Pila y decisiones

| Pieza | Elección | Por qué |
| --- | --- | --- |
| Aplicación | **Next.js 16** (App Router, Server Components, acciones de servidor) + React 19 + TypeScript estricto | Frontend y backend en un solo despliegue; todo el acceso a datos ocurre en el servidor. |
| Estilos | **Tailwind CSS 4** + componentes propios accesibles (`src/components/ui`) | Al estilo de shadcn/ui pero sin dependencias extra: controles nativos (`<dialog>`, `<select>`, radios) que ya son accesibles con teclado. |
| Base de datos | **PostgreSQL** con **Drizzle ORM** (un solo ORM) | Esquema tipado, migraciones SQL reproducibles (`drizzle/`). |
| Base local | **PGlite** (Postgres compilado a WASM) | En desarrollo y en las pruebas no hay que instalar nada: el mismo SQL y las mismas migraciones que en producción. |
| Autenticación | **Better Auth** (sucesor mantenido de Auth.js) | Hash scrypt, sesiones en base de datos, cookies HttpOnly, CSRF, verificación de correo y recuperación de contraseña. |
| Validación | **Zod 4** | Los mismos esquemas validan en el navegador y en el servidor. |
| Formularios | `useActionState` + acciones de servidor | Funcionan sin JavaScript extra; React Hook Form no aportaba lo suficiente aquí. |
| Correo | **nodemailer** (SMTP), solo si se configura | Sin proveedor no se finge nada: la interfaz lo dice. |
| Pruebas | **Vitest** (dominio + integración contra Postgres en memoria) y **Playwright** (extremo a extremo) | |
| Despliegue | Docker Compose: app + PostgreSQL 17 + Caddy (HTTPS automático) | Portable a cualquier VPS; ver `docs/DESPLIEGUE.md`. |

## 2. Organización del código

```
src/
  domain/            Lógica pura y probada: sin base de datos, red ni reloj
    competition/     Cuadros (simple/doble), BYE, avance, correcciones, liga, clasificación, series
    tournament/      Fases del torneo y reglas de inscripción
    permissions.ts   Matriz de permisos (docs/PERMISOS.md)
  features/<x>/      Un dominio de negocio por carpeta:
    schemas.ts       Zod (compartido navegador/servidor)
    service.ts       Escrituras: permisos + transacción + auditoría + avisos
    queries.ts       Lecturas para las páginas
    actions.ts       Acciones de servidor finas: validar → servicio → revalidar
    components/      Interfaz de ese dominio
  server/            Infraestructura: db (cliente, esquema), auth, errores, auditoría, límites, correo
  components/        Interfaz compartida (ui/, layout/, brand/)
  i18n/              Idioma: diccionario de textos compartidos
  app/               Rutas (solo componen)
```

Flujo de una acción: formulario → `actions.ts` (Zod) → `service.ts` (permiso → transacción con bloqueos →
cambios → auditoría → avisos) → `runAction` traduce errores a mensajes → `revalidatePath`.

## 3. Modelo de datos

Migraciones en `drizzle/`. Estados como **enums de Postgres**; fechas `timestamptz` (UTC, se muestran en
Europe/Madrid); identificadores UUID (los de Better Auth, texto).

| Tabla | Contenido |
| --- | --- |
| `users`, `sessions`, `accounts`, `verifications` | Better Auth. `users.role` (user/organizer/admin), suspensión, marca demo. La contraseña (hash) está en `accounts`. |
| `profiles` | Perfil público 1:1: identificador único, nombre visible, Riot ID (único, declarado), región, posición, bio, avatar, privacidad, avisos por correo. |
| `media` | Imágenes subidas (bytea), con tipo verificado por firma binaria. Públicas o privadas (evidencias). |
| `teams`, `team_members`, `team_invitations` | Equipos (nombre y etiqueta únicos entre activos), miembros (únicos por equipo) e invitaciones (una pendiente por equipo y jugador). |
| `tournaments`, `tournament_rules` | Torneo (fechas, plazas, formato, visibilidad, código de acceso, versión) y su configuración estructurada (plantilla, series, puntos, desempates, vueltas, reinicio de la gran final, aprobación, lista de espera, Riot ID obligatorio). |
| `tournament_registrations`, `tournament_registration_members` | Inscripciones (una por equipo o jugador y torneo) y su plantilla. Restricción única (torneo, jugador): nadie juega un torneo con dos equipos. |
| `tournament_participants` | Inscripciones aprobadas, con su semilla. |
| `tournament_stages`, `tournament_rounds`, `matches` | Fase, rondas/jornadas y partidos (huecos, BYE, siguiente partido del ganador y del perdedor, versión). |
| `match_games`, `match_results`, `result_evidence`, `disputes` | Partidas, resultados comunicados/validados/sustituidos (nunca se borran), evidencias y disputas (una abierta por partido). |
| `notifications`, `announcements`, `audit_logs`, `platform_settings`, `content_pages`, `rate_limits` | Avisos, anuncios, auditoría (solo inserción), ajustes, páginas legales y límites de peticiones. |

**Datos calculados, no guardados:** la fase visible del torneo (de su estado y fechas), los nombres de las
rondas, la clasificación de liga, el campeón y el ranking. Así nunca se desincronizan.

## 4. Motor de competición (`src/domain/competition`)

- **Generación.** Se crea el cuadro completo desde el principio, con los huecos posteriores enlazados a su
  origen. Las semillas siguen el orden estándar (1-8, 4-5, 2-7, 3-6…), de modo que las mejores solo se cruzan
  al final y los **BYE** caen siempre contra las semillas más altas (nunca BYE contra BYE).
- **BYE en cadena.** Un hueco «muerto» resuelve solo su partido en cuanto el otro hueco se llena; dos huecos
  muertos anulan el partido. En doble eliminación, los perdedores de partidos con BYE no existen y el cuadro
  de perdedores lo tiene en cuenta.
- **Doble eliminación.** 2(k-1) rondas de perdedores; las caídas se alternan para evitar revanchas
  inmediatas. Gran final con reinicio opcional (si gana quien viene de perdedores).
- **Avance.** Un resultado solo rellena huecos vacíos: nunca se regenera nada.
- **Correcciones.** Se permiten si los partidos a los que fueron ganador y perdedor no se han jugado ni están
  en juego, con resultado comunicado o en disputa; el participante se sustituye en la cadena (atravesando los
  BYE ya resueltos). Si no, se bloquea y hay que corregir antes el partido posterior.
- **Liga.** Método del círculo (ida o ida y vuelta; con número impar, cada jornada descansa uno).
  Clasificación: puntos configurables y desempates en el orden elegido (directo, diferencia de partidas,
  partidas ganadas, series ganadas); si un criterio deshace el empate solo en parte, al subgrupo se le
  aplican de nuevo todos desde el primero; al final, la semilla (y se señala).
- **Concurrencia.** Toda escritura en un cuadro bloquea primero el torneo y después la fase (`for update`),
  siempre en ese orden. Cada partido y cada torneo tienen `version`: si dos personas editan a la vez, la
  segunda recibe «alguien ha cambiado esto» en lugar de pisar el cambio.

## 5. Seguridad

- Acciones de servidor = endpoints públicos: validación Zod y permiso en cada una. Next comprueba el origen
  (CSRF) en las acciones; Better Auth, en sus rutas.
- Contraseñas con scrypt (Better Auth); sesiones en base de datos, cookie HttpOnly, Secure en producción,
  SameSite=Lax; al restablecer la contraseña se cierran las demás sesiones.
- Límite de peticiones en Postgres (atómico): acceso, registro, recuperación, creación de equipos y torneos,
  invitaciones, inscripciones, resultados, disputas y subidas.
- Sin SQL concatenado (Drizzle parametriza); sin `dangerouslySetInnerHTML`; enlaces externos solo https y con
  `noopener`; imágenes verificadas por firma (sin SVG), servidas con `nosniff`.
- Cabeceras: CSP, HSTS (producción), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`. Paneles y API con `X-Robots-Tag: noindex`.
- Errores: solo los de negocio llegan al usuario; el resto se registra sin datos de formulario y se muestra un
  mensaje genérico. Los registros no incluyen contraseñas, tokens ni IP.
- Auditoría de solo inserción con antes/después de cada cambio relevante.

Mejora pendiente: CSP con *nonces* en lugar de `unsafe-inline` para scripts.

## 6. Idioma

Los textos compartidos (estados, formatos, errores, avisos, navegación) están en `src/i18n/messages/es.ts`;
los servicios lanzan errores con una **clave** del diccionario, no con texto. Fechas y números con `Intl` y
el idioma activo. Para añadir inglés: crear `en.ts` con el mismo tipo, registrarlo en `src/i18n/index.ts` y
decidir cómo se elige el idioma (cookie o prefijo de ruta). Los textos propios de cada página están junto a
ella y habría que moverlos al diccionario página a página.

## 7. Notificaciones

Avisos dentro de la aplicación (tabla `notifications`), creados en la misma transacción que el cambio que los
provoca: invitaciones, inscripciones (aprobada, rechazada, en espera, nueva para la organización), inicio y
cancelación del torneo, horarios y cambios de horario, resultados comunicados, confirmados y corregidos, y
disputas abiertas y resueltas. Si hay SMTP y el usuario no lo ha desactivado, se envían también por correo
después de responder (`after()`), «reclamándolos» primero para no enviar dos veces el mismo.
