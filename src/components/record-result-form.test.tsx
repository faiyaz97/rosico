// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  RecordResultForm,
  resultSuccessHref
} from "@/components/record-result-form";

vi.mock("@/app/actions/entities", () => ({
  recordGameAction: vi.fn(async () => ({}))
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

const players = [
  { id: "10000000-0000-4000-8000-000000000011", displayName: "Ada" },
  { id: "10000000-0000-4000-8000-000000000012", displayName: "Ben" },
  { id: "10000000-0000-4000-8000-000000000013", displayName: "Cleo" },
  { id: "10000000-0000-4000-8000-000000000014", displayName: "Dario" }
];

describe("RecordResultForm", () => {
  it("returns to a tournament after recording its match", () => {
    expect(
      resultSuccessHref({
        groupId: "group-1",
        gameId: "game-1",
        tournamentMatchId: "match-1",
        tournamentHref:
          "/app/groups/group-1/competitions/competition-1/tournaments/tournament-1"
      })
    ).toBe(
      "/app/groups/group-1/competitions/competition-1/tournaments/tournament-1"
    );
    expect(
      resultSuccessHref({
        groupId: "group-1",
        gameId: "game-1"
      })
    ).toBe("/app/groups/group-1/games/game-1");
  });

  it("keeps selectable team slots when switching to another competition", () => {
    const { container } = render(
      <RecordResultForm
        groupId="10000000-0000-4000-8000-000000000001"
        initialCompetitionId="10000000-0000-4000-8000-000000000021"
        setups={[
          {
            id: "10000000-0000-4000-8000-000000000021",
            name: "Chess",
            rule: { scoreType: "NUMERIC", allowsDraws: true },
            formats: [
              {
                id: "10000000-0000-4000-8000-000000000031",
                label: "1 vs 1",
                playersPerSide: 1
              }
            ],
            players,
            scoreValues: []
          },
          {
            id: "10000000-0000-4000-8000-000000000022",
            name: "Table football",
            rule: { scoreType: "NUMERIC", allowsDraws: false },
            formats: [
              {
                id: "10000000-0000-4000-8000-000000000032",
                label: "2 vs 2",
                playersPerSide: 2
              }
            ],
            players,
            scoreValues: []
          }
        ]}
      />
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Competition" }));
    fireEvent.click(screen.getByRole("option", { name: "Table football" }));

    const inputs = screen.getAllByPlaceholderText("Search player");
    expect(inputs).toHaveLength(4);

    players.forEach((player, index) => {
      fireEvent.focus(inputs[index]!);
      fireEvent.click(screen.getByRole("option", { name: player.displayName }));
    });

    expect(
      container.querySelectorAll('input[name="sideAPlayerIds"]')
    ).toHaveLength(2);
    expect(
      container.querySelectorAll('input[name="sideBPlayerIds"]')
    ).toHaveLength(2);
  });

  it("uses one explicit winner choice for result-only competitions", () => {
    const { container } = render(
      <RecordResultForm
        groupId="10000000-0000-4000-8000-000000000001"
        initialCompetitionId="10000000-0000-4000-8000-000000000021"
        setups={[
          {
            id: "10000000-0000-4000-8000-000000000021",
            name: "Chess",
            rule: { scoreType: "RESULT", allowsDraws: false },
            formats: [
              {
                id: "10000000-0000-4000-8000-000000000031",
                label: "1 vs 1",
                playersPerSide: 1
              }
            ],
            players,
            scoreValues: []
          }
        ]}
      />
    );

    expect(screen.getByRole("radio", { name: "Side A wins" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Side B wins" })).toBeVisible();
    expect(screen.queryByRole("radio", { name: "Draw" })).toBeNull();
    expect(container.querySelector('[name="scoreA"]')).toBeNull();
    expect(container.querySelector('[name="scoreB"]')).toBeNull();
  });
});
