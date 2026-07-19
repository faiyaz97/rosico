import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";

import { AppShell } from "@/components/app-shell";
import { getGroupAccess, getOptionalActor } from "@/lib/server/authorization";
import { listGroups } from "@/lib/server/groups";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const [actor, cookieStore, headerStore] = await Promise.all([
    getOptionalActor(),
    cookies(),
    headers()
  ]);
  const pathname = headerStore.get("x-rosica-pathname") ?? "";
  const groupId = pathname.match(
    /^\/app\/groups\/([0-9a-f-]{36})(?:\/|$)/i
  )?.[1];
  const memberGroups = actor ? await listGroups() : [];
  let selectedGroup:
    { id: string; name: string; description?: string | null } | undefined;
  let canManageGroup = false;

  if (groupId) {
    try {
      const access = await getGroupAccess(groupId);
      selectedGroup = access.group;
      canManageGroup = access.canManage;
    } catch {
      notFound();
    }
  } else {
    const lastGroupId = cookieStore.get("rosica_last_group")?.value;
    selectedGroup =
      memberGroups.find((group) => group.id === lastGroupId) ?? memberGroups[0];
    canManageGroup = Boolean(selectedGroup);
  }

  const shellGroups = selectedGroup
    ? [
        ...memberGroups,
        ...(memberGroups.some((group) => group.id === selectedGroup.id)
          ? []
          : [selectedGroup])
      ]
    : memberGroups;

  return (
    <AppShell
      groups={shellGroups.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description
      }))}
      selectedGroup={selectedGroup}
      canManageGroup={canManageGroup}
      canManageGroups={Boolean(actor)}
      account={
        actor
          ? {
              name: actor.profile.displayName,
              imagePath: actor.profile.imagePath
            }
          : undefined
      }
    >
      {children}
    </AppShell>
  );
}
