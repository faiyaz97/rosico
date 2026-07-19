"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  getDb,
  groupCompetitions,
  groups,
  players,
  profiles,
  tournaments
} from "@/db";
import { deletePrivateImage, uploadPrivateImage } from "@/lib/media/images";
import { requireActor, requireGroupAdmin } from "@/lib/server/authorization";
import { publicError, unavailable } from "@/lib/server/errors";

export type MediaActionState = { error?: string; success?: string };

export async function uploadImageAction(
  _state: MediaActionState,
  formData: FormData
): Promise<MediaActionState> {
  const file = formData.get("image");
  const owner = String(formData.get("owner") ?? "");
  const ownerId = String(formData.get("ownerId") ?? "");
  const groupId = String(formData.get("groupId") ?? "");
  if (!(file instanceof File) || !file.size) {
    return { error: "Choose an image to upload." };
  }
  if (
    !["profiles", "groups", "players", "competitions", "tournaments"].includes(
      owner
    )
  ) {
    return { error: "The image owner is invalid." };
  }

  let uploadedPath: string | undefined;
  try {
    const db = getDb();
    let previousPath: string | null = null;
    if (owner === "profiles") {
      const actor = await requireActor();
      if (ownerId !== actor.user.id) throw unavailable();
      previousPath = actor.profile.imagePath;
    } else {
      await requireGroupAdmin(groupId);
      const table =
        owner === "groups"
          ? groups
          : owner === "players"
            ? players
            : owner === "competitions"
              ? groupCompetitions
              : tournaments;
      const ownerColumn =
        owner === "groups"
          ? groups.id
          : owner === "players"
            ? players.id
            : owner === "competitions"
              ? groupCompetitions.id
              : tournaments.id;
      const groupColumn =
        owner === "groups"
          ? groups.id
          : owner === "players"
            ? players.groupId
            : owner === "competitions"
              ? groupCompetitions.groupId
              : tournaments.groupId;
      const [current] = await db
        .select({ imagePath: table.imagePath })
        .from(table)
        .where(and(eq(ownerColumn, ownerId), eq(groupColumn, groupId)))
        .limit(1);
      if (!current) throw unavailable();
      previousPath = current.imagePath;
    }

    const uploaded = await uploadPrivateImage(
      owner as
        "profiles" | "groups" | "players" | "competitions" | "tournaments",
      ownerId,
      file
    );
    uploadedPath = uploaded.path;

    if (owner === "profiles") {
      await db
        .update(profiles)
        .set({ imagePath: uploaded.path, updatedAt: new Date() })
        .where(eq(profiles.id, ownerId));
    } else if (owner === "groups") {
      const updated = await db
        .update(groups)
        .set({ imagePath: uploaded.path, updatedAt: new Date() })
        .where(eq(groups.id, groupId))
        .returning({ id: groups.id });
      if (!updated.length) throw unavailable();
    } else if (owner === "players") {
      const updated = await db
        .update(players)
        .set({ imagePath: uploaded.path, updatedAt: new Date() })
        .where(and(eq(players.id, ownerId), eq(players.groupId, groupId)))
        .returning({ id: players.id });
      if (!updated.length) throw unavailable();
    } else if (owner === "competitions") {
      const updated = await db
        .update(groupCompetitions)
        .set({ imagePath: uploaded.path, updatedAt: new Date() })
        .where(
          and(
            eq(groupCompetitions.id, ownerId),
            eq(groupCompetitions.groupId, groupId)
          )
        )
        .returning({ id: groupCompetitions.id });
      if (!updated.length) throw unavailable();
    } else {
      const updated = await db
        .update(tournaments)
        .set({ imagePath: uploaded.path, updatedAt: new Date() })
        .where(
          and(eq(tournaments.id, ownerId), eq(tournaments.groupId, groupId))
        )
        .returning({ id: tournaments.id });
      if (!updated.length) throw unavailable();
    }

    uploadedPath = undefined;
    if (previousPath && previousPath !== uploaded.path) {
      try {
        await deletePrivateImage(previousPath);
      } catch (cleanupError) {
        console.warn("Could not remove the replaced image.", cleanupError);
      }
    }
    revalidatePath("/app", "layout");
    return { success: "Image updated." };
  } catch (error) {
    if (uploadedPath) {
      try {
        await deletePrivateImage(uploadedPath);
      } catch (cleanupError) {
        console.warn(
          "Could not remove an unused uploaded image.",
          cleanupError
        );
      }
    }
    return { error: publicError(error) };
  }
}
