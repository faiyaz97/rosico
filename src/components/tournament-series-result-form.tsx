"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  recordTournamentSeriesAction,
  type TournamentSeriesActionState
} from "@/app/actions/tournament-series";
import { DateTimeControl } from "@/components/date-time-control";
import { SelectControl } from "@/components/select-control";
import {
  tournamentLegOutcome,
  tournamentSeriesProgress,
  type TournamentSeriesLeg,
  type TournamentSeriesOutcome,
  type TournamentSeriesRule
} from "@/lib/tournament-series-form";

type PlayerOption = {
  id: string;
  displayName: string;
};

const initialState: TournamentSeriesActionState = {};

function emptyLeg(): TournamentSeriesLeg {
  return { scoreA: "", scoreB: "", result: "" };
}

export function TournamentSeriesResultForm({
  groupId,
  competitionId,
  competitionName,
  formatId,
  formatLabel,
  tournamentMatchId,
  bestOf,
  sideAWins,
  sideBWins,
  sideA,
  sideB,
  rule,
  orderedValues,
  cancelHref
}: {
  groupId: string;
  competitionId: string;
  competitionName: string;
  formatId: string;
  formatLabel: string;
  tournamentMatchId: string;
  bestOf: number;
  sideAWins: number;
  sideBWins: number;
  sideA: PlayerOption[];
  sideB: PlayerOption[];
  rule: TournamentSeriesRule;
  orderedValues: string[];
  cancelHref: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    recordTournamentSeriesAction,
    initialState
  );
  const remainingLegs = Math.max(1, bestOf - sideAWins - sideBWins);
  const [legs, setLegs] = useState<TournamentSeriesLeg[]>(() =>
    Array.from({ length: remainingLegs }, emptyLeg)
  );
  const [playedAt, setPlayedAt] = useState("");
  const [location, setLocation] = useState("");
  const progress = useMemo(
    () =>
      tournamentSeriesProgress(
        legs,
        rule,
        orderedValues,
        sideAWins,
        sideBWins,
        bestOf
      ),
    [bestOf, legs, orderedValues, rule, sideAWins, sideBWins]
  );

  useEffect(() => {
    if (state.id) router.push(cancelHref);
  }, [cancelHref, router, state.id]);

  function updateLeg(index: number, changes: Partial<TournamentSeriesLeg>) {
    setLegs((current) =>
      current.map((leg, legIndex) =>
        legIndex === index ? { ...leg, ...changes } : leg
      )
    );
  }

  const submittedLegs = legs
    .slice(0, progress.completedLegs)
    .map((leg) =>
      rule.scoreType === "RESULT"
        ? { result: leg.result }
        : { scoreA: leg.scoreA, scoreB: leg.scoreB }
    );
  const sideAName = sideA.map((player) => player.displayName).join(" & ");
  const sideBName = sideB.map((player) => player.displayName).join(" & ");

  return (
    <form className="form-shell series-result-form" action={action}>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="formatId" value={formatId} />
      <input type="hidden" name="tournamentMatchId" value={tournamentMatchId} />
      {sideA.map((player) => (
        <input
          type="hidden"
          name="sideAPlayerIds"
          value={player.id}
          key={player.id}
        />
      ))}
      {sideB.map((player) => (
        <input
          type="hidden"
          name="sideBPlayerIds"
          value={player.id}
          key={player.id}
        />
      ))}
      <input type="hidden" name="legs" value={JSON.stringify(submittedLegs)} />

      {state.error && (
        <p className="form-message form-message-error" role="alert">
          {state.error}
        </p>
      )}

      <div className="form-section series-summary">
        <div>
          <span>{competitionName}</span>
          <small>{formatLabel}</small>
        </div>
        <div className="series-scoreboard" aria-label="Current series score">
          <strong>{sideAName}</strong>
          <span>
            {progress.sideAWins}–{progress.sideBWins}
          </span>
          <strong>{sideBName}</strong>
        </div>
        <p>
          Best of {bestOf}. The first side to {progress.winsNeeded} wins
          advances.
        </p>
      </div>

      <div className="form-section">
        <h2>Game results</h2>
        <p>
          Add the games in order. Later games become unavailable as soon as a
          side wins the series.
        </p>
        <div className="series-leg-list">
          {legs.map((leg, index) => {
            const previousComplete =
              index === 0 ||
              tournamentLegOutcome(legs[index - 1]!, rule, orderedValues) !==
                null;
            const disabled =
              !previousComplete ||
              (progress.clinchedAfter !== null &&
                index > progress.clinchedAfter);
            return (
              <fieldset className="series-leg" disabled={disabled} key={index}>
                <legend>
                  Game {index + 1} of {remainingLegs}
                </legend>
                {disabled && progress.clinchedAfter !== null ? (
                  <p className="series-leg-disabled">
                    Not needed—the series has already been won.
                  </p>
                ) : rule.scoreType === "RESULT" ? (
                  <div className="result-choice-group">
                    {(
                      [
                        { value: "A", label: `${sideAName} wins` },
                        ...(rule.allowsDraws
                          ? [{ value: "DRAW", label: "Draw" }]
                          : []),
                        { value: "B", label: `${sideBName} wins` }
                      ] as const
                    ).map((option) => (
                      <label className="result-choice" key={option.value}>
                        <input
                          type="radio"
                          name={`leg-${index}-result`}
                          value={option.value}
                          checked={leg.result === option.value}
                          onChange={() =>
                            updateLeg(index, {
                              result: option.value as TournamentSeriesOutcome
                            })
                          }
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="field-row two">
                    {(["A", "B"] as const).map((side) => (
                      <label className="field" key={side}>
                        <span>
                          {side === "A" ? sideAName : sideBName} score
                        </span>
                        {rule.scoreType === "ORDERED" ? (
                          <SelectControl
                            value={side === "A" ? leg.scoreA : leg.scoreB}
                            ariaLabel={`Game ${index + 1}, side ${side} score`}
                            placeholder="Choose a value"
                            onValueChange={(value) =>
                              updateLeg(
                                index,
                                side === "A"
                                  ? { scoreA: value }
                                  : { scoreB: value }
                              )
                            }
                            disabled={disabled}
                            options={orderedValues.map((value) => ({
                              label: value,
                              value
                            }))}
                          />
                        ) : (
                          <input
                            inputMode="decimal"
                            autoComplete="off"
                            value={side === "A" ? leg.scoreA : leg.scoreB}
                            onChange={(event) =>
                              updateLeg(
                                index,
                                side === "A"
                                  ? { scoreA: event.target.value }
                                  : { scoreB: event.target.value }
                              )
                            }
                          />
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>
      </div>

      <div className="form-section">
        <h2>Details</h2>
        <p>The date, time and location apply to every game submitted here.</p>
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
        <a className="button button-quiet" href={cancelHref}>
          Cancel
        </a>
        <button
          className="button button-primary"
          type="submit"
          disabled={pending || progress.completedLegs === 0}
        >
          {pending
            ? "Saving…"
            : `Save ${progress.completedLegs || ""} ${
                progress.completedLegs === 1 ? "result" : "results"
              }`.trim()}
        </button>
      </div>
    </form>
  );
}
