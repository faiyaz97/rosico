import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, groupCompetitions } from "@/db";
import {
  deletePrivateImage,
  normaliseImage,
  uploadPrivateImage
} from "@/lib/media/images";
import { createCustomCompetition } from "@/lib/server/competitions";
import { Field, FormActions, PageHeader, UploadField } from "@/components/ui";
import { requireGroupAdmin } from "@/lib/server/authorization";
import {
  CompetitionFormatFields,
  CompetitionScoringFields
} from "@/components/competition-format-fields";

export default async function CustomCompetitionPage({
  params
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  await requireGroupAdmin(groupId);
  async function create(formData: FormData) {
    "use server";
    const file = formData.get("image");
    const hasImage = file instanceof File && file.size > 0;
    if (hasImage) await normaliseImage(file);

    const formatSizes = formData
      .getAll("formats")
      .map((value) => Number(value));
    const orderedValues = String(formData.get("orderedValues") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    let competition:
      Awaited<ReturnType<typeof createCustomCompetition>> | undefined;
    let uploadedPath: string | undefined;
    try {
      competition = await createCustomCompetition({
        groupId,
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        allowsDraws: formData.get("drawsAllowed") === "on",
        scoreType: String(formData.get("scoreType") ?? "NUMERIC"),
        winnerDirection: String(
          formData.get("winnerDirection") ?? "HIGHER_WINS"
        ),
        orderedValues,
        formats: formatSizes.map((size) => ({
          label: `${size} vs ${size}`,
          playersPerSide: size
        }))
      });
      if (hasImage) {
        const image = await uploadPrivateImage(
          "competitions",
          competition.id,
          file
        );
        uploadedPath = image.path;
        await getDb()
          .update(groupCompetitions)
          .set({ imagePath: image.path })
          .where(
            and(
              eq(groupCompetitions.id, competition.id),
              eq(groupCompetitions.groupId, groupId)
            )
          );
      }
    } catch (error) {
      if (competition) {
        await getDb()
          .delete(groupCompetitions)
          .where(
            and(
              eq(groupCompetitions.id, competition.id),
              eq(groupCompetitions.groupId, groupId)
            )
          );
      }
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
    redirect(`/app/groups/${groupId}/competitions/${competition.id}`);
  }
  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/competitions`}
        backLabel="Competitions"
        eyebrow="Custom competition"
        title="Define how your game works"
        description="The same rules power result validation, rankings and tournaments."
      />
      <form className="form-shell" action={create}>
        <div
          className="step-list"
          role="img"
          aria-label="Four configuration sections"
        >
          <span className="active" />
          <span className="active" />
          <span className="active" />
          <span className="active" />
        </div>
        <div className="form-section">
          <h2>Identity</h2>
          <p>Give administrators enough context to record results correctly.</p>
          <div className="field-row">
            <Field
              label="Competition name"
              name="name"
              placeholder="Medal race"
              required
            />
            <label className="field">
              <span>Description</span>
              <textarea
                name="description"
                placeholder="How this competition is played"
              />
            </label>
            <UploadField label="Competition image" />
          </div>
        </div>
        <CompetitionFormatFields initialSizes={[1]} />
        <CompetitionScoringFields />
        <FormActions
          submit="Create competition"
          cancelHref={`/app/groups/${groupId}/competitions`}
        />
      </form>
    </div>
  );
}
