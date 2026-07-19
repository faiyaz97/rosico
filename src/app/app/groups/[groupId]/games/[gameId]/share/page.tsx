import { getGroupSettings } from "@/lib/server/groups";
import { listCompetitions } from "@/lib/server/competitions";
import { getGame } from "@/lib/server/games";
import { ShareResult } from "@/components/share-result";
import { PageHeader } from "@/components/ui";

export default async function ShareGamePage({
  params
}: {
  params: Promise<{ groupId: string; gameId: string }>;
}) {
  const { groupId, gameId } = await params;
  const [{ group }, competitions, game] = await Promise.all([
    getGroupSettings(groupId),
    listCompetitions(groupId, true),
    getGame(groupId, gameId)
  ]);
  const competition = competitions.find(
    (item) => item.id === game.competitionId
  );
  const sideA = game.sideA.map((player) => player.displayName).join(" & ");
  const sideB = game.sideB.map((player) => player.displayName).join(" & ");
  const winner =
    game.outcome === "DRAW"
      ? "Draw"
      : `${game.outcome === "A" ? sideA : sideB} win`;
  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/games/${gameId}`}
        backLabel="Match details"
        eyebrow="Share result"
        title="Make the score look official"
        description="Preview the branded image, then download it to share anywhere."
      />
      <ShareResult
        data={{
          group: group.name,
          competition: competition?.name ?? "Competition",
          sideA,
          sideB,
          scoreA: game.scoreA,
          scoreB: game.scoreB,
          result: winner,
          date: new Intl.DateTimeFormat("en-GB", {
            dateStyle: "long",
            timeZone: "Europe/Rome"
          }).format(game.playedAt)
        }}
      />
    </div>
  );
}
