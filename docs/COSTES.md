# Costes

Precios orientativos a octubre de 2026, sin IVA salvo que se indique. Cambian a menudo y las ofertas exigen
permanencia: compruébalos siempre antes de pagar. El código no depende de ningún servicio de pago.

## Imprescindibles

| Concepto | Opción recomendada | Coste aproximado |
| --- | --- | --- |
| Servidor | Hostinger VPS KVM 2 (2 vCPU, 8 GB, 100 GB NVMe) | ~7–9 €/mes con 24 meses de permanencia; la renovación sube a ~15–18 €/mes. Mensual sin permanencia: bastante más caro. |
| (alternativa más barata) | Hostinger VPS KVM 1 (1 vCPU, 4 GB, 50 GB) | ~5–7 €/mes con permanencia; renovación ~12 €/mes. |
| Dominio | `.es` o `.com` | ~10–20 €/año (el primer año suele tener descuento; mira el precio de renovación). |
| Base de datos | PostgreSQL dentro del mismo VPS (docker-compose) | Incluido. |
| Certificado HTTPS | Let's Encrypt vía Caddy | Gratis. |

Total mínimo realista: **~100–130 € el primer año** (VPS con permanencia + dominio), más IVA.

## Opcionales

| Concepto | Para qué | Coste aproximado |
| --- | --- | --- |
| Correo profesional (Hostinger Business Email u otro) | Verificación de correo, recuperación de contraseña, avisos por correo. | ~1–3 €/buzón/mes. Algunos proveedores SMTP transaccionales tienen niveles gratuitos con límites diarios que pueden cambiar. |
| Copias diarias gestionadas por Hostinger | Más allá de las semanales incluidas y del volcado propio de `docs/DESPLIEGUE.md`. | Complemento de pago (~2–3 €/mes). |
| Monitorización externa (UptimeRobot, Better Stack…) | Aviso si la web cae. | Nivel gratuito suficiente para empezar. |
| CDN / protección (Cloudflare) | Caché y protección frente a ataques. | Plan gratuito. |
| GitHub | Repositorio privado y CI (GitHub Actions). | Gratis para equipos pequeños (minutos de CI limitados). |
| Revisión legal | Textos de privacidad y términos. | Variable (abogado o servicio especializado). |
| Clave de producción de la API de Riot | Verificar Riot ID o traer estadísticas (no implementado). | Gratuita, pero requiere solicitarla y que Riot apruebe el proyecto. |

## No hace falta pagar

- Licencias del software: todo es de código abierto (Next.js, PostgreSQL, Drizzle, Better Auth, Caddy…).
- Almacenamiento de imágenes: van dentro de PostgreSQL (con poco volumen es lo más simple). Si algún día
  crece mucho, se puede pasar a un almacenamiento de objetos (S3 compatible), que sí tendría coste.
