import { describe, expect, it } from "vitest";

import { groupPrimaryNavigation } from "@/lib/group-navigation";

const base = "/app/groups/10000000-0000-4000-8000-000000000001";

describe("group primary navigation", () => {
  it("uses the same four destinations in the required order", () => {
    expect(groupPrimaryNavigation.map((item) => item.label)).toEqual([
      "Overview",
      "Players",
      "Competitions",
      "Games"
    ]);
    expect(groupPrimaryNavigation.map((item) => item.href(base))).toEqual([
      base,
      `${base}/players`,
      `${base}/competitions`,
      `${base}/games`
    ]);
  });

  it.each([
    [base, "overview"],
    [`${base}/players/player-id/edit`, "players"],
    [`${base}/competitions/competition-id/ranking`, "competitions"],
    [`${base}/tournaments`, "competitions"],
    [`${base}/games/game-id/edit`, "games"],
    [`${base}/games/new`, undefined],
    [`${base}/settings`, undefined]
  ])("resolves %s to %s", (pathname, expected) => {
    expect(
      groupPrimaryNavigation.find((item) => item.isActive(pathname, base))?.id
    ).toBe(expected);
  });
});
