import { NextResponse, type NextRequest } from "next/server";

/**
 * Comprobación optimista de las zonas privadas: si no hay cookie de sesión, se manda al acceso recordando
 * la página pedida. No consulta la base de datos ni protege nada por sí sola: la verificación real (sesión
 * válida, cuenta no suspendida, rol) la hacen `requireUser`/`requireAdminArea` en cada página y acción.
 */
const SESSION_COOKIES = ["kl.session_token", "__Secure-kl.session_token"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const url = new URL("/acceso", request.url);
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/admin", "/admin/:path*"],
};
