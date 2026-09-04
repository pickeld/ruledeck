import { diffLines } from "diff";

export function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function lineDiff(before: string, after: string): { type: "add" | "remove" | "equal"; text: string }[] {
  const parts = diffLines(before, after);
  const rows: { type: "add" | "remove" | "equal"; text: string }[] = [];
  for (const part of parts) {
    const type = part.added ? "add" : part.removed ? "remove" : "equal";
    const lines = part.value.split("\n");
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }
    for (const line of lines) {
      rows.push({ type, text: line });
    }
  }
  return rows;
}
