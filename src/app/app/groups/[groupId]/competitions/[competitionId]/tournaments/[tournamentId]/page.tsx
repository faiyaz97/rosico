import { notFound, redirect } from "next/navigation";
import { CalendarDays, Share2, Trophy } from "lucide-react";
import { getTournament, startTournament } from "@/lib/server/tournaments";
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
  params
}: {
  params: Promise<{
    groupId: string;
    competitionId: string;
    tournamentId: string;
  }>;
}) {
  const { groupId, competitionId, tournamentId } = await params;
  const [data, access] = await Promise.all([
    getTournamentOrNotFound(groupId, tournamentId, competitionId),
    getGroupAccess(groupId)
  ]);
  const { tournament, entries, matches, standings } = data;
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
      <div className="tournament-hero">
        <div>
          <Status
            tone={
              tournament.status === "ACTIVE"
                ? "success"
                : tournament.status === "DRAFT"
                  ? "warning"
                  : "neutral"
            }
          >
            {tournament.status.toLowerCase()}
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
      <PageHeader
        backHref={`/app/groups/${groupId}/competitions/${competitionId}/tournaments`}
        backLabel="Tournaments"
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
          matches={matches}
          resultBase={resultBase}
          canManage={access.canManage}
        />
      ) : standings ? (
        <LeagueView
          entries={entries}
          standings={standings}
          matches={matches}
          resultBase={resultBase}
          canManage={access.canManage}
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
