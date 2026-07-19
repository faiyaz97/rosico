import { redirect } from "next/navigation";
import { Plus, SlidersHorizontal } from "lucide-react";
import {
  addCatalogueCompetition,
  listCatalogue
} from "@/lib/server/competitions";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { requireGroupAdmin } from "@/lib/server/authorization";

export default async function CompetitionCataloguePage({
  params
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  await requireGroupAdmin(groupId);
  const catalogue = await listCatalogue();
  async function add(formData: FormData) {
    "use server";
    const competition = await addCatalogueCompetition(
      groupId,
      String(formData.get("catalogueId") ?? "")
    );
    redirect(`/app/groups/${groupId}/competitions/${competition.id}`);
  }
  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/competitions`}
        backLabel="Competitions"
        eyebrow="Competition catalogue"
        title="Choose a competition"
        description="Start with sensible defaults, then customise the competition for your group."
        action={
          <ButtonLink
            href={`/app/groups/${groupId}/competitions/custom`}
            variant="secondary"
          >
            <SlidersHorizontal size={17} /> Create custom
          </ButtonLink>
        }
      />
      {catalogue.length ? (
        <div className="catalogue-grid">
          {catalogue.map((item) => (
            <article className="catalogue-item" key={item.id}>
              <span className="competition-icon">{item.name.slice(0, 1)}</span>
              <h2>{item.name}</h2>
              <p>{item.description}</p>
              <small>
                {item.defaultConfiguration.scoreType === "NUMERIC"
                  ? "Numeric score"
                  : item.defaultConfiguration.scoreType === "ORDERED"
                    ? "Ordered values"
                    : "Winner selection"}{" "}
                -{" "}
                {item.defaultConfiguration.formats
                  .map((format) => format.label)
                  .join(", ")}
              </small>
              <form action={add} style={{ marginTop: 12 }}>
                <input type="hidden" name="catalogueId" value={item.id} />
                <button className="button button-secondary" type="submit">
                  <Plus size={16} /> Add to group
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Catalogue unavailable"
          description="Create a custom competition with the scoring and formats you need."
          action={
            <ButtonLink href={`/app/groups/${groupId}/competitions/custom`}>
              Create custom competition
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
