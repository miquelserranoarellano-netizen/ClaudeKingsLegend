import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Botones de la marca (estilos en `globals.css`, sección «Botones»):
 * - `primary`: oro forjado con doble marco, la acción principal de cada pantalla.
 * - `hex`: cian «hextech», para la llamada de la cabecera.
 * - `outline`, `secondary`, `night`, `ghost`: acciones secundarias.
 * - `danger`: acciones destructivas.
 */
export type ButtonVariant = "primary" | "hex" | "secondary" | "outline" | "ghost" | "danger" | "night";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "btn-gold",
  hex: "btn-hex",
  night: "btn-night",
  secondary: "btn-secondary",
  outline: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.8rem]",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn("btn", variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; children: ReactNode }) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
