"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface NavItem {
  href: string;
  label: string;
  /** Contador (avisos sin leer, invitaciones…). */
  count?: number;
  /** Solo se marca activo si la ruta coincide exactamente (p. ej. «Resumen» en /dashboard). */
  exact?: boolean;
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/" || item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function NavLinks({ items, className, vertical = false }: { items: NavItem[]; className?: string; vertical?: boolean }) {
  const pathname = usePathname();
  return (
    <ul className={cn(vertical ? "flex flex-col gap-0.5" : "flex items-center gap-1", className)}>
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center px-3 py-2 font-display text-[0.95rem] font-bold tracking-[0.12em] uppercase transition-colors",
                active ? "text-brand-strong" : "text-ink-2 hover:text-ink",
                !vertical &&
                  "after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:bg-brand after:opacity-0 after:shadow-[0_0_10px_rgb(200_170_110/0.9)] after:transition-opacity hover:after:opacity-40",
                !vertical && active && "after:opacity-100 hover:after:opacity-100",
                vertical && "border-l-2 border-transparent hover:bg-white/5",
                vertical && active && "border-brand bg-brand-soft text-brand-ink",
              )}
            >
              {item.label}
              {item.count ? (
                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-hex px-1.5 font-sans text-[11px] leading-5 font-bold tracking-normal text-night tabular">
                  {item.count}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
