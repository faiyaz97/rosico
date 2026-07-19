import Link from "next/link";
import { listCompetitions } from "@/lib/server/competitions";
import { listTournaments } from "@/lib/server/tournaments";
import { EmptyState, PageHeader, Segmented, Status } from "@/components/ui";

export default async function GroupTournamentsPage({
  params
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [tournaments, competitions] = await Promise.all([
    listTournaments(groupId),
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
        <Segmented
          label="Status"
          options={["All", "Active", "Draft", "Completed"]}
          active="All"
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
                    ? "success"
                    : item.status === "DRAFT"
                      ? "warning"
                      : "neutral"
                }
              >
                {item.status.toLowerCase()}
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
          title="No tournaments yet"
          description="Open a competition to create its first tournament."
        />
      )}
    </div>
  );
}
