"use client";

import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search } from "lucide-react";

import {
  recordGameAction,
  type EntityActionState
} from "@/app/actions/entities";
import { DateTimeControl } from "@/components/date-time-control";
import { SelectControl } from "@/components/select-control";

type PlayerOption = {
  id: string;
  displayName: string;
};

export function resultSuccessHref({
  groupId,
  gameId,
  tournamentMatchId,
  tournamentHref
}: {
  groupId: string;
  gameId: string;
  tournamentMatchId?: string;
  tournamentHref?: string;
}) {
  return tournamentMatchId && tournamentHref
    ? tournamentHref
    : `/app/groups/${groupId}/games/${gameId}`;
}

type Setup = {
  id: string;
  name: string;
  rule: {
    scoreType: "NUMERIC" | "ORDERED" | "RESULT";
    allowsDraws: boolean;
  };
  formats: Array<{
    id: string;
    label: string;
    playersPerSide: number;
  }>;
  players: PlayerOption[];
  scoreValues: string[];
};

function PlayerCombobox({
  label,
  name,
  players,
  selectedId,
  unavailableIds,
  onSelect
}: {
  label: string;
  name: string;
  players: PlayerOption[];
  selectedId: string;
  unavailableIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const selected = players.find((player) => player.id === selectedId);
  const [query, setQuery] = useState(selected?.displayName ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputId = useId();
  const listboxId = useId();
  const options = players
    .filter(
      (player) => player.id === selectedId || !unavailableIds.has(player.id)
    )
    .filter((player) =>
      player.displayName.toLowerCase().includes(query.trim().toLowerCase())
    )
    .slice(0, 8);
  const highlightedIndex = options.length
    ? Math.min(activeIndex, options.length - 1)
    : 0;

  function choosePlayer(player: PlayerOption) {
    onSelect(player.id);
    setQuery(player.displayName);
    setOpen(false);
  }

  return (
    <div className="player-combobox">
      <label htmlFor={inputId}>
        <span>{label}</span>
        <span className="combobox-control">
          <Search size={17} aria-hidden="true" />
          <input
            id={inputId}
            value={query}
            required
            aria-required="true"
            aria-invalid={Boolean(query.trim() && !selectedId)}
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
            placeholder="Search player"
            onFocus={() => {
              setActiveIndex(0);
              setOpen(true);
            }}
            onBlur={() => setOpen(false)}
            onChange={(event) => {
              setQuery(event.target.value);
              if (selectedId) onSelect("");
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
              if (event.key === "Enter" && open && options[highlightedIndex]) {
                event.preventDefault();
                choosePlayer(options[highlightedIndex]);
              }
            }}
          />
        </span>
      </label>
      {selectedId && <input type="hidden" name={name} value={selectedId} />}
      {open && (
        <div className="combobox-options" role="listbox" id={listboxId}>
          {options.length ? (
            options.map((player, index) => (
              <button
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={player.id === selectedId}
                data-highlighted={
                  index === highlightedIndex ? "true" : undefined
                }
                key={player.id}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choosePlayer(player)}
              >
                <span>{player.displayName}</span>
                {player.id === selectedId && <Check size={16} />}
              </button>
            ))
          ) : (
            <p>No available players match that name.</p>
          )}
        </div>
      )}
    </div>
  );
}

const initialState: EntityActionState = {};

export function RecordResultForm({
  groupId,
  setups,
  initialCompetitionId,
  initialFormatId,
  tournamentMatchId,
  fixedSideA,
  fixedSideB,
  cancelHref
}: {
  groupId: string;
  setups: Setup[];
  initialCompetitionId: string;
  initialFormatId?: string;
  tournamentMatchId?: string;
  fixedSideA?: PlayerOption[];
  fixedSideB?: PlayerOption[];
  cancelHref?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    recordGameAction,
    initialState
  );
  const [competitionId, setCompetitionId] = useState(initialCompetitionId);
  const activeSetup =
    setups.find((setup) => setup.id === competitionId) ?? setups[0]!;
  const [formatId, setFormatId] = useState(
    initialFormatId ?? activeSetup.formats[0]?.id ?? ""
  );
  const activeFormat =
    activeSetup.formats.find((format) => format.id === formatId) ??
    activeSetup.formats[0];
  const teamSize = activeFormat?.playersPerSide ?? 1;
  const [sideA, setSideA] = useState<string[]>(
    fixedSideA?.map((player) => player.id) ?? Array(teamSize).fill("")
  );
  const [sideB, setSideB] = useState<string[]>(
    fixedSideB?.map((player) => player.id) ?? Array(teamSize).fill("")
  );
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [result, setResult] = useState<"" | "A" | "B" | "DRAW">("");
  const [playedAt, setPlayedAt] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (state.id) {
      router.push(
        resultSuccessHref({
          groupId,
          gameId: state.id,
          tournamentMatchId,
          tournamentHref: cancelHref
        })
      );
    }
  }, [cancelHref, groupId, router, state.id, tournamentMatchId]);

  const selectedIds = useMemo(
    () => new Set([...sideA, ...sideB].filter(Boolean)),
    [sideA, sideB]
  );

  function updateSlot(side: "A" | "B", index: number, playerId: string) {
    const setter = side === "A" ? setSideA : setSideB;
    setter((current) =>
      current.map((value, slot) => (slot === index ? playerId : value))
    );
  }

  return (
    <form className="form-shell" action={action}>
      <input type="hidden" name="groupId" value={groupId} />
      {tournamentMatchId && (
        <input
          type="hidden"
          name="tournamentMatchId"
          value={tournamentMatchId}
        />
      )}
      {state.error && (
        <p
          className="form-message form-message-error result-form-error"
          role="alert"
        >
          {state.error}
        </p>
      )}
      <div className="form-section">
        <h2>Competition and format</h2>
        <p>Choose the rules and exact team size for this result.</p>
        <div className="field-row two">
          <label className="field">
            <span>Competition</span>
            <SelectControl
              name="competitionId"
              value={activeSetup.id}
              ariaLabel="Competition"
              disabled={Boolean(tournamentMatchId)}
              onValueChange={(value) => {
                const next = setups.find((setup) => setup.id === value);
                if (!next) return;
                setCompetitionId(next.id);
                const nextFormat = next.formats[0];
                setFormatId(nextFormat?.id ?? "");
                setSideA(Array(nextFormat?.playersPerSide ?? 1).fill(""));
                setSideB(Array(nextFormat?.playersPerSide ?? 1).fill(""));
                setScoreA("");
                setScoreB("");
                setResult("");
              }}
              options={setups.map((setup) => ({
                label: setup.name,
                value: setup.id
              }))}
            />
          </label>
          {tournamentMatchId && (
            <input type="hidden" name="competitionId" value={activeSetup.id} />
          )}
          <label className="field">
            <span>Game format</span>
            <SelectControl
              name="formatId"
              value={activeFormat?.id ?? ""}
              ariaLabel="Game format"
              disabled={Boolean(tournamentMatchId)}
              onValueChange={(nextId) => {
                const next = activeSetup.formats.find(
                  (format) => format.id === nextId
                );
                setFormatId(nextId);
                setSideA(Array(next?.playersPerSide ?? 1).fill(""));
                setSideB(Array(next?.playersPerSide ?? 1).fill(""));
              }}
              options={activeSetup.formats.map((format) => ({
                label: `${format.label} · ${format.playersPerSide} per side`,
                value: format.id
              }))}
            />
          </label>
          {tournamentMatchId && (
            <input
              type="hidden"
              name="formatId"
              value={activeFormat?.id ?? ""}
            />
          )}
        </div>
      </div>

      <div className="form-section">
        <h2>Choose sides</h2>
        <p>
          {tournamentMatchId
            ? "Tournament entries are fixed for this match."
            : `Choose exactly ${teamSize} player${teamSize === 1 ? "" : "s"} per side.`}
        </p>
        {fixedSideA && fixedSideB ? (
          <div className="field-row two">
            {[fixedSideA, fixedSideB].map((side, sideIndex) => (
              <div className="surface surface-pad fixed-team" key={sideIndex}>
                <strong>Side {sideIndex === 0 ? "A" : "B"}</strong>
                {side.map((player) => (
                  <div key={player.id}>
                    <input
                      type="hidden"
                      name={
                        sideIndex === 0 ? "sideAPlayerIds" : "sideBPlayerIds"
                      }
                      value={player.id}
                    />
                    {player.displayName}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="team-selector-grid">
            <fieldset>
              <legend>Side A</legend>
              {Array.from({ length: teamSize }, (_, index) => (
                <PlayerCombobox
                  key={`${competitionId}-${formatId}-a-${index}`}
                  label={`Player ${index + 1}`}
                  name="sideAPlayerIds"
                  players={activeSetup.players}
                  selectedId={sideA[index] ?? ""}
                  unavailableIds={
                    new Set(
                      [...selectedIds].filter((id) => id !== sideA[index])
                    )
                  }
                  onSelect={(id) => updateSlot("A", index, id)}
                />
              ))}
            </fieldset>
            <fieldset>
              <legend>Side B</legend>
              {Array.from({ length: teamSize }, (_, index) => (
                <PlayerCombobox
                  key={`${competitionId}-${formatId}-b-${index}`}
                  label={`Player ${index + 1}`}
                  name="sideBPlayerIds"
                  players={activeSetup.players}
                  selectedId={sideB[index] ?? ""}
                  unavailableIds={
                    new Set(
                      [...selectedIds].filter((id) => id !== sideB[index])
                    )
                  }
                  onSelect={(id) => updateSlot("B", index, id)}
                />
              ))}
            </fieldset>
          </div>
        )}
      </div>

      <div className="form-section">
        <h2>Final score</h2>
        <p>
          {activeSetup.rule.scoreType === "RESULT"
            ? activeSetup.rule.allowsDraws
              ? "Choose the winner, or record a draw."
              : "Choose which side won."
            : activeSetup.rule.scoreType === "ORDERED"
              ? `Choose from: ${activeSetup.scoreValues.join(", ")}.`
              : activeSetup.rule.allowsDraws
                ? "Enter the final numeric score. Draws are allowed."
                : "Enter the final numeric score. The final scores must be different."}
        </p>
        {activeSetup.rule.scoreType === "RESULT" ? (
          <fieldset className="result-choice-group">
            <legend className="sr-only">Final result</legend>
            {(
              [
                { value: "A", label: "Side A wins" },
                ...(activeSetup.rule.allowsDraws
                  ? [{ value: "DRAW", label: "Draw" }]
                  : []),
                { value: "B", label: "Side B wins" }
              ] as const
            ).map((option) => (
              <label className="result-choice" key={option.value}>
                <input
                  type="radio"
                  name="result"
                  value={option.value}
                  checked={result === option.value}
                  onChange={() => setResult(option.value as "A" | "B" | "DRAW")}
                  required
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="field-row two">
            {(["A", "B"] as const).map((side) => (
              <label className="field" key={side}>
                <span>Side {side} score</span>
                {activeSetup.rule.scoreType === "ORDERED" ? (
                  <SelectControl
                    name={`score${side}`}
                    required
                    ariaLabel={`Side ${side} score`}
                    placeholder="Choose a value"
                    value={side === "A" ? scoreA : scoreB}
                    onValueChange={(value) =>
                      side === "A" ? setScoreA(value) : setScoreB(value)
                    }
                    options={activeSetup.scoreValues.map((value) => ({
                      label: value,
                      value
                    }))}
                  />
                ) : (
                  <input
                    name={`score${side}`}
                    inputMode="decimal"
                    required
                    autoComplete="off"
                    value={side === "A" ? scoreA : scoreB}
                    onChange={(event) =>
                      side === "A"
                        ? setScoreA(event.target.value)
                        : setScoreB(event.target.value)
                    }
                  />
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="form-section">
        <h2>Details</h2>
        <p>Optional context for the match history.</p>
        <div className="field-row two">
          <label className="field">
            <span>Date and time</span>
            <DateTimeControl
              name="playedAt"
              value={playedAt}
              ariaLabel="Date and time"
              onValueChange={setPlayedAt}
            />
          </label>
          <label className="field">
            <span>Location</span>
            <input
              name="location"
              placeholder="Break room"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="form-actions">
        <a
          className="button button-quiet"
          href={cancelHref ?? `/app/groups/${groupId}/games`}
        >
          Cancel
        </a>
        <button
          className="button button-primary"
          type="submit"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save result"}
        </button>
      </div>
    </form>
  );
}
