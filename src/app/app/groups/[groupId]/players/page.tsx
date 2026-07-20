import { Plus } from "lucide-react";
import { listPlayers } from "@/lib/server/players";
import { getGroupAccess } from "@/lib/server/authorization";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { PlayerList } from "@/components/player-list";

export default async function PlayersPage({
  params
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [players, access] = await Promise.all([
    listPlayers(groupId),
    getGroupAccess(groupId)
  ]);
  return (
    <div className="app-content">
      <PageHeader
        title="Players"
        description="Player profiles belong to this group and do not need user accounts."
        action={
          access.canManage ? (
            <ButtonLink href={`/app/groups/${groupId}/players/new`}>
              <Plus size={18} /> Add player
            </ButtonLink>
          ) : undefined
        }
      />
      {players.length ? (
        <PlayerList
          groupId={groupId}
          players={players.map((player) => ({
            id: player.id,
            displayName: player.displayName,
            imagePath: player.imagePath,
            archived: Boolean(player.archivedAt)
          }))}
        />
      ) : (
        <EmptyState
          title="No players yet"
          description="Add player profiles before recording a result."
          action={
            access.canManage ? (
              <ButtonLink href={`/app/groups/${groupId}/players/new`}>
                <Plus size={18} /> Add player
              </ButtonLink>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
