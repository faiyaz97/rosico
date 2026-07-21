import { getCompetitionGameSetup, listMatchHistory } from "@/lib/server/games";
import { CompetitionTabs } from "@/components/context-tabs";
import { FilterSelect } from "@/components/filter-select";
import { gameForDisplay } from "@/components/presentation";
import { EmptyState, MatchRow, PageHeader } from "@/components/ui";

export default async function CompetitionGamesPage({
  params,
  searchParams
}: {
  params: Promise<{ groupId: string; competitionId: string }>;
  searchParams: Promise<{ format?: string }>;
}) {
  const { groupId, competitionId } = await params;
  const query = await searchParams;
  const [setup, games] = await Promise.all([
    getCompetitionGameSetup(groupId, competitionId),
    listMatchHistory(groupId, competitionId)
  ]);
  const selectedFormat = setup.formats.find(
    (format) => format.id === query.format
  );
  const visibleGames = selectedFormat
    ? games.filter((game) => game.formatId === selectedFormat.id)
    : games;
  const baseHref = `/app/groups/${groupId}/competitions/${competitionId}/games`;
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
        <FilterSelect
          label="Game format"
          active={selectedFormat?.label ?? "All formats"}
          options={[
            { label: "All formats", href: baseHref },
            ...setup.formats.map((format) => ({
              label: format.label,
              href: `${baseHref}?format=${format.id}`
            }))
          ]}
        />
        <span className="active-period">
          {visibleGames.length} recorded matches
        </span>
      </div>
      {visibleGames.length ? (
        <div className="match-list">
          {visibleGames.map((game) => (
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
