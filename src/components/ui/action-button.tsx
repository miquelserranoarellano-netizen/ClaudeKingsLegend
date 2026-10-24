"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import type { ButtonSize, ButtonVariant } from "./button";
import { FormMessage, SubmitButton } from "./form";

/**
 * Botón que ejecuta una acción de servidor con unos campos fijos (aceptar una invitación, publicar…).
 * Muestra el estado de envío y el resultado junto al botón.
 */
export function ActionButton({
  action,
  fields,
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  showSuccess = true,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  showSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={cn("inline-flex flex-col gap-2", className)}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel}>
        {children}
      </SubmitButton>
      {(state && !state.ok) || (showSuccess && state?.ok) ? <FormMessage state={state} /> : null}
    </form>
  );
}
