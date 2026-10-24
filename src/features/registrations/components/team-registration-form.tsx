"use client";

import { AlertTriangle } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { registerSoloAction, registerTeamAction } from "../actions";

type Role = "none" | "starter" | "sub";

export interface CaptainTeam {
  id: string;
  name: string;
  members: { userId: string; displayName: string; handle: string; hasRiotId: boolean; suspended: boolean }[];
}

export function TeamRegistrationForm({
  tournamentId,
  accessCode,
  teams,
  teamSize,
  maxSubstitutes,
  requireRiotId,
}: {
  tournamentId: string;
  accessCode: string | null;
  teams: CaptainTeam[];
  teamSize: number;
  maxSubstitutes: number;
  requireRiotId: boolean;
}) {
  const [state, formAction] = useActionState(registerTeamAction, null);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const team = teams.find((t) => t.id === teamId);
  const [roles, setRoles] = useState<Record<string, Role>>({});

  const starters = useMemo(() => Object.values(roles).filter((r) => r === "starter").length, [roles]);
  const subs = useMemo(() => Object.values(roles).filter((r) => r === "sub").length, [roles]);
  const valid = starters === teamSize && subs <= maxSubstitutes;
  const missingRiot = requireRiotId && team?.members.some((m) => roles[m.userId] && roles[m.userId] !== "none" && !m.hasRiotId);

  if (state?.ok) return <FormMessage state={state} />;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      {accessCode && <input type="hidden" name="accessCode" value={accessCode} />}
      {Object.entries(roles)
        .filter(([, role]) => role !== "none")
        .map(([userId, role]) => (
          <span key={userId}>
            <input type="hidden" name="players[]" value={userId} />
            {role === "sub" && <input type="hidden" name="subs[]" value={userId} />}
          </span>
        ))}

      {teams.length > 1 && (
        <Field label="Equipo">
          {(p) => (
            <Select
              {...p}
              name="teamId"
              value={teamId}
              onChange={(e) => {
                setTeamId(e.target.value);
                setRoles({});
              }}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      {teams.length === 1 && <input type="hidden" name="teamId" value={teamId} />}

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">
          Plantilla: {teamSize} titulares{maxSubstitutes > 0 ? ` y hasta ${maxSubstitutes} suplentes` : ""}
        </legend>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {team?.members.map((m) => {
            const role = roles[m.userId] ?? "none";
            return (
              <li key={m.userId} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.displayName}</p>
                  <p className={cn("text-xs", !m.hasRiotId && requireRiotId ? "text-warning" : "text-ink-3")}>
                    @{m.handle}
                    {!m.hasRiotId && requireRiotId ? " · sin Riot ID" : ""}
                    {m.suspended ? " · cuenta suspendida" : ""}
                  </p>
                </div>
                <div role="radiogroup" aria-label={`Papel de ${m.displayName}`} className="inline-flex overflow-hidden rounded-md border border-line-strong text-xs font-semibold">
                  {(["none", "starter", ...(maxSubstitutes > 0 ? (["sub"] as const) : [])] as Role[]).map((value) => (
                    <label
                      key={value}
                      className={cn(
                        "cursor-pointer px-2.5 py-1.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand",
                        role === value ? "bg-night text-white" : "bg-surface text-ink-2 hover:bg-surface-2",
                        m.suspended && "pointer-events-none opacity-50",
                      )}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={`role-${m.userId}`}
                        value={value}
                        checked={role === value}
                        disabled={m.suspended}
                        onChange={() => setRoles((current) => ({ ...current, [m.userId]: value }))}
                      />
                      {value === "none" ? "No juega" : value === "starter" ? "Titular" : "Suplente"}
                    </label>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <p className={cn("text-xs font-semibold tabular", valid ? "text-open" : "text-ink-3")} aria-live="polite">
          Titulares {starters}/{teamSize}
          {maxSubstitutes > 0 ? ` · Suplentes ${subs}/${maxSubstitutes}` : ""}
        </p>
        {team && team.members.length < teamSize && (
          <p className="text-xs text-warning">El equipo tiene {team.members.length} miembros y necesita al menos {teamSize}: invita a más jugadores.</p>
        )}
      </fieldset>
      {missingRiot && (
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" /> Este torneo exige Riot ID: los jugadores marcados deben añadirlo a su perfil antes.
        </p>
      )}
      <Field label="Nota para la organización" optional>
        {(p) => <Input {...p} name="note" maxLength={300} placeholder="Disponibilidad, contacto de Discord…" />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton disabled={!valid} pendingLabel="Enviando…" className="w-full">
        Inscribir al equipo
      </SubmitButton>
    </form>
  );
}

export function SoloRegistrationForm({ tournamentId, accessCode }: { tournamentId: string; accessCode: string | null }) {
  const [state, formAction] = useActionState(registerSoloAction, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      {accessCode && <input type="hidden" name="accessCode" value={accessCode} />}
      <Field label="Nota para la organización" optional>
        {(p) => <Input {...p} name="note" maxLength={300} />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Enviando…" className="w-full">
        Inscribirme
      </SubmitButton>
    </form>
  );
}
