import type { Artifact, ArtifactVersion, ProjectKind } from "@prisma/client";
import { prisma } from "./prisma";
import type { CanonicalArtifact, ArtifactOrigin } from "./adapters";
import { GLOBAL_PROJECT_SLUG, isGlobalProject } from "./config";

type ArtifactWithVersions = Artifact & {
  versions: ArtifactVersion[];
  project?: { kind: ProjectKind };
};

export function artifactKey(artifact: Pick<CanonicalArtifact, "type" | "slug">): string {
  return `${artifact.type}:${artifact.slug}`;
}

export function toCanonical(
  artifact: Artifact & { project?: { kind: ProjectKind } },
  version: ArtifactVersion,
): CanonicalArtifact {
  const origin: ArtifactOrigin = artifact.project?.kind === "GLOBAL" ? "global" : "project";
  return {
    type: artifact.type,
    slug: artifact.slug,
    title: artifact.title,
    description: artifact.description,
    targets: artifact.targets,
    globs: artifact.globs,
    alwaysApply: artifact.alwaysApply,
    content: version.content,
    origin,
  };
}

export function mergeArtifacts(
  inherited: CanonicalArtifact[],
  overlay: CanonicalArtifact[],
): CanonicalArtifact[] {
  const map = new Map<string, CanonicalArtifact>();
  for (const artifact of inherited) {
    map.set(artifactKey(artifact), { ...artifact, origin: "global" });
  }
  for (const artifact of overlay) {
    map.set(artifactKey(artifact), artifact);
  }
  return [...map.values()].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type.localeCompare(right.type);
    }
    return left.slug.localeCompare(right.slug);
  });
}

export function packOrigins(artifacts: CanonicalArtifact[]): { global: number; project: number } {
  return {
    global: artifacts.filter((item) => item.origin === "global").length,
    project: artifacts.filter((item) => item.origin === "project").length,
  };
}

export async function getGlobalProject() {
  return prisma.project.findFirst({
    where: { OR: [{ kind: "GLOBAL" }, { slug: GLOBAL_PROJECT_SLUG }] },
  });
}

export async function latestArtifacts(projectId: string): Promise<CanonicalArtifact[]> {
  const artifacts = await prisma.artifact.findMany({
    where: { projectId },
    include: {
      project: { select: { kind: true } },
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
    orderBy: [{ type: "asc" }, { slug: "asc" }],
  });
  return (artifacts as ArtifactWithVersions[])
    .filter((artifact) => artifact.versions[0])
    .map((artifact) => toCanonical(artifact, artifact.versions[0]));
}

export async function releaseArtifacts(releaseId: string): Promise<CanonicalArtifact[]> {
  const items = await prisma.releaseItem.findMany({
    where: { releaseId },
    include: {
      artifact: { include: { project: { select: { kind: true } } } },
      version: true,
    },
  });
  return items.map((item) => toCanonical(item.artifact, item.version));
}

export async function effectiveLiveArtifacts(projectId: string): Promise<CanonicalArtifact[]> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const own = project.liveReleaseId ? await releaseArtifacts(project.liveReleaseId) : [];
  if (isGlobalProject(project)) {
    return own.map((artifact) => ({ ...artifact, origin: "global" as const }));
  }
  const global = await getGlobalProject();
  const inherited = global?.liveReleaseId ? await releaseArtifacts(global.liveReleaseId) : [];
  return mergeArtifacts(inherited, own);
}

export async function effectiveDraftArtifacts(projectId: string): Promise<CanonicalArtifact[]> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const own = await latestArtifacts(project.id);
  if (isGlobalProject(project)) {
    return own.map((artifact) => ({ ...artifact, origin: "global" as const }));
  }
  const global = await getGlobalProject();
  const inherited = global?.liveReleaseId
    ? await releaseArtifacts(global.liveReleaseId)
    : global
      ? await latestArtifacts(global.id)
      : [];
  return mergeArtifacts(inherited, own);
}
