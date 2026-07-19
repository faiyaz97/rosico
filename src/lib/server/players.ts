import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { getDb, players } from "@/db";
import {
  requireGroupAdmin,
  requireGroupViewer
} from "@/lib/server/authorization";
import { unavailable } from "@/lib/server/errors";
import { playerInputSchema } from "@/lib/validation/entities";

export async function listPlayers(groupId: string, includeArchived = true) {
  await requireGroupViewer(groupId);
  const db = getDb();
  return db
    .select()
    .from(players)
    .where(
      includeArchived
        ? eq(players.groupId, groupId)
        : and(eq(players.groupId, groupId), isNull(players.archivedAt))
    )
    .orderBy(asc(players.displayName));
}

export async function savePlayer(input: unknown) {
  const data = playerInputSchema.parse(input);
  await requireGroupAdmin(data.groupId);
  const db = getDb();

  if (data.playerId) {
    const [player] = await db
      .update(players)
      .set({ displayName: data.displayName, updatedAt: new Date() })
      .where(
        and(eq(players.id, data.playerId), eq(players.groupId, data.groupId))
      )
      .returning();
    if (!player) throw unavailable();
    return player;
  }

  const [player] = await db
    .insert(players)
    .values({ groupId: data.groupId, displayName: data.displayName })
    .returning();
  if (!player) throw new Error("The player could not be created.");
  return player;
}

export async function setPlayerArchived(
  groupId: string,
  playerId: string,
  archived: boolean
) {
  await requireGroupAdmin(groupId);
  const db = getDb();
  const [player] = await db
    .update(players)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(players.id, playerId), eq(players.groupId, groupId)))
    .returning();
  if (!player) throw unavailable();
  return player;
}
