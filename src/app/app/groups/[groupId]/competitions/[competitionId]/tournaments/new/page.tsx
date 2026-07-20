import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { getCompetitionGameSetup } from "@/lib/server/games";
import { createTournamentDraft } from "@/lib/server/tournaments";
import { APPLICATION_TIME_ZONE } from "@/lib/domain";
import { EmptyState, FormActions, PageHeader } from "@/components/ui";
import { requireGroupAdmin } from "@/lib/server/authorization";
import { TournamentFormatEntries } from "@/components/tournament-format-entries";
import { selectInitialTournamentFormat } from "@/lib/tournament-formats";

export default async function NewTournamentPage({
  params,
  searchParams
}: {
  params: Promise<{ groupId: string; competitionId: string }>;
  searchParams: Promise<{ format?: string }>;
}) {
  const { groupId, competitionId } = await params;
  await requireGroupAdmin(groupId);
  const query = await searchParams;
  const setup = await getCompetitionGameSetup(groupId, competitionId);
  const format = selectInitialTournamentFormat(
    setup.formats,
    setup.players.length,
    query.format
  );
  if (!format)
    return (
      <div className="app-content">
        <PageHeader
          backHref={`/app/groups/${groupId}/competitions/${competitionId}/tournaments`}
          backLabel="Tournaments"
          title="Create tournament"
        />
        <EmptyState
          title="Not enough active players"
          description="Add enough active players for at least two complete tournament entries."
        />
      </div>
    );
  async function create(formData: FormData) {
    "use server";
    const selectedFormat = setup.formats.find(
      (item) => item.id === String(formData.get("formatId"))
    );
    if (!selectedFormat) throw new Error("Choose a valid format.");
    const entries = Array.from({ length: 16 }, (_, index) => {
      const playerIds = formData
        .getAll(`entry-${index}`)
        .map(String)
        .filter(Boolean);
      return {
        name: playerIds
          .map(
            (id) =>
              setup.players.find((player) => player.id === id)?.displayName
          )
          .filter(Boolean)
          .join(" & "),
        playerIds
      };
    }).filter(
      (entry) => entry.playerIds.length === selectedFormat.playersPerSide
    );
    const type = String(formData.get("type"));
    const tournament = await createTournamentDraft({
      groupId,
      competitionId,
      formatId: selectedFormat.id,
      name: String(formData.get("name") ?? ""),
      type,
      startsAt: fromZonedTime(
        String(formData.get("startsAt") ?? ""),
        APPLICATION_TIME_ZONE
      ),
      bestOf:
        type === "ELIMINATION" ? Number(formData.get("bestOf")) : undefined,
      winPoints:
        type === "LEAGUE" ? Number(formData.get("winPoints")) : undefined,
      drawPoints:
        type === "LEAGUE" ? Number(formData.get("drawPoints")) : undefined,
      lossPoints:
        type === "LEAGUE" ? Number(formData.get("lossPoints")) : undefined,
      entries
    });
    redirect(
      `/app/groups/${groupId}/competitions/${competitionId}/tournaments/${tournament.id}`
    );
  }
  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/competitions/${competitionId}/tournaments`}
        backLabel="Tournaments"
        eyebrow={setup.competition.name}
        title="Create a tournament"
        description="Set the structure, add participants, then review the generated fixtures before starting."
      />
      <form className="form-shell" action={create}>
        <div
          className="step-list"
          role="img"
          aria-label="Four tournament sections"
        >
          <span className="active" />
          <span className="active" />
          <span className="active" />
          <span className="active" />
        </div>
        <TournamentFormatEntries
          formats={setup.formats}
          players={setup.players}
          initialFormatId={format.id}
          allowsDraws={setup.rule.allowsDraws}
        />
        <FormActions
          submit="Create draft"
          cancelHref={`/app/groups/${groupId}/competitions/${competitionId}/tournaments`}
        />
      </form>
    </div>
  );
}
