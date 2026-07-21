import { listCompetitions } from "@/lib/server/competitions";
import { listMatchHistory } from "@/lib/server/games";
import { gameForDisplay } from "@/components/presentation";
import { FilterSelect } from "@/components/filter-select";
import { EmptyState, MatchRow, PageHeader } from "@/components/ui";

export default async function GamesPage({
  params,
  searchParams
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ competition?: string }>;
}) {
  const { groupId } = await params;
  const query = await searchParams;
  const competitions = await listCompetitions(groupId, true);
  const selectedCompetition = competitions.find(
    (competition) => competition.id === query.competition
  );
  const games = await listMatchHistory(groupId, selectedCompetition?.id);
  const names = new Map(
    competitions.map((competition) => [competition.id, competition.name])
  );
  return (
    <div className="app-content">
      <PageHeader
        title="Match history"
        description="Every recorded match across this group, newest first."
      />
      <div className="filter-bar">
        <FilterSelect
          label="Competition"
          options={[
            {
              label: "All competitions",
              href: `/app/groups/${groupId}/games`
            },
            ...competitions.map((competition) => ({
              label: competition.name,
              href: `/app/groups/${groupId}/games?competition=${competition.id}`
            }))
          ]}
          active={selectedCompetition?.name ?? "All competitions"}
        />
        <span className="active-period">{games.length} recorded matches</span>
      </div>
      {games.length ? (
        <div className="match-list">
          {games.map((game) => (
            <MatchRow
              groupId={groupId}
              key={game.id}
              game={gameForDisplay(game, {
                competition: names.get(game.competitionId)
              })}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No games yet"
          description="Choose a competition and record the first result."
        />
      )}
    </div>
  );
}
