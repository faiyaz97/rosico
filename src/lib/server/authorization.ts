import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, groupMemberships, groups, profiles } from "@/db";
import { requireUser } from "@/lib/supabase/server";
import { unauthenticated, unavailable } from "@/lib/server/errors";

export async function getOptionalActor(options?: { verified?: boolean }) {
  const user = await requireUser();
  if (!user) return null;
  if (options?.verified !== false && !user.email_confirmed_at) {
    return null;
  }

  const email = user.email?.trim().toLowerCase();
  if (!email) return null;

  const db = getDb();
  const [profile] = await db
    .insert(profiles)
    .values({
      id: user.id,
      email,
      displayName:
        String(user.user_metadata.display_name ?? "").trim() ||
        email.split("@")[0] ||
        "Player"
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { email, updatedAt: new Date() }
    })
    .returning();

  if (!profile) return null;
  return { user, profile };
}

export async function requireActor(options?: { verified?: boolean }) {
  const actor = await getOptionalActor(options);
  if (!actor) throw unauthenticated();
  return actor;
}

export async function getGroupAccess(groupId: string) {
  if (!z.uuid().safeParse(groupId).success) throw unavailable();
  const [actor, group] = await Promise.all([
    getOptionalActor(),
    getDb()
      .select({
        id: groups.id,
        name: groups.name,
        description: groups.description,
        imagePath: groups.imagePath,
        isPublic: groups.isPublic
      })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1)
      .then((rows) => rows[0])
  ]);
  if (!group) throw unavailable();

  let canManage = false;
  if (actor) {
    const [membership] = await getDb()
      .select({ groupId: groupMemberships.groupId })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.userId, actor.user.id)
        )
      )
      .limit(1);
    canManage = Boolean(membership);
  }
  if (!canManage && !group.isPublic) throw unavailable();
  return { actor, group, canManage };
}

export async function requireGroupViewer(groupId: string) {
  return getGroupAccess(groupId);
}

export async function requireGroupAdmin(groupId: string) {
  if (!z.uuid().safeParse(groupId).success) throw unavailable();
  const actor = await requireActor();
  const db = getDb();
  const [membership] = await db
    .select()
    .from(groupMemberships)
    .where(
      and(
        eq(groupMemberships.groupId, groupId),
        eq(groupMemberships.userId, actor.user.id)
      )
    )
    .limit(1);

  if (!membership) throw unavailable();
  return actor;
}
