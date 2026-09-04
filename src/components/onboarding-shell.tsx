import Link from "next/link";
import type { ReactNode } from "react";

const STEPS = [
  ["Account", "/join"],
  ["Platforms", "/onboarding/platforms"],
  ["Apply pack", "/onboarding/apply"],
  ["Done", "/onboarding/done"],
];

export function OnboardingShell({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid min-h-full max-w-2xl content-center gap-8 px-6 py-16">
      <div>
        <Link href="/" className="font-display text-3xl tracking-tight">
          RuleDeck
        </Link>
        <ol className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-muted">
          {STEPS.map(([label], index) => (
            <li key={label} className={index === step ? "text-accent" : ""}>
              {index + 1}. {label}
            </li>
          ))}
        </ol>
        <h1 className="mt-6 font-display text-3xl tracking-tight">{title}</h1>
      </div>
      <div className="rounded-2xl border border-line bg-panel p-6">{children}</div>
    </main>
  );
}
