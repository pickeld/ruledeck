"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth";
import { buttonClass, inputClass } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted">Email</span>
        <input className={inputClass} autoComplete="username" name="email" type="email" required />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted">Password</span>
        <input
          className={inputClass}
          autoComplete="current-password"
          name="password"
          type="password"
          required
        />
      </label>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
