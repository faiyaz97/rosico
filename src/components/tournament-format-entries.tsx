"use client";

import { useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { SelectControl } from "@/components/select-control";
import { Field } from "@/components/ui";
import {
  selectInitialTournamentFormat,
  tournamentFormatCapacity,
  type TournamentFormatOption
} from "@/lib/tournament-formats";

type Format = TournamentFormatOption;

type Player = {
  id: string;
  displayName: string;
};

function ParticipantPicker({
  players,
  selectedIds,
  maximum,
  playersPerSide,
  onAdd,
  onRemove
}: {
  players: Player[];
  selectedIds: string[];
  maximum: number;
  playersPerSide: number;
  onAdd: (playerId: string) => void;
  onRemove: (playerId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showValidation, setShowValidation] = useState(false);
  const inputId = useId();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedSet = new Set(selectedIds);
  const options = players
    .filter((player) => !selectedSet.has(player.id))
    .filter((player) =>
      player.displayName.toLowerCase().includes(query.trim().toLowerCase())
    )
    .slice(0, 8);
  const highlightedIndex = options.length
    ? Math.min(activeIndex, options.length - 1)
    : 0;
  const completeEntries = Math.floor(selectedIds.length / playersPerSide);
  const missingForNextEntry =
    selectedIds.length % playersPerSide === 0
      ? 0
      : playersPerSide - (selectedIds.length % playersPerSide);
  const selectionIsValid = completeEntries >= 2 && missingForNextEntry === 0;
  const atCapacity = selectedIds.length >= maximum;

  function choosePlayer(player: Player) {
    onAdd(player.id);
    setQuery("");
    setActiveIndex(0);
    setShowValidation(false);
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className="tournament-participant-picker">
      <div className="participant-search-wrap">
        <label className="participant-search" htmlFor={inputId}>
          <span>Add players</span>
          <span className="combobox-control">
            <Search size={17} aria-hidden="true" />
            <input
              ref={inputRef}
              id={inputId}
              value={query}
              disabled={atCapacity}
              autoComplete="off"
              role="combobox"
              aria-controls={listboxId}
              aria-expanded={open}
              aria-autocomplete="list"
              aria-activedescendant={
                open && options[highlightedIndex]
                  ? `${listboxId}-option-${highlightedIndex}`
                  : undefined
              }
              placeholder={
                atCapacity
                  ? "All available players added"
                  : "Search and add a player"
              }
              onFocus={() => {
                setActiveIndex(0);
                setOpen(!atCapacity);
              }}
              onClick={() => {
                if (!atCapacity) setOpen(true);
              }}
              onBlur={() => setOpen(false)}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  return;
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setOpen(true);
                  if (!options.length) return;
                  setActiveIndex((current) => {
                    const direction = event.key === "ArrowDown" ? 1 : -1;
                    const normalized = Math.min(current, options.length - 1);
                    return (
                      (normalized + direction + options.length) % options.length
                    );
                  });
                  return;
                }
                if (
                  event.key === "Enter" &&
                  open &&
                  options[highlightedIndex]
                ) {
                  event.preventDefault();
                  choosePlayer(options[highlightedIndex]);
                }
              }}
            />
          </span>
        </label>

        {open && (
          <div className="combobox-options" role="listbox" id={listboxId}>
            {options.length ? (
              options.map((player, index) => (
                <button
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected="false"
                  data-highlighted={
                    index === highlightedIndex ? "true" : undefined
                  }
                  key={player.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choosePlayer(player)}
                >
                  {player.displayName}
                </button>
              ))
            ) : (
              <p>No available players match that name.</p>
            )}
          </div>
        )}
      </div>

      <select
        className="custom-select-native"
        value={selectionIsValid ? "valid" : ""}
        required
        tabIndex={-1}
        aria-hidden="true"
        onChange={() => undefined}
        onInvalid={(event) => {
          event.preventDefault();
          setShowValidation(true);
          inputRef.current?.focus();
        }}
      >
        <option value="" />
        <option value="valid">Valid participant selection</option>
      </select>

      <div className="participant-selection" aria-live="polite">
        <div className="participant-selection-heading">
          <strong>
            Selected participants{" "}
            <span aria-label={`${selectedIds.length} selected`}>
              {selectedIds.length}
            </span>
          </strong>
          <small>
            {playersPerSide === 1
              ? "Each player enters individually."
              : `Teams are formed in selection order, ${playersPerSide} players per team.`}
          </small>
        </div>

        {selectedIds.length ? (
          <ol className="participant-list">
            {selectedIds.map((playerId, index) => {
              const player = players.find((item) => item.id === playerId);
              const entryIndex = Math.floor(index / playersPerSide);
              const slotIndex = index % playersPerSide;
              return (
                <li key={playerId}>
                  <span className="participant-order">{index + 1}</span>
                  <span className="participant-name">
                    <strong>{player?.displayName}</strong>
                    <small>
                      {playersPerSide === 1
                        ? `Participant ${entryIndex + 1}`
                        : `Team ${entryIndex + 1} · Player ${slotIndex + 1}`}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="participant-remove"
                    aria-label={`Remove ${player?.displayName}`}
                    onClick={() => {
                      onRemove(playerId);
                      setShowValidation(false);
                    }}
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                  <input
                    type="hidden"
                    name={`entry-${entryIndex}`}
                    value={playerId}
                  />
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="participant-empty">
            Search above to add at least{" "}
            {playersPerSide === 1 ? "two players" : "two complete teams"}.
          </p>
        )}

        {(showValidation || missingForNextEntry > 0) && !selectionIsValid && (
          <p className="participant-validation" role="alert">
            {missingForNextEntry > 0
              ? `Add ${missingForNextEntry} more ${missingForNextEntry === 1 ? "player" : "players"} to complete the next team.`
              : `Add at least ${playersPerSide * 2} players to create two complete entries.`}
          </p>
        )}
      </div>
    </div>
  );
}

export function TournamentFormatEntries({
  formats,
  players,
  initialFormatId,
  allowsDraws = false
}: {
  formats: Format[];
  players: Player[];
  initialFormatId: string;
  allowsDraws?: boolean;
}) {
  const initialFormat = selectInitialTournamentFormat(
    formats,
    players.length,
    initialFormatId
  );
  const [formatId, setFormatId] = useState(
    initialFormat?.id ?? initialFormatId
  );
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [tournamentType, setTournamentType] = useState<
    "ELIMINATION" | "LEAGUE"
  >("ELIMINATION");
  const selectedFormat =
    formats.find((format) => format.id === formatId) ??
    initialFormat ??
    formats[0]!;
  const entryCapacity = tournamentFormatCapacity(
    selectedFormat,
    players.length
  );

  return (
    <>
      <div className="form-section">
        <h2>Basics</h2>
        <p>Tournament structure cannot change after results are recorded.</p>
        <div className="field-row">
          <Field
            label="Tournament name"
            name="name"
            placeholder="Summer Knockout"
            required
          />
          <div className="field-row two">
            <label className="field">
              <span>Type</span>
              <SelectControl
                name="type"
                ariaLabel="Type"
                value={tournamentType}
                onValueChange={(value) =>
                  setTournamentType(value as "ELIMINATION" | "LEAGUE")
                }
                options={[
                  { label: "Single elimination", value: "ELIMINATION" },
                  { label: "Round-robin league", value: "LEAGUE" }
                ]}
              />
            </label>
            <label className="field">
              <span>Game format</span>
              <SelectControl
                name="formatId"
                value={selectedFormat.id}
                ariaLabel="Game format"
                onValueChange={(nextFormatId) => {
                  setFormatId(nextFormatId);
                  setSelectedPlayerIds([]);
                }}
                options={formats.map((format) => {
                  const available =
                    tournamentFormatCapacity(format, players.length) >= 2;
                  return {
                    value: format.id,
                    label: `${format.label}${available ? "" : " — not enough active players"}`,
                    disabled: !available
                  };
                })}
              />
            </label>
          </div>
          <Field label="Start date" name="startsAt" type="date" required />
        </div>
      </div>
      <div className="form-section">
        <h2>Participants</h2>
        <p>
          Add each player once. Remove and re-add a player to change the
          selection order before creating the draft.
        </p>
        <ParticipantPicker
          players={players}
          selectedIds={selectedPlayerIds}
          maximum={entryCapacity * selectedFormat.playersPerSide}
          playersPerSide={selectedFormat.playersPerSide}
          onAdd={(playerId) =>
            setSelectedPlayerIds((current) =>
              current.includes(playerId) ? current : [...current, playerId]
            )
          }
          onRemove={(playerId) =>
            setSelectedPlayerIds((current) =>
              current.filter((id) => id !== playerId)
            )
          }
        />
      </div>
      <div className="form-section">
        <h2>Tournament rules</h2>
        <p>
          {tournamentType === "ELIMINATION"
            ? "Choose how many games make up each bracket match."
            : "Set the points awarded in the round-robin table."}
        </p>
        {tournamentType === "ELIMINATION" ? (
          <label className="field">
            <span>Games per match</span>
            <SelectControl
              name="bestOf"
              ariaLabel="Games per match"
              defaultValue="1"
              options={[
                { label: "Best of 1", value: "1" },
                { label: "Best of 3", value: "3" },
                { label: "Best of 5", value: "5" },
                { label: "Best of 7", value: "7" }
              ]}
            />
          </label>
        ) : (
          <div className="field-row three">
            <Field
              label="Win points"
              name="winPoints"
              type="number"
              defaultValue="3"
            />
            {allowsDraws && (
              <Field
                label="Draw points"
                name="drawPoints"
                type="number"
                defaultValue="1"
              />
            )}
            <Field
              label="Loss points"
              name="lossPoints"
              type="number"
              defaultValue="0"
            />
          </div>
        )}
      </div>
    </>
  );
}
