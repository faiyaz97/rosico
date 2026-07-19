import { Pencil, Share2 } from "lucide-react";

import { ButtonLink, PageHeader, Stat } from "@/components/ui";
import { listCompetitions, listGroupFormats } from "@/lib/server/competitions";
import { getGame } from "@/lib/server/games";
import { getGroupAccess } from "@/lib/server/authorization";

export default async function GameDetailPage({
  params
}: {
  params: Promise<{ groupId: string; gameId: string }>;
}) {
  const { groupId, gameId } = await params;
  const [game, competitions, formats, access] = await Promise.all([
    getGame(groupId, gameId),
    listCompetitions(groupId, true),
    listGroupFormats(groupId),
    getGroupAccess(groupId)
  ]);

  const competition = competitions.find(
    (item) => item.id === game.competitionId
  );
  const format = formats.find((item) => item.id === game.formatId);
  const sideA = game.sideA.map((player) => player.displayName).join(" & ");
  const sideB = game.sideB.map((player) => player.displayName).join(" & ");
  const winner =
    game.outcome === "DRAW" ? "Draw" : game.outcome === "A" ? sideA : sideB;

  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/games`}
        backLabel="Match history"
        eyebrow={competition?.name ?? "Match"}
        title={`${sideA} vs ${sideB}`}
        description={new Intl.DateTimeFormat("en-GB", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: "Europe/Rome"
        }).format(game.playedAt)}
        action={
          access.canManage ? (
            <>
              <ButtonLink
                href={`/app/groups/${groupId}/games/${gameId}/edit`}
                variant="secondary"
              >
                <Pencil size={16} /> Edit
              </ButtonLink>
              <ButtonLink href={`/app/groups/${groupId}/games/${gameId}/share`}>
                <Share2 size={16} /> Share result
              </ButtonLink>
            </>
          ) : undefined
        }
      />
      <section className="result-detail surface">
        <div>
          <span>{sideA}</span>
          <strong>{game.scoreA}</strong>
        </div>
        <i>:</i>
        <div>
          <span>{sideB}</span>
          <strong>{game.scoreB}</strong>
        </div>
      </section>
      <div className="stats-grid">
        <Stat label="Winner" value={winner} />
        <Stat label="Format" value={format?.label ?? "Match"} />
        <Stat label="Location" value={game.location || "Not specified"} />
        <Stat
          label="Recorded"
          value={new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeZone: "Europe/Rome"
          }).format(game.createdAt)}
        />
      </div>
    </div>
  );
}
