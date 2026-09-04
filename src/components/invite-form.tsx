"use client";

import { useActionState } from "react";
import { createInviteAction } from "@/lib/actions/invites";
import { buttonClass, inputClass } from "@/components/ui";

export function InviteForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(createInviteAction, undefined);
  return (
    <div className="grid gap-3">
      <form action={action}>
        <input type="hidden" name="slug" value={slug} />
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Creating…" : "Create invite link"}
        </button>
      </form>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.url ? (
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted">Share this once — it is not shown again</span>
          <input className={inputClass} readOnly value={state.url} />
        </label>
      ) : null}
    </div>
  );
}
