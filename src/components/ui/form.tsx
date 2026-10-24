"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { type ComponentProps, type ReactNode, useId } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";
import type { ActionState } from "@/lib/action-state";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

const control =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-danger disabled:bg-surface-2 disabled:text-ink-3";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-10 pr-8", className)} {...props} />;
}

/**
 * Campo con etiqueta, ayuda y error, enlazados por `aria-describedby`. El control se recibe como función
 * para poder pasarle `id`, `aria-invalid` y `aria-describedby`.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline gap-2 text-sm font-semibold text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-ink-3">(opcional)</span>}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ label, hint, className, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand" {...props} />
      <label htmlFor={id} className="text-sm leading-snug">
        <span className="font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-3">{hint}</span>}
      </label>
    </div>
  );
}

/** Botón de envío que se desactiva y muestra un indicador mientras la acción está en curso. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
  disabled,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      name={name}
      value={value}
    >
      {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/** Resultado de una acción: mensaje de éxito o de error, anunciado a los lectores de pantalla. */
export function FormMessage({ state, className }: { state: ActionState<unknown>; className?: string }) {
  if (!state) return null;
  if (state.ok && !state.message) return null;
  const ok = state.ok;
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <div
      role={ok ? "status" : "alert"}
      className={cn(
        "flex animate-fade-in items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
        ok ? "bg-open-soft text-open" : "bg-danger-soft text-danger",
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{ok ? state.message : state.error}</span>
    </div>
  );
}

export function fieldError(state: ActionState<unknown>, name: string): string | undefined {
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}
