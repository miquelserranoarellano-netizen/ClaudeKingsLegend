"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { FormMessage, SubmitButton } from "./form";

/**
 * Botón que pide confirmación en un diálogo nativo (`<dialog>`, accesible con teclado y Escape) antes de
 * enviar una acción irreversible. Los campos extra (motivo, etc.) van como `children` dentro del diálogo.
 */
export function ConfirmForm({
  action,
  hidden,
  trigger,
  title,
  description,
  confirmLabel,
  variant = "primary",
  triggerVariant,
  size = "md",
  children,
  onDone,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  variant?: ButtonVariant;
  triggerVariant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
  onDone?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(action, null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      dialog.current?.close();
      onDone?.();
    }
  }, [state, onDone]);

  return (
    <>
      <Button
        variant={triggerVariant ?? variant}
        size={size}
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        {trigger}
      </Button>
      {state?.ok && state.message && !open && <FormMessage state={state} className="mt-2" />}
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-night/50"
      >
        <form action={formAction} className="space-y-4 p-5">
          {Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <h2 className="font-display text-xl font-bold uppercase">{title}</h2>
          {description && <div className="text-sm text-ink-2">{description}</div>}
          {children}
          <FormMessage state={state} />
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => dialog.current?.close()}>
              Cancelar
            </Button>
            <SubmitButton variant={variant}>{confirmLabel}</SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
