import "server-only";

import { and, count, desc, eq, sql } from "drizzle-orm";

import {
  getDb,
  groupInvitations,
  groupMemberships,
  groups,
  profiles
} from "@/db";
import { sendInvitationEmail } from "@/lib/email";
import {
  requireActor,
  requireGroupAdmin,
  requireGroupViewer
} from "@/lib/server/authorization";
import { conflict, unavailable } from "@/lib/server/errors";
import {
  groupInputSchema,
  invitationInputSchema
} from "@/lib/validation/entities";

export async function listGroups() {
  const { user } = await requireActor();
  const db = getDb();
  return db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      imagePath: groups.imagePath,
      isPublic: groups.isPublic,
      updatedAt: groups.updatedAt
    })
    .from(groups)
    .innerJoin(
      groupMemberships,
      and(
        eq(groupMemberships.groupId, groups.id),
        eq(groupMemberships.userId, user.id)
      )
    )
    .orderBy(desc(groups.updatedAt));
}

export async function createGroup(input: unknown) {
  const data = groupInputSchema.parse(input);
  const { user } = await requireActor();
  const db = getDb();

  return db.transaction(async (tx) => {
    const [group] = await tx
      .insert(groups)
      .values({
        name: data.name,
        description: data.description,
        isPublic: data.isPublic,
        creatorId: user.id
      })
      .returning();
    if (!group) throw new Error("The group could not be created.");

    await tx.insert(groupMemberships).values({
      groupId: group.id,
      userId: user.id,
      addedById: user.id
    });
    return group;
  });
}

export async function updateGroup(groupId: string, input: unknown) {
  const data = groupInputSchema.parse(input);
  await requireGroupAdmin(groupId);
  const db = getDb();
  const [group] = await db
    .update(groups)
    .set({
      name: data.name,
      description: data.description,
      isPublic: data.isPublic,
      updatedAt: new Date()
    })
    .where(eq(groups.id, groupId))
    .returning();
  if (!group) throw unavailable();
  return group;
}

export async function getGroupSettings(groupId: string) {
  await requireGroupAdmin(groupId);
  const db = getDb();
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!group) throw unavailable();

  const members = await db
    .select({
      userId: profiles.id,
      displayName: profiles.displayName,
      email: profiles.email,
      imagePath: profiles.imagePath,
      createdAt: groupMemberships.createdAt
    })
    .from(groupMemberships)
    .innerJoin(profiles, eq(profiles.id, groupMemberships.userId))
    .where(eq(groupMemberships.groupId, groupId))
    .orderBy(profiles.displayName);

  const invitations = await db
    .select()
    .from(groupInvitations)
    .where(
      and(
        eq(groupInvitations.groupId, groupId),
        eq(groupInvitations.status, "PENDING")
      )
    )
    .orderBy(desc(groupInvitations.createdAt));

  return { group, members, invitations };
}

export async function getGroupOverview(groupId: string) {
  const access = await requireGroupViewer(groupId);
  const [adminTotal] = await getDb()
    .select({ value: count() })
    .from(groupMemberships)
    .where(eq(groupMemberships.groupId, groupId));
  return {
    group: access.group,
    adminCount: adminTotal?.value ?? 0,
    canManage: access.canManage
  };
}

export async function inviteAdministrator(input: unknown) {
  const data = invitationInputSchema.parse(input);
  const actor = await requireGroupAdmin(data.groupId);
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    const [group] = await tx
      .select({ name: groups.name })
      .from(groups)
      .where(eq(groups.id, data.groupId))
      .limit(1);
    if (!group) throw unavailable();

    const [existing] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(sql`lower(${profiles.email}) = ${data.email}`)
      .limit(1);

    if (existing) {
      const membership = await tx
        .insert(groupMemberships)
        .values({
          groupId: data.groupId,
          userId: existing.id,
          addedById: actor.user.id
        })
        .onConflictDoNothing()
        .returning();
      await tx
        .update(groupInvitations)
        .set({ status: "CANCELLED", cancelledAt: new Date() })
        .where(
          and(
            eq(groupInvitations.groupId, data.groupId),
            eq(groupInvitations.status, "PENDING"),
            sql`lower(${groupInvitations.email}) = ${data.email}`
          )
        );
      return {
        kind: membership.length
          ? ("ADDED" as const)
          : ("ALREADY_MEMBER" as const),
        groupName: group.name
      };
    }

    const invitation = await tx
      .insert(groupInvitations)
      .values({
        groupId: data.groupId,
        email: data.email,
        invitedById: actor.user.id
      })
      .onConflictDoNothing()
      .returning();
    if (!invitation.length) {
      const [pending] = await tx
        .select({ id: groupInvitations.id })
        .from(groupInvitations)
        .where(
          and(
            eq(groupInvitations.groupId, data.groupId),
            eq(groupInvitations.status, "PENDING"),
            sql`lower(${groupInvitations.email}) = ${data.email}`
          )
        )
        .limit(1);
      if (!pending) throw unavailable();
      return {
        kind: "ALREADY_INVITED" as const,
        groupName: group.name,
        invitationId: pending.id
      };
    }
    return {
      kind: "INVITED" as const,
      groupName: group.name,
      invitationId: invitation[0]!.id
    };
  });

  if (result.kind === "INVITED" || result.kind === "ALREADY_INVITED") {
    const email = await sendInvitationEmail({
      invitationId: result.invitationId,
      to: data.email,
      groupName: result.groupName,
      inviterName: actor.profile.displayName
    });
    return { ...result, ...email };
  }
  return result;
}

export async function acceptInvitation(invitationId: string) {
  const actor = await requireActor();
  const email = actor.user.email?.trim().toLowerCase();
  if (!email || !actor.user.email_confirmed_at) throw unavailable();
  const db = getDb();

  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .update(groupInvitations)
      .set({
        status: "ACCEPTED",
        acceptedById: actor.user.id,
        acceptedAt: new Date()
      })
      .where(
        and(
          eq(groupInvitations.id, invitationId),
          eq(groupInvitations.status, "PENDING"),
          sql`lower(${groupInvitations.email}) = ${email}`
        )
      )
      .returning();
    if (!invitation) throw unavailable();

    await tx
      .insert(groupMemberships)
      .values({
        groupId: invitation.groupId,
        userId: actor.user.id,
        addedById: invitation.invitedById
      })
      .onConflictDoNothing();
    return invitation.groupId;
  });
}

export async function listPendingInvitationsForActor() {
  const actor = await requireActor();
  const email = actor.user.email?.trim().toLowerCase();
  if (!email) return [];
  const db = getDb();
  return db
    .select({
      id: groupInvitations.id,
      groupId: groupInvitations.groupId,
      groupName: groups.name,
      invitedBy: profiles.displayName,
      createdAt: groupInvitations.createdAt
    })
    .from(groupInvitations)
    .innerJoin(groups, eq(groups.id, groupInvitations.groupId))
    .innerJoin(profiles, eq(profiles.id, groupInvitations.invitedById))
    .where(
      and(
        eq(groupInvitations.status, "PENDING"),
        sql`lower(${groupInvitations.email}) = ${email}`
      )
    )
    .orderBy(desc(groupInvitations.createdAt));
}

export async function cancelInvitation(groupId: string, invitationId: string) {
  const actor = await requireGroupAdmin(groupId);
  const db = getDb();
  const [invitation] = await db
    .update(groupInvitations)
    .set({ status: "CANCELLED", cancelledAt: new Date() })
    .where(
      and(
        eq(groupInvitations.id, invitationId),
        eq(groupInvitations.groupId, groupId),
        eq(groupInvitations.status, "PENDING")
      )
    )
    .returning();
  if (!invitation) throw unavailable();
  return { invitation, actorId: actor.user.id };
}

export async function removeAdministrator(groupId: string, userId: string) {
  await requireGroupAdmin(groupId);
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from groups where id = ${groupId} for update`
    );
    const [total] = await tx
      .select({ value: count() })
      .from(groupMemberships)
      .where(eq(groupMemberships.groupId, groupId));
    if ((total?.value ?? 0) <= 1) {
      throw conflict("A group must always have at least one administrator.");
    }

    const deleted = await tx
      .delete(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.userId, userId)
        )
      )
      .returning();
    if (!deleted.length) throw unavailable();
  });
}
