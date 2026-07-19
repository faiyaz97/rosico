// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompetitionRail } from "@/components/competition-rail";
import { MatchRow, PageHeader } from "@/components/ui";

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

describe("CompetitionRail", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    Object.defineProperty(HTMLUListElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 260
    });
    Object.defineProperty(HTMLUListElement.prototype, "scrollWidth", {
      configurable: true,
      get: () => 500
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLUListElement.prototype, "clientWidth");
    Reflect.deleteProperty(HTMLUListElement.prototype, "scrollWidth");
  });

  it("only renders the arrow for an available scroll direction", async () => {
    const { container } = render(
      <CompetitionRail
        groupId="group-1"
        competitions={[
          { id: "one", name: "One" },
          { id: "two", name: "Two" },
          { id: "three", name: "Three" }
        ]}
      />
    );

    expect(
      await screen.findByRole("button", { name: "Next competitions" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Previous competitions" })
    ).not.toBeInTheDocument();

    const viewport = container.querySelector("ul");
    expect(viewport).not.toBeNull();
    Object.defineProperty(viewport!, "scrollLeft", {
      configurable: true,
      writable: true,
      value: 240
    });
    fireEvent.scroll(viewport!);

    expect(
      await screen.findByRole("button", { name: "Previous competitions" })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Next competitions" })
      ).not.toBeInTheDocument()
    );
  });
});

describe("shared navigation and match rows", () => {
  afterEach(cleanup);

  it("renders a deterministic labelled back link", () => {
    render(
      <PageHeader
        title="Match details"
        backHref="/app/groups/group-1/games"
        backLabel="Match history"
      />
    );

    expect(screen.getByRole("link", { name: "Match history" })).toHaveAttribute(
      "href",
      "/app/groups/group-1/games"
    );
  });

  it("shows location and a visible winner label in the full-row link", () => {
    render(
      <MatchRow
        groupId="group-1"
        game={{
          id: "game-1",
          competition: "Table tennis",
          format: "Singles",
          playedAt: "18 Jul 2026",
          location: "Break room",
          sideA: "A very long player name",
          sideB: "Other player",
          scoreA: "11",
          scoreB: "8",
          winner: "A"
        }}
      />
    );

    const row = screen.getByRole("link", {
      name: /A very long player name won/
    });
    expect(row).toHaveAttribute("href", "/app/groups/group-1/games/game-1");
    expect(screen.getByText(/Break room/)).toBeInTheDocument();
    expect(screen.getByText("Winner")).toBeInTheDocument();
  });
});
