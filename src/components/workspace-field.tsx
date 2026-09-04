import { inputClass } from "@/components/ui";

export function WorkspaceField({
  projectSlug,
  defaultValue,
}: {
  projectSlug: string;
  defaultValue?: string[];
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-muted">Cursor workspace / git repo for this pack</span>
      <textarea
        className={`${inputClass} min-h-20 font-mono text-xs`}
        name="workspaces"
        defaultValue={(defaultValue?.length ? defaultValue : [projectSlug]).join("\n")}
        placeholder={`${projectSlug}\ngithub.com/your-org/${projectSlug}`}
      />
      <span className="text-xs text-muted">
        One per line: folder name (the Cursor window you open) or git remote. Hooks skip any other
        repo.
      </span>
    </label>
  );
}
