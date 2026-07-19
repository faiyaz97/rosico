"use client";

import { useActionState } from "react";

import {
  savePlayerAction,
  type EntityActionState
} from "@/app/actions/entities";
import { Field, UploadField } from "@/components/ui";

const initialState: EntityActionState = {};

export function PlayerEditForm({
  groupId,
  player
}: {
  groupId: string;
  player?: { id: string; displayName: string };
}) {
  const [state, action, pending] = useActionState(
    savePlayerAction,
    initialState
  );
  return (
    <form className="form-shell" action={action}>
      <input type="hidden" name="groupId" value={groupId} />
      {player && <input type="hidden" name="playerId" value={player.id} />}
      <input
        type="hidden"
        name="destination"
        value={
          player
            ? `/app/groups/${groupId}/players/${player.id}`
            : `/app/groups/${groupId}/players`
        }
      />
      <div className="form-section">
        <h2>Player details</h2>
        <p>
          {player
            ? "Update the name or replace the profile image."
            : "Names do not need to be unique."}
        </p>
        {state.error && (
          <p className="form-message form-message-error" role="alert">
            {state.error}
          </p>
        )}
        <div className="field-row">
          <Field
            label="Display name"
            name="displayName"
            defaultValue={player?.displayName}
            placeholder="Elena Rossi"
            required
          />
          <UploadField
            label={player ? "Replace player image" : "Player image"}
          />
        </div>
      </div>
      <div className="form-actions">
        <a
          className="button button-quiet"
          href={
            player
              ? `/app/groups/${groupId}/players/${player.id}`
              : `/app/groups/${groupId}/players`
          }
        >
          Cancel
        </a>
        <button
          className="button button-primary"
          type="submit"
          disabled={pending}
        >
          {pending ? "Saving…" : player ? "Save player" : "Add player"}
        </button>
      </div>
    </form>
  );
}
