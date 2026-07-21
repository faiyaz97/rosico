import { Pencil, Share2 } from "lucide-react";
import Link from "next/link";

import { ButtonLink, PageHeader, Stat, Status } from "@/components/ui";
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

  const tournamentHref = game.tournament
    ? `/app/groups/${groupId}/competitions/${game.tournament.competitionId}/tournaments/${game.tournament.tournamentId}#match-${game.tournamentMatchId}`
    : undefined;
  const canEdit =
    access.canManage &&
    (!game.tournament || game.tournament.status === "ACTIVE");

  return (
    <div className="app-content">
      <PageHeader
        backHref={tournamentHref ?? `/app/groups/${groupId}/games`}
        backLabel={game.tournament?.name ?? "Match history"}
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
              {canEdit && (
                <ButtonLink
                  href={`/app/groups/${groupId}/games/${gameId}/edit`}
                  variant="secondary"
                >
                  <Pencil size={16} /> Edit
                </ButtonLink>
              )}
              <ButtonLink href={`/app/groups/${groupId}/games/${gameId}/share`}>
                <Share2 size={16} /> Share result
              </ButtonLink>
            </>
          ) : undefined
        }
      />
      {game.tournament && (
        <Link className="tournament-result-context" href={tournamentHref!}>
          <span>
            Tournament ·{" "}
            {game.tournament.type === "ELIMINATION" &&
            game.tournament.nextMatchId === null
              ? "Final"
              : `Round ${game.tournament.round}`}
          </span>
          <strong>{game.tournament.name}</strong>
          <Status
            tone={
              game.tournament.status === "ACTIVE"
                ? "success"
                : game.tournament.status === "CANCELLED"
                  ? "danger"
                  : "neutral"
            }
          >
            {game.tournament.status === "ACTIVE"
              ? "Editable"
              : game.tournament.status === "COMPLETED"
                ? "Confirmed"
                : game.tournament.status === "CANCELLED"
                  ? "Cancelled · locked"
                  : "Locked"}
          </Status>
        </Link>
      )}
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
