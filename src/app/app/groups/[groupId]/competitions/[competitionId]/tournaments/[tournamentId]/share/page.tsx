import { getGroupSettings } from "@/lib/server/groups";
import { getCompetitionGameSetup } from "@/lib/server/games";
import { getTournament } from "@/lib/server/tournaments";
import { ShareResult } from "@/components/share-result";
import { PageHeader } from "@/components/ui";
import { notFound } from "next/navigation";

export default async function ShareTournamentPage({
  params
}: {
  params: Promise<{
    groupId: string;
    competitionId: string;
    tournamentId: string;
  }>;
}) {
  const { groupId, competitionId, tournamentId } = await params;
  const [{ group }, setup, data] = await Promise.all([
    getGroupSettings(groupId),
    getCompetitionGameSetup(groupId, competitionId),
    getTournament(groupId, tournamentId, competitionId)
  ]);
  const winner = data.entries.find(
    (entry) => entry.id === data.tournament.winnerEntryId
  );
  if (data.tournament.status !== "COMPLETED" || !winner) notFound();

  const finalMatch =
    data.tournament.type === "ELIMINATION"
      ? data.matches.reduce<(typeof data.matches)[number] | null>(
          (latest, match) =>
            !latest || match.round > latest.round ? match : latest,
          null
        )
      : null;
  const runnerUpId =
    data.tournament.type === "LEAGUE"
      ? data.standings?.[1]?.entryId
      : finalMatch?.sideAEntryId === winner.id
        ? finalMatch.sideBEntryId
        : finalMatch?.sideAEntryId;
  const runnerUp = data.entries.find((entry) => entry.id === runnerUpId);
  const winnerStanding = data.standings?.find(
    (row) => row.entryId === winner.id
  );
  const runnerUpStanding = data.standings?.find(
    (row) => row.entryId === runnerUp?.id
  );
  const winnerIsSideA = finalMatch?.sideAEntryId === winner.id;
  const scoreA =
    data.tournament.type === "LEAGUE"
      ? String(winnerStanding?.points ?? 0)
      : String(
          winnerIsSideA
            ? (finalMatch?.sideAWins ?? 0)
            : (finalMatch?.sideBWins ?? 0)
        );
  const scoreB =
    data.tournament.type === "LEAGUE"
      ? String(runnerUpStanding?.points ?? 0)
      : String(
          winnerIsSideA
            ? (finalMatch?.sideBWins ?? 0)
            : (finalMatch?.sideAWins ?? 0)
        );
  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/competitions/${competitionId}/tournaments/${tournamentId}`}
        backLabel="Tournament"
        eyebrow="Tournament result"
        title="Share the final standings"
        description="Download a branded summary image without connecting a social account."
      />
      <ShareResult
        data={{
          group: group.name,
          competition: setup.competition.name,
          title: data.tournament.name,
          sideA: winner.name,
          sideB: runnerUp?.name ?? "Tournament field",
          scoreA,
          scoreB,
          result: `${winner.name} are champions`,
          date: new Intl.DateTimeFormat("en-GB", {
            dateStyle: "long",
            timeZone: "Europe/Rome"
          }).format(data.tournament.startsAt)
        }}
      />
    </div>
  );
}
