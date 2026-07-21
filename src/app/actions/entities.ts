"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { fromZonedTime } from "date-fns-tz";

import {
  addCatalogueCompetition,
  createCustomCompetition
} from "@/lib/server/competitions";
import { recordGame, updateGame } from "@/lib/server/games";
import {
  acceptInvitation,
  cancelInvitation,
  createGroup,
  inviteAdministrator,
  removeAdministrator,
  updateGroup
} from "@/lib/server/groups";
import { publicError } from "@/lib/server/errors";
import { APPLICATION_TIME_ZONE } from "@/lib/domain";
import { getDb, players } from "@/db";
import {
  deletePrivateImage,
  normaliseImage,
  uploadPrivateImage
} from "@/lib/media/images";
import { savePlayer, setPlayerArchived } from "@/lib/server/players";
import {
  confirmTournamentResult,
  createTournamentDraft,
  startTournament
} from "@/lib/server/tournaments";
import { requireGroupAdmin } from "@/lib/server/authorization";
import { playerInputSchema } from "@/lib/validation/entities";

export type EntityActionState = {
  error?: string;
  success?: string;
  id?: string;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function json<T>(formData: FormData, key: string, fallback: T): T {
  const value = formData.get(key);
  if (!value) return fallback;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function applicationDateTime(value: string): Date | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  return /(?:z|[+-]\d{2}:\d{2})$/i.test(normalized)
    ? new Date(normalized)
    : fromZonedTime(normalized, APPLICATION_TIME_ZONE);
}

export async function createGroupAction(
  _state: EntityActionState,
  formData: FormData
): Promise<EntityActionState> {
  let groupId: string;
  try {
    const group = await createGroup({
      name: text(formData, "name"),
      description: text(formData, "description")
    });
    groupId = group.id;
  } catch (error) {
    return { error: publicError(error) };
  }
  redirect(`/app/groups/${groupId}`);
}

export async function inviteAdministratorAction(
  _state: EntityActionState,
  formData: FormData
): Promise<EntityActionState> {
  try {
    const groupId = text(formData, "groupId");
    const result = await inviteAdministrator({
      groupId,
      email: text(formData, "email")
    });
    revalidatePath(`/app/groups/${groupId}/settings`);
    const success =
      result.kind === "ADDED"
        ? "The administrator was added."
        : result.kind === "INVITED"
          ? "The invitation is ready."
          : result.kind === "ALREADY_MEMBER"
            ? "That account is already an administrator."
            : "A pending invitation already exists.";
    return {
      success:
        "previewUrl" in result && result.previewUrl
          ? `${success} Local link: ${result.previewUrl}`
          : success
    };
  } catch (error) {
    return { error: publicError(error) };
  }
}

export async function updateGroupAction(
  _state: EntityActionState,
  formData: FormData
): Promise<EntityActionState> {
  try {
    const groupId = text(formData, "groupId");
    await updateGroup(groupId, {
      name: text(formData, "name"),
      description: text(formData, "description"),
      isPublic: text(formData, "isPublic") === "on"
    });
    revalidatePath(`/app/groups/${groupId}`, "layout");
    return { success: "Group settings updated." };
  } catch (error) {
    return { error: publicError(error) };
  }
}

export async function acceptInvitationAction(formData: FormData) {
  let groupId: string;
  try {
    groupId = await acceptInvitation(text(formData, "invitationId"));
  } catch {
    redirect("/app/invitations?error=The invitation is unavailable.");
  }
  redirect(`/app/groups/${groupId}`);
}

export async function cancelInvitationAction(formData: FormData) {
  const groupId = text(formData, "groupId");
  try {
    await cancelInvitation(groupId, text(formData, "invitationId"));
    revalidatePath(`/app/groups/${groupId}/settings`);
  } catch {
    redirect(
      `/app/groups/${groupId}/settings?error=Unable to cancel invitation.`
    );
  }
}

export async function removeAdministratorAction(formData: FormData) {
  const groupId = text(formData, "groupId");
  try {
    await removeAdministrator(groupId, text(formData, "userId"));
    revalidatePath(`/app/groups/${groupId}/settings`);
  } catch (error) {
    redirect(
      `/app/groups/${groupId}/settings?error=${encodeURIComponent(publicError(error))}`
    );
  }
}

export async function savePlayerAction(
  _state: EntityActionState,
  formData: FormData
): Promise<EntityActionState> {
  let destination: string | undefined;
  let createdPlayerId: string | undefined;
  let uploadedPath: string | undefined;
  try {
    const groupId = text(formData, "groupId");
    const playerId = text(formData, "playerId") || undefined;
    const playerInput = playerInputSchema.parse({
      groupId,
      playerId,
      displayName: text(formData, "displayName")
    });
    const file = formData.get("image");
    if (file instanceof File && file.size > 0) {
      await normaliseImage(file);
    }
    let player;
    if (playerId && file instanceof File && file.size > 0) {
      await requireGroupAdmin(groupId);
      const [current] = await getDb()
        .select()
        .from(players)
        .where(and(eq(players.id, playerId), eq(players.groupId, groupId)))
        .limit(1);
      if (!current) throw new Error("This player is unavailable.");
      const uploaded = await uploadPrivateImage("players", playerId, file);
      uploadedPath = uploaded.path;
      [player] = await getDb()
        .update(players)
        .set({
          displayName: playerInput.displayName,
          imagePath: uploaded.path,
          updatedAt: new Date()
        })
        .where(and(eq(players.id, playerId), eq(players.groupId, groupId)))
        .returning();
      if (!player) throw new Error("This player is unavailable.");
      uploadedPath = undefined;
      if (current.imagePath) {
        try {
          await deletePrivateImage(current.imagePath);
        } catch (cleanupError) {
          console.warn("Could not remove replaced player image.", cleanupError);
        }
      }
    } else {
      player = await savePlayer(playerInput);
    }
    if (!playerId) createdPlayerId = player.id;
    if (!playerId && file instanceof File && file.size > 0) {
      const uploaded = await uploadPrivateImage("players", player.id, file);
      uploadedPath = uploaded.path;
      await getDb()
        .update(players)
        .set({ imagePath: uploaded.path, updatedAt: new Date() })
        .where(and(eq(players.id, player.id), eq(players.groupId, groupId)));
      if (player.imagePath) {
        try {
          await deletePrivateImage(player.imagePath);
        } catch (cleanupError) {
          console.warn("Could not remove replaced player image.", cleanupError);
        }
      }
      uploadedPath = undefined;
    }
    revalidatePath(`/app/groups/${groupId}/players`);
    destination =
      text(formData, "destination") ||
      `/app/groups/${groupId}/players/${player.id}`;
  } catch (error) {
    if (createdPlayerId) {
      await getDb().delete(players).where(eq(players.id, createdPlayerId));
    }
    if (uploadedPath) {
      try {
        await deletePrivateImage(uploadedPath);
      } catch (cleanupError) {
        console.warn("Could not remove an unused player image.", cleanupError);
      }
    }
    return { error: publicError(error) };
  }
  redirect(destination);
}

export async function archivePlayerAction(formData: FormData) {
  const groupId = text(formData, "groupId");
  try {
    await setPlayerArchived(
      groupId,
      text(formData, "playerId"),
      text(formData, "archived") !== "false"
    );
  } catch (error) {
    redirect(
      `/app/groups/${groupId}/players?error=${encodeURIComponent(publicError(error))}`
    );
  }
  revalidatePath(`/app/groups/${groupId}/players`);
}

export async function addCatalogueCompetitionAction(formData: FormData) {
  const groupId = text(formData, "groupId");
  let competitionId: string;
  try {
    const competition = await addCatalogueCompetition(
      groupId,
      text(formData, "catalogueCompetitionId")
    );
    competitionId = competition.id;
  } catch (error) {
    redirect(
      `/app/groups/${groupId}/competitions/catalogue?error=${encodeURIComponent(publicError(error))}`
    );
  }
  redirect(`/app/groups/${groupId}/competitions/${competitionId}`);
}

export async function createCustomCompetitionAction(
  _state: EntityActionState,
  formData: FormData
): Promise<EntityActionState> {
  let destination: string;
  try {
    const groupId = text(formData, "groupId");
    const competition = await createCustomCompetition({
      groupId,
      name: text(formData, "name"),
      description: text(formData, "description"),
      allowsDraws: text(formData, "allowsDraws") === "on",
      scoreType: text(formData, "scoreType"),
      winnerDirection: text(formData, "winnerDirection"),
      orderedValues: text(formData, "orderedValues")
        .split(/\r?\n|,/)
        .map((value) => value.trim())
        .filter(Boolean),
      formats: json(formData, "formats", [
        { label: "1 vs 1", playersPerSide: 1 }
      ])
    });
    destination = `/app/groups/${groupId}/competitions/${competition.id}`;
  } catch (error) {
    return { error: publicError(error) };
  }
  redirect(destination);
}

export async function recordGameAction(
  _state: EntityActionState,
  formData: FormData
): Promise<EntityActionState> {
  try {
    const game = await recordGame({
      groupId: text(formData, "groupId"),
      competitionId: text(formData, "competitionId"),
      formatId: text(formData, "formatId"),
      sideAPlayerIds: formData.getAll("sideAPlayerIds").map(String),
      sideBPlayerIds: formData.getAll("sideBPlayerIds").map(String),
      scoreA: text(formData, "scoreA") || undefined,
      scoreB: text(formData, "scoreB") || undefined,
      result: text(formData, "result") || undefined,
      playedAt: applicationDateTime(text(formData, "playedAt")),
      location: text(formData, "location"),
      tournamentMatchId: text(formData, "tournamentMatchId") || undefined
    });
    revalidatePath(`/app/groups/${game.groupId}`);
    return { success: "Result recorded.", id: game.id };
  } catch (error) {
    return { error: publicError(error) };
  }
}

export async function updateGameAction(
  _state: EntityActionState,
  formData: FormData
): Promise<EntityActionState> {
  try {
    const groupId = text(formData, "groupId");
    const game = await updateGame({
      groupId,
      gameId: text(formData, "gameId"),
      expectedUpdatedAt: text(formData, "expectedUpdatedAt"),
      competitionId: text(formData, "competitionId"),
      formatId: text(formData, "formatId"),
      sideAPlayerIds: formData.getAll("sideAPlayerIds").map(String),
      sideBPlayerIds: formData.getAll("sideBPlayerIds").map(String),
      scoreA: text(formData, "scoreA") || undefined,
      scoreB: text(formData, "scoreB") || undefined,
      result: text(formData, "result") || undefined,
      playedAt: applicationDateTime(text(formData, "playedAt")),
      location: text(formData, "location")
    });
    revalidatePath(`/app/groups/${groupId}`);
    return { success: "Result corrected.", id: game.id };
  } catch (error) {
    return { error: publicError(error) };
  }
}

export async function createTournamentAction(
  _state: EntityActionState,
  formData: FormData
): Promise<EntityActionState> {
  try {
    const tournament = await createTournamentDraft({
      groupId: text(formData, "groupId"),
      competitionId: text(formData, "competitionId"),
      formatId: text(formData, "formatId"),
      name: text(formData, "name"),
      type: text(formData, "type"),
      startsAt: applicationDateTime(text(formData, "startsAt")),
      bestOf: text(formData, "bestOf") || undefined,
      winPoints: text(formData, "winPoints") || undefined,
      drawPoints: text(formData, "drawPoints") || undefined,
      lossPoints: text(formData, "lossPoints") || undefined,
      entries: json(formData, "entries", [])
    });
    return {
      success: "Tournament draft created.",
      id: tournament.id
    };
  } catch (error) {
    return { error: publicError(error) };
  }
}

export async function startTournamentAction(formData: FormData) {
  const groupId = text(formData, "groupId");
  const competitionId = text(formData, "competitionId");
  const tournamentId = text(formData, "tournamentId");
  const destination = `/app/groups/${groupId}/competitions/${competitionId}/tournaments/${tournamentId}`;
  try {
    await startTournament(groupId, tournamentId);
  } catch (error) {
    redirect(`${destination}?error=${encodeURIComponent(publicError(error))}`);
  }
  redirect(destination);
}

export async function confirmTournamentResultAction(formData: FormData) {
  const groupId = text(formData, "groupId");
  const competitionId = text(formData, "competitionId");
  const tournamentId = text(formData, "tournamentId");
  const destination = `/app/groups/${groupId}/competitions/${competitionId}/tournaments/${tournamentId}`;
  try {
    await confirmTournamentResult(groupId, tournamentId);
    revalidatePath(`/app/groups/${groupId}`);
    revalidatePath(destination);
  } catch (error) {
    redirect(`${destination}?error=${encodeURIComponent(publicError(error))}`);
  }
  redirect(destination);
}
