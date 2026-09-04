import { notFound } from "next/navigation";
import { DiffView } from "@/components/diff-view";
import { Badge, Panel, buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import { restoreVersionAction, saveArtifactAction } from "@/lib/actions/artifacts";
import { TARGETS, TARGET_LABELS } from "@/lib/config";
import { isManager, requireUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function ArtifactPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ compare?: string }>;
}) {
  const user = await requireUser();
  const { slug, id } = await params;
  const { compare } = await searchParams;
  const artifact = await prisma.artifact.findUnique({
    where: { id },
    include: {
      project: true,
      versions: { orderBy: { version: "desc" }, include: { author: true } },
    },
  });
  if (!artifact || artifact.project.slug !== slug) {
    notFound();
  }
  const current = artifact.versions[0];
  const compared =
    artifact.versions.find((version) => version.id === compare) ?? artifact.versions[1];
  const save = saveArtifactAction.bind(null, slug, artifact.id);
  const manager = isManager(user);

  return (
    <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-10">
      <Panel title={artifact.title}>
        <form action={save} className="grid gap-4">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Title</span>
            <input className={inputClass} name="title" defaultValue={artifact.title} required readOnly={!manager} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Slug</span>
            <input className={inputClass} name="slug" defaultValue={artifact.slug} required readOnly={!manager} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Description</span>
            <input className={inputClass} name="description" defaultValue={artifact.description} readOnly={!manager} />
          </label>
          <fieldset className="grid gap-2 text-sm">
            <legend className="text-muted">Targets</legend>
            <div className="flex flex-wrap gap-4">
              {TARGETS.map((target) => (
                <label key={target} className="flex items-center gap-2">
                  <input
                    defaultChecked={artifact.targets.includes(target)}
                    disabled={!manager}
                    name={`target-${target}`}
                    type="checkbox"
                  />
                  {TARGET_LABELS[target]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Globs</span>
            <input
              className={inputClass}
              name="globs"
              defaultValue={artifact.globs.join(", ")}
              readOnly={!manager}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              defaultChecked={artifact.alwaysApply}
              disabled={!manager}
              name="alwaysApply"
              type="checkbox"
            />
            Always apply
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Content</span>
            <textarea
              className={`${inputClass} min-h-64 font-mono text-xs`}
              name="content"
              required
              defaultValue={current?.content ?? ""}
              readOnly={!manager}
            />
          </label>
          {manager ? (
            <>
              <label className="grid gap-1.5 text-sm">
                <span className="text-muted">Version message</span>
                <input className={inputClass} name="message" placeholder="Why this change" />
              </label>
              <button className={buttonClass} type="submit">
                Save new version
              </button>
            </>
          ) : (
            <p className="text-sm text-muted">View only. Ask a manager to change policy.</p>
          )}
        </form>
      </Panel>
      <div className="grid gap-6">
        <Panel title="History">
          <ol className="grid gap-3 text-sm">
            {artifact.versions.map((version) => {
              const restore = restoreVersionAction.bind(null, slug, artifact.id, version.id);
              return (
                <li key={version.id} className="rounded-lg border border-line bg-ink px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>v{version.version}</span>
                    <Badge>{formatWhen(version.createdAt)}</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    {version.author.name} · {version.message}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <a className="text-xs text-accent hover:underline" href={`?compare=${version.id}`}>
                      Diff
                    </a>
                    {manager && version.id !== current?.id ? (
                      <form action={restore}>
                        <button className="text-xs text-accent hover:underline" type="submit">
                          Restore
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
        {current && compared ? (
          <Panel
            title={`Diff v${compared.version} → v${current.version}`}
            action={
              <a className={ghostButtonClass} href="?">
                Latest
              </a>
            }
          >
            <DiffView before={compared.content} after={current.content} />
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
