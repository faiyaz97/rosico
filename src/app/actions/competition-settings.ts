"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb, groupCompetitions } from "@/db";
import { deletePrivateImage, uploadPrivateImage } from "@/lib/media/images";
import { requireGroupAdmin } from "@/lib/server/authorization";
import { updateCompetitionConfiguration } from "@/lib/server/competitions";
import { publicError, validationError } from "@/lib/server/errors";

export type CompetitionSettingsActionState = {
  error?: string;
  success?: string;
  fields?: {
    name?: string;
    description?: string;
  };
  ruleFields?: {
    formats: number[];
    scoreType: string;
    winnerDirection: string;
    orderedValues: string;
    allowsDraws: boolean;
  };
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function refreshCompetition(groupId: string, competitionId: string) {
  revalidatePath(
    `/app/groups/${groupId}/competitions/${competitionId}`,
    "layout"
  );
  revalidatePath(`/app/groups/${groupId}/competitions`);
  revalidatePath(`/app/groups/${groupId}`);
}

export async function updateCompetitionIdentityAction(
  _state: CompetitionSettingsActionState,
  formData: FormData
): Promise<CompetitionSettingsActionState> {
  const groupId = text(formData, "groupId");
  const competitionId = text(formData, "competitionId");
  const name = text(formData, "name").trim();
  const description = text(formData, "description").trim();
  let uploadedPath: string | undefined;
  let replacedImagePath: string | null = null;

  try {
    await requireGroupAdmin(groupId);
    if (name.length < 2 || name.length > 100) {
      throw validationError(
        "Competition names must be between 2 and 100 characters."
      );
    }

    const file = formData.get("image");
    if (file instanceof File && file.size > 0) {
      uploadedPath = (
        await uploadPrivateImage("competitions", competitionId, file)
      ).path;
    }

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
      if (!current) throw validationError("This competition is unavailable.");

      await tx
        .update(groupCompetitions)
        .set({
          name,
          description: description || null,
          ...(uploadedPath ? { imagePath: uploadedPath } : {}),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(groupCompetitions.id, competitionId),
            eq(groupCompetitions.groupId, groupId)
          )
        );
      return uploadedPath ? current.imagePath : null;
    });
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
    return {
      error: publicError(error),
      fields: { name, description }
    };
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

  refreshCompetition(groupId, competitionId);
  return { success: "Competition identity updated." };
}

export async function updateCompetitionRulesAction(
  _state: CompetitionSettingsActionState,
  formData: FormData
): Promise<CompetitionSettingsActionState> {
  const groupId = text(formData, "groupId");
  const competitionId = text(formData, "competitionId");
  const ruleFields = {
    formats: formData
      .getAll("formats")
      .map(Number)
      .filter((size) => Number.isInteger(size) && size > 0),
    scoreType: text(formData, "scoreType"),
    winnerDirection: text(formData, "winnerDirection"),
    orderedValues: text(formData, "orderedValues"),
    allowsDraws: formData.get("drawsAllowed") === "on"
  };

  try {
    await updateCompetitionConfiguration({
      groupId,
      competitionId,
      allowsDraws: ruleFields.allowsDraws,
      scoreType: ruleFields.scoreType,
      winnerDirection: ruleFields.winnerDirection,
      orderedValues: ruleFields.orderedValues
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      formats: ruleFields.formats.map((playersPerSide) => ({
        label: `${playersPerSide} vs ${playersPerSide}`,
        playersPerSide
      }))
    });
  } catch (error) {
    return { error: publicError(error), ruleFields };
  }

  refreshCompetition(groupId, competitionId);
  return { success: "A new competition rule version was saved." };
}
