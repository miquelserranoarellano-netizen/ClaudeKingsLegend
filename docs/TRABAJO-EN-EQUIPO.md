# Trabajo en equipo con Git y GitHub

## Estado de partida

La carpeta del proyecto **no era un repositorio** y en este ordenador **no hay Git instalado**, así que no
había historial ni trabajo de otras personas que proteger. El código está listo para el primer commit.

## Primeros pasos

```bash
winget install Git.Git                       # y reabrir el terminal
git config --global user.name "Tu Nombre"
git config --global user.email "tu@correo"
cd "C:\Users\mique\Documents\PaginasMiquel\kings legenmd"
git init -b main
git add .
git commit -m "Primera versión de Kings Legend"
# Crea el repositorio privado vacío en GitHub y después:
git remote add origin https://github.com/TU_USUARIO/kings-legend.git
git push -u origin main
```

Comprueba antes del primer `git add` que `git status` no lista `.env`, `.data/` ni `node_modules/` (están en
`.gitignore`).

## Flujo de trabajo

- `main` siempre desplegable. Protégela en GitHub (Settings → Branches): pull request obligatorio, CI en verde
  (`.github/workflows/ci.yml`) y al menos una revisión.
- Una rama por funcionalidad o corrección: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- Commits pequeños y descriptivos, en imperativo: «Añade la lista de espera a las inscripciones».
- Pull requests acotados (idealmente < 400 líneas), con descripción de qué cambia, cómo se ha probado y
  capturas si hay interfaz.
- Antes de abrir el PR: `npm run check`, `npm run build` y, si toca flujos, `npm run test:e2e`.
- Migraciones: un PR que cambia el esquema incluye su migración generada (`npm run db:generate`). Dos ramas
  que generan migraciones a la vez chocan: la segunda en fusionarse debe regenerar la suya sobre `main`.
- Nadie hace `push --force` sobre `main` ni fusiona sin revisión.

## Reparto propuesto por áreas

Cada área tiene su carpeta en `src/features/` (y, si aplica, en `src/domain/`), así que se puede trabajar en
paralelo con pocos conflictos:

| Área | Carpetas | Siguientes tareas posibles |
| --- | --- | --- |
| Cuentas y perfiles | `features/auth`, `features/profiles`, `server/auth` | Cambio de correo con verificación, inicio de sesión con Discord. |
| Equipos | `features/teams` | Posiciones por jugador, historial de altas y bajas. |
| Torneos e inscripciones | `features/tournaments`, `features/registrations`, `domain/tournament` | Check-in antes de empezar, inscripción por la organización. |
| Motor de competición | `domain/competition`, `features/competition` | Fase de grupos + eliminatoria, tercer puesto, sistema suizo. |
| Partidos, resultados y disputas | `features/matches` | Detalle por partida (campeones, KDA), recordatorios antes del partido. |
| Administración | `app/admin`, `features/admin` | Exportaciones, estadísticas de uso. |
| Diseño e interfaz | `components/`, `app/globals.css` | Logotipo definitivo, modo oscuro, repaso de accesibilidad. |
| Infraestructura | `Dockerfile`, `docker-compose.yml`, `scripts/`, `.github/` | Despliegue automático desde GitHub, copias fuera del servidor. |
| Idioma | `src/i18n` | Inglés: mover los textos de cada página al diccionario. |
