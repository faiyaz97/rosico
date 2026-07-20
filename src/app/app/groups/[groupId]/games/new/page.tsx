import Link from "next/link";

import { RecordResultForm } from "@/components/record-result-form";
import { TournamentSeriesResultForm } from "@/components/tournament-series-result-form";
import { EmptyState, PageHeader } from "@/components/ui";
import { listCompetitions } from "@/lib/server/competitions";
import { getCompetitionGameSetup } from "@/lib/server/games";
import { getTournament } from "@/lib/server/tournaments";
import { requireGroupAdmin } from "@/lib/server/authorization";

export default async function RecordResultPage({
  params,
  searchParams
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{
    competition?: string;
    tournament?: string;
    match?: string;
  }>;
}) {
  const { groupId } = await params;
  await requireGroupAdmin(groupId);
  const query = await searchParams;
  const tournament = query.tournament
    ? await getTournament(groupId, query.tournament, query.competition)
    : null;
  const competitions = await listCompetitions(groupId);
  if (!competitions.length) {
    return (
      <div className="app-content">
        <PageHeader
          backHref={`/app/groups/${groupId}/games`}
          backLabel="Match history"
          title="Record a result"
        />
        <EmptyState
          title="Add a competition first"
          description="Results need a competition with scoring rules and at least one format."
          action={
            <Link
              className="button button-primary"
              href={`/app/groups/${groupId}/competitions/catalog`}
            >
              Add competition
            </Link>
          }
        />
      </div>
    );
  }

  const setups = await Promise.all(
    competitions.map(async (competition) => {
      const setup = await getCompetitionGameSetup(groupId, competition.id, {
        includeArchivedFormatId:
          tournament?.tournament.competitionId === competition.id
            ? tournament.tournament.formatId
            : undefined,
        pinnedRuleVersionId:
          tournament?.tournament.competitionId === competition.id
            ? tournament.tournament.ruleVersionId
            : undefined
      });
      return {
        id: competition.id,
        name: competition.name,
        rule: {
          scoreType: setup.rule.scoreType,
          allowsDraws: setup.rule.allowsDraws,
          winnerDirection: setup.rule.winnerDirection
        },
        formats: setup.formats.map((format) => ({
          id: format.id,
          label: format.label,
          playersPerSide: format.playersPerSide
        })),
        players: setup.players.map((player) => ({
          id: player.id,
          displayName: player.displayName
        })),
        scoreValues: setup.scoreValues.map((value) => value.value)
      };
    })
  );
  const initialCompetitionId = setups.some(
    (setup) => setup.id === query.competition
  )
    ? query.competition!
    : setups[0]!.id;
  const tournamentMatch = tournament?.matches.find(
    (match) => match.id === query.match
  );
  const sideAEntry = tournamentMatch?.sideAEntryId
    ? tournament?.entries.find(
        (entry) => entry.id === tournamentMatch.sideAEntryId
      )
    : null;
  const sideBEntry = tournamentMatch?.sideBEntryId
    ? tournament?.entries.find(
        (entry) => entry.id === tournamentMatch.sideBEntryId
      )
    : null;
  const backHref = tournament
    ? `/app/groups/${groupId}/competitions/${tournament.tournament.competitionId}/tournaments/${tournament.tournament.id}`
    : `/app/groups/${groupId}/games`;
  const tournamentSetup = tournament
    ? setups.find((setup) => setup.id === tournament.tournament.competitionId)
    : undefined;
  const tournamentFormat = tournamentSetup?.formats.find(
    (format) => format.id === tournament?.tournament.formatId
  );
  const isEliminationSeries =
    tournament?.tournament.type === "ELIMINATION" &&
    tournamentMatch &&
    tournament.tournament.bestOf &&
    sideAEntry &&
    sideBEntry &&
    tournamentSetup &&
    tournamentFormat;

  return (
    <div className="app-content">
      <PageHeader
        backHref={backHref}
        backLabel={tournament ? tournament.tournament.name : "Match history"}
        eyebrow="New result"
        title={
          isEliminationSeries ? "Record series results" : "Record a result"
        }
        description={
          isEliminationSeries
            ? "Add one or more games from this series. Rosica stops the series as soon as a side reaches the required wins."
            : "Choose the players and final result. Rosica validates it and updates the ranking."
        }
      />
      {isEliminationSeries ? (
        <TournamentSeriesResultForm
          groupId={groupId}
          competitionId={tournamentSetup.id}
          competitionName={tournamentSetup.name}
          formatId={tournamentFormat.id}
          formatLabel={tournamentFormat.label}
          tournamentMatchId={tournamentMatch.id}
          bestOf={tournament.tournament.bestOf!}
          sideAWins={tournamentMatch.sideAWins}
          sideBWins={tournamentMatch.sideBWins}
          sideA={sideAEntry.members.map((player) => ({
            id: player.playerId,
            displayName: player.displayName
          }))}
          sideB={sideBEntry.members.map((player) => ({
            id: player.playerId,
            displayName: player.displayName
          }))}
          rule={tournamentSetup.rule}
          orderedValues={tournamentSetup.scoreValues}
          cancelHref={backHref}
        />
      ) : (
        <RecordResultForm
          groupId={groupId}
          setups={setups}
          initialCompetitionId={
            tournament?.tournament.competitionId ?? initialCompetitionId
          }
          initialFormatId={tournament?.tournament.formatId}
          tournamentMatchId={tournamentMatch?.id}
          fixedSideA={sideAEntry?.members.map((player) => ({
            id: player.playerId,
            displayName: player.displayName
          }))}
          fixedSideB={sideBEntry?.members.map((player) => ({
            id: player.playerId,
            displayName: player.displayName
          }))}
          cancelHref={backHref}
        />
      )}
    </div>
  );
}
