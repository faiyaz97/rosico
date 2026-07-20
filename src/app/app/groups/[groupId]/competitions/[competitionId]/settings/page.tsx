import { revalidatePath } from "next/cache";
import { requireGroupAdmin } from "@/lib/server/authorization";
import { setCompetitionArchived } from "@/lib/server/competitions";
import { getCompetitionGameSetup } from "@/lib/server/games";
import { CompetitionTabs } from "@/components/context-tabs";
import {
  CompetitionIdentitySettingsForm,
  CompetitionRulesSettingsForm
} from "@/components/competition-settings-forms";
import { PageHeader } from "@/components/ui";

export default async function CompetitionSettingsPage({
  params
}: {
  params: Promise<{ groupId: string; competitionId: string }>;
}) {
  const { groupId, competitionId } = await params;
  await requireGroupAdmin(groupId);
  const setup = await getCompetitionGameSetup(groupId, competitionId);
  async function archive() {
    "use server";
    await setCompetitionArchived(groupId, competitionId, true);
    revalidatePath(`/app/groups/${groupId}/competitions`);
  }
  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/competitions/${competitionId}`}
        backLabel={setup.competition.name}
        title="Competition settings"
        description="Identity changes apply immediately. Historical submitted scores and outcomes remain intact."
      />
      <CompetitionTabs
        groupId={groupId}
        competitionId={competitionId}
        active="Settings"
      />
      <div className="competition-settings-page">
        <div className="competition-settings-overview">
          <CompetitionIdentitySettingsForm
            groupId={groupId}
            competitionId={competitionId}
            name={setup.competition.name}
            description={setup.competition.description}
          />

          <section className="surface competition-settings-panel competition-settings-current">
            <header className="competition-settings-heading">
              <div>
                <h2>Current rules</h2>
                <p>
                  Used for new results. Historical results keep their original
                  rules.
                </p>
              </div>
              <span className="competition-settings-version">
                Version {setup.rule.version}
              </span>
            </header>
            <dl className="competition-settings-rule-list">
              <div>
                <dt>Score type</dt>
                <dd>
                  {setup.rule.scoreType === "NUMERIC"
                    ? "Numeric"
                    : setup.rule.scoreType === "ORDERED"
                      ? "Ordered values"
                      : "Result selection"}
                </dd>
              </div>
              <div>
                <dt>Winner</dt>
                <dd>
                  {setup.rule.scoreType === "RESULT"
                    ? "Selected directly"
                    : setup.rule.winnerDirection === "HIGHER_WINS"
                      ? "Higher score"
                      : "Lower score"}
                </dd>
              </div>
              <div>
                <dt>Draws</dt>
                <dd>{setup.rule.allowsDraws ? "Allowed" : "Not allowed"}</dd>
              </div>
              {setup.rule.scoreType === "ORDERED" && (
                <div>
                  <dt>Value order</dt>
                  <dd>
                    {setup.scoreValues.map((value) => value.value).join(" → ")}
                  </dd>
                </div>
              )}
            </dl>
            <div className="competition-settings-formats">
              <h3>Active formats</h3>
              {setup.formats.length ? (
                <ul>
                  {setup.formats.map((format) => (
                    <li key={format.id}>
                      <strong>{format.label}</strong>
                      <span>
                        {format.playersPerSide}{" "}
                        {format.playersPerSide === 1 ? "player" : "players"} per
                        side
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No active formats.</p>
              )}
            </div>
          </section>
        </div>

        <CompetitionRulesSettingsForm
          groupId={groupId}
          competitionId={competitionId}
          formats={setup.formats.map((format) => format.playersPerSide)}
          rule={{
            scoreType: setup.rule.scoreType,
            winnerDirection: setup.rule.winnerDirection,
            allowsDraws: setup.rule.allowsDraws
          }}
          orderedValues={setup.scoreValues
            .map((value) => value.value)
            .join(", ")}
        />

        <section className="competition-settings-danger">
          <div>
            <h2>Archive competition</h2>
            <p>
              Remove this competition from active lists while keeping all
              historical games, rankings and tournaments.
            </p>
          </div>
          <form action={archive}>
            <button className="button button-danger" type="submit">
              Archive competition
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
