import { and, eq, isNull } from "drizzle-orm";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import {
  gameParticipants,
  games,
  getDb,
  groupCompetitions,
  groups,
  players
} from "@/db";
import { requireGroupAdmin } from "@/lib/server/authorization";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const db = getDb();
  const [game] = await db
    .select({
      game: games,
      groupName: groups.name,
      competitionName: groupCompetitions.name
    })
    .from(games)
    .innerJoin(groups, eq(groups.id, games.groupId))
    .innerJoin(
      groupCompetitions,
      and(
        eq(groupCompetitions.id, games.competitionId),
        eq(groupCompetitions.groupId, games.groupId)
      )
    )
    .where(and(eq(games.id, gameId), isNull(games.deletedAt)))
    .limit(1);

  if (!game) return new Response("Not found", { status: 404 });
  try {
    await requireGroupAdmin(game.game.groupId);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const participantRows = await db
    .select({
      side: gameParticipants.side,
      slot: gameParticipants.slot,
      name: players.displayName
    })
    .from(gameParticipants)
    .innerJoin(players, eq(players.id, gameParticipants.playerId))
    .where(eq(gameParticipants.gameId, gameId))
    .orderBy(gameParticipants.slot);
  const sideA = participantRows
    .filter((participant) => participant.side === "A")
    .map((participant) => participant.name)
    .join(" & ");
  const sideB = participantRows
    .filter((participant) => participant.side === "B")
    .map((participant) => participant.name)
    .join(" & ");
  const winner =
    game.game.outcome === "DRAW"
      ? "DRAW"
      : game.game.outcome === "A"
        ? `${sideA} WINS`
        : `${sideB} WINS`;
  const download = request.nextUrl.searchParams.get("download") === "1";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "84px",
        color: "#18211c",
        background: "#f7f6f1",
        fontFamily: "sans-serif"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: "#0b6b57" }}>
          rosica
        </div>
        <div style={{ fontSize: 28, color: "#667069" }}>
          {new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeZone: "Europe/Rome"
          }).format(game.game.playedAt)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
        <div style={{ fontSize: 34, color: "#667069" }}>{game.groupName}</div>
        <div style={{ fontSize: 62, fontWeight: 800 }}>
          {game.competitionName}
        </div>
        <div
          style={{
            height: "8px",
            width: "130px",
            background: "#f2b632"
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "36px"
        }}
      >
        <div style={{ width: "35%", fontSize: 46, fontWeight: 700 }}>
          {sideA}
        </div>
        <div
          style={{
            display: "flex",
            gap: "24px",
            fontSize: 118,
            fontWeight: 900,
            fontVariantNumeric: "tabular-nums"
          }}
        >
          <span>{game.game.scoreA}</span>
          <span style={{ color: "#667069" }}>–</span>
          <span>{game.game.scoreB}</span>
        </div>
        <div
          style={{
            width: "35%",
            textAlign: "right",
            fontSize: 46,
            fontWeight: 700
          }}
        >
          {sideB}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "3px solid #dde2dc",
          paddingTop: "42px"
        }}
      >
        <div style={{ fontSize: 42, fontWeight: 800, color: "#0b6b57" }}>
          {winner}
        </div>
        <div style={{ fontSize: 26, color: "#667069" }}>rosica.it</div>
      </div>
    </div>,
    {
      width: 1080,
      height: 1350,
      headers: {
        "Cache-Control": "private, no-store",
        ...(download
          ? {
              "Content-Disposition": `attachment; filename="rosica-result-${gameId}.png"`
            }
          : {})
      }
    }
  );
}
