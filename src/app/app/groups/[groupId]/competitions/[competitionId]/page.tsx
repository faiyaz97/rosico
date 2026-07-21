import Link from "next/link";
import { Settings } from "lucide-react";
import { getCompetitionGameSetup, listMatchHistory } from "@/lib/server/games";
import { getCompetitionRanking } from "@/lib/server/rankings";
import { listTournaments } from "@/lib/server/tournaments";
import { CompetitionTabs } from "@/components/context-tabs";
import { gameForDisplay } from "@/components/presentation";
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
import { getGroupAccess } from "@/lib/server/authorization";

export default async function CompetitionOverviewPage({
  params
}: {
  params: Promise<{ groupId: string; competitionId: string }>;
}) {
  const { groupId, competitionId } = await params;
  const [setup, games, ranking, tournaments, access] = await Promise.all([
    getCompetitionGameSetup(groupId, competitionId),
    listMatchHistory(groupId, competitionId),
    getCompetitionRanking({ groupId, competitionId }),
    listTournaments(groupId, competitionId),
    getGroupAccess(groupId)
  ]);
  const { competition, rule, formats } = setup;
  const scoringDescription =
    rule.scoreType === "RESULT"
      ? "Winner selected directly"
      : `${rule.scoreType === "NUMERIC" ? "Numeric score" : "Ordered values"} - ${
          rule.winnerDirection === "HIGHER_WINS"
            ? "Higher score wins"
            : "Lower score wins"
        }`;
  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/competitions`}
        backLabel="Competitions"
        eyebrow="Competition"
        title={competition.name}
        description={`${scoringDescription} - Draws ${rule.allowsDraws ? "allowed" : "disabled"}`}
        action={
          access.canManage ? (
            <ButtonLink
              href={`/app/groups/${groupId}/competitions/${competitionId}/settings`}
              variant="secondary"
            >
              <Settings size={16} /> Configure
            </ButtonLink>
          ) : undefined
        }
      />
      <CompetitionTabs
        groupId={groupId}
        competitionId={competitionId}
        active="Overview"
      />
      <div className="stats-grid">
        <Stat label="Matches" value={games.length} />
        <Stat label="Players" value={ranking.rows.length} />
        <Stat
          label="Formats"
          value={formats.length}
          detail={formats.map((format) => format.label).join(", ")}
        />
        <Stat label="Leader" value={ranking.rows[0]?.displayName ?? "-"} />
      </div>
      <div className="split-grid">
        <Section
          title="Recent games"
          action={
            <Link
              className="text-link"
              href={`/app/groups/${groupId}/competitions/${competitionId}/games`}
            >
              View all
            </Link>
          }
        >
          {games.length ? (
            <div className="match-list">
              {games.slice(0, 5).map((game) => (
                <MatchRow
                  groupId={groupId}
                  key={game.id}
                  game={gameForDisplay(game, {
                    competition: competition.name,
                    format: formats.find(
                      (format) => format.id === game.formatId
                    )?.label
                  })}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No games yet"
              description="Record a result to begin this competition's history."
            />
          )}
        </Section>
        <Section
          title="Top players"
          description="All time - All formats"
          action={
            <Link
              className="text-link"
              href={`/app/groups/${groupId}/competitions/${competitionId}/ranking`}
            >
              Full ranking
            </Link>
          }
        >
          {ranking.rows.length ? (
            <CompactRankingTable
              rows={ranking.rows.slice(0, 5)}
              playerBaseHref={`/app/groups/${groupId}/players`}
            />
          ) : (
            <EmptyState
              title="No ranking yet"
              description="Players are ranked after their first completed game."
            />
          )}
        </Section>
      </div>
      <Section title="Active tournaments">
        {tournaments.some((item) => item.status === "ACTIVE") ? (
          <div className="cards-grid">
            {tournaments
              .filter((item) => item.status === "ACTIVE")
              .map((item) => (
                <Link
                  className="surface surface-pad"
                  href={`/app/groups/${groupId}/competitions/${competitionId}/tournaments/${item.id}`}
                  key={item.id}
                >
                  <Status tone={item.winnerEntryId ? "warning" : "success"}>
                    {item.winnerEntryId
                      ? "Awaiting confirmation"
                      : "In progress"}
                  </Status>
                  <h2 style={{ margin: "14px 0 5px" }}>{item.name}</h2>
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
            description="Create a bracket or league for this competition."
          />
        )}
      </Section>
    </div>
  );
}
