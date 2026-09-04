const MATCHER = /^[a-z0-9._/@:-]+$/i;

export function normalizeMatcher(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^git@/, "")
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "")
    .replace(/:/g, "/");
}

export function parseWorkspaceMatchers(raw: string, fallbackSlug: string): string[] {
  const items = raw
    .split(/[\n,]/)
    .map((item) => normalizeMatcher(item))
    .filter((item) => item.length > 0 && item.length <= 200 && MATCHER.test(item));
  const unique = [...new Set(items)].slice(0, 20);
  return unique.length ? unique : [normalizeMatcher(fallbackSlug)];
}

export function matchersFor(projectSlug: string, stored: string[]): string[] {
  return stored.length ? stored : [normalizeMatcher(projectSlug)];
}
