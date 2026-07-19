import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { listGroups } from "@/lib/server/groups";
import { ButtonLink, EmptyState, PageHeader, Status } from "@/components/ui";

export const metadata = { title: "Groups" };

export default async function GroupsPage() {
  const groups = await listGroups();
  return (
    <div className="app-content">
      <PageHeader
        title="Your groups"
        description="Each group keeps its own administrators, players, competitions and history."
        action={
          <ButtonLink href="/app/groups/new">
            <Plus size={18} /> Create group
          </ButtonLink>
        }
      />
      {groups.length ? (
        <div className="cards-grid">
          {groups.map((group) => (
            <Link
              className="surface surface-pad"
              href={`/app/groups/${group.id}`}
              key={group.id}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <span className="group-mini">
                  {group.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <Status tone="success">Admin</Status>
              </div>
              <h2 style={{ margin: "18px 0 5px" }}>{group.name}</h2>
              <p style={{ minHeight: 46 }}>
                {group.description || "A Rosica competition group."}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 18
                }}
              >
                <small>
                  Updated{" "}
                  {new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "medium"
                  }).format(group.updatedAt)}
                </small>
                <ArrowRight size={18} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No groups yet"
          description="Create a group for your office, club or group of friends."
          action={
            <ButtonLink href="/app/groups/new">
              <Plus size={18} /> Create group
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
