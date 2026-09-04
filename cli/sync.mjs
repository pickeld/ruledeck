#!/usr/bin/env node
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trigger = process.argv[2] ?? "sync";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafe(rel) {
  const normalized = String(rel).replaceAll("\\", "/");
  if (!normalized || path.isAbsolute(normalized)) {
    throw new Error("Refusing to write " + rel);
  }
  for (const part of normalized.split("/")) {
    if (!part || part === "." || part === ".." || !/^[a-zA-Z0-9._-]+$/.test(part)) {
      throw new Error("Refusing to write " + rel);
    }
  }
}

function git(args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

function normalizeMatcher(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^git@/, "")
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "")
    .replace(/:/g, "/");
}

function workspaceIdentity() {
  const folder = path.basename(root);
  const remotes = [];
  try {
    const raw = git(["remote", "-v"]);
    for (const line of raw.split("\n")) {
      const url = line.split(/\s+/)[1];
      if (url) {
        remotes.push(normalizeMatcher(url));
      }
    }
  } catch {
    // not a git repo, or no remotes yet
  }
  return { folder: normalizeMatcher(folder), remotes: [...new Set(remotes)] };
}

function linkedToProject(config) {
  const matchers = (Array.isArray(config.match) && config.match.length
    ? config.match
    : [config.project]
  ).map(normalizeMatcher);
  const identity = workspaceIdentity();
  return matchers.some(
    (matcher) =>
      matcher === identity.folder ||
      identity.remotes.some((remote) => remote === matcher || remote.endsWith("/" + matcher)),
  );
}

function describeWorkspace() {
  const identity = workspaceIdentity();
  return identity.remotes[0] || identity.folder;
}

async function main() {
  const config = JSON.parse(await readFile(path.join(root, ".ruledeck", "config.json"), "utf8"));
  const linked = linkedToProject(config);

  if (trigger === "install-hooks") {
    if (!linked) {
      throw new Error(
        `This folder (${path.basename(root)}) is not linked to ${config.project}. Open that project's repo in Cursor, or add this folder/git remote to .ruledeck/config.json match.`,
      );
    }
    git(["config", "core.hooksPath", ".ruledeck/hooks"]);
    process.stdout.write(`Installed RuleDeck git hooks for ${config.project} in ${path.basename(root)}\n`);
    return;
  }

  if (!linked) {
    process.stdout.write(
      `RuleDeck skip: ${path.basename(root)} is not linked to ${config.project}\n`,
    );
    return;
  }

  const creds = JSON.parse(await readFile(path.join(root, ".ruledeck", "credentials"), "utf8"));
  const packRes = await fetch(`${config.apiUrl}/api/v1/pack?project=${encodeURIComponent(config.project)}`, {
    headers: { authorization: `Bearer ${creds.token}` },
    cache: "no-store",
  });
  if (!packRes.ok) {
    throw new Error(`Pack fetch failed (${packRes.status})`);
  }
  const pack = await packRes.json();
  const hashes = [];
  for (const file of pack.files) {
    assertSafe(file.path);
    const full = path.join(root, file.path);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, file.content, "utf8");
    hashes.push(`${file.path}:${sha256(file.content)}`);
  }
  hashes.sort();
  const contentHash = sha256(hashes.join("\n"));
  const checkin = await fetch(`${config.apiUrl}/api/v1/checkin`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${creds.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      project: config.project,
      trigger,
      contentHash,
      fileCount: pack.files.length,
      workspace: describeWorkspace(),
    }),
  });
  if (!checkin.ok) {
    throw new Error(`Check-in failed (${checkin.status})`);
  }
  process.stdout.write(
    `RuleDeck ${trigger}: wrote ${pack.files.length} files (${pack.release}) in ${path.basename(root)}\n`,
  );

  if (trigger !== "push") {
    return;
  }

  const managed = pack.files.map((file) => file.path);
  try {
    git(["add", "--", ...managed]);
    const staged = git(["diff", "--cached", "--name-only", "--", ...managed]).trim();
    const unstaged = git(["diff", "--name-only", "--", ...managed]).trim();
    if (staged || unstaged) {
      process.stderr.write("RuleDeck updated policy files. Commit them, then push again.\n");
      process.exit(1);
    }
  } catch (error) {
    if (typeof error?.status === "number" && error.status !== 0) {
      throw error;
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exit(1);
});
