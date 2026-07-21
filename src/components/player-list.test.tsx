// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PlayerList } from "@/components/player-list";

const players = [
  {
    id: "ada",
    displayName: "Ada Lovelace",
    imagePath: null,
    archived: false
  },
  {
    id: "grace",
    displayName: "Grace Hopper",
    imagePath: null,
    archived: true
  }
];

describe("PlayerList", () => {
  afterEach(cleanup);

  it("filters names case-insensitively and keeps archived players searchable", () => {
    render(<PlayerList groupId="group-1" players={players} />);

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search players" }),
      {
        target: { value: "gRaCe" }
      }
    );

    expect(screen.getByRole("link", { name: /Grace Hopper/ })).toHaveAttribute(
      "href",
      "/app/groups/group-1/players/grace"
    );
    expect(
      screen.queryByRole("link", { name: /Ada Lovelace/ })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 player");
  });

  it("shows a recoverable no-results state and clears all filters", () => {
    render(<PlayerList groupId="group-1" players={players} />);

    fireEvent.click(screen.getByRole("combobox", { name: "Player status" }));
    fireEvent.click(screen.getByRole("option", { name: "Active" }));
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search players" }),
      {
        target: { value: "Nobody" }
      }
    );

    expect(screen.getByText("No matching players")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(
      screen.getByRole("searchbox", { name: "Search players" })
    ).toHaveValue("");
    expect(
      screen.getByRole("combobox", { name: "Player status" })
    ).toHaveTextContent("All");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
