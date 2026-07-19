import { getCompetitionGameSetup, listGames } from "@/lib/server/games";
import { CompetitionTabs } from "@/components/context-tabs";
import { gameForDisplay } from "@/components/presentation";
import { EmptyState, MatchRow, PageHeader, Segmented } from "@/components/ui";

export default async function CompetitionGamesPage({
  params
}: {
  params: Promise<{ groupId: string; competitionId: string }>;
}) {
  const { groupId, competitionId } = await params;
  const [setup, games] = await Promise.all([
    getCompetitionGameSetup(groupId, competitionId),
    listGames(groupId, competitionId)
  ]);
  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/competitions/${competitionId}`}
        backLabel={setup.competition.name}
        title={`${setup.competition.name} games`}
        description="Results in every supported format, newest first."
      />
      <CompetitionTabs
        groupId={groupId}
        competitionId={competitionId}
        active="Games"
      />
      <div className="filter-bar">
        <Segmented
          label="Format"
          options={[
            "All formats",
            ...setup.formats.map((format) => format.label)
          ]}
          active="All formats"
        />
        <span className="active-period">{games.length} recorded games</span>
      </div>
      {games.length ? (
        <div className="match-list">
          {games.map((game) => (
            <MatchRow
              groupId={groupId}
              key={game.id}
              game={gameForDisplay(game, {
                competition: setup.competition.name,
                format: setup.formats.find(
                  (format) => format.id === game.formatId
                )?.label
              })}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No games yet"
          description="Record the first result for this competition."
        />
      )}
    </div>
  );
}
