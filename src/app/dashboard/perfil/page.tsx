import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ProfileForm } from "@/features/profiles/components/profile-form";
import { getOwnProfile } from "@/features/profiles/queries";
import { formatRiotId } from "@/lib/lol";
import { requireUser } from "@/server/auth/session";
import { isMailConfigured } from "@/server/mail";

export const metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const user = await requireUser("/dashboard/perfil");
  const profile = await getOwnProfile(user.id);
  if (!profile) notFound();
  return (
    <>
      <DashboardTitle
        title="Perfil"
        description="Lo que ven los demás jugadores y la organización."
        actions={
          <ButtonLink href={`/jugadores/${profile.handle}`} variant="outline">
            <ExternalLink aria-hidden className="size-4" /> Ver mi perfil público
          </ButtonLink>
        }
      />
      <Card>
        <CardBody className="py-6">
          <ProfileForm
            mailConfigured={isMailConfigured()}
            profile={{
              displayName: profile.displayName,
              handle: profile.handle,
              riotId: formatRiotId(profile.riotGameName, profile.riotTagLine),
              region: profile.region,
              mainPosition: profile.mainPosition,
              bio: profile.bio,
              isPublic: profile.isPublic,
              notifyByEmail: profile.notifyByEmail,
              avatarMediaId: profile.avatarMediaId,
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}
