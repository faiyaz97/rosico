import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import {
  getDb,
  groupCompetitions,
  groups,
  players,
  profiles,
  tournaments
} from "@/db";
import { createSignedImageUrl } from "@/lib/media/images";
import { requireActor, requireGroupAdmin } from "@/lib/server/authorization";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await context.params;
  const path = parts.join("/");
  try {
    const db = getDb();

    if (path.startsWith("profiles/")) {
      const actor = await requireActor();
      const [profile] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(
          and(eq(profiles.id, actor.user.id), eq(profiles.imagePath, path))
        )
        .limit(1);
      if (!profile) return new NextResponse("Not found", { status: 404 });
    } else {
      const owner = await findMediaOwner(path);
      if (!owner) return new NextResponse("Not found", { status: 404 });
      const [ownerGroup] = await db
        .select({ isPublic: groups.isPublic })
        .from(groups)
        .where(eq(groups.id, owner.groupId))
        .limit(1);
      if (!ownerGroup?.isPublic || !owner.publicEligible) {
        await requireGroupAdmin(owner.groupId);
      }
    }

    return NextResponse.redirect(await createSignedImageUrl(path));
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

async function findMediaOwner(path: string) {
  const db = getDb();
  const group = await db
    .select({ groupId: groups.id })
    .from(groups)
    .where(eq(groups.imagePath, path))
    .limit(1);
  if (group[0]) return { groupId: group[0].groupId, publicEligible: true };

  const player = await db
    .select({ groupId: players.groupId })
    .from(players)
    .where(eq(players.imagePath, path))
    .limit(1);
  if (player[0]) return { groupId: player[0].groupId, publicEligible: true };

  const competition = await db
    .select({
      groupId: groupCompetitions.groupId,
      archivedAt: groupCompetitions.archivedAt
    })
    .from(groupCompetitions)
    .where(eq(groupCompetitions.imagePath, path))
    .limit(1);
  if (competition[0]) {
    return {
      groupId: competition[0].groupId,
      publicEligible: competition[0].archivedAt === null
    };
  }

  const tournament = await db
    .select({ groupId: tournaments.groupId, status: tournaments.status })
    .from(tournaments)
    .where(eq(tournaments.imagePath, path))
    .limit(1);
  if (!tournament[0]) return null;
  return {
    groupId: tournament[0].groupId,
    publicEligible:
      tournament[0].status === "ACTIVE" || tournament[0].status === "COMPLETED"
  };
}
