"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SelectControl } from "@/components/select-control";

const MIN_TEAM_SIZE = 1;
const MAX_TEAM_SIZE = 20;
const MAX_FORMATS = 10;

function normaliseSizes(initialSizes: number[]) {
  const uniqueSizes = [...new Set(initialSizes)].filter(
    (size) =>
      Number.isInteger(size) && size >= MIN_TEAM_SIZE && size <= MAX_TEAM_SIZE
  );

  return uniqueSizes.slice(0, MAX_FORMATS);
}

export function CompetitionFormatFields({
  initialSizes,
  description = "Teams are always equal in this version.",
  headingLevel = "h2"
}: {
  initialSizes: number[];
  description?: string;
  headingLevel?: "h2" | "h3";
}) {
  const [sizes, setSizes] = useState(() => {
    const validSizes = normaliseSizes(initialSizes);
    return validSizes.length ? validSizes : [MIN_TEAM_SIZE];
  });
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const errorId = useId();
  const errors = useMemo(
    () =>
      sizes.map((size, index) => {
        if (
          !Number.isInteger(size) ||
          size < MIN_TEAM_SIZE ||
          size > MAX_TEAM_SIZE
        )
          return `Enter a whole number from ${MIN_TEAM_SIZE} to ${MAX_TEAM_SIZE}.`;
        if (sizes.indexOf(size) !== index)
          return "Each team size can be added only once.";
        return undefined;
      }),
    [sizes]
  );
  const hasErrors = errors.some(Boolean);
  const canAdd = sizes.length < MAX_FORMATS;
  const Heading = headingLevel;

  useEffect(() => {
    errors.forEach((error, index) => {
      inputs.current[index]?.setCustomValidity(error ?? "");
    });
  }, [errors]);

  function updateSize(index: number, value: string) {
    const parsed = Number(value);
    setSizes((current) =>
      current.map((size, currentIndex) =>
        currentIndex === index ? parsed : size
      )
    );
  }

  function addSize() {
    const nextSize = Array.from(
      { length: MAX_TEAM_SIZE },
      (_, index) => index + MIN_TEAM_SIZE
    ).find((size) => !sizes.includes(size));
    if (nextSize === undefined) return;
    setSizes((current) => [...current, nextSize]);
  }

  function removeSize(index: number) {
    if (sizes.length === 1) return;
    setSizes((current) =>
      current.filter((_, currentIndex) => currentIndex !== index)
    );
  }

  return (
    <section className="form-section competition-configuration-section">
      <Heading>Game formats</Heading>
      <p>{description}</p>
      <fieldset
        className="competition-format-fields"
        aria-describedby={errorId}
      >
        <legend className="sr-only">Equal team sizes</legend>
        {sizes.map((size, index) => {
          const error = errors[index];
          const inputId = `team-size-${index}`;
          return (
            <div className="competition-format-row" key={`format-${index}`}>
              <label className="field" htmlFor={inputId}>
                <span>Players on each side</span>
                <input
                  id={inputId}
                  name="formats"
                  type="number"
                  min={MIN_TEAM_SIZE}
                  max={MAX_TEAM_SIZE}
                  step="1"
                  required
                  value={size}
                  ref={(element) => {
                    inputs.current[index] = element;
                  }}
                  aria-invalid={error ? "true" : undefined}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(event) => updateSize(index, event.target.value)}
                />
              </label>
              <strong aria-live="polite">
                {Number.isInteger(size) && size > 0
                  ? `${size} vs ${size}`
                  : "Invalid size"}
              </strong>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => removeSize(index)}
                disabled={sizes.length === 1}
                aria-label={`Remove ${size} versus ${size} format`}
              >
                Remove
              </button>
            </div>
          );
        })}
        <button
          className="button button-secondary"
          type="button"
          onClick={addSize}
          disabled={!canAdd}
        >
          Add team size
        </button>
        <p
          id={errorId}
          className="competition-format-help"
          role={hasErrors ? "alert" : undefined}
        >
          {hasErrors
            ? errors.find(Boolean)
            : `Add up to ${MAX_FORMATS} unique formats, from ${MIN_TEAM_SIZE} vs ${MIN_TEAM_SIZE} to ${MAX_TEAM_SIZE} vs ${MAX_TEAM_SIZE}.`}
        </p>
      </fieldset>
    </section>
  );
}

export function CompetitionScoringFields({
  defaultScoreType = "NUMERIC",
  defaultWinnerDirection = "HIGHER_WINS",
  defaultOrderedValues = "",
  defaultAllowsDraws = false,
  headingLevel = "h2"
}: {
  defaultScoreType?: string;
  defaultWinnerDirection?: string;
  defaultOrderedValues?: string;
  defaultAllowsDraws?: boolean;
  headingLevel?: "h2" | "h3";
}) {
  const [scoreType, setScoreType] = useState(defaultScoreType);
  const scoreTypeId = useId();
  const winnerDirectionId = useId();
  const orderedValuesId = useId();
  const resultBased = scoreType === "RESULT";
  const ordered = scoreType === "ORDERED";
  const Heading = headingLevel;

  return (
    <section className="form-section competition-configuration-section">
      <Heading>Scoring</Heading>
      <p className="competition-scoring-summary" aria-live="polite">
        {resultBased
          ? "Choose the winning side when recording each result. Scores and winner direction are not used."
          : ordered
            ? "Record one of your ordered values for each side. The winner is calculated from their position in the list."
            : "Record a number for each side. The winner is calculated from this configuration."}
      </p>
      <div className="field-row two">
        <label className="field" htmlFor={scoreTypeId}>
          <span>Score type</span>
          <SelectControl
            id={scoreTypeId}
            name="scoreType"
            value={scoreType}
            ariaLabel="Score type"
            onValueChange={setScoreType}
            options={[
              { label: "Numeric", value: "NUMERIC" },
              { label: "Ordered values", value: "ORDERED" },
              { label: "Result", value: "RESULT" }
            ]}
          />
          <small>Result records the winning side directly.</small>
        </label>
        {resultBased && (
          <input
            name="winnerDirection"
            type="hidden"
            value={defaultWinnerDirection}
          />
        )}
        <label className="field" htmlFor={winnerDirectionId}>
          <span>Winner rule</span>
          <SelectControl
            id={winnerDirectionId}
            name={resultBased ? undefined : "winnerDirection"}
            defaultValue={defaultWinnerDirection}
            disabled={resultBased}
            ariaLabel={
              resultBased
                ? "Winner rule, not used for result scoring"
                : "Winner rule"
            }
            options={[
              { label: "Higher score wins", value: "HIGHER_WINS" },
              { label: "Lower score wins", value: "LOWER_WINS" }
            ]}
          />
          <small id={resultBased ? "result-winner-help" : undefined}>
            {resultBased
              ? "Not used when the winning side is selected directly."
              : "Used to calculate the winner from the recorded scores."}
          </small>
        </label>
      </div>
      <div className="field-row">
        <label className="field" htmlFor={orderedValuesId}>
          <span>Ordered values</span>
          <input
            id={orderedValuesId}
            name="orderedValues"
            defaultValue={defaultOrderedValues}
            placeholder="Bronze, Silver, Gold"
            disabled={!ordered}
            required={ordered}
            aria-describedby="ordered-values-help"
          />
          <small id="ordered-values-help">
            {ordered
              ? "Required for ordered scoring, lowest to highest."
              : "Only used with ordered-value scoring."}
          </small>
        </label>
        <label className="choice">
          <input
            type="checkbox"
            name="drawsAllowed"
            defaultChecked={defaultAllowsDraws}
          />
          <span>
            <strong>Allow draws</strong>
            <small>
              {resultBased
                ? "Allow a result without a winning side."
                : "Equal final scores will be accepted."}
            </small>
          </span>
        </label>
      </div>
    </section>
  );
}
