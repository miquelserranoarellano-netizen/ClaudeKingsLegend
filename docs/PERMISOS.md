# Roles y permisos

Los permisos se comprueban **siempre en el servidor**: cada servicio (`src/features/*/service.ts`) recibe a
quien actúa y consulta las funciones de `src/domain/permissions.ts`, que tienen sus propias pruebas
(`src/domain/rules.test.ts`). La interfaz oculta lo que no se puede hacer solo por comodidad.

## Roles

| Rol | Cómo se obtiene | Qué es |
| --- | --- | --- |
| **Visitante** | Sin sesión. | Ve lo público. |
| **Usuario registrado** (`user`) | Al crear la cuenta. | Juega: perfil, equipos, inscripciones. |
| **Capitán de equipo** | Por equipo: quien lo crea, o a quien se le cede la capitanía. No es un rol global. | Gestiona su equipo e inscripciones; comunica resultados y abre disputas. |
| **Organizador** (`organizer`) | Lo asigna un administrador. | Crea torneos y gestiona **los suyos**. |
| **Administrador** (`admin`) | `npm run admin:grant` (el primero) o desde /admin/usuarios. | Todo, en toda la plataforma. |

Una cuenta **suspendida** pierde todos los permisos al momento (se cierran sus sesiones y no puede entrar).

## Matriz

| Acción | Visitante | Usuario | Capitán | Organizador | Admin |
| --- | :-: | :-: | :-: | :-: | :-: |
| Ver torneos públicos, equipos, perfiles públicos, ranking, noticias | ✔ | ✔ | ✔ | ✔ | ✔ |
| Ver un torneo privado | con enlace | con enlace o si participa | ídem | si es suyo | ✔ |
| Ver un borrador | — | — | — | si es suyo | ✔ |
| Editar su perfil, crear equipos, aceptar invitaciones | — | ✔ | ✔ | ✔ | ✔ |
| Invitar, expulsar, ceder capitanía, disolver equipo | — | — | su equipo | — | ✔ |
| Salir de un equipo | — | ✔ (no el capitán) | — | ✔ | ✔ |
| Inscribir un equipo / retirarlo | — | — | su equipo | — | — |
| Inscribirse en un torneo individual / retirarse | — | ✔ | ✔ | ✔ | ✔ |
| Comunicar resultado, confirmar el del rival, abrir disputa | — | — | sus partidos | — | — |
| Crear torneos | — | — | — | ✔ | ✔ |
| Editar, publicar, cerrar inscripciones, iniciar, cancelar | — | — | — | sus torneos | ✔ |
| Revisar inscripciones, fijar semillas | — | — | — | sus torneos | ✔ |
| Programar partidos, validar y corregir resultados | — | — | — | sus torneos | ✔ |
| Resolver disputas | — | — | — | sus torneos | ✔ |
| Anuncios de un torneo | — | — | — | sus torneos | ✔ |
| Anuncios generales, páginas legales, ajustes | — | — | — | — | ✔ |
| Gestionar usuarios (roles, suspensiones) y equipos | — | — | — | — | ✔ |
| Ver el registro de auditoría completo | — | — | — | historial de sus torneos | ✔ |

Reglas adicionales:

- Nadie puede cambiar su propio rol ni suspenderse; siempre queda al menos un administrador activo.
- Las **evidencias** (capturas) solo las ven los jugadores de los dos equipos del partido y quien gestiona el
  torneo; a los demás, la ruta responde como si no existiera.
- Las **correcciones** de resultados exigen motivo, quedan en el historial del partido y en la auditoría, y
  solo se permiten si el siguiente partido del ganador (y del perdedor, en doble eliminación) no se ha
  jugado ni tiene un resultado comunicado o una disputa abierta.
- Un torneo privado se ve con su **enlace de invitación** (`?codigo=…`), que la organización puede renovar.
