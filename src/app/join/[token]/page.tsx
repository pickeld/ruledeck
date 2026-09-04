import { notFound } from "next/navigation";
import { JoinForm } from "@/components/join-form";
import { OnboardingShell } from "@/components/onboarding-shell";
import { buttonClass } from "@/components/ui";
import { acceptInviteExistingAction } from "@/lib/actions/onboarding";
import { getSessionUser } from "@/lib/auth";
import { sha256Hex } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { project: true, createdBy: true },
  });
  // eslint-disable-next-line react-hooks/purity -- invite expiry is evaluated per request
  if (!invite || invite.revokedAt || invite.expiresAt.getTime() < Date.now() || invite.usedCount >= invite.maxUses) {
    notFound();
  }
  const user = await getSessionUser();
  const accept = acceptInviteExistingAction.bind(null, token);

  return (
    <OnboardingShell step={0} title={`Join ${invite.project.name}`}>
      <p className="mb-6 text-sm text-muted">
        {invite.createdBy.name} invited you to follow this squad’s vibe-coding pack.
      </p>
      {user ? (
        <form action={accept}>
          <button className={buttonClass} type="submit">
            Continue as {user.name}
          </button>
        </form>
      ) : (
        <JoinForm token={token} projectName={invite.project.name} />
      )}
    </OnboardingShell>
  );
}
