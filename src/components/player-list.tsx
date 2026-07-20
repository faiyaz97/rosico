"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Search, SearchX } from "lucide-react";
import { Avatar, Status } from "@/components/ui";

type PlayerListItem = {
  id: string;
  displayName: string;
  imagePath: string | null;
  archived: boolean;
};

type PlayerStatus = "Active" | "Archived" | "All";

export function PlayerList({
  groupId,
  players
}: {
  groupId: string;
  players: PlayerListItem[];
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PlayerStatus>("All");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visiblePlayers = useMemo(
    () =>
      players.filter((player) => {
        const matchesStatus =
          status === "All" ||
          (status === "Archived" ? player.archived : !player.archived);
        const matchesQuery =
          !normalizedQuery ||
          player.displayName.toLocaleLowerCase().includes(normalizedQuery);
        return matchesStatus && matchesQuery;
      }),
    [normalizedQuery, players, status]
  );

  const clearFilters = () => {
    setQuery("");
    setStatus("All");
  };

  return (
    <>
      <div className="player-list-toolbar">
        <label className="player-list-search" htmlFor={searchId}>
          <span className="sr-only">Search players</span>
          <Search size={18} aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search players"
            autoComplete="off"
          />
        </label>
        <div className="filter-bar player-status-filter">
          <div className="segmented" role="group" aria-label="Player status">
            {(["Active", "Archived", "All"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={option === status ? "active" : ""}
                aria-pressed={option === status}
                onClick={() => setStatus(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <span className="active-period" role="status" aria-live="polite">
            {visiblePlayers.length}{" "}
            {visiblePlayers.length === 1 ? "player" : "players"}
          </span>
        </div>
      </div>

      {visiblePlayers.length ? (
        <div className="entity-list">
          {visiblePlayers.map((player) => (
            <Link
              className="entity-row"
              href={`/app/groups/${groupId}/players/${player.id}`}
              key={player.id}
            >
              <Avatar
                player={{
                  name: player.displayName,
                  imagePath: player.imagePath
                }}
              />
              <span className="entity-row-main">
                <b>{player.displayName}</b>
                <small>
                  {player.archived
                    ? "Kept in historical games and statistics"
                    : "Available for new games and tournaments"}
                </small>
              </span>
              {player.archived ? (
                <Status>
                  <Archive size={12} aria-hidden="true" /> Archived
                </Status>
              ) : (
                <Status tone="success">Active</Status>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="player-filter-empty" role="status">
          <SearchX size={24} aria-hidden="true" />
          <div>
            <strong>No matching players</strong>
            <p>Try another name or include a different player status.</p>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
