import { Inbox } from "lucide-react";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InvitationList } from "@/features/teams/components/invitation-list";
import { myInvitations } from "@/features/teams/queries";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Invitaciones" };

export default async function InvitationsPage() {
  const user = await requireUser("/dashboard/invitaciones");
  const invitations = await myInvitations(user.id);
  return (
    <>
      <DashboardTitle title="Invitaciones" description={`Los capitanes te encuentran por tu identificador: @${user.handle}`} />
      {invitations.length > 0 ? (
        <Card className="overflow-hidden">
          <InvitationList items={invitations} />
        </Card>
      ) : (
        <EmptyState icon={Inbox} title="Sin invitaciones pendientes">
          Cuando un capitán te invite a su equipo, podrás aceptarlo o rechazarlo aquí. Las invitaciones caducan a los 14 días.
        </EmptyState>
      )}
    </>
  );
}
