import Link from "next/link";
import { FilterSelect } from "@/components/filter-select";
import { listCompetitions } from "@/lib/server/competitions";
import { listTournaments } from "@/lib/server/tournaments";
import { EmptyState, PageHeader, Status } from "@/components/ui";
import {
  parseTournamentStatus,
  tournamentStatusOptions
} from "@/lib/tournament-status";

export default async function GroupTournamentsPage({
  params,
  searchParams
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { groupId } = await params;
  const query = await searchParams;
  const status = parseTournamentStatus(query.status);
  const baseHref = `/app/groups/${groupId}/tournaments`;
  const [tournaments, competitions] = await Promise.all([
    listTournaments(groupId, undefined, status === "all" ? undefined : status),
    listCompetitions(groupId, true)
  ]);
  const names = new Map(
    competitions.map((competition) => [competition.id, competition.name])
  );
  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}`}
        backLabel="Group overview"
        title="Tournaments"
        description="Every bracket and league across this group."
      />
      <div className="filter-bar">
        <FilterSelect
          label="Status"
          options={tournamentStatusOptions(baseHref)}
          active={status.charAt(0).toUpperCase() + status.slice(1)}
        />
        <span className="active-period">{tournaments.length} tournaments</span>
      </div>
      {tournaments.length ? (
        <div className="cards-grid">
          {tournaments.map((item) => (
            <Link
              className="surface surface-pad"
              href={`/app/groups/${groupId}/competitions/${item.competitionId}/tournaments/${item.id}`}
              key={item.id}
            >
              <Status
                tone={
                  item.status === "ACTIVE"
                    ? item.winnerEntryId
                      ? "warning"
                      : "success"
                    : item.status === "DRAFT"
                      ? "warning"
                      : "neutral"
                }
              >
                {item.status === "ACTIVE" && item.winnerEntryId
                  ? "awaiting confirmation"
                  : item.status.toLowerCase()}
              </Status>
              <h2 style={{ margin: "15px 0 4px" }}>{item.name}</h2>
              <p>
                {names.get(item.competitionId)} -{" "}
                {item.type === "ELIMINATION"
                  ? "Single elimination"
                  : "Round robin league"}
              </p>
              <small>
                Starts{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeZone: "Europe/Rome"
                }).format(item.startsAt)}
              </small>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            status === "all" ? "No tournaments yet" : `No ${status} tournaments`
          }
          description={
            status === "all"
              ? "Open a competition to create its first tournament."
              : "Choose another status to see this group's tournaments."
          }
        />
      )}
    </div>
  );
}
