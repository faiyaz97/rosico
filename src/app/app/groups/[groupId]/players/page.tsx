import Link from "next/link";
import { Archive, Plus } from "lucide-react";
import { listPlayers } from "@/lib/server/players";
import { getGroupAccess } from "@/lib/server/authorization";
import {
  Avatar,
  ButtonLink,
  EmptyState,
  PageHeader,
  Segmented,
  Status
} from "@/components/ui";

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
      <div className="filter-bar">
        <Segmented
          label="Player status"
          options={["Active", "Archived", "All"]}
          active="All"
        />
        <span className="active-period">
          {players.filter((player) => !player.archivedAt).length} active players
        </span>
      </div>
      {players.length ? (
        <div className="entity-list">
          {players.map((player) => (
            <Link
              className="entity-row"
              href={`/app/groups/${groupId}/players/${player.id}`}
              key={player.id}
            >
              <Avatar
                player={{
                  name: player.displayName,
                  imagePath: player.imagePath
                }}
              />
              <span className="entity-row-main">
                <b>{player.displayName}</b>
                <small>
                  {player.archivedAt
                    ? "Kept in historical games and statistics"
                    : "Available for new games and tournaments"}
                </small>
              </span>
              {player.archivedAt ? (
                <Status>
                  <Archive size={12} /> Archived
                </Status>
              ) : (
                <Status tone="success">Active</Status>
              )}
            </Link>
          ))}
        </div>
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
