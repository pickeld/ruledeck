import Link from "next/link";
import { PageHeader, Shell } from "@/components/shell";
import { Badge, Panel, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function DeckPage() {
  const user = await requireUser();
  const [projects, events, memberships] = await Promise.all([
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        liveRelease: true,
        artifacts: { select: { id: true } },
        generateRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: true, project: true },
    }),
    prisma.membership.findMany({
      where: { userId: user.id, project: { kind: "PROJECT" } },
      include: { project: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const ordered = [...projects].sort((left, right) => {
    if (left.kind === right.kind) {
      return 0;
    }
    return left.kind === "GLOBAL" ? -1 : 1;
  });

  return (
    <Shell user={user}>
      <PageHeader
        eyebrow="Deck"
        title="What the team is following"
        subtitle="Managers edit global vs project packs. Developers link each Cursor window to one project."
        actions={
          user.role === "MANAGER" ? (
            <Link className={buttonClass} href="/projects/new">
              New project
            </Link>
          ) : null
        }
      />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.4fr_0.8fr] lg:px-10">
        {memberships.length ? (
          <Panel
            title="Your Cursor workspaces"
            action={
              <Link className="text-xs text-accent hover:underline" href="/workspaces">
                Manage
              </Link>
            }
          >
            <div className="grid gap-3 text-sm">
              {memberships.map((membership) => (
                <div key={membership.id} className="rounded-lg border border-line bg-ink px-4 py-3">
                  <div className="font-medium">{membership.project.name}</div>
                  <div className="text-xs text-muted">
                    Linked:{" "}
                    {(membership.workspaceMatchers.length
                      ? membership.workspaceMatchers
                      : [membership.project.slug]
                    ).join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
        <Panel title="Projects">
          {projects.length === 0 ? (
            <p className="text-sm text-muted">No projects yet. Create one to start the catalog.</p>
          ) : (
            <div className="grid gap-3">
              {ordered.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.slug}`}
                  className="rounded-lg border border-line bg-ink px-4 py-3 hover:border-accent/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-xs text-muted">{project.slug}</div>
                    </div>
                    <div className="flex gap-2">
                      {project.kind === "GLOBAL" ? <Badge>global</Badge> : null}
                      <Badge>{project.liveRelease?.label ?? "unpublished"}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted">
                    <span>{project.artifacts.length} artifacts</span>
                    <span>
                      Last generate{" "}
                      {project.generateRuns[0]
                        ? formatWhen(project.generateRuns[0].createdAt)
                        : "never"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Recent audit">
          <ol className="grid gap-3 text-sm">
            {events.map((event) => (
              <li key={event.id} className="border-b border-line pb-3 last:border-0">
                <div className="text-foreground">{event.action}</div>
                <div className="text-xs text-muted">
                  {event.actor?.name ?? "system"}
                  {event.project ? ` · ${event.project.slug}` : ""} · {formatWhen(event.createdAt)}
                </div>
              </li>
            ))}
            {events.length === 0 ? <li className="text-muted">No events yet.</li> : null}
          </ol>
        </Panel>
      </div>
    </Shell>
  );
}
