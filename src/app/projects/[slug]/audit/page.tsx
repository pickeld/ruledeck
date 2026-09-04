import { notFound } from "next/navigation";
import { Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function ProjectAuditPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireUser();
  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      auditEvents: {
        orderBy: { createdAt: "desc" },
        take: 80,
        include: { actor: true },
      },
    },
  });
  if (!project) {
    notFound();
  }
  return (
    <div className="px-6 py-6 lg:px-10">
      <Panel title="Project audit">
        <ol className="grid gap-3 text-sm">
          {project.auditEvents.map((event) => (
            <li key={event.id} className="grid gap-1 border-b border-line pb-3 sm:grid-cols-[180px_1fr]">
              <div className="text-xs text-muted">{formatWhen(event.createdAt)}</div>
              <div>
                <div>
                  {event.action} · {event.actor?.name ?? "system"}
                </div>
                <div className="text-xs text-muted">
                  {event.entityType}
                  {event.entityId ? ` ${event.entityId.slice(0, 8)}` : ""}
                </div>
              </div>
            </li>
          ))}
          {project.auditEvents.length === 0 ? <li className="text-muted">No audit events.</li> : null}
        </ol>
      </Panel>
    </div>
  );
}
