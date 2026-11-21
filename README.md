# Kings Legend

Plataforma web para organizar, gestionar y disputar torneos y ligas de **League of Legends**: equipos,
inscripciones, cuadros eliminatorios (simple y doble), ligas con clasificación, resultados con evidencias,
disputas, avisos y un panel de administración.

> Kings Legend no está afiliado, respaldado ni patrocinado por Riot Games. League of Legends es una marca
> registrada de Riot Games, Inc.

## Puesta en marcha (desarrollo)

Requisitos: Node 24 y npm. No hace falta instalar PostgreSQL: en local se usa **PGlite** (Postgres real
compilado a WASM) guardado en `.data/`. En producción: **Cloudflare Workers + Supabase**
([`docs/DESPLIEGUE-CLOUDFLARE.md`](docs/DESPLIEGUE-CLOUDFLARE.md)).

```bash
npm install
npm run db:seed        # opcional: datos de demostración (marcados como «Demo»)
npm run dev            # http://localhost:3400
```

Cuentas del seed (contraseña `demo-kings-legend`, solo desarrollo): `admin@demo.kingslegend.test`,
`organiza@demo.kingslegend.test` y `jugador1@demo.kingslegend.test` … `jugador40@…`.

Para dar el rol de administrador a tu propia cuenta (con el servidor de desarrollo parado):

```bash
npm run admin:grant -- tu@correo.com admin
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (puerto 3400). |
| `npm run check` | Tipos, lint y pruebas unitarias e integración (Vitest, contra Postgres en memoria). |
| `npm run test:e2e` | Pruebas de extremo a extremo (Playwright con el Chrome instalado; base propia en `.data/e2e`). |
| `npm run build` | Compilación de producción (`next build`; en Cloudflare Workers Builds, el Worker). |
| `npm run build:cf` | Compila el Worker de Cloudflare (OpenNext) en `.open-next/`. |
| `npm run preview:cf` | Compila el Worker y lo ejecuta en local con `workerd` (variables en `.dev.vars`). |
| `npm run deploy:cf` | Compila y despliega el Worker con Wrangler (desde tu ordenador). |
| `npm run db:generate` | Genera una migración nueva a partir de los cambios en `src/server/db/schema`. |
| `npm run db:migrate` | Aplica las migraciones a la base de `DATABASE_URL` (producción). |
| `npm run db:seed` | Datos de demostración (se niega a ejecutarse en producción). |
| `npm run admin:grant -- correo rol` | Cambia el rol global de una cuenta (`admin`, `organizer`, `user`). |

## Documentación

- [`docs/ESTADO.md`](docs/ESTADO.md) — qué funciona, qué se ha verificado y qué falta.
- [`docs/AUDITORIA.md`](docs/AUDITORIA.md) — auditoría de seguridad, base de datos y rendimiento (noviembre de 2026).
- [`docs/DESPLIEGUE-CLOUDFLARE.md`](docs/DESPLIEGUE-CLOUDFLARE.md) — publicar en Cloudflare Workers con Supabase (paso a paso).
- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — pila, capas, modelo de datos y motor de competición.
- [`docs/PERMISOS.md`](docs/PERMISOS.md) — roles y matriz de permisos.
- [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) — alternativa: publicar en un VPS de Hostinger, migraciones y copias.
- [`docs/COSTES.md`](docs/COSTES.md) — costes imprescindibles y opcionales.
- [`docs/TRABAJO-EN-EQUIPO.md`](docs/TRABAJO-EN-EQUIPO.md) — Git, ramas y reparto del trabajo.
