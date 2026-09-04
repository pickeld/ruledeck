import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding-shell";
import { buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { memberOutputDir } from "@/lib/paths";
import { matchersFor } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";

async function readCredentials(dest: string): Promise<string | null> {
  try {
    const raw = await readFile(path.join(dest, ".ruledeck", "credentials"), "utf8");
    const parsed = JSON.parse(raw) as { token?: unknown };
    return typeof parsed.token === "string" ? parsed.token : null;
  } catch {
    return null;
  }
}

export default async function DonePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  const { project: slug } = await searchParams;
  if (!slug) {
    redirect("/");
  }
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, project: { slug } },
  });
  if (!membership) {
    notFound();
  }
  const dest = memberOutputDir(slug, user.id);
  const token = membership.writeConsentAt ? await readCredentials(dest) : null;
  const matchers = matchersFor(slug, membership.workspaceMatchers);

  return (
    <OnboardingShell step={3} title="Link this pack to a Cursor workspace">
      <div className="grid gap-4 text-sm">
        <p className="text-muted">
          A Cursor session is the folder you open. Put the kit in <strong>that</strong> project
          checkout only. Other windows (including this RuleDeck app repo) are not linked and will
          skip writes.
        </p>
        <p>
          Linked to:{" "}
          <span className="text-foreground">{matchers.join(" · ")}</span>
        </p>
        <ol className="grid list-decimal gap-2 pl-5 text-muted">
          <li>Open the matching git repo as its own Cursor window.</li>
          <li>
            Copy <code className="text-foreground">{dest}/.ruledeck</code> to that repo’s root.
          </li>
          <li>
            In that window run{" "}
            <code className="text-foreground">node .ruledeck/sync.mjs install-hooks</code>
          </li>
          <li>
            Then <code className="text-foreground">node .ruledeck/sync.mjs pull</code>
          </li>
        </ol>
        {token ? (
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.14em] text-muted">Sync token (shown once)</span>
            <input
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 font-mono text-xs"
              readOnly
              value={token}
            />
          </label>
        ) : null}
        <p className="text-xs text-muted">
          Credentials stay in gitignored <code>.ruledeck/credentials</code>. Change linked folders
          anytime from Workspaces.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link className={buttonClass} href="/workspaces">
            Your workspaces
          </Link>
          <Link className={buttonClass} href={`/projects/${slug}`}>
            Open {slug}
          </Link>
        </div>
      </div>
    </OnboardingShell>
  );
}
