"use client";

import { useActionState } from "react";
import { joinAction } from "@/lib/actions/onboarding";
import { buttonClass, inputClass } from "@/components/ui";

export function JoinForm({ token, projectName }: { token: string; projectName: string }) {
  const [state, action, pending] = useActionState(joinAction, undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-muted">
        You were invited to follow the manager pack for <span className="text-foreground">{projectName}</span>.
      </p>
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted">Name</span>
        <input className={inputClass} name="name" required autoComplete="name" />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted">Work email</span>
        <input className={inputClass} name="email" type="email" required autoComplete="email" />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted">Password (8+ characters)</span>
        <input className={inputClass} name="password" type="password" required autoComplete="new-password" minLength={8} />
      </label>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Creating account…" : "Create account and continue"}
      </button>
    </form>
  );
}
