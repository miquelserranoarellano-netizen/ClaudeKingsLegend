"use client";

import { Bell, ChevronDown, LayoutDashboard, LogOut, Menu, Settings, Shield, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth-client";
import { Disclosure } from "./disclosure";
import { NavLinks, type NavItem } from "./nav-links";

export interface HeaderUser {
  displayName: string;
  handle: string;
  avatarMediaId: string | null;
  canAdmin: boolean;
  unread: number;
}

const itemClass = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink";

function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={itemClass}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await authClient.signOut();
          router.push("/");
          router.refresh();
        })
      }
    >
      <LogOut aria-hidden className="size-4" /> {pending ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );
}

function AccountLinks({ user }: { user: HeaderUser }) {
  return (
    <>
      <Link href="/dashboard" className={itemClass}>
        <LayoutDashboard aria-hidden className="size-4" /> Mi panel
      </Link>
      <Link href={`/jugadores/${user.handle}`} className={itemClass}>
        <UserRound aria-hidden className="size-4" /> Perfil público
      </Link>
      <Link href="/dashboard/ajustes" className={itemClass}>
        <Settings aria-hidden className="size-4" /> Ajustes de cuenta
      </Link>
      {user.canAdmin && (
        <Link href="/admin" className={itemClass}>
          <Shield aria-hidden className="size-4" /> Administración
        </Link>
      )}
      <div className="my-1 border-t border-line" />
      <SignOutButton />
    </>
  );
}

export function UserMenu({ user }: { user: HeaderUser }) {
  return (
    <div className="flex items-center gap-1">
      <Link
        href="/dashboard/notificaciones"
        className="relative inline-flex size-10 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
        aria-label={user.unread > 0 ? `Notificaciones: ${user.unread} sin leer` : "Notificaciones"}
      >
        <Bell aria-hidden className="size-5" />
        {user.unread > 0 && (
          <span className="absolute top-1.5 right-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] leading-4 font-bold text-white tabular">
            {user.unread > 99 ? "99+" : user.unread}
          </span>
        )}
      </Link>
      <Disclosure
        label="Menú de la cuenta"
        buttonClassName="hidden items-center gap-2 rounded-lg py-1 pr-2 pl-1 hover:bg-surface-2 md:flex"
        panelClassName="w-60"
        button={
          <>
            <Avatar name={user.displayName} mediaId={user.avatarMediaId} size="sm" />
            <span className="max-w-32 truncate text-sm font-semibold">{user.displayName}</span>
            <ChevronDown aria-hidden className="size-4 text-ink-3" />
          </>
        }
      >
        <AccountLinks user={user} />
      </Disclosure>
    </div>
  );
}

export function MobileMenu({ items, user }: { items: NavItem[]; user: HeaderUser | null }) {
  return (
    <Disclosure
      label="Abrir menú"
      buttonClassName="inline-flex size-10 items-center justify-center rounded-lg text-ink hover:bg-surface-2 md:hidden"
      panelClassName="fixed inset-x-3 top-16 mt-1 max-h-[calc(100dvh-5rem)] overflow-y-auto p-2"
      button={<Menu aria-hidden className="size-5" />}
    >
      <nav aria-label="Menú principal (móvil)">
        <NavLinks items={items} vertical />
      </nav>
      <div className="my-2 border-t border-line" />
      {user ? (
        <AccountLinks user={user} />
      ) : (
        <div className="grid grid-cols-2 gap-2 p-1">
          <Link href="/acceso" className="flex h-10 items-center justify-center rounded-lg border border-line-strong text-sm font-semibold">
            Entrar
          </Link>
          <Link href="/registro" className="chamfer-sm flex h-10 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white">
            Crear cuenta
          </Link>
        </div>
      )}
    </Disclosure>
  );
}
