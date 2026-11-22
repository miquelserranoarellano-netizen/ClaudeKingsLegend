import { CalendarDays, Crown, Gamepad2, Globe2, Megaphone, Swords, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/section";
import { mediaUrl, TeamLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DemoBadge, PhaseBadge } from "@/components/ui/status-badge";
import { listPublishedAnnouncements } from "@/features/announcements/service";
import { Bracket } from "@/features/tournaments/components/bracket";
import { RegistrationPanel } from "@/features/tournaments/components/registration-panel";
import { Schedule } from "@/features/tournaments/components/schedule";
import { StandingsTable } from "@/features/tournaments/components/standings-table";
import { SwissView } from "@/features/tournaments/components/swiss-view";
import { TournamentBanner } from "@/features/tournaments/components/tournament-banner";
import { getChampion, getCompetition, getLeagueStandings, getParticipants, getSwissStandings, getTournamentDetail } from "@/features/tournaments/queries";
import { label } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { getCurrentUser } from "@/server/auth/session";

type Params = { slug: string };
type Search = { vista?: string; codigo?: string };

const TABS = ["resumen", "participantes", "partidos", "cuadro", "reglas"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const [{ slug }, { codigo }] = await Promise.all([params, searchParams]);
  const viewer = await getCurrentUser();
  const detail = await getTournamentDetail(slug, viewer, codigo ?? null);
  if (!detail) return { title: "Torneo no encontrado", robots: { index: false } };
  const t = detail.tournament;
  const description = t.summary ?? `${label("format", t.format)} de League of Legends. ${label("tournamentPhase", detail.phase)}. Empieza el ${formatDate(t.startsAt)}.`;
  return {
    title: t.name,
    description,
    alternates: { canonical: `/torneos/${t.slug}` },
    robots: t.visibility === "private" || t.isDemo ? { index: false, follow: false } : undefined,
    openGraph: {
      title: t.name,
      description,
      url: `/torneos/${t.slug}`,
      images: t.bannerMediaId ? [{ url: mediaUrl(t.bannerMediaId) }] : undefined,
    },
  };
}

export default async function TournamentPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const accessCode = search.codigo ?? null;
  const viewer = await getCurrentUser();
  const detail = await getTournamentDetail(slug, viewer, accessCode);
  if (!detail) notFound();
  const { tournament: t, rules, phase } = detail;
  const started = t.status === "in_progress" || t.status === "completed";
  const competitionTab = t.format === "league" ? "Clasificación" : "Cuadro";
  const tab: Tab = (TABS as readonly string[]).includes(search.vista ?? "") ? (search.vista as Tab) : "resumen";

  const [participants, rounds, champion, announcements, standings, swissTable] = await Promise.all([
    getParticipants(t.id),
    started ? getCompetition(t.id, t.format) : Promise.resolve([]),
    getChampion(t),
    listPublishedAnnouncements({ tournamentId: t.id, pageSize: 5 }),
    started && t.format === "league" ? getLeagueStandings(t.id) : Promise.resolve([]),
    started && t.format === "swiss" ? getSwissStandings(t.id) : Promise.resolve([]),
  ]);
  const tabHref = (value: Tab) => {
    const q = new URLSearchParams();
    if (value !== "resumen") q.set("vista", value);
    if (accessCode) q.set("codigo", accessCode);
    const s = q.toString();
    return `/torneos/${t.slug}${s ? `?${s}` : ""}`;
  };

  const facts = [
    { icon: CalendarDays, label: "Inicio", value: formatDateTime(t.startsAt) },
    { icon: Users, label: "Plazas", value: `${detail.counts.approved}/${t.maxParticipants} (mín. ${t.minParticipants})` },
    { icon: Gamepad2, label: "Formato", value: `${label("format", t.format)} · Bo${rules.bestOf}${rules.bestOfFinal !== rules.bestOf ? ` (final Bo${rules.bestOfFinal})` : ""}` },
    { icon: Swords, label: "Modalidad", value: t.participantType === "team" ? `Equipos de ${rules.teamSize}${rules.maxSubstitutes ? ` + ${rules.maxSubstitutes} supl.` : ""}` : "Individual" },
    ...(t.region ? [{ icon: Globe2, label: "Servidor", value: t.region }] : []),
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-night text-white">
        <div className="absolute inset-0 opacity-90">
          <TournamentBanner seed={t.slug} mediaId={t.bannerMediaId} priority />
        </div>
        <div className="absolute inset-0 bg-linear-to-t from-night via-night/70 to-night/20" aria-hidden />
        <Container className="relative pt-24 pb-8 sm:pt-32">
          <div className="flex flex-wrap items-center gap-2">
            <PhaseBadge phase={phase} />
            {t.isDemo && <DemoBadge />}
            {t.visibility === "private" && <Badge tone="night">Privado</Badge>}
            <span className="text-sm text-white/75">
              {label("format", t.format)} · {label("participantType", t.participantType)}
            </span>
          </div>
          <h1 className="display mt-3 max-w-4xl text-4xl uppercase drop-shadow-[0_4px_24px_rgb(0_0_0/0.7)] sm:text-6xl">{t.name}</h1>
          <span aria-hidden className="ornament mt-4" />
          {t.summary && <p className="mt-3 max-w-2xl text-white/80">{t.summary}</p>}
          <p className="mt-4 text-sm text-white/70">
            Organiza{" "}
            {detail.organizer.handle ? (
              <Link href={`/jugadores/${detail.organizer.handle}`} className="font-semibold text-brand-strong underline-offset-4 hover:underline">
                {detail.organizer.name}
              </Link>
            ) : (
              detail.organizer.name
            )}
          </p>
        </Container>
        <div aria-hidden className="gold-rule relative" />
      </section>

      <div className="border-b border-line bg-night/80 backdrop-blur-sm">
        <Container>
          <nav aria-label="Secciones del torneo" className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map((value) => (
              <Link
                key={value}
                href={tabHref(value)}
                aria-current={tab === value ? "page" : undefined}
                className={cn(
                  "shrink-0 border-b-2 px-4 py-3.5 font-display text-[0.95rem] font-bold tracking-[0.12em] uppercase transition-colors",
                  tab === value ? "border-brand text-brand-strong" : "border-transparent text-ink-3 hover:text-ink",
                )}
              >
                {value === "resumen" ? "Resumen" : value === "participantes" ? `Participantes (${participants.length})` : value === "partidos" ? "Partidos" : value === "cuadro" ? competitionTab : "Reglas"}
              </Link>
            ))}
          </nav>
        </Container>
      </div>

      {/* El cuadro necesita todo el ancho: en esa pestaña el panel lateral pasa debajo. */}
      <Container className={cn("grid gap-8 py-8", tab !== "cuadro" && "lg:grid-cols-[minmax(0,1fr)_22rem]")}>
        <div className="min-w-0 space-y-6">
          {champion && (
            <div className="frame-gold flex items-center gap-5 rounded-card bg-[radial-gradient(30rem_12rem_at_0%_50%,rgb(232_199_122/0.18),transparent_70%)] bg-night-2 p-5">
              <span className="flex size-14 shrink-0 rotate-45 items-center justify-center border border-trophy/70 bg-night shadow-[0_0_26px_-4px_rgb(232_199_122/0.7)]">
                <Crown aria-hidden className="size-7 -rotate-45 text-trophy" />
              </span>
              <div>
                <p className="eyebrow text-trophy">Campeón</p>
                <p className="display text-gold text-3xl uppercase">
                  {champion.href ? <Link href={champion.href} className="hover:text-brand">{champion.name}</Link> : champion.name}
                </p>
              </div>
            </div>
          )}
          {t.status === "cancelled" && (
            <p className="rounded-card border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
              Torneo cancelado el {formatDate(t.cancelledAt)}.{t.cancelReason ? ` Motivo: ${t.cancelReason}` : ""}
            </p>
          )}

          {tab === "resumen" && (
            <>
              <Card>
                <CardHeader title="Información" />
                <CardBody>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    {facts.map((f) => (
                      <div key={f.label} className="flex gap-3">
                        <f.icon aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
                        <div>
                          <dt className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{f.label}</dt>
                          <dd className="font-semibold">{f.value}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                  <dl className="mt-5 grid gap-x-6 gap-y-2 border-t border-line pt-4 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-2"><dt className="text-ink-3">Apertura de inscripciones</dt><dd className="font-medium">{formatDateTime(t.registrationOpensAt)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-ink-3">Cierre de inscripciones</dt><dd className="font-medium">{formatDateTime(t.registrationClosesAt)}</dd></div>
                    {t.endsAt && <div className="flex justify-between gap-2"><dt className="text-ink-3">Fin previsto</dt><dd className="font-medium">{formatDateTime(t.endsAt)}</dd></div>}
                    <div className="flex justify-between gap-2"><dt className="text-ink-3">Inscripción</dt><dd className="font-medium">{label("approvalMode", rules.approvalMode)}{rules.waitlistEnabled ? " · lista de espera" : ""}</dd></div>
                  </dl>
                </CardBody>
              </Card>
              {t.prizeDescription && (
                <Card>
                  <CardHeader title="Premios" />
                  <CardBody className="flex gap-3">
                    <Trophy aria-hidden className="size-6 shrink-0 text-trophy" />
                    <p className="whitespace-pre-line text-ink-2">{t.prizeDescription}</p>
                  </CardBody>
                </Card>
              )}
              {t.description && (
                <Card>
                  <CardHeader title="Descripción" />
                  <CardBody>
                    <p className="whitespace-pre-line text-ink-2">{t.description}</p>
                  </CardBody>
                </Card>
              )}
              {announcements.items.length > 0 && (
                <Card className="overflow-hidden">
                  <CardHeader title="Anuncios" />
                  <ul className="divide-y divide-line">
                    {announcements.items.map((a) => (
                      <li key={a.id} className="px-5 py-4">
                        <p className="flex items-center gap-2 text-xs text-ink-3">
                          <Megaphone aria-hidden className="size-3.5" /> {formatDate(a.publishedAt)}
                        </p>
                        <p className="mt-1 font-semibold">{a.title}</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{a.body}</p>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}

          {tab === "participantes" &&
            (participants.length > 0 ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {participants.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-card">
                    <TeamLogo name={p.name} tag={p.tag} mediaId={p.logoMediaId} />
                    <div className="min-w-0 flex-1">
                      {p.href ? (
                        <Link href={p.href} className="block truncate font-semibold hover:text-brand">
                          {p.name}
                        </Link>
                      ) : (
                        <p className="truncate font-semibold">{p.name}</p>
                      )}
                      <p className="text-xs text-ink-3">{p.seed ? `Semilla ${p.seed}` : "Inscripción aprobada"}{p.status === "disqualified" ? " · descalificado" : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Users} title="Sin participantes todavía">
                {phase === "registration_open" ? "Sé el primero en inscribirte." : "Aquí aparecerán las inscripciones aprobadas."}
                {detail.counts.pending + detail.counts.waitlisted > 0 && ` Hay ${detail.counts.pending} pendientes de revisión y ${detail.counts.waitlisted} en lista de espera.`}
              </EmptyState>
            ))}

          {tab === "partidos" &&
            (rounds.length > 0 ? (
              <Schedule rounds={rounds} slug={t.slug} />
            ) : (
              <EmptyState icon={CalendarDays} title="Calendario pendiente">
                El calendario se genera cuando la organización cierra las inscripciones y arranca la competición.
              </EmptyState>
            ))}

          {tab === "cuadro" &&
            (!started ? (
              <EmptyState icon={Trophy} title={`${competitionTab} pendiente`}>
                Se genera al empezar la competición, con los participantes aprobados ({detail.counts.approved} de un mínimo de {t.minParticipants}).
              </EmptyState>
            ) : t.format === "league" ? (
              <StandingsTable
                rows={standings}
                tiebreakers={rules.tiebreakers}
                points={{ win: rules.pointsWin, draw: rules.bestOf % 2 === 0 ? rules.pointsDraw : undefined, loss: rules.pointsLoss, forfeitLoss: rules.pointsForfeitLoss }}
              />
            ) : t.format === "swiss" ? (
              <div className="space-y-10">
                <SwissView standings={swissTable} rounds={rounds} slug={t.slug} />
                <section aria-labelledby="eliminatoria" className="space-y-3">
                  <h2 id="eliminatoria" className="font-display text-xl font-bold tracking-[0.06em] uppercase">
                    Eliminatoria
                  </h2>
                  {rounds.some((r) => r.bracket === "winners") ? (
                    <Bracket rounds={rounds} slug={t.slug} />
                  ) : (
                    <p className="rounded-card border border-dashed border-line-strong bg-surface px-5 py-6 text-sm text-ink-3">
                      Se genera sola cuando termina el suizo, con los clasificados sembrados por su balance (los 3-0 primero).
                    </p>
                  )}
                </section>
              </div>
            ) : (
              <Bracket rounds={rounds} slug={t.slug} />
            ))}

          {tab === "reglas" && (
            <>
              <Card>
                <CardHeader title="Reglas de la competición" />
                <CardBody>
                  <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <li><span className="text-ink-3">Formato:</span> {label("format", t.format)}</li>
                    <li>
                      <span className="text-ink-3">Series:</span>{" "}
                      {t.format === "league"
                        ? rules.bestOf % 2 === 0
                          ? `BO${rules.bestOf}: se juegan todas las partidas y cabe el empate`
                          : `al mejor de ${rules.bestOf} en todas las jornadas`
                        : t.format === "swiss"
                          ? `suizo al mejor de ${rules.bestOf} (decisivos al mejor de ${rules.swissDeciderBestOf}); eliminatoria al mejor de ${rules.playoffBestOf} y final al mejor de ${rules.bestOfFinal}`
                          : `al mejor de ${rules.bestOf}; final al mejor de ${rules.bestOfFinal}`}
                    </li>
                    {t.participantType === "team" && (
                      <li><span className="text-ink-3">Plantilla:</span> {rules.teamSize} titulares y hasta {rules.maxSubstitutes} suplentes</li>
                    )}
                    <li><span className="text-ink-3">Riot ID obligatorio:</span> {rules.requireRiotId ? "sí" : "no"}</li>
                    <li><span className="text-ink-3">Plazas:</span> de {t.minParticipants} a {t.maxParticipants}</li>
                    <li><span className="text-ink-3">Inscripción:</span> {label("approvalMode", rules.approvalMode).toLowerCase()}{rules.waitlistEnabled ? ", con lista de espera" : ""}</li>
                    {t.format === "double_elimination" && (
                      <li className="sm:col-span-2">
                        <span className="text-ink-3">Gran final:</span>{" "}
                        {rules.grandFinalReset
                          ? "si gana quien llega del cuadro de perdedores, se juega una segunda serie (reinicio) porque el otro aún no había perdido."
                          : "una sola serie; quien la gana es campeón."}
                      </li>
                    )}
                    {t.format === "league" && (
                      <>
                        <li><span className="text-ink-3">Vueltas:</span> {rules.leagueLegs === 2 ? "ida y vuelta" : "solo ida"}</li>
                        <li>
                          <span className="text-ink-3">Puntos:</span> victoria {rules.pointsWin}
                          {rules.bestOf % 2 === 0 ? `, empate ${rules.pointsDraw}` : ""}, derrota {rules.pointsLoss}, incomparecencia {rules.pointsForfeitLoss}
                        </li>
                        <li><span className="text-ink-3">Calendario:</span> una jornada por semana desde el inicio</li>
                        <li className="sm:col-span-2">
                          <span className="text-ink-3">Desempates (en orden):</span>{" "}
                          {rules.tiebreakers.map((tb) => label("tiebreaker", tb as "wins")).join(" → ") || "ninguno"} → semilla. Si un criterio
                          solo deshace el empate en parte, al grupo que sigue empatado se le aplican de nuevo desde el primero.
                        </li>
                      </>
                    )}
                    {t.format === "swiss" && (
                      <li className="sm:col-span-2">
                        <span className="text-ink-3">Sistema suizo:</span> como en los Worlds. Cada ronda enfrenta a equipos con el mismo balance,
                        sin repetir rival; con 3 victorias se pasa a la eliminatoria y con 3 derrotas se queda fuera. Los clasificados se
                        siembran por balance (3-0, 3-1, 3-2) y por la fuerza de su calendario.
                      </li>
                    )}
                    {t.format !== "league" && (
                      <li className="sm:col-span-2">
                        <span className="text-ink-3">BYE:</span> si los participantes no llenan el cuadro, las mejores semillas pasan la primera ronda sin jugar.
                      </li>
                    )}
                  </ul>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Reglamento" />
                <CardBody>
                  {t.rulesText ? (
                    <p className="whitespace-pre-line text-ink-2">{t.rulesText}</p>
                  ) : (
                    <p className="text-sm text-ink-3">La organización no ha publicado un reglamento adicional.</p>
                  )}
                </CardBody>
              </Card>
            </>
          )}
        </div>

        <aside className={cn("space-y-6", tab === "cuadro" ? "max-w-md" : "lg:sticky lg:top-24 lg:self-start")}>
          <RegistrationPanel detail={detail} viewer={viewer} accessCode={accessCode} />
        </aside>
      </Container>
    </>
  );
}
