import { notFound, redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding-shell";
import { buttonClass } from "@/components/ui";
import { applyPackAction } from "@/lib/actions/apply";
import { requireUser } from "@/lib/auth";
import { WorkspaceField } from "@/components/workspace-field";
import { platformLabel } from "@/lib/platforms";
import { prisma } from "@/lib/prisma";

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  const { project: slug } = await searchParams;
  if (!slug) {
    redirect("/");
  }
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      liveRelease: true,
      memberships: { where: { userId: user.id } },
    },
  });
  if (!project || !project.memberships[0]) {
    notFound();
  }
  const apply = applyPackAction.bind(null, slug);
  const platforms = project.memberships[0].platforms;

  return (
    <OnboardingShell step={2} title="Apply the live pack">
      <div className="grid gap-4 text-sm">
        <p className="text-muted">
          This binds <strong>one Cursor workspace</strong> (the folder you open) to this RuleDeck
          project. Git pull/push in that repo writes global + project files. Other folders are
          skipped.
        </p>
        <p>
          Live release: <span className="text-foreground">{project.liveRelease?.label ?? "none"}</span>
        </p>
        <p>
          Your tools: {platforms.length ? platforms.map(platformLabel).join(", ") : "none selected"}
        </p>
        <form action={apply} className="grid gap-4">
          <WorkspaceField projectSlug={slug} defaultValue={project.memberships[0].workspaceMatchers} />
          <label className="flex items-start gap-3 rounded-lg border border-line bg-ink px-4 py-3">
            <input className="mt-1" name="writeConsent" required type="checkbox" />
            <span>
              Allow RuleDeck to write policy files in <strong>that workspace only</strong> on git
              pull/sync and git push.
            </span>
          </label>
          <button className={buttonClass} type="submit" disabled={!project.liveReleaseId}>
            Grant write access and apply
          </button>
        </form>
      </div>
    </OnboardingShell>
  );
}
