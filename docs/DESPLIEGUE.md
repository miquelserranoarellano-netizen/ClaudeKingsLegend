# Despliegue en Hostinger (VPS)

## 1. Qué contratar

| Necesidad | Producto de Hostinger | Notas |
| --- | --- | --- |
| **Servidor** (imprescindible) | **VPS KVM 2**: 2 vCPU, 8 GB de RAM, 100 GB NVMe, 8 TB de tráfico | Recomendado. El **KVM 1** (1 vCPU, 4 GB) también sirve para empezar, pero compilar la imagen va más justo. |
| Sistema | Plantilla **Ubuntu 24.04 con Docker** (en la sección de plantillas del VPS) | Trae Docker y Docker Compose instalados. Ubicación: un centro de datos europeo (p. ej. Fráncfort o Lituania). |
| **Dominio** (imprescindible) | Cualquier registrador (en Hostinger, «Dominios») | `.es` o `.com`. |
| Correo (opcional) | Correo de Hostinger (Business Email) u otro proveedor SMTP | Solo para verificación de correo, recuperación de contraseña y avisos por correo. |

**Por qué un VPS y no el hosting web (ni el plan con Node.js):** los planes compartidos (Premium, Business,
Cloud) incluyen bases de datos **MySQL**, no PostgreSQL, y sus aplicaciones Node.js tienen límites de
procesos y memoria. Kings Legend necesita PostgreSQL y un proceso Node permanente. En un VPS tienes ambos,
con HTTPS automático, por un precio similar. (Alternativa posible pero no recomendada: plan Business con
Node.js + un PostgreSQL externo como Neon o Supabase.)

Precios orientativos (octubre de 2026, compruébalos al pagar): el KVM 2 ronda 7–9 €/mes con permanencia de
24 meses (más IVA) y la renovación es más cara (unos 15–18 €/mes). Detalle en `docs/COSTES.md`.

## 2. Requisitos previos (en tu ordenador)

1. Instalar **Git** (`winget install Git.Git`) y crear una cuenta de **GitHub**.
2. Crear un repositorio **privado** en GitHub (por ejemplo `kings-legend`) y subir el código (ver
   `docs/TRABAJO-EN-EQUIPO.md`). El `.env` real nunca se sube: está en `.gitignore`.

## 3. Primera instalación

### 3.1 Dominio → servidor

En el DNS de tu dominio crea dos registros **A** con la IP del VPS (la ves en hPanel → VPS → Resumen):

| Tipo | Nombre | Valor |
| --- | --- | --- |
| A | `@` | IP del VPS |
| A | `www` | IP del VPS |

Si el dominio está en Hostinger: hPanel → Dominios → tu dominio → DNS / Nameservers. Puede tardar de minutos
a unas horas en propagarse.

### 3.2 Cortafuegos

hPanel → VPS → Seguridad → Cortafuegos: permite **22** (SSH), **80** y **443** (web). Nada más: la base de
datos no se publica (solo la ve la aplicación por la red interna de Docker).

### 3.3 Instalar la aplicación

Entra al servidor por SSH (`ssh root@IP_DEL_VPS`) o con el terminal del navegador de hPanel y ejecuta:

```bash
# Usuario sin privilegios para la aplicación (recomendado)
adduser --disabled-password --gecos "" kings && usermod -aG docker kings
su - kings

# Código (repositorio privado: GitHub te pedirá un token de acceso personal o una clave de despliegue)
git clone https://github.com/TU_USUARIO/kings-legend.git
cd kings-legend

# Configuración
cp .env.example .env
openssl rand -base64 48   # copia el resultado en BETTER_AUTH_SECRET
openssl rand -hex 24      # copia el resultado en POSTGRES_PASSWORD
nano .env                 # DOMAIN, NEXT_PUBLIC_SITE_URL, secretos y (opcional) SMTP

# Construir y arrancar (la primera vez tarda unos minutos)
docker compose up -d --build
docker compose ps         # los tres servicios deben estar «running» / «healthy»
```

Al arrancar, el contenedor `app` aplica las migraciones y Caddy pide el certificado HTTPS. Abre
`https://tu-dominio`.

### 3.4 Primer administrador

Crea tu cuenta desde la web (`/registro`) y después, en el servidor:

```bash
docker compose exec app node scripts/grant-role.mjs tu@correo.com admin
```

Desde `/admin/usuarios` podrás nombrar organizadores y otros administradores. Revisa también
`/admin/ajustes` (correo de contacto, redes) y `/admin/contenido` (textos legales: **revisión legal antes
del lanzamiento**).

## 4. Actualizar a una versión nueva

```bash
cd ~/kings-legend
git pull
docker compose up -d --build
```

Las migraciones nuevas se aplican solas al arrancar. Si una falla, el contenedor no arranca y Docker lo
reintenta: mira el motivo con `docker compose logs app`.

## 5. Migraciones (procedimiento)

1. En desarrollo, cambia el esquema en `src/server/db/schema/` y ejecuta `npm run db:generate`: se crea un
   archivo nuevo en `drizzle/`. Revisa el SQL generado.
2. `npm run check` (las pruebas aplican todas las migraciones a un Postgres en memoria).
3. Sube el cambio y despliega: se aplica al arrancar (`scripts/migrate.mjs`, con bloqueo para que nunca se
   apliquen dos veces).
4. **Nunca** edites ni borres una migración ya aplicada en producción: corrige con otra nueva.
5. Antes de una migración delicada, haz una copia (apartado 6).

## 6. Copias de seguridad

Hostinger hace copias semanales del VPS completo, pero conviene un volcado diario de la base de datos:

```bash
mkdir -p ~/copias
# Prueba manual
docker compose -f ~/kings-legend/docker-compose.yml exec -T db pg_dump -U kings_legend kings_legend | gzip > ~/copias/kings-$(date +%F).sql.gz
# Programado cada día a las 4:00, conservando 14 días (crontab -e)
0 4 * * * cd ~/kings-legend && docker compose exec -T db pg_dump -U kings_legend kings_legend | gzip > ~/copias/kings-$(date +\%F).sql.gz && find ~/copias -name 'kings-*.sql.gz' -mtime +14 -delete
```

Restaurar (¡sobrescribe los datos!): `gunzip -c copia.sql.gz | docker compose exec -T db psql -U kings_legend kings_legend`.
Guarda también copias fuera del servidor de vez en cuando.

## 7. Supervisión y registros

- Salud: `https://tu-dominio/api/health` responde `200 {"status":"ok"}` si la aplicación y la base de datos
  funcionan (`503` si no). Puedes vigilarla con un servicio gratuito como UptimeRobot.
- Registros: `docker compose logs -f app` (o `db`, `caddy`). No contienen contraseñas, tokens ni IP.
- Estado: `docker compose ps`. Docker reinicia solo un servicio que se caiga (`restart: unless-stopped`).

## 8. Correo (opcional)

Con el correo de Hostinger: crea un buzón (p. ej. `no-responder@tu-dominio`) y rellena en `.env`:

```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=no-responder@tu-dominio
SMTP_PASSWORD=la contraseña del buzón
MAIL_FROM="Kings Legend <no-responder@tu-dominio>"
```

Después: `docker compose up -d` (sin `--build`). Con el correo configurado se exige verificar el correo al
registrarse y funcionan la recuperación de contraseña y los avisos por correo. Configura también SPF y DKIM
del dominio (hPanel → Correo → Ajustes DNS) para que no acaben en spam.

## 9. Conectar Hostinger con Claude (opcional)

Hostinger publica un servidor MCP oficial (`hostinger-api-mcp`) con el que Claude puede, con tu permiso,
consultar y gestionar el VPS (estado, reinicios, proyectos Docker) y el DNS del dominio:

1. hPanel → tu perfil → **API** → crea un token. Trátalo como una contraseña: **no lo pegues en el chat**.
2. En un terminal de tu ordenador (con Claude Code instalado):

   ```bash
   claude mcp add hostinger --scope user -e API_TOKEN=TU_TOKEN -- npx -y hostinger-api-mcp
   ```

3. Reinicia la sesión de Claude Code. A partir de ahí puedes pedir, por ejemplo, «comprueba el estado del VPS»
   o «crea los registros DNS del dominio». Cualquier acción que cambie algo te la confirmaré antes.

Otra opción es darme acceso por **SSH** con una clave (sin contraseñas en el chat): desde tu ordenador podré
ejecutar el despliegue del apartado 4 cuando me lo pidas.

## 10. Otras plataformas

El proyecto no depende de Hostinger: cualquier servidor con Docker sirve igual (Hetzner, OVH, DigitalOcean…).
También puede ir en Vercel (aplicación) + Neon o Supabase (PostgreSQL) definiendo `DATABASE_URL` y
ejecutando `npm run db:migrate` antes de cada despliegue.
