import Link from "next/link";
import { Settings } from "lucide-react";
import { listCompetitions } from "@/lib/server/competitions";
import { listGames } from "@/lib/server/games";
import { getGroupOverview } from "@/lib/server/groups";
import { listPlayers } from "@/lib/server/players";
import { getGroupRanking } from "@/lib/server/rankings";
import { listTournaments } from "@/lib/server/tournaments";
import { gameForDisplay } from "@/components/presentation";
import { CompetitionRail } from "@/components/competition-rail";
import { OverviewRankingFilter } from "@/components/overview-ranking-filter";
import {
  ButtonLink,
  CompactRankingTable,
  EmptyState,
  MatchRow,
  PageHeader,
  Section,
  Stat,
  Status
} from "@/components/ui";

export default async function GroupOverviewPage({
  params,
  searchParams
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ leaders?: string }>;
}) {
  const { groupId } = await params;
  const filters = await searchParams;
  const [
    { group, adminCount, canManage },
    players,
    competitions,
    games,
    tournaments
  ] = await Promise.all([
    getGroupOverview(groupId),
    listPlayers(groupId),
    listCompetitions(groupId),
    listGames(groupId),
    listTournaments(groupId)
  ]);
  const selectedCompetition =
    competitions.find((competition) => competition.id === filters.leaders) ??
    null;
  const ranking = (
    await getGroupRanking({
      groupId,
      competitionId: selectedCompetition?.id
    })
  ).rows;
  const competitionNames = new Map(
    competitions.map((competition) => [competition.id, competition.name])
  );
  return (
    <div className="app-content">
      <div className="desktop-group-header">
        <PageHeader
          eyebrow="Group"
          title={group.name}
          description={group.description || "Your competition group."}
          action={
            canManage ? (
              <ButtonLink
                href={`/app/groups/${groupId}/settings`}
                variant="secondary"
                className="compact-settings-action"
              >
                <Settings size={17} /> <span>Group settings</span>
              </ButtonLink>
            ) : undefined
          }
        />
      </div>
      <div className="stats-grid">
        <Stat
          label="Players"
          value={players.filter((player) => !player.archivedAt).length}
        />
        <Stat label="Competitions" value={competitions.length} />
        <Stat label="Games" value={games.length} />
        <Stat label="Admins" value={adminCount} />
      </div>
      <Section
        title="Competitions"
        action={
          <Link
            className="text-link"
            href={`/app/groups/${groupId}/competitions`}
          >
            View all
          </Link>
        }
      >
        {competitions.length ? (
          <CompetitionRail
            groupId={groupId}
            competitions={competitions.map((competition) => ({
              id: competition.id,
              name: competition.name,
              imagePath: competition.imagePath
            }))}
          />
        ) : (
          <EmptyState
            title="No competitions yet"
            description="Add a competition to begin recording results."
          />
        )}
      </Section>
      <div className="split-grid">
        <Section
          title="Recent games"
          action={
            <Link className="text-link" href={`/app/groups/${groupId}/games`}>
              Match history
            </Link>
          }
        >
          {games.length ? (
            <div className="match-list">
              {games.slice(0, 4).map((game) => (
                <MatchRow
                  groupId={groupId}
                  key={game.id}
                  game={gameForDisplay(game, {
                    competition: competitionNames.get(game.competitionId)
                  })}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No games yet"
              description="Record the first result to begin this group's history."
            />
          )}
        </Section>
        <Section
          title="Top players"
          description={`All time · ${selectedCompetition?.name ?? "All competitions"}`}
          action={
            <div className="overview-ranking-actions">
              <OverviewRankingFilter
                competitions={competitions}
                value={selectedCompetition?.id ?? "all"}
              />
              {selectedCompetition && (
                <Link
                  className="text-link"
                  href={`/app/groups/${groupId}/competitions/${selectedCompetition.id}/ranking`}
                >
                  Full ranking
                </Link>
              )}
            </div>
          }
        >
          {ranking.length ? (
            <CompactRankingTable
              rows={ranking.slice(0, 3)}
              playerBaseHref={`/app/groups/${groupId}/players`}
            />
          ) : (
            <EmptyState
              title="No ranking yet"
              description="Complete a game to place players in the ranking."
            />
          )}
        </Section>
      </div>
      <Section
        title="Active tournaments"
        action={
          <Link
            className="text-link"
            href={`/app/groups/${groupId}/tournaments`}
          >
            View all tournaments
          </Link>
        }
      >
        {tournaments.some((item) => item.status === "ACTIVE") ? (
          <div className="cards-grid">
            {tournaments
              .filter((item) => item.status === "ACTIVE")
              .map((item) => (
                <Link
                  className="surface surface-pad"
                  href={`/app/groups/${groupId}/competitions/${item.competitionId}/tournaments/${item.id}`}
                  key={item.id}
                >
                  <Status tone="success">In progress</Status>
                  <h2 style={{ margin: "15px 0 4px" }}>{item.name}</h2>
                  <p>
                    {item.type === "ELIMINATION"
                      ? "Single elimination"
                      : "Round robin league"}
                  </p>
                </Link>
              ))}
          </div>
        ) : (
          <EmptyState
            title="No active tournaments"
            description="Create a tournament from one of this group's competitions."
          />
        )}
      </Section>
    </div>
  );
}
