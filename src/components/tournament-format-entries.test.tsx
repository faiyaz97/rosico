// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TournamentFormatEntries } from "@/components/tournament-format-entries";

const players = Array.from({ length: 8 }, (_, index) => ({
  id: `player-${index + 1}`,
  displayName: `Player ${index + 1}`
}));

describe("TournamentFormatEntries", () => {
  afterEach(cleanup);

  it("updates each entry's player slots when the format changes", () => {
    render(
      <TournamentFormatEntries
        formats={[
          { id: "one", label: "1 vs 1", playersPerSide: 1 },
          { id: "two", label: "2 vs 2", playersPerSide: 2 }
        ]}
        players={players}
        initialFormatId="one"
      />
    );

    expect(screen.getAllByRole("group", { name: /Entry/ })).toHaveLength(8);
    expect(screen.getAllByRole("combobox", { name: /Player/ })).toHaveLength(8);

    fireEvent.click(screen.getByRole("combobox", { name: "Game format" }));
    fireEvent.click(screen.getByRole("option", { name: "2 vs 2" }));

    expect(screen.getAllByRole("group", { name: /Entry/ })).toHaveLength(4);
    expect(screen.getAllByRole("combobox", { name: /Player/ })).toHaveLength(8);
    expect(
      screen.getAllByRole("group", { name: /Entry/ })[0]
    ).toHaveTextContent("Player 1");
    expect(
      screen.getAllByRole("group", { name: /Entry/ })[0]
    ).toHaveTextContent("Player 2");
  });

  it("starts with a viable format and disables formats without two entries", () => {
    render(
      <TournamentFormatEntries
        formats={[
          { id: "five", label: "5 vs 5", playersPerSide: 5 },
          { id: "two", label: "2 vs 2", playersPerSide: 2 }
        ]}
        players={players}
        initialFormatId="five"
      />
    );

    const formatSelect = screen.getByRole("combobox", {
      name: "Game format"
    });
    expect(formatSelect).toHaveTextContent("2 vs 2");
    fireEvent.click(formatSelect);
    expect(
      screen.getByRole("option", {
        name: "5 vs 5 — not enough active players"
      })
    ).toBeDisabled();
    expect(screen.getAllByRole("group", { name: /Entry/ })).toHaveLength(4);
  });
});
