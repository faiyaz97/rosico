import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, groupCompetitions } from "@/db";
import { deletePrivateImage, uploadPrivateImage } from "@/lib/media/images";
import { requireGroupAdmin } from "@/lib/server/authorization";
import {
  setCompetitionArchived,
  updateCompetitionConfiguration
} from "@/lib/server/competitions";
import { getCompetitionGameSetup } from "@/lib/server/games";
import { CompetitionTabs } from "@/components/context-tabs";
import { Field, FormActions, PageHeader, UploadField } from "@/components/ui";
import {
  CompetitionFormatFields,
  CompetitionScoringFields
} from "@/components/competition-format-fields";

export default async function CompetitionSettingsPage({
  params
}: {
  params: Promise<{ groupId: string; competitionId: string }>;
}) {
  const { groupId, competitionId } = await params;
  await requireGroupAdmin(groupId);
  const setup = await getCompetitionGameSetup(groupId, competitionId);
  async function update(formData: FormData) {
    "use server";
    await requireGroupAdmin(groupId);
    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 2 || name.length > 100)
      throw new Error(
        "Competition names must be between 2 and 100 characters."
      );
    let uploadedPath: string | undefined;
    let replacedImagePath: string | null = null;
    const file = formData.get("image");
    if (file instanceof File && file.size > 0) {
      uploadedPath = (
        await uploadPrivateImage("competitions", competitionId, file)
      ).path;
    }
    try {
      const description =
        String(formData.get("description") ?? "").trim() || null;
      if (uploadedPath) {
        replacedImagePath = await getDb().transaction(async (tx) => {
          const [current] = await tx
            .select({ imagePath: groupCompetitions.imagePath })
            .from(groupCompetitions)
            .where(
              and(
                eq(groupCompetitions.id, competitionId),
                eq(groupCompetitions.groupId, groupId)
              )
            )
            .for("update");
          if (!current) throw new Error("This competition is unavailable.");
          await tx
            .update(groupCompetitions)
            .set({
              name,
              description,
              imagePath: uploadedPath,
              updatedAt: new Date()
            })
            .where(
              and(
                eq(groupCompetitions.id, competitionId),
                eq(groupCompetitions.groupId, groupId)
              )
            );
          return current.imagePath;
        });
      } else {
        await getDb()
          .update(groupCompetitions)
          .set({ name, description, updatedAt: new Date() })
          .where(
            and(
              eq(groupCompetitions.id, competitionId),
              eq(groupCompetitions.groupId, groupId)
            )
          );
      }
    } catch (error) {
      if (uploadedPath) {
        try {
          await deletePrivateImage(uploadedPath);
        } catch (cleanupError) {
          console.warn(
            "Could not remove an unused competition image.",
            cleanupError
          );
        }
      }
      throw error;
    }
    if (replacedImagePath && replacedImagePath !== uploadedPath) {
      try {
        await deletePrivateImage(replacedImagePath);
      } catch (cleanupError) {
        console.warn(
          "Could not remove replaced competition image.",
          cleanupError
        );
      }
    }
    revalidatePath(`/app/groups/${groupId}/competitions/${competitionId}`);
  }
  async function archive() {
    "use server";
    await setCompetitionArchived(groupId, competitionId, true);
    revalidatePath(`/app/groups/${groupId}/competitions`);
  }
  async function updateRules(formData: FormData) {
    "use server";
    const teamSizes = formData
      .getAll("formats")
      .map(Number)
      .filter((size) => Number.isInteger(size) && size > 0);
    await updateCompetitionConfiguration({
      groupId,
      competitionId,
      allowsDraws: formData.get("drawsAllowed") === "on",
      scoreType: String(formData.get("scoreType") ?? "NUMERIC"),
      winnerDirection: String(formData.get("winnerDirection") ?? "HIGHER_WINS"),
      orderedValues: String(formData.get("orderedValues") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      formats: teamSizes.map((playersPerSide) => ({
        label: `${playersPerSide} vs ${playersPerSide}`,
        playersPerSide
      }))
    });
    revalidatePath(`/app/groups/${groupId}/competitions/${competitionId}`);
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
          <form
            className="surface competition-settings-panel competition-settings-identity"
            action={update}
          >
            <header className="competition-settings-heading">
              <h2>Competition identity</h2>
              <p>Shown in this group and on shared images.</p>
            </header>
            <div className="field-row">
              <Field
                label="Name"
                name="name"
                defaultValue={setup.competition.name}
                required
              />
              <label className="field">
                <span>Description</span>
                <textarea
                  name="description"
                  defaultValue={setup.competition.description ?? ""}
                />
              </label>
              <UploadField label="Competition image" />
            </div>
            <FormActions submit="Save identity" />
          </form>

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

        <form
          className="surface competition-settings-panel competition-settings-rules"
          action={updateRules}
        >
          <header className="competition-settings-heading">
            <h2>Formats and scoring</h2>
            <p>
              Saving creates a new rule version. Existing games are never
              recalculated.
            </p>
          </header>
          <div className="competition-settings-config-grid">
            <CompetitionFormatFields
              initialSizes={setup.formats.map(
                (format) => format.playersPerSide
              )}
              description="Add each equal-team size this competition supports."
              headingLevel="h3"
            />
            <CompetitionScoringFields
              defaultScoreType={setup.rule.scoreType}
              defaultWinnerDirection={setup.rule.winnerDirection}
              defaultOrderedValues={setup.scoreValues
                .map((value) => value.value)
                .join(", ")}
              defaultAllowsDraws={setup.rule.allowsDraws}
              headingLevel="h3"
            />
          </div>
          <FormActions submit="Save new rule version" />
        </form>

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
