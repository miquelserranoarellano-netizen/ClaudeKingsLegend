import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getSettings, type SocialNetwork } from "@/features/settings/service";
import { t } from "@/i18n";

const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  discord: "Discord",
  x: "X (Twitter)",
  twitch: "Twitch",
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
};

export async function SiteFooter() {
  const settings = await getSettings();
  const socials = (Object.entries(settings.socialLinks) as [SocialNetwork, string | null][]).filter(([, url]) => url);
  const columns = [
    {
      title: "Competir",
      links: [
        { href: "/torneos", label: "Torneos y ligas" },
        { href: "/equipos", label: "Equipos" },
        { href: "/ranking", label: "Ranking" },
        { href: "/noticias", label: "Noticias" },
      ],
    },
    {
      title: "Tu cuenta",
      links: [
        { href: "/registro", label: "Crear cuenta" },
        { href: "/dashboard", label: "Mi panel" },
        { href: "/dashboard/equipos/nuevo", label: "Crear un equipo" },
      ],
    },
    {
      title: "Legal",
      links: [
        { href: "/privacidad", label: "Privacidad" },
        { href: "/terminos", label: "Términos de uso" },
        { href: "/contacto", label: "Contacto" },
      ],
    },
  ];

  return (
    <footer className="relative mt-24 bg-night">
      <div aria-hidden className="gold-rule" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm text-ink-3">{t("common.tagline")}: inscripciones, cuadros, calendarios y clasificaciones en un solo sitio.</p>
          {settings.contactEmail && (
            <p className="text-sm">
              <a className="font-semibold text-hex underline-offset-4 hover:underline" href={`mailto:${settings.contactEmail}`}>
                {settings.contactEmail}
              </a>
            </p>
          )}
          {socials.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Redes sociales">
              {socials.map(([network, url]) => (
                <li key={network}>
                  <a
                    href={url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center border border-line-strong px-2.5 font-display text-xs font-bold tracking-[0.1em] text-ink-2 uppercase hover:border-brand hover:text-brand-strong"
                  >
                    {SOCIAL_LABELS[network]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <h2 className="font-display text-sm font-bold tracking-[0.2em] text-brand uppercase">{column.title}</h2>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-ink-3 transition-colors hover:text-brand-strong">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-ink-3 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Kings Legend</p>
          <p className="max-w-3xl md:text-right">{t("common.notAffiliated")}</p>
        </div>
      </div>
    </footer>
  );
}
