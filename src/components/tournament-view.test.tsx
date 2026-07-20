// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EliminationView } from "@/components/tournament-view";

describe("EliminationView", () => {
  afterEach(cleanup);

  it("shows every leg score and aggregate series wins in an accessible table", () => {
    render(
      <EliminationView
        entries={[
          { id: "entry-a", name: "Ada" },
          { id: "entry-b", name: "Grace" }
        ]}
        matches={[
          {
            id: "match-1",
            round: 1,
            slot: 0,
            sideAEntryId: "entry-a",
            sideBEntryId: "entry-b",
            sideAWins: 2,
            sideBWins: 0,
            winnerEntryId: "entry-a",
            status: "COMPLETED",
            legs: [
              {
                id: "leg-1",
                scoreA: "8",
                scoreB: "11",
                outcome: "A"
              },
              {
                id: "leg-2",
                scoreA: "7",
                scoreB: "9",
                outcome: "A"
              }
            ]
          }
        ]}
        resultBase="/games/new?tournament=tournament-1"
        bestOf={3}
      />
    );

    expect(
      screen.getByRole("region", { name: "Single elimination bracket" })
    ).toHaveAttribute("tabindex", "0");
    const scoreTable = screen.getByRole("table", {
      name: "Ada versus Grace"
    });
    expect(
      within(scoreTable).getByRole("columnheader", { name: "G1" })
    ).toBeInTheDocument();
    expect(
      within(scoreTable).getByRole("columnheader", { name: "G3" })
    ).toBeInTheDocument();
    expect(within(scoreTable).getAllByText("Not played")).toHaveLength(2);

    const ada = within(scoreTable).getByRole("rowheader", { name: "Ada" });
    const adaRow = ada.closest("tr");
    expect(adaRow).not.toBeNull();
    expect(within(adaRow!).getByText("8")).toHaveClass("leg-winner");
    expect(within(adaRow!).getByText("7")).toHaveClass("leg-winner");
    expect(within(adaRow!).getByText("2")).toBeInTheDocument();
  });
});
