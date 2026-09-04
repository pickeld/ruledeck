import { notFound, redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding-shell";
import { buttonClass } from "@/components/ui";
import { savePlatformsAction } from "@/lib/actions/apply";
import { requireUser } from "@/lib/auth";
import { PLATFORMS } from "@/lib/platforms";
import { prisma } from "@/lib/prisma";

export default async function PlatformsPage({
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
    include: { memberships: { where: { userId: user.id } } },
  });
  if (!project || project.memberships.length === 0) {
    notFound();
  }
  const membership = project.memberships[0];
  const save = savePlatformsAction.bind(null, slug);

  return (
    <OnboardingShell step={1} title="Which vibe-coding tools do you use?">
      <form action={save} className="grid gap-4">
        <p className="text-sm text-muted">
          RuleDeck will apply the manager pack to the tools it supports today, and track the rest so the
          squad stays aligned.
        </p>
        <div className="grid gap-2">
          {PLATFORMS.map((platform) => (
            <label
              key={platform.id}
              className="flex items-start gap-3 rounded-lg border border-line bg-ink px-3 py-3 text-sm"
            >
              <input
                className="mt-1"
                name={`platform-${platform.id}`}
                type="checkbox"
                defaultChecked={
                  membership.platforms.length
                    ? membership.platforms.includes(platform.id)
                    : platform.generates
                }
              />
              <span>
                <span className="block font-medium">{platform.label}</span>
                <span className="text-xs text-muted">{platform.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <button className={buttonClass} type="submit">
          Continue
        </button>
      </form>
    </OnboardingShell>
  );
}
