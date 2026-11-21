# Costes

Precios orientativos a octubre de 2026, sin IVA salvo que se indique. Cambian a menudo y las ofertas exigen
permanencia: compruébalos siempre antes de pagar. El código no depende de ningún servicio de pago.

## Opción principal: Cloudflare Workers + Supabase (noviembre de 2026)

| Concepto | Plan | Coste aproximado |
| --- | --- | --- |
| Cloudflare Workers | **Workers Paid** (imprescindible: el gratuito corta a 10 ms de CPU por petición y comprobar una contraseña gasta ~80 ms) | 5 $/mes; incluye 10 millones de peticiones y 30 millones de ms de CPU al mes. |
| Hyperdrive | Incluido en Workers | 0 $ (el plan gratuito de Workers lo limita a 100.000 consultas al día; el de pago, sin límite). |
| Supabase | Free: 500 MB de base, 5 GB de salida al mes, **se pausa tras 7 días sin actividad** | 0 $. Pro: 25 $/mes (8 GB, sin pausas). |
| Correo | Resend Free: 100 correos al día, 3.000 al mes | 0 $. Pro: 20 $/mes. |
| Dominio | `.es` o `.com` (opcional al principio: sirve el de `workers.dev`) | ~10–20 €/año. |

**Mínimo: 5 $/mes** (más el dominio si lo quieres). Con mucho crecimiento: Supabase Pro (+25 $/mes).

## Alternativa: VPS (Hostinger)

### Imprescindibles

| Concepto | Opción recomendada | Coste aproximado |
| --- | --- | --- |
| Servidor | Hostinger VPS KVM 2 (2 vCPU, 8 GB, 100 GB NVMe) | ~7–9 €/mes con 24 meses de permanencia; la renovación sube a ~15–18 €/mes. Mensual sin permanencia: bastante más caro. |
| (alternativa más barata) | Hostinger VPS KVM 1 (1 vCPU, 4 GB, 50 GB) | ~5–7 €/mes con permanencia; renovación ~12 €/mes. |
| Dominio | `.es` o `.com` | ~10–20 €/año (el primer año suele tener descuento; mira el precio de renovación). |
| Base de datos | PostgreSQL dentro del mismo VPS (docker-compose) | Incluido. |
| Certificado HTTPS | Let's Encrypt vía Caddy | Gratis. |

Total mínimo realista: **~100–130 € el primer año** (VPS con permanencia + dominio), más IVA.

### Opcionales

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
