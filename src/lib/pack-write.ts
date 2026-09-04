import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GeneratedFile } from "./adapters";
import { sha256Hex } from "./crypto";
import { HOOK_PULL, HOOK_PUSH } from "./sync-runtime";

const exec = promisify(execFile);

export function assertSafeRelPath(rel: string): void {
  const normalized = rel.replaceAll("\\", "/");
  if (!normalized || path.isAbsolute(normalized)) {
    throw new Error(`Refusing to write ${rel}`);
  }
  for (const part of normalized.split("/")) {
    if (!part || part === "." || part === ".." || !/^[a-zA-Z0-9._-]+$/.test(part)) {
      throw new Error(`Refusing to write ${rel}`);
    }
  }
}

export function hashGeneratedFiles(files: GeneratedFile[]): string {
  return sha256Hex(
    files
      .map((file) => `${file.path}:${sha256Hex(file.content)}`)
      .sort()
      .join("\n"),
  );
}

export async function writeGeneratedFiles(dest: string, files: GeneratedFile[]): Promise<string> {
  const root = path.resolve(dest);
  for (const file of files) {
    assertSafeRelPath(file.path);
    const full = path.resolve(root, file.path);
    const rel = path.relative(root, full);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(`Refusing to write ${file.path}`);
    }
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, file.content, "utf8");
  }
  return hashGeneratedFiles(files);
}

export async function appendGitignore(dest: string, entry: string): Promise<void> {
  const gitignore = path.join(dest, ".gitignore");
  let current = "";
  try {
    current = await readFile(gitignore, "utf8");
  } catch {
    current = "";
  }
  if (!current.includes(entry)) {
    const prefix = current.endsWith("\n") || current === "" ? "" : "\n";
    await writeFile(gitignore, `${current}${prefix}${entry}\n`, "utf8");
  }
}

export async function enableHooksPath(dest: string): Promise<boolean> {
  try {
    await exec("git", ["-C", dest, "rev-parse", "--is-inside-work-tree"]);
    await exec("git", ["-C", dest, "config", "core.hooksPath", ".ruledeck/hooks"]);
    return true;
  } catch {
    return false;
  }
}

async function writeExecutable(full: string, content: string): Promise<void> {
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
  await chmod(full, 0o755);
}

export async function loadSyncRuntime(): Promise<string> {
  const full = path.join(/* turbopackIgnore: true */ process.cwd(), "cli", "sync.mjs");
  return readFile(full, "utf8");
}

export async function installSyncKit(options: {
  dest: string;
  files: GeneratedFile[];
  projectSlug: string;
  apiUrl: string;
  token?: string;
  match?: string[];
  enableHooks?: boolean;
}): Promise<string> {
  const dest = path.resolve(options.dest);
  const contentHash = await writeGeneratedFiles(dest, options.files);
  const deck = path.join(dest, ".ruledeck");
  await mkdir(deck, { recursive: true });
  await writeFile(
    path.join(deck, "config.json"),
    `${JSON.stringify(
      {
        project: options.projectSlug,
        apiUrl: options.apiUrl,
        match: options.match?.length ? options.match : [options.projectSlug],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  if (options.token) {
    const credsPath = path.join(deck, "credentials");
    await writeFile(credsPath, `${JSON.stringify({ token: options.token }, null, 2)}\n`, "utf8");
    await chmod(credsPath, 0o600);
  }
  await writeExecutable(path.join(deck, "sync.mjs"), await loadSyncRuntime());
  await writeExecutable(path.join(deck, "hooks", "post-merge"), HOOK_PULL);
  await writeExecutable(path.join(deck, "hooks", "post-checkout"), HOOK_PULL);
  await writeExecutable(path.join(deck, "hooks", "post-rewrite"), HOOK_PULL);
  await writeExecutable(path.join(deck, "hooks", "pre-push"), HOOK_PUSH);
  await writeFile(path.join(deck, ".gitignore"), "credentials\n", "utf8");
  await appendGitignore(dest, ".ruledeck/credentials");
  if (options.enableHooks) {
    await enableHooksPath(dest);
  }
  return contentHash;
}
