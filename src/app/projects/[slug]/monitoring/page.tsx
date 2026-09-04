import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { generateAll } from "@/lib/adapters";
import { effectiveLiveArtifacts } from "@/lib/catalog";
import { TARGETS } from "@/lib/config";
import { sha256Hex } from "@/lib/crypto";
import { formatWhen } from "@/lib/format";
import { memberOutputDir } from "@/lib/paths";
import { requireUser } from "@/lib/auth";
import { Badge, Panel } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export default async function MonitoringPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireUser();
  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      liveRelease: true,
      memberships: true,
      generateRuns: {
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { actor: true, release: true },
      },
    },
  });
  if (!project) {
    notFound();
  }

  let drift = "No live release to compare";
  if (project.liveReleaseId) {
    const artifacts = await effectiveLiveArtifacts(project.id);
    const expected = generateAll(artifacts, [...TARGETS]);
    const kits = project.memberships.filter((member) => member.writeConsentAt);
    let driftedKits = 0;
    for (const member of kits) {
      const dest = memberOutputDir(project.slug, member.userId);
      let mismatched = 0;
      for (const file of expected) {
        try {
          const onDisk = await readFile(path.join(dest, file.path), "utf8");
          if (sha256Hex(onDisk) !== sha256Hex(file.content)) {
            mismatched += 1;
          }
        } catch {
          mismatched += 1;
        }
      }
      if (mismatched > 0) {
        driftedKits += 1;
      }
    }
    drift =
      kits.length === 0
        ? "No member kits generated yet"
        : driftedKits === 0
          ? `${kits.length} kit(s) in sync with live pack`
          : `${driftedKits} of ${kits.length} member kit(s) drifted`;
  }

  return (
    <div className="grid gap-6 px-6 py-6 lg:px-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <Panel>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Live release</p>
          <p className="mt-2 font-display text-2xl">{project.liveRelease?.label ?? "none"}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Last generate</p>
          <p className="mt-2 font-display text-2xl">
            {project.generateRuns[0] ? formatWhen(project.generateRuns[0].createdAt) : "never"}
          </p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Drift</p>
          <p className="mt-2 text-lg">{drift}</p>
        </Panel>
      </div>
      <Panel title="Generate runs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="pb-3">When</th>
                <th className="pb-3">Who</th>
                <th className="pb-3">Release</th>
                <th className="pb-3">Targets</th>
                <th className="pb-3">Files</th>
              </tr>
            </thead>
            <tbody>
              {project.generateRuns.map((run) => (
                <tr key={run.id} className="border-t border-line">
                  <td className="py-3">{formatWhen(run.createdAt)}</td>
                  <td>{run.actor.name}</td>
                  <td>{run.release?.label ?? "draft"}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {run.targets.map((target) => (
                        <Badge key={target}>{target}</Badge>
                      ))}
                    </div>
                  </td>
                  <td>{run.fileCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {project.generateRuns.length === 0 ? (
            <p className="pt-3 text-sm text-muted">No generates yet.</p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
