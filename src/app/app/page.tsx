import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { listGroups } from "@/lib/server/groups";

export const metadata = { title: "Home" };

export default async function DashboardPage() {
  const [groups, cookieStore] = await Promise.all([listGroups(), cookies()]);
  const lastGroupId = cookieStore.get("rosica_last_group")?.value;
  const current = groups.find((group) => group.id === lastGroupId) ?? groups[0];

  if (current) redirect(`/app/groups/${current.id}`);

  return (
    <div className="app-content">
      <PageHeader
        title="Welcome to Rosica"
        description="Create a group to start adding players, competitions and results."
      />
      <EmptyState
        title="Create your first group"
        description="Groups keep every player, competition and result safely separated."
        action={
          <ButtonLink href="/app/groups/new">
            <Plus size={18} /> Create group
          </ButtonLink>
        }
      />
    </div>
  );
}
