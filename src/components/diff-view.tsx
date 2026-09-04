import { lineDiff } from "@/lib/format";

export function DiffView({ before, after }: { before: string; after: string }) {
  const rows = lineDiff(before, after);
  if (before === after) {
    return <p className="text-sm text-muted">No content changes in this version.</p>;
  }
  return (
    <pre className="overflow-auto rounded-lg border border-line bg-ink p-4 font-mono text-xs leading-6">
      {rows.map((row, index) => (
        <div
          key={`${index}-${row.type}`}
          className={
            row.type === "add"
              ? "bg-sage/15 text-sage"
              : row.type === "remove"
                ? "bg-danger/15 text-danger"
                : "text-muted"
          }
        >
          <span className="inline-block w-4">{row.type === "add" ? "+" : row.type === "remove" ? "-" : " "}</span>
          {row.text}
        </div>
      ))}
    </pre>
  );
}
