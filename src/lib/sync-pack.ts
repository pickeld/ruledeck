import { generateAll } from "./adapters";
import { effectiveLiveArtifacts } from "./catalog";
import { hashGeneratedFiles } from "./pack-write";
import { packTargets } from "./platforms";
import type { SyncActor } from "./sync-auth";

export async function livePackFor(actor: SyncActor) {
  if (!actor.project.liveReleaseId) {
    throw new Error("This project has no live pack yet");
  }
  const artifacts = await effectiveLiveArtifacts(actor.project.id);
  const generateTargets = packTargets(actor.platforms);
  const files = generateAll(artifacts, generateTargets);
  return {
    project: actor.project.slug,
    releaseId: actor.project.liveReleaseId,
    files,
    generateTargets,
    contentHash: hashGeneratedFiles(files),
  };
}
