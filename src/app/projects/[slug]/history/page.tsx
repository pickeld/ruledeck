import { notFound } from "next/navigation";
import { DiffView } from "@/components/diff-view";
import { Badge, Panel, buttonClass, inputClass } from "@/components/ui";
import { publishReleaseAction } from "@/lib/actions/releases";
import { isManager, requireUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function HistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      liveRelease: true,
      releases: {
        orderBy: { publishedAt: "desc" },
        include: { publishedBy: true, items: true },
      },
      artifacts: {
        include: { versions: { orderBy: { version: "desc" }, take: 2, include: { author: true } } },
      },
    },
  });
  if (!project) {
    notFound();
  }
  const publish = publishReleaseAction.bind(null, slug);
  const nextLabel = `v${project.releases.length + 1}`;

  return (
    <div className="grid gap-6 px-6 py-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
      <Panel title="Publish live pack">
        {isManager(user) ? (
          <form action={publish} className="grid gap-4">
            <p className="text-sm text-muted">
              {project.kind === "GLOBAL"
                ? "Snapshots the org-wide pack. Every project inherits this live release; a project can override the same slug."
                : "Snapshots this project’s artifacts. Developers also receive the live global pack."}
            </p>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted">Label</span>
              <input className={inputClass} name="label" defaultValue={nextLabel} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted">Changelog</span>
              <textarea className={`${inputClass} min-h-24`} name="changelog" />
            </label>
            <button className={buttonClass} type="submit">
              Publish {nextLabel}
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">Only managers can publish. Current live: {project.liveRelease?.label ?? "none"}.</p>
        )}
        <ol className="mt-6 grid gap-3 text-sm">
          {project.releases.map((release) => (
            <li key={release.id} className="rounded-lg border border-line bg-ink px-3 py-2">
              <div className="flex items-center justify-between">
                <span>{release.label}</span>
                {project.liveReleaseId === release.id ? <Badge>live</Badge> : null}
              </div>
              <p className="text-xs text-muted">
                {release.publishedBy.name} · {formatWhen(release.publishedAt)} · {release.items.length} artifacts
              </p>
              {release.changelog ? <p className="mt-1 text-xs">{release.changelog}</p> : null}
            </li>
          ))}
        </ol>
      </Panel>
      <Panel title="Recent version diffs">
        <div className="grid gap-8">
          {project.artifacts.map((artifact) => {
            const latest = artifact.versions[0];
            const previous = artifact.versions[1];
            if (!latest) {
              return null;
            }
            return (
              <div key={artifact.id}>
                <h3 className="mb-2 text-sm font-medium">
                  {artifact.title}{" "}
                  <span className="text-muted">
                    v{previous?.version ?? 0} → v{latest.version}
                  </span>
                </h3>
                <DiffView before={previous?.content ?? ""} after={latest.content} />
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
