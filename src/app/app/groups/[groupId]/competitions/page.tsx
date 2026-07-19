import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { listCompetitions } from "@/lib/server/competitions";
import { getGroupAccess } from "@/lib/server/authorization";
import { ButtonLink, EmptyState, PageHeader, Status } from "@/components/ui";

export default async function CompetitionsPage({
  params
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [competitions, access] = await Promise.all([
    listCompetitions(groupId, true),
    getGroupAccess(groupId)
  ]);
  return (
    <div className="app-content">
      <PageHeader
        title="Competitions"
        description="Every competition has its own formats, scoring, rankings and tournaments."
        action={
          access.canManage ? (
            <ButtonLink href={`/app/groups/${groupId}/competitions/catalog`}>
              <Plus size={18} /> Add competition
            </ButtonLink>
          ) : undefined
        }
      />
      {competitions.length ? (
        <div className="cards-grid">
          {competitions.map((competition) => (
            <Link
              className="surface surface-pad"
              href={`/app/groups/${groupId}/competitions/${competition.id}`}
              key={competition.id}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <span className="competition-icon">
                  {competition.name.slice(0, 1).toUpperCase()}
                </span>
                <Status tone={competition.archivedAt ? "neutral" : "success"}>
                  {competition.archivedAt ? "Archived" : "Active"}
                </Status>
              </div>
              <h2 style={{ margin: "17px 0 5px" }}>{competition.name}</h2>
              <p>{competition.description || "A custom competition."}</p>
              <span
                className="text-link"
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  marginTop: 17
                }}
              >
                Open competition <ArrowRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No competitions yet"
          description="Choose a competition from the catalogue or define your own rules."
          action={
            access.canManage ? (
              <ButtonLink href={`/app/groups/${groupId}/competitions/catalog`}>
                <Plus size={18} /> Add competition
              </ButtonLink>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
