import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Share2, Trophy } from "lucide-react";
import { getTournament, startTournament } from "@/lib/server/tournaments";
import { listGames } from "@/lib/server/games";
import { EliminationView, LeagueView } from "@/components/tournament-view";
import {
  ButtonLink,
  EmptyState,
  PageHeader,
  Section,
  Status
} from "@/components/ui";
import { getGroupAccess } from "@/lib/server/authorization";
import { AppError } from "@/lib/server/errors";
import { confirmTournamentResultAction } from "@/app/actions/entities";

async function getTournamentOrNotFound(
  groupId: string,
  tournamentId: string,
  competitionId: string
) {
  try {
    return await getTournament(groupId, tournamentId, competitionId);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}

export default async function TournamentPage({
  params,
  searchParams
}: {
  params: Promise<{
    groupId: string;
    competitionId: string;
    tournamentId: string;
  }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { groupId, competitionId, tournamentId } = await params;
  const query = await searchParams;
  const [data, access, competitionGames] = await Promise.all([
    getTournamentOrNotFound(groupId, tournamentId, competitionId),
    getGroupAccess(groupId),
    listGames(groupId, competitionId)
  ]);
  const { tournament, entries, matches, standings } = data;
  const champion = entries.find(
    (entry) => entry.id === tournament.winnerEntryId
  );
  const matchesWithLegs = matches.map((match) => ({
    ...match,
    legs: competitionGames
      .filter((game) => game.tournamentMatchId === match.id)
      .sort(
        (left, right) =>
          left.createdAt.getTime() - right.createdAt.getTime() ||
          left.id.localeCompare(right.id)
      )
      .map((game) => ({
        id: game.id,
        scoreA: game.scoreA,
        scoreB: game.scoreB,
        outcome: game.outcome,
        href: `/app/groups/${groupId}/games/${game.id}`,
        editHref: `/app/groups/${groupId}/games/${game.id}/edit`
      }))
  }));
  const resultBase = `/app/groups/${groupId}/games/new?competition=${data.tournament.competitionId}&tournament=${tournamentId}`;
  async function start() {
    "use server";
    await startTournament(groupId, tournamentId);
    redirect(
      `/app/groups/${groupId}/competitions/${data.tournament.competitionId}/tournaments/${tournamentId}`
    );
  }
  return (
    <div className="app-content">
      <Link
        className="back-link tournament-back-link"
        href={`/app/groups/${groupId}/competitions/${competitionId}/tournaments`}
      >
        <ArrowLeft size={17} aria-hidden="true" />
        <span>Tournaments</span>
      </Link>
      <div className="tournament-hero">
        <div>
          <Status
            tone={
              tournament.status === "ACTIVE"
                ? champion
                  ? "warning"
                  : "success"
                : tournament.status === "DRAFT"
                  ? "warning"
                  : "neutral"
            }
          >
            {tournament.status === "ACTIVE" && champion
              ? "awaiting confirmation"
              : tournament.status.toLowerCase()}
          </Status>
          <h1>{tournament.name}</h1>
          <p>
            {tournament.type === "ELIMINATION"
              ? `Single elimination - Best of ${tournament.bestOf}`
              : "Round-robin league"}
          </p>
        </div>
        <div className="tournament-meta">
          <div>
            <small>
              <CalendarDays size={14} /> Starts
            </small>
            <strong>
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeZone: "Europe/Rome"
              }).format(tournament.startsAt)}
            </strong>
          </div>
          <div>
            <small>
              <Trophy size={14} /> Entries
            </small>
            <strong>{entries.length}</strong>
          </div>
        </div>
      </div>
      {query.error && (
        <div className="form-feedback error" role="alert">
          {query.error}
        </div>
      )}
      {champion && (
        <section
          className={`tournament-champion ${tournament.status === "ACTIVE" ? "provisional" : ""}`}
          aria-labelledby="champion-name"
        >
          <span className="tournament-champion-mark" aria-hidden="true">
            <Trophy size={24} />
          </span>
          <div>
            <p>
              {tournament.status === "COMPLETED"
                ? "Tournament champion"
                : "Calculated winner"}
            </p>
            <h2 id="champion-name">{champion.name}</h2>
            {champion.members.length > 0 && (
              <span>
                {champion.members
                  .map((member) => member.displayName)
                  .join(" & ")}
              </span>
            )}
          </div>
        </section>
      )}
      {tournament.status === "ACTIVE" && champion && access.canManage && (
        <section className="surface surface-pad tournament-confirmation">
          <div>
            <h2>Confirm the tournament result</h2>
            <p>
              Check every recorded game first. Confirmation locks this
              tournament and its results, and then enables the share graphic.
            </p>
          </div>
          <form action={confirmTournamentResultAction}>
            <input type="hidden" name="groupId" value={groupId} />
            <input type="hidden" name="competitionId" value={competitionId} />
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <button className="button button-primary" type="submit">
              Confirm and lock result
            </button>
          </form>
        </section>
      )}
      <PageHeader
        title={tournament.type === "ELIMINATION" ? "Bracket" : "League table"}
        description={
          tournament.type === "ELIMINATION"
            ? "Winners advance automatically when the required number of games is reached."
            : "Table order: points, head-to-head, score difference, wins, score for, then seed."
        }
        action={
          access.canManage ? (
            <>
              {tournament.status === "DRAFT" && (
                <form action={start}>
                  <button className="button button-primary" type="submit">
                    Generate fixtures and start
                  </button>
                </form>
              )}
              {tournament.status === "COMPLETED" && (
                <ButtonLink
                  href={`/app/groups/${groupId}/competitions/${competitionId}/tournaments/${tournamentId}/share`}
                  variant="secondary"
                >
                  <Share2 size={17} /> Share result
                </ButtonLink>
              )}
            </>
          ) : undefined
        }
      />
      {tournament.status === "DRAFT" ? (
        <Section
          title="Entries"
          description="Review fixed teams before generating the schedule."
        >
          <div className="entity-list">
            {entries.map((entry) => (
              <div className="entity-row" key={entry.id}>
                <span className="competition-icon">{entry.seed}</span>
                <span className="entity-row-main">
                  <b>{entry.name}</b>
                  <small>
                    {entry.members
                      .map((member) => member.displayName)
                      .join(" & ")}
                  </small>
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : tournament.type === "ELIMINATION" ? (
        <EliminationView
          entries={entries}
          matches={matchesWithLegs}
          resultBase={resultBase}
          bestOf={tournament.bestOf ?? 1}
          canManage={access.canManage && tournament.status === "ACTIVE"}
        />
      ) : standings ? (
        <LeagueView
          entries={entries}
          standings={standings}
          matches={matchesWithLegs}
          resultBase={resultBase}
          canManage={access.canManage && tournament.status === "ACTIVE"}
        />
      ) : (
        <EmptyState
          title="Table awaiting fixtures"
          description="Start the tournament to generate its round-robin schedule."
        />
      )}
    </div>
  );
}
