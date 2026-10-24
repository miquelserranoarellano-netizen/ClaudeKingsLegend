import Link from "next/link";
import { TeamLogo } from "@/components/ui/avatar";
import { ActionButton } from "@/components/ui/action-button";
import { formatDate } from "@/lib/format";
import { respondInvitationAction } from "../actions";
import type { myInvitations } from "../queries";

export function InvitationList({ items }: { items: Awaited<ReturnType<typeof myInvitations>> }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((inv) => (
        <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <TeamLogo name={inv.teamName} tag={inv.teamTag} mediaId={inv.teamLogo} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              <Link href={`/equipos/${inv.teamSlug}`} className="hover:text-brand">
                {inv.teamName}
              </Link>
            </p>
            <p className="text-xs text-ink-3">
              Te invita {inv.inviterName ?? "el capitán"} · caduca el {formatDate(inv.expiresAt)}
            </p>
            {inv.message && <p className="mt-1 text-sm text-ink-2">«{inv.message}»</p>}
          </div>
          <div className="flex gap-2">
            <ActionButton action={respondInvitationAction} fields={{ invitationId: inv.id, decision: "accept" }} size="sm">
              Aceptar
            </ActionButton>
            <ActionButton action={respondInvitationAction} fields={{ invitationId: inv.id, decision: "decline" }} size="sm" variant="outline">
              Rechazar
            </ActionButton>
          </div>
        </li>
      ))}
    </ul>
  );
}
