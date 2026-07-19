import { PlayerEditForm } from "@/components/player-edit-form";
import { PageHeader } from "@/components/ui";
import { requireGroupAdmin } from "@/lib/server/authorization";

export default async function NewPlayerPage({
  params
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  await requireGroupAdmin(groupId);
  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/players`}
        backLabel="Players"
        eyebrow="New player"
        title="Add a player"
        description="This creates a group-only player profile. It is not a login account."
      />
      <PlayerEditForm groupId={groupId} />
    </div>
  );
}
