import { redirect } from "next/navigation";
import { PageHeader, Shell } from "@/components/shell";
import { buttonClass, inputClass, Panel } from "@/components/ui";
import { createProjectAction } from "@/lib/actions/projects";
import { isManager, requireUser } from "@/lib/auth";

export default async function NewProjectPage() {
  const user = await requireUser();
  if (!isManager(user)) {
    redirect("/");
  }
  return (
    <Shell user={user}>
      <PageHeader
        eyebrow="Projects"
        title="Open a new deck"
        subtitle="Project-specific extras on top of the global pack. Same slug overrides global."
      />
      <div className="max-w-xl px-6 py-6 lg:px-10">
        <Panel>
          <form action={createProjectAction} className="grid gap-4">
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted">Name</span>
              <input className={inputClass} name="name" required placeholder="Platform API" />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted">Slug</span>
              <input className={inputClass} name="slug" required placeholder="platform-api" />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted">Description</span>
              <textarea className={`${inputClass} min-h-24`} name="description" />
            </label>
            <button className={buttonClass} type="submit">
              Create project
            </button>
          </form>
        </Panel>
      </div>
    </Shell>
  );
}
