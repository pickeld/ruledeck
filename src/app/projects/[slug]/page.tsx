import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Panel, buttonClass, ghostButtonClass } from "@/components/ui";
import { artifactKey, getGlobalProject, latestArtifacts, releaseArtifacts } from "@/lib/catalog";
import { ARTIFACT_LABELS, ARTIFACT_TYPES, isGlobalProject, TARGET_LABELS } from "@/lib/config";
import { isManager, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ArtifactType } from "@prisma/client";

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const { type } = await searchParams;
  const active = ARTIFACT_TYPES.includes(type as (typeof ARTIFACT_TYPES)[number])
    ? (type as ArtifactType)
    : "RULE";
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      artifacts: {
        where: { type: active },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
        orderBy: { slug: "asc" },
      },
    },
  });
  if (!project) {
    notFound();
  }
  const globalProject = isGlobalProject(project) ? null : await getGlobalProject();
  const inherited = globalProject
    ? (globalProject.liveReleaseId
        ? await releaseArtifacts(globalProject.liveReleaseId)
        : await latestArtifacts(globalProject.id)
      ).filter((artifact) => artifact.type === active)
    : [];
  const localSlugs = new Set(project.artifacts.map((artifact) => artifact.slug));
  const inheritedVisible = inherited.filter((artifact) => !localSlugs.has(artifact.slug));
  const overridden = project.artifacts.filter((artifact) =>
    inherited.some((item) => item.slug === artifact.slug),
  );

  return (
    <div className="px-6 py-6 lg:px-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {ARTIFACT_TYPES.map((item) => (
            <Link
              key={item}
              href={`/projects/${slug}?type=${item}`}
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] ${
                item === active ? "border-accent text-accent" : "border-line text-muted"
              }`}
            >
              {ARTIFACT_LABELS[item]}
            </Link>
          ))}
        </div>
        {isManager(user) ? (
          <Link className={buttonClass} href={`/projects/${slug}/new?type=${active}`}>
            New {ARTIFACT_LABELS[active].slice(0, -1).toLowerCase()}
          </Link>
        ) : null}
      </div>
      {!isGlobalProject(project) && inheritedVisible.length > 0 ? (
        <Panel title="From global pack" action={<Badge>all projects</Badge>}>
          <div className="grid gap-3">
            {inheritedVisible.map((artifact) => (
              <div
                key={artifactKey(artifact)}
                className="flex items-start justify-between gap-4 rounded-lg border border-line bg-ink px-4 py-3"
              >
                <div>
                  <div className="font-medium">{artifact.title}</div>
                  <div className="text-xs text-muted">{artifact.slug} · inherited</div>
                  <p className="mt-1 text-sm text-muted">{artifact.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex flex-wrap justify-end gap-1">
                    {artifact.targets.map((target) => (
                      <Badge key={target}>
                        {TARGET_LABELS[target as keyof typeof TARGET_LABELS] ?? target}
                      </Badge>
                    ))}
                  </div>
                  {globalProject && isManager(user) ? (
                    <Link
                      className="text-xs text-accent hover:underline"
                      href={`/projects/${slug}/new?type=${artifact.type}&slug=${artifact.slug}`}
                    >
                      Override in this project
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
      <Panel
        title={isGlobalProject(project) ? "Global artifacts" : "This project"}
        action={
          overridden.length ? <Badge>{overridden.length} override{overridden.length === 1 ? "" : "s"}</Badge> : undefined
        }
      >
        {project.artifacts.length === 0 ? (
          <p className="text-sm text-muted">
            {isGlobalProject(project)
              ? "Nothing in the global pack yet."
              : "No project-specific artifacts. Global pack still applies when you generate."}
          </p>
        ) : (
          <div className="grid gap-3">
            {project.artifacts.map((artifact) => {
              const isOverride = inherited.some((item) => item.slug === artifact.slug);
              return (
                <Link
                  key={artifact.id}
                  href={`/projects/${slug}/a/${artifact.id}`}
                  className="flex items-start justify-between gap-4 rounded-lg border border-line bg-ink px-4 py-3 hover:border-accent/50"
                >
                  <div>
                    <div className="font-medium">{artifact.title}</div>
                    <div className="text-xs text-muted">
                      {artifact.slug} · v{artifact.versions[0]?.version ?? 0}
                      {isOverride ? " · overrides global" : ""}
                    </div>
                    <p className="mt-1 text-sm text-muted">{artifact.description}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {artifact.targets.map((target) => (
                      <Badge key={target}>
                        {TARGET_LABELS[target as keyof typeof TARGET_LABELS] ?? target}
                      </Badge>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>
      {isManager(user) ? (
        <p className="mt-4 text-xs text-muted">
          {isGlobalProject(project)
            ? "Every project pack includes the live global release unless it overrides the same slug."
            : "Developers pull this project’s live release plus the live global pack."}
          <Link className={`${ghostButtonClass} ml-3`} href={`/projects/${slug}/history`}>
            Publish
          </Link>
        </p>
      ) : null}
    </div>
  );
}
