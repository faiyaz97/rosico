import { describe, expect, it } from "vitest";

import {
  aggregateMatchHistory,
  type MatchHistoryGame,
  type MatchHistoryTournamentContext
} from "./match-history";

function game(
  id: string,
  outcome: "A" | "B" | "DRAW",
  tournamentMatchId: string | null,
  minute: number
): MatchHistoryGame {
  return {
    id,
    competitionId: "competition-1",
    formatId: "format-1",
    tournamentMatchId,
    scoreA: outcome === "A" ? "11" : "8",
    scoreB: outcome === "B" ? "11" : "8",
    outcome,
    playedAt: new Date(`2026-07-20T10:${String(minute).padStart(2, "0")}:00Z`),
    createdAt: new Date(`2026-07-20T11:${String(minute).padStart(2, "0")}:00Z`),
    location: null,
    sideA: [{ playerId: "a", displayName: "Alex" }],
    sideB: [{ playerId: "b", displayName: "Blair" }]
  };
}

const series: MatchHistoryTournamentContext = {
  matchId: "match-1",
  tournamentId: "tournament-1",
  competitionId: "competition-1",
  tournamentName: "Summer Cup",
  tournamentType: "ELIMINATION",
  tournamentStatus: "ACTIVE",
  bestOf: 3,
  round: 2,
  slot: 0,
  sideAWins: 2,
  sideBWins: 0,
  winnerEntryId: "entry-a",
  sideAEntryId: "entry-a",
  sideBEntryId: "entry-b",
  nextMatchId: null
};

describe("match history aggregation", () => {
  it("shows a best-of series as one match with its individual games", () => {
    const result = aggregateMatchHistory(
      [game("leg-2", "A", "match-1", 2), game("leg-1", "A", "match-1", 1)],
      [series],
      ({ matchId }) => `/tournaments/1#match-${matchId}`
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "match-1",
      scoreA: "2",
      scoreB: "0",
      historyWinner: "A",
      historyHref: "/tournaments/1#match-match-1",
      tournament: {
        name: "Summer Cup",
        isFinal: true,
        clinchedTournament: true
      }
    });
    expect(result[0]?.legs.map((leg) => leg.id)).toEqual(["leg-1", "leg-2"]);
  });

  it("keeps ordinary games separate", () => {
    const result = aggregateMatchHistory(
      [game("game-1", "B", null, 1), game("game-2", "DRAW", null, 2)],
      [],
      () => "/unused"
    );

    expect(result.map((item) => item.id)).toEqual(["game-2", "game-1"]);
    expect(result.map((item) => item.historyWinner)).toEqual(["draw", "B"]);
  });

  it("keeps series game numbering in immutable creation order", () => {
    const first = game("leg-1", "A", "match-1", 8);
    const second = game("leg-2", "B", "match-1", 2);
    first.createdAt = new Date("2026-07-20T10:00:00Z");
    second.createdAt = new Date("2026-07-20T10:01:00Z");

    const result = aggregateMatchHistory(
      [second, first],
      [series],
      () => "/tournaments/1"
    );

    expect(result[0]?.legs.map((leg) => leg.id)).toEqual(["leg-1", "leg-2"]);
    expect(result[0]?.playedAt).toEqual(first.playedAt);
  });
});
