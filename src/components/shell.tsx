import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/lib/actions/auth";
import type { SessionUser } from "@/lib/auth";

export function Shell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full grid lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col border-b border-line bg-panel lg:min-h-full lg:border-b-0 lg:border-r">
        <div className="px-5 py-6">
          <Link href="/" className="font-display text-2xl tracking-tight text-foreground">
            RuleDeck
          </Link>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">Policy console</p>
        </div>
        <nav className="grid gap-1 px-3 pb-6 text-sm">
          <Link className="rounded-lg px-3 py-2 hover:bg-ink" href="/">
            Deck
          </Link>
          <Link className="rounded-lg px-3 py-2 hover:bg-ink" href="/workspaces">
            Workspaces
          </Link>
          <Link className="rounded-lg px-3 py-2 hover:bg-ink" href="/projects/global">
            Global pack
          </Link>
          <Link className="rounded-lg px-3 py-2 hover:bg-ink" href="/projects/new">
            New project
          </Link>
          <Link className="rounded-lg px-3 py-2 hover:bg-ink" href="/audit">
            Audit log
          </Link>
        </nav>
        <div className="mt-auto border-t border-line px-5 py-4 text-xs text-muted">
          <div className="text-foreground">{user.name}</div>
          <div>{user.role === "MANAGER" ? "Engineering manager" : "Developer"}</div>
          <form action={logoutAction} className="mt-3">
            <button className="text-accent hover:underline" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-6 py-6 lg:px-10">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-3xl tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </header>
  );
}
