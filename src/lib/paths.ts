import path from "node:path";
import { getOutputRoot } from "./config";

export function memberOutputDir(projectSlug: string, userId: string): string {
  if (!/^[a-z0-9_-]+$/i.test(userId)) {
    throw new Error("Invalid user id");
  }
  return scopedDir(projectSlug, "members", userId);
}

function scopedDir(...parts: string[]): string {
  const root = getOutputRoot();
  const dest = path.resolve(root, ...parts);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (dest !== root && !dest.startsWith(prefix)) {
    throw new Error("Refusing to write outside OUTPUT_ROOT");
  }
  if (parts.some((part) => part.includes("..") || path.isAbsolute(part))) {
    throw new Error("Invalid output path");
  }
  return dest;
}
