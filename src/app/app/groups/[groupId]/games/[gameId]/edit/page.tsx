import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { RecordResultForm } from "@/components/record-result-form";
import { PageHeader } from "@/components/ui";
import { APPLICATION_TIME_ZONE } from "@/lib/domain";
import { requireGroupAdmin } from "@/lib/server/authorization";
import { getCompetitionGameSetup, getGame } from "@/lib/server/games";

export default async function EditGamePage({
  params
}: {
  params: Promise<{ groupId: string; gameId: string }>;
}) {
  const { groupId, gameId } = await params;
  await requireGroupAdmin(groupId);
  const game = await getGame(groupId, gameId);
  const setup = await getCompetitionGameSetup(groupId, game.competitionId, {
    includeArchivedFormatId: game.formatId,
    pinnedRuleVersionId: game.ruleVersionId
  });
  const currentPlayers = [...game.sideA, ...game.sideB];
  const selectablePlayers = [
    ...setup.players,
    ...currentPlayers
      .filter(
        (player) =>
          !setup.players.some((candidate) => candidate.id === player.playerId)
      )
      .map((player) => ({
        id: player.playerId,
        displayName: player.displayName
      }))
  ];
  const tournamentHref = game.tournament
    ? `/app/groups/${groupId}/competitions/${game.tournament.competitionId}/tournaments/${game.tournament.tournamentId}`
    : undefined;
  const cancelHref = tournamentHref ?? `/app/groups/${groupId}/games/${gameId}`;

  return (
    <div className="app-content">
      <PageHeader
        backHref={cancelHref}
        backLabel={game.tournament ? "Tournament" : "Match details"}
        eyebrow="Result correction"
        title="Edit result"
        description={
          game.tournament
            ? "Correct this game in the series. Rosica will recalculate the bracket safely."
            : "The existing details are prefilled. Saving creates an audit revision and updates rankings."
        }
      />
      <RecordResultForm
        groupId={groupId}
        setups={[
          {
            id: setup.competition.id,
            name: setup.competition.name,
            rule: {
              scoreType: setup.rule.scoreType,
              allowsDraws: setup.rule.allowsDraws
            },
            formats: setup.formats,
            players: selectablePlayers,
            scoreValues: setup.scoreValues.map((value) => value.value)
          }
        ]}
        initialCompetitionId={game.competitionId}
        initialFormatId={game.formatId}
        correctionGameId={game.id}
        expectedUpdatedAt={game.updatedAt.toISOString()}
        initialSideA={game.sideA.map((player) => ({
          id: player.playerId,
          displayName: player.displayName
        }))}
        initialSideB={game.sideB.map((player) => ({
          id: player.playerId,
          displayName: player.displayName
        }))}
        initialScoreA={game.scoreType === "RESULT" ? "" : game.scoreA}
        initialScoreB={game.scoreType === "RESULT" ? "" : game.scoreB}
        initialResult={game.scoreType === "RESULT" ? game.outcome : ""}
        initialPlayedAt={format(
          toZonedTime(game.playedAt, APPLICATION_TIME_ZONE),
          "yyyy-MM-dd'T'HH:mm"
        )}
        initialLocation={game.location ?? ""}
        fixedSideA={
          game.tournament
            ? game.sideA.map((player) => ({
                id: player.playerId,
                displayName: player.displayName
              }))
            : undefined
        }
        fixedSideB={
          game.tournament
            ? game.sideB.map((player) => ({
                id: player.playerId,
                displayName: player.displayName
              }))
            : undefined
        }
        cancelHref={cancelHref}
      />
    </div>
  );
}
