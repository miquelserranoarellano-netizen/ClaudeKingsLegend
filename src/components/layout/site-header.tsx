import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { canAccessAdminArea } from "@/domain/permissions";
import { unreadCount } from "@/features/notifications/service";
import { t } from "@/i18n";
import { getCurrentUser } from "@/server/auth/session";
import { NavLinks, type NavItem } from "./nav-links";
import { type HeaderUser, MobileMenu, UserMenu } from "./user-menu";

export const MAIN_NAV: NavItem[] = [
  { href: "/torneos", label: t("nav.tournaments") },
  { href: "/equipos", label: t("nav.teams") },
  { href: "/ranking", label: t("nav.ranking") },
  { href: "/noticias", label: t("nav.news") },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  const headerUser: HeaderUser | null = user
    ? {
        displayName: user.displayName,
        handle: user.handle,
        avatarMediaId: user.avatarMediaId,
        canAdmin: canAccessAdminArea(user),
        unread: await unreadCount(user.id),
      }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Kings Legend, ir al inicio" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label={t("nav.mainMenu")} className="ml-4 hidden md:block">
          <NavLinks items={MAIN_NAV} />
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {headerUser ? (
            <UserMenu user={headerUser} />
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <ButtonLink href="/acceso" variant="ghost">
                {t("nav.signIn")}
              </ButtonLink>
              <ButtonLink href="/registro">{t("nav.signUp")}</ButtonLink>
            </div>
          )}
          <MobileMenu items={MAIN_NAV} user={headerUser} />
        </div>
      </div>
    </header>
  );
}
