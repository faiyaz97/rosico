import Link from "next/link";
import { Plus } from "lucide-react";
import { FilterSelect } from "@/components/filter-select";
import { getCompetitionGameSetup } from "@/lib/server/games";
import { listTournaments } from "@/lib/server/tournaments";
import { CompetitionTabs } from "@/components/context-tabs";
import { getGroupAccess } from "@/lib/server/authorization";
import {
  parseTournamentStatus,
  tournamentStatusOptions
} from "@/lib/tournament-status";
import { ButtonLink, EmptyState, PageHeader, Status } from "@/components/ui";

export default async function TournamentListPage({
  params,
  searchParams
}: {
  params: Promise<{ groupId: string; competitionId: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { groupId, competitionId } = await params;
  const query = await searchParams;
  const status = parseTournamentStatus(query.status);
  const baseHref = `/app/groups/${groupId}/competitions/${competitionId}/tournaments`;
  const [setup, tournaments, access] = await Promise.all([
    getCompetitionGameSetup(groupId, competitionId),
    listTournaments(
      groupId,
      competitionId,
      status === "all" ? undefined : status
    ),
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
        <FilterSelect
          label="Status"
          options={tournamentStatusOptions(baseHref)}
          active={status.charAt(0).toUpperCase() + status.slice(1)}
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
                    ? item.winnerEntryId
                      ? "warning"
                      : "success"
                    : item.status === "DRAFT"
                      ? "warning"
                      : "neutral"
                }
              >
                {item.status === "ACTIVE" && item.winnerEntryId
                  ? "awaiting confirmation"
                  : item.status.toLowerCase()}
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
          title={
            status === "all" ? "No tournaments yet" : `No ${status} tournaments`
          }
          description={
            status === "all"
              ? "Create a bracket or league using active players in this competition."
              : "Choose another status to see this competition's tournaments."
          }
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
