import { LoginForm } from "@/components/login-form";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/");
  }
  return (
    <main className="grid min-h-full place-items-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <p className="font-display text-4xl tracking-tight">RuleDeck</p>
        <p className="mt-2 text-sm text-muted">
          Managers set the pack. Teams apply it in Cursor, Claude Code, and Copilot.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
