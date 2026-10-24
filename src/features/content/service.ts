import "server-only";
import { eq } from "drizzle-orm";
import { canManagePlatform } from "@/domain/permissions";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { contentPages } from "@/server/db/schema";
import { forbidden, notFound } from "@/server/errors";

export const CONTENT_SLUGS = ["privacidad", "terminos", "contacto"] as const;
export type ContentSlug = (typeof CONTENT_SLUGS)[number];

/**
 * Textos de partida. Describen lo que hace la aplicación de verdad, pero NO son un texto legal revisado:
 * la página muestra un aviso hasta que un administrador marque que un profesional lo ha revisado.
 */
const DEFAULTS: Record<ContentSlug, { title: string; body: string }> = {
  privacidad: {
    title: "Política de privacidad",
    body: `Responsable del tratamiento: [nombre o razón social, NIF y dirección del titular de Kings Legend — completar].
Contacto para privacidad: [correo — completar].

Qué datos tratamos
- Cuenta: correo electrónico, contraseña (guardada solo como hash; nunca en claro) y fechas de alta y acceso.
- Perfil: nombre visible, identificador público, Riot ID (opcional, declarado por ti y no verificado), servidor, posición, biografía y avatar.
- Actividad competitiva: equipos, invitaciones, inscripciones, partidos, resultados, evidencias que subas y disputas.
- Técnicos: sesiones abiertas (navegador y dirección IP de la sesión) y registros de seguridad necesarios para evitar abusos (límite de intentos).

Para qué
- Prestar el servicio: crear tu cuenta, gestionar equipos y torneos y mostrar cuadros, resultados y clasificaciones.
- Seguridad: proteger las cuentas y la integridad de las competiciones (registro de auditoría de los cambios de resultados).
- Avisos: notificaciones dentro de la plataforma y, si lo activas y hay un servicio de correo configurado, por correo.

Base legal: la ejecución del servicio que solicitas al registrarte y el interés legítimo en la seguridad de la plataforma.

Qué es público: tu nombre visible, tu identificador, tu perfil (si lo mantienes público), tus equipos y tus resultados en torneos públicos.

Conservación: mientras mantengas la cuenta. Al eliminarla se borran tus datos personales; tus resultados históricos se conservan anonimizados («Jugador eliminado») para no alterar los cuadros.

Encargados del tratamiento: [proveedor de alojamiento y, si se configura, de correo — completar].

Tus derechos: acceso, rectificación, supresión, oposición, limitación y portabilidad, escribiendo al contacto indicado. También puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).

Cookies: solo usamos una cookie técnica de sesión, imprescindible para iniciar sesión. No usamos cookies de analítica ni de publicidad.`,
  },
  terminos: {
    title: "Términos de uso",
    body: `Titular: [nombre o razón social, NIF y dirección — completar].

1. Objeto. Kings Legend es una plataforma para organizar y disputar torneos y ligas amateurs de League of Legends. No es un producto oficial ni está afiliada, respaldada o patrocinada por Riot Games. League of Legends es una marca de Riot Games, Inc.

2. Cuenta. Debes facilitar datos veraces y custodiar tu contraseña. Una persona, una cuenta. Edad mínima: [definir — completar].

3. Conducta. Se prohíben las trampas, la suplantación (incluido usar un Riot ID ajeno), el acoso, el lenguaje de odio y la manipulación de resultados. Las normas de cada torneo complementan estas.

4. Torneos. Cada organizador fija el reglamento de su torneo y valida los resultados. Las disputas se resuelven por la organización del torneo; los administradores de la plataforma pueden intervenir.

5. Premios. Los premios, si los hay, son responsabilidad de quien organiza el torneo. [Completar según el caso.]

6. Contenido. Eres responsable de lo que subas (logotipos, avatares, capturas). Debes tener derecho a usarlo.

7. Suspensión. Podemos suspender cuentas que incumplan estos términos.

8. Responsabilidad. El servicio se presta tal cual; haremos lo posible por que esté disponible y sin errores.

9. Legislación aplicable: española. [Revisar con un profesional.]`,
  },
  contacto: {
    title: "Contacto",
    body: `¿Dudas, problemas con tu cuenta, quieres organizar un torneo o informar de una incidencia?

Escríbenos a: [correo de contacto — completar también en Administración › Ajustes].

Para incidencias de un partido concreto, abre una disputa desde la página del partido: llega directamente a la organización del torneo.`,
  },
};

export async function getContentPage(slug: ContentSlug) {
  const db = await getDb();
  const [row] = await db.select().from(contentPages).where(eq(contentPages.slug, slug));
  return row ?? { slug, ...DEFAULTS[slug], legalReviewed: false, updatedAt: null, updatedById: null };
}

export async function saveContentPage(
  actor: CurrentUser,
  slug: string,
  input: { title: string; body: string; legalReviewed: boolean },
): Promise<void> {
  if (!canManagePlatform(actor)) throw forbidden();
  if (!(CONTENT_SLUGS as readonly string[]).includes(slug)) throw notFound();
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx
      .insert(contentPages)
      .values({ slug, ...input, updatedById: actor.id })
      .onConflictDoUpdate({ target: contentPages.slug, set: { ...input, updatedById: actor.id, updatedAt: new Date() } });
    await audit(tx, { actorId: actor.id, action: "content.update", entityType: "content_page", entityId: slug, data: { legalReviewed: input.legalReviewed } });
  });
}
