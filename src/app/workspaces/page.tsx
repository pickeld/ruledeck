import Link from "next/link";
import { PageHeader, Shell } from "@/components/shell";
import { Badge, Panel, buttonClass } from "@/components/ui";
import { WorkspaceField } from "@/components/workspace-field";
import { saveWorkspaceMatchersAction } from "@/lib/actions/workspaces";
import { COMPLIANCE_LABEL } from "@/lib/compliance";
import { requireUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { matchersFor } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";

export default async function WorkspacesPage() {
  const user = await requireUser();
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, project: { kind: "PROJECT" } },
    include: { project: { include: { liveRelease: true } }, appliedRelease: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <Shell user={user}>
      <PageHeader
        eyebrow="You"
        title="Your workspaces"
        subtitle="Each Cursor window is one folder. Link that folder (or its git remote) to a RuleDeck project. Sync on pull/push only runs there."
      />
      <div className="grid gap-6 px-6 py-6 lg:px-10">
        {memberships.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted">
              You are not on a project pack yet. Use an invite link, then grant write access.
            </p>
          </Panel>
        ) : (
          memberships.map((membership) => {
            const save = saveWorkspaceMatchersAction.bind(null, membership.project.slug);
            const matchers = matchersFor(membership.project.slug, membership.workspaceMatchers);
            return (
              <Panel
                key={membership.id}
                title={membership.project.name}
                action={<Badge>{membership.project.liveRelease?.label ?? "unpublished"}</Badge>}
              >
                <div className="grid gap-4 text-sm">
                  <p className="text-muted">
                    Status: {COMPLIANCE_LABEL[membership.compliance]}
                    {membership.lastWorkspace ? ` · last session ${membership.lastWorkspace}` : ""}
                    {membership.lastCheckInAt ? ` · ${formatWhen(membership.lastCheckInAt)}` : ""}
                  </p>
                  <form action={save} className="grid gap-3">
                    <WorkspaceField projectSlug={membership.project.slug} defaultValue={matchers} />
                    <button className={buttonClass} type="submit">
                      Save linked repos
                    </button>
                  </form>
                  <ol className="grid list-decimal gap-1 pl-5 text-xs text-muted">
                    <li>Open a Cursor window on the matching checkout.</li>
                    <li>
                      Copy the kit from{" "}
                      <code className="text-foreground">
                        output/{membership.project.slug}/members/&lt;you&gt;/.ruledeck
                      </code>{" "}
                      into that repo root.
                    </li>
                    <li>
                      Run <code className="text-foreground">node .ruledeck/sync.mjs install-hooks</code>{" "}
                      then <code className="text-foreground">node .ruledeck/sync.mjs pull</code>
                    </li>
                  </ol>
                  <Link className="text-xs text-accent hover:underline" href={`/projects/${membership.project.slug}`}>
                    Open catalog
                  </Link>
                </div>
              </Panel>
            );
          })
        )}
      </div>
    </Shell>
  );
}
