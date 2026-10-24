# Imagen de producción de Kings Legend.
#   docker compose up -d --build      (ver docker-compose.yml y docs/DESPLIEGUE.md)

FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Dependencias completas para compilar.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Compilación. NEXT_PUBLIC_SITE_URL se fija aquí porque Next la incrusta en el código al compilar.
FROM base AS build
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_TIME_ZONE=Europe/Madrid
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_TIME_ZONE=$NEXT_PUBLIC_TIME_ZONE
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && rm -rf .next/cache

# Solo dependencias de producción para la imagen final.
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=prod-deps /app/node_modules ./node_modules
# .next debe poder escribirse en ejecución (caché de Next).
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build /app/package.json /app/next.config.mjs ./
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
# Usuario sin privilegios.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Primero las migraciones pendientes; si fallan, el contenedor no arranca (y Docker lo reintenta).
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node_modules/.bin/next start -p ${PORT}"]
