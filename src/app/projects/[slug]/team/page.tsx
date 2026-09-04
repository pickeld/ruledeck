import { notFound } from "next/navigation";
import { Badge, Panel } from "@/components/ui";
import { InviteForm } from "@/components/invite-form";
import { revokeInviteAction } from "@/lib/actions/invites";
import { COMPLIANCE_LABEL, refreshMembershipCompliance } from "@/lib/compliance";
import { isManager, requireUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { platformLabel } from "@/lib/platforms";
import { prisma } from "@/lib/prisma";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      liveRelease: true,
      memberships: { include: { user: true, appliedRelease: true }, orderBy: { createdAt: "asc" } },
      invites: { orderBy: { createdAt: "desc" }, take: 8, include: { createdBy: true } },
    },
  });
  if (!project) {
    notFound();
  }
  await Promise.all(project.memberships.map((member) => refreshMembershipCompliance(member.id)));
  const members = await prisma.membership.findMany({
    where: { projectId: project.id },
    include: { user: true, appliedRelease: true },
    orderBy: { createdAt: "asc" },
  });
  const following = members.filter((member) => member.compliance === "FOLLOWING").length;
  const broke = members.filter((member) => member.compliance === "DRIFTED").length;

  return (
    <div className="grid gap-6 px-6 py-6 lg:px-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <Panel>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">On the pack</p>
          <p className="mt-2 font-display text-2xl">
            {following}/{members.length}
          </p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Broke pack</p>
          <p className="mt-2 font-display text-2xl text-danger">{broke}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Live release</p>
          <p className="mt-2 font-display text-2xl">{project.liveRelease?.label ?? "none"}</p>
        </Panel>
      </div>
      <Panel title="Members">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="pb-3">Person</th>
                <th className="pb-3">Platforms</th>
                <th className="pb-3">Applied</th>
                <th className="pb-3">Last check-in</th>
                <th className="pb-3">Workspace</th>
                <th className="pb-3">Write access</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-t border-line">
                  <td className="py-3">
                    <div>{member.user.name}</div>
                    <div className="text-xs text-muted">{member.user.email}</div>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {member.platforms.length
                        ? member.platforms.map((id) => <Badge key={id}>{platformLabel(id)}</Badge>)
                        : "—"}
                    </div>
                  </td>
                  <td>{member.appliedRelease?.label ?? "—"}</td>
                  <td>{member.lastCheckInAt ? formatWhen(member.lastCheckInAt) : "never"}</td>
                  <td className="max-w-[12rem] truncate text-xs">
                    {member.lastWorkspace || (member.workspaceMatchers[0] ?? "—")}
                  </td>
                  <td>{member.writeConsentAt ? "Granted" : "No"}</td>
                  <td>
                    <span className={member.compliance === "DRIFTED" ? "text-danger" : member.compliance === "FOLLOWING" ? "text-sage" : "text-muted"}>
                      {COMPLIANCE_LABEL[member.compliance]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {isManager(user) ? (
        <Panel title="Invite link">
          <p className="mb-4 text-sm text-muted">
            Anyone with the link creates an account, picks their tools, and grants write access so
            RuleDeck can keep the live pack on pull and push.
          </p>
          <InviteForm slug={slug} />
          <ol className="mt-6 grid gap-2 text-xs text-muted">
            {project.invites.map((invite) => {
              const revoke = revokeInviteAction.bind(null, slug, invite.id);
              // eslint-disable-next-line react-hooks/purity -- invite expiry is evaluated per request
              const active = !invite.revokedAt && invite.expiresAt.getTime() > Date.now();
              return (
                <li key={invite.id} className="flex items-center justify-between gap-3 border-t border-line pt-2">
                  <span>
                    {invite.createdBy.name} · {invite.usedCount}/{invite.maxUses} used · expires {formatWhen(invite.expiresAt)}
                    {active ? "" : " · inactive"}
                  </span>
                  {active ? (
                    <form action={revoke}>
                      <button className="text-danger hover:underline" type="submit">
                        Revoke
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Panel>
      ) : null}
    </div>
  );
}
