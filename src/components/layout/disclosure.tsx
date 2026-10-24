"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Desplegable accesible (patrón «disclosure»): botón con `aria-expanded`, se cierra con Escape, al pulsar
 * fuera y al cambiar de página. El contenido son enlaces y botones normales, navegables con el teclado.
 */
export function Disclosure({
  label,
  button,
  children,
  panelClassName,
  buttonClassName,
}: {
  label: string;
  button: ReactNode;
  children: ReactNode;
  panelClassName?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);

  // Cerrar al navegar (ajuste de estado durante el render, sin efecto).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={buttonClassName}
      >
        {button}
      </button>
      <div
        id={id}
        hidden={!open}
        className={cn("absolute right-0 z-50 mt-2 animate-fade-in rounded-card border border-line bg-surface p-1.5 shadow-lift", panelClassName)}
      >
        {children}
      </div>
    </div>
  );
}
