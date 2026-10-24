import { label } from "@/i18n";
import type { TournamentPhase } from "@/domain/tournament/phase";
import { Badge, type BadgeTone } from "./badge";

const PHASE_TONES: Record<TournamentPhase, BadgeTone> = {
  draft: "warning",
  registration_upcoming: "upcoming",
  registration_open: "open",
  registration_closed: "neutral",
  in_progress: "live",
  completed: "finished",
  cancelled: "danger",
};

export function PhaseBadge({ phase, className }: { phase: TournamentPhase; className?: string }) {
  return (
    <Badge tone={PHASE_TONES[phase]} dot={phase === "in_progress"} className={className}>
      {label("tournamentPhase", phase)}
    </Badge>
  );
}

type MatchStatus = "pending" | "scheduled" | "in_progress" | "awaiting_validation" | "disputed" | "confirmed" | "void";

const MATCH_TONES: Record<MatchStatus, BadgeTone> = {
  pending: "neutral",
  scheduled: "upcoming",
  in_progress: "live",
  awaiting_validation: "warning",
  disputed: "danger",
  confirmed: "finished",
  void: "neutral",
};

export function MatchStatusBadge({ status, className }: { status: MatchStatus; className?: string }) {
  return (
    <Badge tone={MATCH_TONES[status]} dot={status === "in_progress"} className={className}>
      {label("matchStatus", status)}
    </Badge>
  );
}

const REGISTRATION_TONES = {
  pending: "warning",
  approved: "open",
  rejected: "danger",
  waitlisted: "upcoming",
  withdrawn: "neutral",
} as const satisfies Record<string, BadgeTone>;

export function RegistrationBadge({ status }: { status: keyof typeof REGISTRATION_TONES }) {
  return <Badge tone={REGISTRATION_TONES[status]}>{label("registrationStatus", status)}</Badge>;
}

export function DemoBadge() {
  return (
    <Badge tone="warning" className="normal-case tracking-normal">
      Demo
    </Badge>
  );
}
