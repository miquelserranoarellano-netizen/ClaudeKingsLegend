"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * «Continuar con Google» (estilo oscuro de las normas de marca de Google). Lleva a Google, que vuelve a
 * `/api/auth/callback/google`; si algo falla, se vuelve a la página de acceso con `?error=`.
 */
export function GoogleButton({ next, label = "Continuar con Google" }: { next: string; label?: string }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    setPending(true);
    setFailed(false);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
      // Quien entra por primera vez completa su perfil (nombre visible, Riot ID).
      newUserCallbackURL: "/dashboard/perfil",
      // Better Auth añade `error=<código>` a esta dirección.
      errorCallbackURL: `/acceso?next=${encodeURIComponent(next)}`,
    });
    // Si todo va bien, el navegador ya se está yendo a Google.
    if (error) {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-sm border border-[#8e918f] bg-[#131314] px-4 text-[0.95rem] font-medium text-[#e3e3e3] transition-[background-color,transform] duration-150 ease-out hover:bg-[#1f1f20] active:scale-[0.98] disabled:opacity-60"
      >
        <GoogleLogo />
        {pending ? "Abriendo Google…" : label}
      </button>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-danger">
          No se ha podido abrir Google. Vuelve a intentarlo dentro de un momento.
        </p>
      )}
    </div>
  );
}

/** La «G» de Google, en sus colores (uso permitido en botones de inicio de sesión). */
function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Separador «o con tu correo» entre Google y el formulario. */
export function AuthDivider({ text = "o con tu correo" }: { text?: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs tracking-[0.14em] text-ink-3 uppercase">
      <span className="h-px flex-1 bg-line" />
      {text}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
