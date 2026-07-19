import { and, eq } from "drizzle-orm";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import {
  getDb,
  groupCompetitions,
  groups,
  tournamentEntries,
  tournaments
} from "@/db";
import { requireGroupAdmin } from "@/lib/server/authorization";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await context.params;
  const db = getDb();
  const [row] = await db
    .select({
      tournament: tournaments,
      groupName: groups.name,
      competitionName: groupCompetitions.name,
      winnerName: tournamentEntries.name
    })
    .from(tournaments)
    .innerJoin(groups, eq(groups.id, tournaments.groupId))
    .innerJoin(
      groupCompetitions,
      and(
        eq(groupCompetitions.id, tournaments.competitionId),
        eq(groupCompetitions.groupId, tournaments.groupId)
      )
    )
    .leftJoin(
      tournamentEntries,
      and(
        eq(tournamentEntries.id, tournaments.winnerEntryId),
        eq(tournamentEntries.tournamentId, tournaments.id)
      )
    )
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!row || row.tournament.status !== "COMPLETED") {
    return new Response("Not found", { status: 404 });
  }
  try {
    await requireGroupAdmin(row.tournament.groupId);
  } catch {
    return new Response("Not found", { status: 404 });
  }
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
          {row.tournament.endsAt
            ? new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeZone: "Europe/Rome"
              }).format(row.tournament.endsAt)
            : ""}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "28px",
          alignItems: "center",
          textAlign: "center"
        }}
      >
        <div style={{ fontSize: 34, color: "#667069" }}>
          {row.groupName} · {row.competitionName}
        </div>
        <div style={{ fontSize: 68, fontWeight: 850 }}>
          {row.tournament.name}
        </div>
        <div
          style={{
            width: "160px",
            height: "10px",
            background: "#f2b632"
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "32px"
        }}
      >
        <div style={{ fontSize: 36, color: "#667069" }}>CHAMPION</div>
        <div
          style={{
            fontSize: 92,
            lineHeight: 1.05,
            textAlign: "center",
            fontWeight: 900,
            color: "#0b6b57"
          }}
        >
          {row.winnerName ?? "Tournament complete"}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderTop: "3px solid #dde2dc",
          paddingTop: "42px",
          fontSize: 27,
          color: "#667069"
        }}
      >
        <span>
          {row.tournament.type === "ELIMINATION"
            ? `Single elimination · Best of ${row.tournament.bestOf}`
            : "Round-robin league"}
        </span>
        <span>rosica.it</span>
      </div>
    </div>,
    {
      width: 1080,
      height: 1350,
      headers: {
        "Cache-Control": "private, no-store",
        ...(download
          ? {
              "Content-Disposition": `attachment; filename="rosica-tournament-${tournamentId}.png"`
            }
          : {})
      }
    }
  );
}
