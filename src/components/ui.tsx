import type { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-muted">
      {children}
    </span>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-panel">
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          {title ? <h2 className="text-sm font-medium tracking-wide">{title}</h2> : <div />}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  name,
  children,
  hint,
}: {
  label: string;
  name?: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-muted">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      {name ? <input type="hidden" name={name} /> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-foreground outline-none ring-accent/40 placeholder:text-muted/70 focus:border-accent focus:ring-2";

export const buttonClass =
  "inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink transition hover:bg-accent-hot disabled:opacity-50";

export const ghostButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-line px-4 py-2 text-sm text-foreground transition hover:border-accent/60 hover:text-accent";
