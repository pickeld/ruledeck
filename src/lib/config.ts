import path from "node:path";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function getSessionSecret(): string {
  const secret = required("SESSION_SECRET");
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

export function getOutputRoot(): string {
  const configured = process.env.OUTPUT_ROOT;
  if (configured) {
    return path.resolve(/* turbopackIgnore: true */ configured);
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), "output");
}

export function getPublicUrl(): string {
  return (process.env.APP_PUBLIC_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
}

export function isHttps(): boolean {
  return process.env.RULEDECK_HTTPS === "true";
}

export const TARGETS = ["cursor", "claudecode", "copilot"] as const;
export type TargetId = (typeof TARGETS)[number];

export const TARGET_LABELS: Record<TargetId, string> = {
  cursor: "Cursor",
  claudecode: "Claude Code",
  copilot: "GitHub Copilot",
};

export const ARTIFACT_TYPES = ["RULE", "PROMPT", "PROCEDURE", "TOOL"] as const;

export const GLOBAL_PROJECT_SLUG = "global";

export function isGlobalProject(project: { kind?: string; slug: string }): boolean {
  return project.kind === "GLOBAL" || project.slug === GLOBAL_PROJECT_SLUG;
}

export const ARTIFACT_LABELS: Record<(typeof ARTIFACT_TYPES)[number], string> = {
  RULE: "Rules",
  PROMPT: "Prompts",
  PROCEDURE: "Procedures",
  TOOL: "Tools",
};
