import Link from "next/link";
import { Plus } from "lucide-react";
import { getCompetitionGameSetup } from "@/lib/server/games";
import { listTournaments } from "@/lib/server/tournaments";
import { CompetitionTabs } from "@/components/context-tabs";
import { getGroupAccess } from "@/lib/server/authorization";
import {
  ButtonLink,
  EmptyState,
  PageHeader,
  Segmented,
  Status
} from "@/components/ui";

export default async function TournamentListPage({
  params
}: {
  params: Promise<{ groupId: string; competitionId: string }>;
}) {
  const { groupId, competitionId } = await params;
  const [setup, tournaments, access] = await Promise.all([
    getCompetitionGameSetup(groupId, competitionId),
    listTournaments(groupId, competitionId),
    getGroupAccess(groupId)
  ]);
  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/competitions/${competitionId}`}
        backLabel={setup.competition.name}
        title={`${setup.competition.name} tournaments`}
        description="Run a reliable knockout bracket or round-robin league."
        action={
          access.canManage ? (
            <ButtonLink
              href={`/app/groups/${groupId}/competitions/${competitionId}/tournaments/new`}
            >
              <Plus size={18} /> Create tournament
            </ButtonLink>
          ) : undefined
        }
      />
      <CompetitionTabs
        groupId={groupId}
        competitionId={competitionId}
        active="Tournaments"
      />
      <div className="filter-bar">
        <Segmented
          label="Status"
          options={["All", "Active", "Draft", "Completed"]}
          active="All"
        />
        <span className="active-period">{tournaments.length} tournaments</span>
      </div>
      {tournaments.length ? (
        <div className="cards-grid">
          {tournaments.map((item) => (
            <Link
              className="surface surface-pad"
              href={`/app/groups/${groupId}/competitions/${competitionId}/tournaments/${item.id}`}
              key={item.id}
            >
              <Status
                tone={
                  item.status === "ACTIVE"
                    ? "success"
                    : item.status === "DRAFT"
                      ? "warning"
                      : "neutral"
                }
              >
                {item.status.toLowerCase()}
              </Status>
              <h2 style={{ margin: "15px 0 4px" }}>{item.name}</h2>
              <p>
                {item.type === "ELIMINATION"
                  ? `Single elimination - Best of ${item.bestOf}`
                  : `League - ${item.winPoints}/${item.drawPoints}/${item.lossPoints} points`}
              </p>
              <small>
                Starts{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeZone: "Europe/Rome"
                }).format(item.startsAt)}
              </small>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No tournaments yet"
          description="Create a bracket or league using active players in this competition."
          action={
            access.canManage ? (
              <ButtonLink
                href={`/app/groups/${groupId}/competitions/${competitionId}/tournaments/new`}
              >
                <Plus size={18} /> Create tournament
              </ButtonLink>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
