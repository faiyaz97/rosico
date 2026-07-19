import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { PlayerEditForm } from "@/components/player-edit-form";
import { listPlayers } from "@/lib/server/players";
import { requireGroupAdmin } from "@/lib/server/authorization";

export default async function EditPlayerPage({
  params
}: {
  params: Promise<{ groupId: string; playerId: string }>;
}) {
  const { groupId, playerId } = await params;
  await requireGroupAdmin(groupId);
  const player = (await listPlayers(groupId)).find(
    (item) => item.id === playerId
  );
  if (!player) notFound();

  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/players/${playerId}`}
        backLabel={player.displayName}
        eyebrow="Player"
        title={`Edit ${player.displayName}`}
        description="Player profiles belong only to this group."
      />
      <PlayerEditForm groupId={groupId} player={player} />
    </div>
  );
}
