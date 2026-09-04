import { notFound, redirect } from "next/navigation";
import { Panel, buttonClass, inputClass } from "@/components/ui";
import { createArtifactAction } from "@/lib/actions/artifacts";
import { ARTIFACT_TYPES, TARGETS, TARGET_LABELS } from "@/lib/config";
import { isManager, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ArtifactType } from "@prisma/client";

const STARTERS: Record<ArtifactType, string> = {
  RULE: "Follow existing module patterns. Prefer small, reviewable changes. Never skip tests for behavior you touch.",
  PROMPT: "Review this diff for regressions, missing tests, and unclear naming. List findings by severity.",
  PROCEDURE: "1. Confirm the live RuleDeck release.\n2. Generate Cursor + Claude Code + Copilot files.\n3. Open a PR with the generated files.",
  TOOL: JSON.stringify(
    {
      github: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
      },
    },
    null,
    2,
  ),
};

export default async function NewArtifactPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; slug?: string }>;
}) {
  const user = await requireUser();
  if (!isManager(user)) {
    redirect("/");
  }
  const { slug } = await params;
  const { type, slug: artifactSlug } = await searchParams;
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) {
    notFound();
  }
  const artifactType = ARTIFACT_TYPES.includes(type as ArtifactType)
    ? (type as ArtifactType)
    : "RULE";
  const save = createArtifactAction.bind(null, slug);

  return (
    <div className="px-6 py-6 lg:px-10">
      <Panel title={`New ${artifactType.toLowerCase()}`}>
        <form action={save} className="grid gap-4">
          <input type="hidden" name="type" value={artifactType} />
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Title</span>
            <input className={inputClass} name="title" required />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Slug</span>
            <input className={inputClass} name="slug" required placeholder="coding-standards" defaultValue={artifactSlug ?? ""} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Description</span>
            <input className={inputClass} name="description" />
          </label>
          <fieldset className="grid gap-2 text-sm">
            <legend className="text-muted">Targets</legend>
            <div className="flex flex-wrap gap-4">
              {TARGETS.map((target) => (
                <label key={target} className="flex items-center gap-2">
                  <input defaultChecked name={`target-${target}`} type="checkbox" />
                  {TARGET_LABELS[target]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Globs</span>
            <input className={inputClass} name="globs" placeholder="**/*.ts, **/*.tsx" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="alwaysApply" type="checkbox" defaultChecked={artifactType === "RULE"} />
            Always apply
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Content</span>
            <textarea
              className={`${inputClass} min-h-56 font-mono text-xs`}
              name="content"
              required
              defaultValue={STARTERS[artifactType]}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Version message</span>
            <input className={inputClass} name="message" defaultValue="Initial version" />
          </label>
          <button className={buttonClass} type="submit">
            Save artifact
          </button>
        </form>
      </Panel>
    </div>
  );
}
