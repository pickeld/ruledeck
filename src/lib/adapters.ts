import type { TargetId } from "./config";

export type { TargetId };

export type ArtifactTypeId = "RULE" | "PROMPT" | "PROCEDURE" | "TOOL";

export type ArtifactOrigin = "global" | "project";

export type CanonicalArtifact = {
  type: ArtifactTypeId;
  slug: string;
  title: string;
  description: string;
  targets: string[];
  globs: string[];
  alwaysApply: boolean;
  content: string;
  origin: ArtifactOrigin;
};

export type GeneratedFile = {
  path: string;
  content: string;
};

function wants(artifact: CanonicalArtifact, target: TargetId): boolean {
  return artifact.targets.includes("*") || artifact.targets.includes(target);
}

function yamlList(values: string[]): string {
  if (values.length === 0) {
    return "[]";
  }
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function heading(title: string): string {
  return `# ${title}\n\n`;
}

function generateCursor(artifacts: CanonicalArtifact[]): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const mcpServers: Record<string, unknown> = {};

  for (const artifact of artifacts.filter((item) => wants(item, "cursor"))) {
    if (artifact.type === "RULE") {
      const frontmatter = [
        "---",
        `description: ${JSON.stringify(artifact.description || artifact.title)}`,
        `globs: ${yamlList(artifact.globs.length ? artifact.globs : ["**/*"])}`,
        `alwaysApply: ${artifact.alwaysApply}`,
        "---",
        "",
        artifact.content.trim(),
        "",
      ].join("\n");
      files.push({ path: `.cursor/rules/${artifact.slug}.mdc`, content: frontmatter });
    } else if (artifact.type === "PROMPT" || artifact.type === "PROCEDURE") {
      files.push({
        path: `.cursor/commands/${artifact.slug}.md`,
        content: `${heading(artifact.title)}${artifact.content.trim()}\n`,
      });
    } else if (artifact.type === "TOOL") {
      Object.assign(mcpServers, parseTool(artifact));
    }
  }

  if (Object.keys(mcpServers).length > 0) {
    files.push({
      path: ".cursor/mcp.json",
      content: `${JSON.stringify({ mcpServers }, null, 2)}\n`,
    });
  }

  return files;
}

function generateClaudeCode(artifacts: CanonicalArtifact[]): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const rules = artifacts.filter((item) => item.type === "RULE" && wants(item, "claudecode"));
  const mcpServers: Record<string, unknown> = {};

  if (rules.length > 0) {
    const body = rules
      .map((rule) => `## ${rule.title}\n\n${rule.content.trim()}`)
      .join("\n\n");
    files.push({
      path: "CLAUDE.md",
      content: `# Project instructions\n\nManaged by RuleDeck. Do not edit by hand.\n\n${body}\n`,
    });
  }

  for (const artifact of artifacts.filter((item) => wants(item, "claudecode"))) {
    if (artifact.type === "PROMPT" || artifact.type === "PROCEDURE") {
      files.push({
        path: `.claude/commands/${artifact.slug}.md`,
        content: `${heading(artifact.title)}${artifact.content.trim()}\n`,
      });
    } else if (artifact.type === "TOOL") {
      Object.assign(mcpServers, parseTool(artifact));
    }
  }

  if (Object.keys(mcpServers).length > 0) {
    files.push({
      path: ".mcp.json",
      content: `${JSON.stringify({ mcpServers }, null, 2)}\n`,
    });
  }

  return files;
}

function generateCopilot(artifacts: CanonicalArtifact[]): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const rules = artifacts.filter((item) => item.type === "RULE" && wants(item, "copilot"));
  const mcpServers: Record<string, unknown> = {};

  if (rules.length > 0) {
    const body = rules
      .map((rule) => `## ${rule.title}\n\n${rule.content.trim()}`)
      .join("\n\n");
    files.push({
      path: ".github/copilot-instructions.md",
      content: `<!-- Managed by RuleDeck. Do not edit by hand. -->\n\n${body}\n`,
    });
  }

  for (const artifact of artifacts.filter((item) => wants(item, "copilot"))) {
    if (artifact.type === "PROMPT" || artifact.type === "PROCEDURE") {
      files.push({
        path: `.github/prompts/${artifact.slug}.prompt.md`,
        content: `${heading(artifact.title)}${artifact.content.trim()}\n`,
      });
    } else if (artifact.type === "TOOL") {
      Object.assign(mcpServers, parseTool(artifact));
    }
  }

  if (Object.keys(mcpServers).length > 0) {
    files.push({
      path: ".vscode/mcp.json",
      content: `${JSON.stringify({ servers: mcpServers }, null, 2)}\n`,
    });
  }

  return files;
}

export function generateAll(
  artifacts: CanonicalArtifact[],
  targets: TargetId[],
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  if (targets.includes("cursor")) {
    files.push(...generateCursor(artifacts));
  }
  if (targets.includes("claudecode")) {
    files.push(...generateClaudeCode(artifacts));
  }
  if (targets.includes("copilot")) {
    files.push(...generateCopilot(artifacts));
  }
  files.push({
    path: ".ruledeck/manifest.json",
    content: `${JSON.stringify(
      {
        artifactCount: artifacts.length,
        targets,
      },
      null,
      2,
    )}\n`,
  });
  return files;
}

function parseTool(artifact: CanonicalArtifact): Record<string, unknown> {
  const trimmed = artifact.content.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Stored as prose — skip MCP merge and let the markdown adapter paths unused.
  }
  return {
    [artifact.slug]: {
      command: "npx",
      args: ["-y", artifact.slug],
    },
  };
}
