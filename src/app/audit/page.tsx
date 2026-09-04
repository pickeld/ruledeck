import { PageHeader, Shell } from "@/components/shell";
import { Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function GlobalAuditPage() {
  const user = await requireUser();
  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 120,
    include: { actor: true, project: true },
  });
  return (
    <Shell user={user}>
      <PageHeader
        eyebrow="Audit"
        title="Who changed policy"
        subtitle="Logins, catalog edits, publishes, and generates. Secrets are never stored here."
      />
      <div className="px-6 py-6 lg:px-10">
        <Panel>
          <ol className="grid gap-3 text-sm">
            {events.map((event) => (
              <li key={event.id} className="grid gap-1 border-b border-line pb-3 sm:grid-cols-[180px_1fr]">
                <div className="text-xs text-muted">{formatWhen(event.createdAt)}</div>
                <div>
                  <div>{event.action}</div>
                  <div className="text-xs text-muted">
                    {event.actor?.name ?? "system"}
                    {event.project ? ` · ${event.project.slug}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </Shell>
  );
}
