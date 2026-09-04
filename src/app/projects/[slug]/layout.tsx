import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader, Shell } from "@/components/shell";
import { Badge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isGlobalProject } from "@/lib/config";
import { prisma } from "@/lib/prisma";

const TABS = [
  ["", "Catalog"],
  ["/team", "Team"],
  ["/history", "History"],
  ["/generate", "Generate"],
  ["/monitoring", "Monitoring"],
  ["/audit", "Audit"],
] as const;

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug },
    include: { liveRelease: true },
  });
  if (!project) {
    notFound();
  }

  const tabs = isGlobalProject(project)
    ? TABS.filter(([, label]) => label !== "Team")
    : TABS;

  return (
    <Shell user={user}>
      <PageHeader
        eyebrow={isGlobalProject(project) ? "Global pack" : "Project"}
        title={project.name}
        subtitle={
          project.description ||
          (isGlobalProject(project)
            ? "Org-wide rules, prompts, procedures, and tools. Every project inherits the live release."
            : "Project-specific extras. Same slug overrides the global pack.")
        }
        actions={<Badge>{project.liveRelease?.label ?? "unpublished"}</Badge>}
      />
      <nav className="flex gap-1 overflow-x-auto border-b border-line px-6 lg:px-10">
        {tabs.map(([suffix, label]) => (
          <Link
            key={label}
            href={`/projects/${slug}${suffix}`}
            className="border-b-2 border-transparent px-3 py-3 text-sm text-muted hover:text-foreground"
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </Shell>
  );
}
