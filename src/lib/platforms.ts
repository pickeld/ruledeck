import { TARGETS, type TargetId } from "./config";

export type PlatformId =
  | "cursor"
  | "claudecode"
  | "copilot"
  | "codexcli"
  | "windsurf"
  | "cline"
  | "continue"
  | "opencode";

export type Platform = {
  id: PlatformId;
  label: string;
  generates: boolean;
  hint: string;
};

export const PLATFORMS: Platform[] = [
  { id: "cursor", label: "Cursor", generates: true, hint: ".cursor/rules" },
  { id: "claudecode", label: "Claude Code", generates: true, hint: "CLAUDE.md" },
  { id: "copilot", label: "GitHub Copilot", generates: true, hint: ".github/copilot-instructions.md" },
  { id: "codexcli", label: "Codex CLI", generates: false, hint: "Declared — pack lands as AGENTS.md later" },
  { id: "windsurf", label: "Windsurf", generates: false, hint: "Declared — .windsurfrules later" },
  { id: "cline", label: "Cline", generates: false, hint: "Declared — .clinerules later" },
  { id: "continue", label: "Continue", generates: false, hint: "Declared — .continue later" },
  { id: "opencode", label: "OpenCode", generates: false, hint: "Declared — AGENTS.md later" },
];

export function platformLabel(id: string): string {
  return PLATFORMS.find((item) => item.id === id)?.label ?? id;
}

export function packTargets(platforms: string[]): TargetId[] {
  const picked = TARGETS.filter((id) => platforms.includes(id));
  return picked.length ? picked : [...TARGETS];
}
