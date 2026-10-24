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
                "relative flex items-center rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                active ? "text-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
                !vertical && active && "after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:bg-brand",
                vertical && active && "bg-brand-soft text-brand-ink",
              )}
            >
              {item.label}
              {item.count ? (
                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] leading-5 font-bold text-white tabular">
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
