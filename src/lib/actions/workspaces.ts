"use server";

import { revalidatePath } from "next/cache";
import { getPublicUrl } from "@/lib/config";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseWorkspaceMatchers } from "@/lib/workspace";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { memberOutputDir } from "@/lib/paths";

export async function saveWorkspaceMatchersAction(projectSlug: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const project = await prisma.project.findUniqueOrThrow({ where: { slug: projectSlug } });
  const membership = await prisma.membership.findUniqueOrThrow({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
  });
  const match = parseWorkspaceMatchers(String(formData.get("workspaces") ?? ""), project.slug);
  await prisma.membership.update({
    where: { id: membership.id },
    data: { workspaceMatchers: match },
  });
  const dest = memberOutputDir(project.slug, user.id);
  const configPath = path.join(dest, ".ruledeck", "config.json");
  try {
    const current = JSON.parse(await readFile(configPath, "utf8")) as { project?: unknown; apiUrl?: unknown };
    await writeFile(
      configPath,
      `${JSON.stringify(
        {
          project: project.slug,
          apiUrl: typeof current.apiUrl === "string" ? current.apiUrl : getPublicUrl(),
          match,
        },
        null,
        2,
      )}\n`,
    );
  } catch {
    // kit not on disk yet
  }
  revalidatePath("/workspaces");
  revalidatePath(`/projects/${projectSlug}/team`);
}
