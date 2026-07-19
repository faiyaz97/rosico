import type { MatchDisplay } from "./ui";
export { formatPercentage } from "@/lib/format";

type StoredGame = {
  id: string;
  scoreA: string;
  scoreB: string;
  outcome: "A" | "B" | "DRAW";
  playedAt: Date;
  location: string | null;
  competitionId: string;
  formatId: string;
  sideA: Array<{ displayName: string }>;
  sideB: Array<{ displayName: string }>;
};

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function gameForDisplay(
  game: StoredGame,
  labels?: { competition?: string; format?: string }
): MatchDisplay {
  return {
    id: game.id,
    competition: labels?.competition ?? "Competition",
    format: labels?.format ?? "Match",
    playedAt: new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Rome"
    }).format(game.playedAt),
    location: game.location ?? undefined,
    sideA: game.sideA.map((player) => player.displayName).join(" & "),
    sideB: game.sideB.map((player) => player.displayName).join(" & "),
    scoreA: game.scoreA,
    scoreB: game.scoreB,
    winner: game.outcome === "DRAW" ? "draw" : game.outcome
  };
}
