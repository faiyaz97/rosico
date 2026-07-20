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

  it("adds and removes players from one searchable participant picker", () => {
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

    const search = screen.getByRole("combobox", { name: "Add players" });
    expect(screen.queryByText("Entry 1")).not.toBeInTheDocument();

    fireEvent.focus(search);
    fireEvent.click(screen.getByRole("option", { name: "Player 1" }));
    expect(screen.getByText("Participant 1")).toBeInTheDocument();
    expect(document.querySelector('input[name="entry-0"]')).toHaveValue(
      "player-1"
    );

    fireEvent.click(search);
    expect(screen.getByRole("option", { name: "Player 2" })).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: "Player 2" }));
    expect(screen.getByLabelText("2 selected")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Remove Player 1" }));
    expect(screen.getByLabelText("1 selected")).toBeVisible();
    expect(document.querySelector('input[name="entry-0"]')).toHaveValue(
      "player-2"
    );
  });

  it("groups selected players by team when the format changes", () => {
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

    fireEvent.click(screen.getByRole("combobox", { name: "Game format" }));
    fireEvent.click(screen.getByRole("option", { name: "2 vs 2" }));

    const search = screen.getByRole("combobox", { name: "Add players" });
    for (const player of players.slice(0, 2)) {
      fireEvent.focus(search);
      fireEvent.click(screen.getByRole("option", { name: player.displayName }));
    }

    expect(screen.getByText("Team 1 · Player 1")).toBeInTheDocument();
    expect(screen.getByText("Team 1 · Player 2")).toBeInTheDocument();
    expect(document.querySelectorAll('input[name="entry-0"]')).toHaveLength(2);
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
    expect(
      screen.getByRole("combobox", { name: "Add players" })
    ).toBeInTheDocument();
  });

  it("shows only the rules that apply to the selected tournament type", () => {
    render(
      <TournamentFormatEntries
        formats={[{ id: "one", label: "1 vs 1", playersPerSide: 1 }]}
        players={players}
        initialFormatId="one"
        allowsDraws
      />
    );

    expect(
      screen.getByRole("combobox", { name: "Games per match" })
    ).toBeVisible();
    expect(screen.queryByLabelText("Win points")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "Type" }));
    fireEvent.click(screen.getByRole("option", { name: "Round-robin league" }));

    expect(
      screen.queryByRole("combobox", { name: "Games per match" })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Win points")).toBeVisible();
    expect(screen.getByLabelText("Draw points")).toBeVisible();
    expect(screen.getByLabelText("Loss points")).toBeVisible();
  });
});
