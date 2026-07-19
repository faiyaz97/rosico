"use client";

import { useState } from "react";

import { Field, SelectField } from "@/components/ui";
import { SelectControl } from "@/components/select-control";

type Format = {
  id: string;
  label: string;
  playersPerSide: number;
};

type Player = {
  id: string;
  displayName: string;
};

export function tournamentFormatCapacity(format: Format, playerCount: number) {
  return Math.min(8, Math.floor(playerCount / format.playersPerSide));
}

export function selectInitialTournamentFormat(
  formats: Format[],
  playerCount: number,
  requestedFormatId?: string
) {
  const requested = formats.find((format) => format.id === requestedFormatId);
  if (requested && tournamentFormatCapacity(requested, playerCount) >= 2) {
    return requested;
  }
  return formats.find(
    (format) => tournamentFormatCapacity(format, playerCount) >= 2
  );
}

export function TournamentFormatEntries({
  formats,
  players,
  initialFormatId
}: {
  formats: Format[];
  players: Player[];
  initialFormatId: string;
}) {
  const initialFormat = selectInitialTournamentFormat(
    formats,
    players.length,
    initialFormatId
  );
  const [formatId, setFormatId] = useState(
    initialFormat?.id ?? initialFormatId
  );
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
            <SelectField
              label="Type"
              name="type"
              options={[
                { label: "Single elimination", value: "ELIMINATION" },
                { label: "Round-robin league", value: "LEAGUE" }
              ]}
            />
            <label className="field">
              <span>Game format</span>
              <SelectControl
                name="formatId"
                value={selectedFormat.id}
                ariaLabel="Game format"
                onValueChange={setFormatId}
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
        <h2>Fixed entries</h2>
        <p>
          Fill at least two complete entries. Each player may enter only once.
        </p>
        <div className="field-row">
          {Array.from({ length: entryCapacity }, (_, index) => (
            <fieldset className="surface surface-pad" key={index}>
              <legend style={{ fontWeight: 800 }}>Entry {index + 1}</legend>
              <div className="field-row two">
                {Array.from(
                  { length: selectedFormat.playersPerSide },
                  (_, slot) => (
                    <label className="field" key={slot}>
                      <span>Player {slot + 1}</span>
                      <SelectControl
                        name={`entry-${index}`}
                        ariaLabel={`Entry ${index + 1}, Player ${slot + 1}`}
                        defaultValue=""
                        placeholder="Choose player"
                        options={players.map((player) => ({
                          label: player.displayName,
                          value: player.id
                        }))}
                      />
                    </label>
                  )
                )}
              </div>
            </fieldset>
          ))}
        </div>
      </div>
    </>
  );
}
