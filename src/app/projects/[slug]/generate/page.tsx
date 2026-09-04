import { notFound } from "next/navigation";
import { generateAll } from "@/lib/adapters";
import { effectiveDraftArtifacts, effectiveLiveArtifacts, packOrigins } from "@/lib/catalog";
import { isGlobalProject, TARGETS, TARGET_LABELS } from "@/lib/config";
import { requireUser } from "@/lib/auth";
import { applyPackAction } from "@/lib/actions/apply";
import { generateAction } from "@/lib/actions/generate";
import { Badge, Panel, buttonClass } from "@/components/ui";
import { WorkspaceField } from "@/components/workspace-field";
import { prisma } from "@/lib/prisma";

export default async function GeneratePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug },
    include: { memberships: { where: { userId: user.id } } },
  });
  if (!project) {
    notFound();
  }
  const draft = await effectiveDraftArtifacts(project.id);
  const live = await effectiveLiveArtifacts(project.id);
  const draftFiles = generateAll(draft, [...TARGETS]);
  const liveFiles = live.length ? generateAll(live, [...TARGETS]) : [];
  const generate = generateAction.bind(null, slug);
  const apply = applyPackAction.bind(null, slug);
  const membership = project.memberships[0];
  const preview = liveFiles.length ? live : draft;
  const origins = packOrigins(preview);
  const global = isGlobalProject(project);

  return (
    <div className="grid gap-6 px-6 py-6 lg:px-10">
      {membership && !membership.writeConsentAt && !global ? (
        <Panel title="Allow writes on pull and push">
          <form action={apply} className="grid gap-4">
            <p className="text-sm text-muted">
              Bind this pack to the Cursor folder you actually work in. Other sessions keep their
              own project (or none).
            </p>
            <WorkspaceField
              projectSlug={slug}
              defaultValue={membership.workspaceMatchers}
            />
            <label className="flex items-start gap-3 text-sm">
              <input className="mt-1" name="writeConsent" required type="checkbox" />
              I allow RuleDeck to write those files in my repo.
            </label>
            <button className={buttonClass} disabled={!project.liveReleaseId} type="submit">
              Grant write access
            </button>
          </form>
        </Panel>
      ) : null}
      <Panel title="Write files">
        <form action={generate} className="grid gap-4">
          <p className="text-sm text-muted">
            {global
              ? "Publishing here updates the org-wide files included in every project pack."
              : "Writes Cursor, Claude Code, and Copilot files: live global pack plus this project’s extras. Same slug in this project overrides global."}
          </p>
          <fieldset className="flex flex-wrap gap-4 text-sm">
            {TARGETS.map((target) => (
              <label key={target} className="flex items-center gap-2">
                <input defaultChecked name={`target-${target}`} type="checkbox" />
                {TARGET_LABELS[target]}
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input defaultChecked={Boolean(project.liveReleaseId)} name="source" type="checkbox" value="live" />
            Use live release (developers should)
          </label>
          <button className={buttonClass} type="submit">
            Generate now
          </button>
        </form>
      </Panel>
      <Panel
        title="Preview"
        action={
          <Badge>
            {origins.global} global · {origins.project} project ·{" "}
            {liveFiles.length ? `${liveFiles.length} live files` : `${draftFiles.length} draft files`}
          </Badge>
        }
      >
        <div className="grid gap-4">
          {(liveFiles.length ? liveFiles : draftFiles).map((file) => (
            <details key={file.path} className="rounded-lg border border-line bg-ink">
              <summary className="cursor-pointer px-4 py-2 font-mono text-xs">{file.path}</summary>
              <pre className="overflow-auto border-t border-line p-4 text-xs leading-6 text-muted">
                {file.content}
              </pre>
            </details>
          ))}
        </div>
      </Panel>
    </div>
  );
}
