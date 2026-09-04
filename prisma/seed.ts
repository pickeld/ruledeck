import { PrismaClient, type ArtifactType } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const managerPassword = process.env.SEED_MANAGER_PASSWORD;
  const developerPassword = process.env.SEED_DEVELOPER_PASSWORD;
  if (!managerPassword || !developerPassword) {
    throw new Error("SEED_MANAGER_PASSWORD and SEED_DEVELOPER_PASSWORD must be set");
  }

  const manager = await prisma.user.upsert({
    where: { email: "manager@ruledeck.local" },
    update: {
      name: "Dana Manager",
      role: "MANAGER",
      passwordHash: await hashPassword(managerPassword),
    },
    create: {
      email: "manager@ruledeck.local",
      name: "Dana Manager",
      role: "MANAGER",
      passwordHash: await hashPassword(managerPassword),
    },
  });

  const developer = await prisma.user.upsert({
    where: { email: "dev@ruledeck.local" },
    update: {
      name: "Eli Developer",
      role: "DEVELOPER",
      passwordHash: await hashPassword(developerPassword),
    },
    create: {
      email: "dev@ruledeck.local",
      name: "Eli Developer",
      role: "DEVELOPER",
      passwordHash: await hashPassword(developerPassword),
    },
  });

  await ensureGlobal(manager.id);

  const existing = await prisma.project.findUnique({ where: { slug: "platform-api" } });
  if (existing) {
    await seedMemberships(existing.id, manager.id, developer.id, existing.liveReleaseId);
    return;
  }

  const project = await prisma.project.create({
    data: {
      slug: "platform-api",
      name: "Platform API",
      description: "Project-specific extras for the platform API squad.",
      kind: "PROJECT",
    },
  });

  const items: {
    type: ArtifactType;
    slug: string;
    title: string;
    description: string;
    content: string;
    alwaysApply?: boolean;
  }[] = [
    {
      type: "PROMPT",
      slug: "pr-review",
      title: "PR review",
      description: "Manager-approved review prompt for this squad.",
      content:
        "Review this diff for regressions, missing tests, authz gaps, and unclear naming. Group findings as blockers, should-fix, and nit. Do not bikeshed formatting.",
    },
    {
      type: "PROCEDURE",
      slug: "ship-checklist",
      title: "Ship checklist",
      description: "Before a change is considered done on Platform API.",
      content:
        "1. Confirm you are on the live RuleDeck release.\n2. Generate Cursor, Claude Code, and Copilot files.\n3. Run the project test command.\n4. Open a PR that includes generated policy files if they changed.",
    },
    {
      type: "TOOL",
      slug: "github",
      title: "GitHub MCP",
      description: "Allowed GitHub MCP server for this project.",
      content: JSON.stringify(
        {
          github: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"],
          },
        },
        null,
        2,
      ),
    },
  ];

  for (const item of items) {
    await prisma.artifact.create({
      data: {
        projectId: project.id,
        type: item.type,
        slug: item.slug,
        title: item.title,
        description: item.description,
        targets: ["cursor", "claudecode", "copilot"],
        globs: ["**/*"],
        alwaysApply: item.alwaysApply ?? false,
        versions: {
          create: {
            version: 1,
            content: item.content,
            message: "Seeded by RuleDeck",
            authorId: manager.id,
          },
        },
      },
    });
  }

  const artifacts = await prisma.artifact.findMany({
    where: { projectId: project.id },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  const release = await prisma.release.create({
    data: {
      projectId: project.id,
      label: "v1",
      changelog: "Initial project pack for Platform API.",
      publishedById: manager.id,
      items: {
        create: artifacts.map((artifact) => ({
          artifactId: artifact.id,
          versionId: artifact.versions[0].id,
        })),
      },
    },
  });

  await prisma.project.update({
    where: { id: project.id },
    data: { liveReleaseId: release.id },
  });

  await prisma.auditEvent.create({
    data: {
      actorId: manager.id,
      projectId: project.id,
      action: "project.seeded",
      entityType: "project",
      entityId: project.id,
    },
  });

  await seedMemberships(project.id, manager.id, developer.id, release.id);
}

async function ensureGlobal(managerId: string): Promise<void> {
  const global = await prisma.project.upsert({
    where: { slug: "global" },
    update: {
      name: "Global pack",
      description: "Org-wide policy included in every project unless a project overrides the same slug.",
      kind: "GLOBAL",
    },
    create: {
      slug: "global",
      name: "Global pack",
      description: "Org-wide policy included in every project unless a project overrides the same slug.",
      kind: "GLOBAL",
    },
  });

  const alreadyGlobal = await prisma.artifact.findFirst({
    where: { projectId: global.id, type: "RULE", slug: "coding-standards" },
  });
  const fromProject = await prisma.artifact.findFirst({
    where: { type: "RULE", slug: "coding-standards", project: { slug: "platform-api" } },
  });
  if (!alreadyGlobal && fromProject) {
    await prisma.artifact.update({
      where: { id: fromProject.id },
      data: { projectId: global.id },
    });
  } else if (!alreadyGlobal) {
    await prisma.artifact.create({
      data: {
        projectId: global.id,
        type: "RULE",
        slug: "coding-standards",
        title: "Coding standards",
        description: "Org-wide engineering standards.",
        targets: ["cursor", "claudecode", "copilot"],
        globs: ["**/*"],
        alwaysApply: true,
        versions: {
          create: {
            version: 1,
            content:
              "Follow existing module patterns. Keep changes small and reviewable. Do not add comments that only restate the code. Prefer explicit errors over thrown strings. Never skip tests for behavior you touched.",
            message: "Seeded by RuleDeck",
            authorId: managerId,
          },
        },
      },
    });
  }

  const current = await prisma.project.findUniqueOrThrow({ where: { id: global.id } });
  if (!current.liveReleaseId) {
    const artifacts = await prisma.artifact.findMany({
      where: { projectId: global.id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    const withContent = artifacts.filter((artifact) => artifact.versions[0]);
    if (withContent.length > 0) {
      const release = await prisma.release.create({
        data: {
          projectId: global.id,
          label: "v1",
          changelog: "Initial global pack.",
          publishedById: managerId,
          items: {
            create: withContent.map((artifact) => ({
              artifactId: artifact.id,
              versionId: artifact.versions[0].id,
            })),
          },
        },
      });
      await prisma.project.update({
        where: { id: global.id },
        data: { liveReleaseId: release.id },
      });
    }
  }

  await prisma.membership.upsert({
    where: { projectId_userId: { projectId: global.id, userId: managerId } },
    update: {},
    create: {
      projectId: global.id,
      userId: managerId,
      role: "MANAGER",
      platforms: ["cursor", "claudecode", "copilot"],
      onboardingCompletedAt: new Date(),
      lastCheckInAt: new Date(),
      compliance: "FOLLOWING",
    },
  });
}

async function seedMemberships(
  projectId: string,
  managerId: string,
  developerId: string,
  liveReleaseId: string | null,
): Promise<void> {
  await prisma.membership.upsert({
    where: { projectId_userId: { projectId, userId: managerId } },
    update: {},
    create: {
      projectId,
      userId: managerId,
      role: "MANAGER",
      platforms: ["cursor", "claudecode", "copilot"],
      onboardingCompletedAt: new Date(),
      appliedReleaseId: liveReleaseId,
      lastCheckInAt: new Date(),
      compliance: liveReleaseId ? "FOLLOWING" : "PENDING",
    },
  });
  await prisma.membership.upsert({
    where: { projectId_userId: { projectId, userId: developerId } },
    update: {},
    create: {
      projectId,
      userId: developerId,
      role: "DEVELOPER",
      platforms: ["cursor", "copilot"],
      compliance: "PENDING",
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
