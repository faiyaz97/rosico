import { redirect } from "next/navigation";
import { listCompetitions } from "@/lib/server/competitions";
import { getGame, removeGame } from "@/lib/server/games";
import { gameForDisplay } from "@/components/presentation";
import { ButtonLink, MatchRow, PageHeader, Section } from "@/components/ui";
import { requireGroupAdmin } from "@/lib/server/authorization";

export default async function EditGamePage({
  params
}: {
  params: Promise<{ groupId: string; gameId: string }>;
}) {
  const { groupId, gameId } = await params;
  await requireGroupAdmin(groupId);
  const [game, competitions] = await Promise.all([
    getGame(groupId, gameId),
    listCompetitions(groupId, true)
  ]);
  const competition = competitions.find(
    (item) => item.id === game.competitionId
  );
  async function remove() {
    "use server";
    await removeGame(groupId, gameId);
    redirect(`/app/groups/${groupId}/games`);
  }
  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/games/${gameId}`}
        backLabel="Match details"
        title="Correct a result"
        description="To preserve a clear audit trail, remove this result and record the corrected game."
      />
      <div className="match-list">
        <MatchRow
          groupId={groupId}
          game={gameForDisplay(game, { competition: competition?.name })}
        />
      </div>
      <Section
        title="Correction options"
        description="Tournament results must be corrected from their tournament match."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <ButtonLink
            href={`/app/groups/${groupId}/games/new?competition=${game.competitionId}`}
          >
            Record corrected result
          </ButtonLink>
          <form action={remove}>
            <button className="button button-danger" type="submit">
              Remove this result
            </button>
          </form>
        </div>
      </Section>
    </div>
  );
}
