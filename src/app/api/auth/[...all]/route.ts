import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth/auth";

/** Endpoints de Better Auth (registro, acceso, cierre de sesión, verificación, recuperación…). */
export const { GET, POST } = toNextJsHandler(async (request) => (await getAuth()).handler(request));
