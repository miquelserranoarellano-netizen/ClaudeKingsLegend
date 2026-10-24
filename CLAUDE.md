# Kings Legend

Plataforma de torneos y ligas de League of Legends. Next.js 16 (App Router), React 19, Tailwind 4, TypeScript
estricto, Drizzle + PostgreSQL (PGlite en local), Better Auth, Zod 4, Vitest y Playwright. Interfaz y
comentarios en español de España, tuteando.

- Antes de tocar nada: `docs/ESTADO.md` y `docs/ARQUITECTURA.md`. Permisos: `docs/PERMISOS.md`.
- Next.js 16 difiere de versiones anteriores (`params` como promesa, etc.): documentación de la versión
  instalada en `node_modules/next/dist/docs/`.
- **Capas.** `src/domain/` es lógica pura con pruebas (motor de cuadros y ligas, fases, inscripciones,
  permisos): sin base de datos ni red. `src/features/<x>/service.ts` aplica permisos, transacciones,
  auditoría y avisos; `queries.ts` son lecturas; `actions.ts` son acciones de servidor finas (Zod +
  `runAction`). `src/app/` solo compone páginas.
- **Permisos en el servidor, siempre.** Cada servicio recibe el `actor` y llama a `src/domain/permissions.ts`.
  Ocultar un botón no protege nada.
- **Base de datos.** Esquema en `src/server/db/schema/`. Una migración aplicada no se edita: cambia el esquema
  y ejecuta `npm run db:generate`. Estados como enums de Postgres. Cambios de cuadro siempre bajo bloqueo del
  torneo y de la fase (`lockMatch` / `lockAndLoadStage`), y con `version` para detectar ediciones simultáneas.
- **Nada falso.** Sin datos inventados: si algo no está configurado (correo, etc.), se dice en pantalla. Los
  datos del seed llevan `is_demo` y se muestran como «Demo».
- **Textos compartidos** (estados, errores, avisos) en `src/i18n/messages/es.ts`; los errores de negocio se
  lanzan como `AppError` con una clave del diccionario.
- Comprobaciones: `npm run check` y `npm run build`; extremo a extremo: `npm run test:e2e`. En este ordenador,
  `npm.cmd`/`npx.cmd`.
- PGlite solo admite un proceso por carpeta: no arrancar a la vez `next dev`, el seed, `admin:grant` o las
  pruebas e2e (estas usan `.data/e2e`, pero comparten `.next` con `next dev`).
