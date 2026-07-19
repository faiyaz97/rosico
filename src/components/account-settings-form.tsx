"use client";

import { useActionState } from "react";

import { updateProfileAction, type AuthActionState } from "@/app/actions/auth";
import { Avatar, Field, UploadField } from "@/components/ui";

const initialState: AuthActionState = {};

export function AccountSettingsForm({
  profile
}: {
  profile: {
    displayName: string;
    email: string;
    imagePath: string | null;
  };
}) {
  const [state, action, pending] = useActionState(
    updateProfileAction,
    initialState
  );
  return (
    <form className="settings-profile-form" action={action}>
      <div className="settings-avatar-row">
        <Avatar
          player={{ name: profile.displayName, imagePath: profile.imagePath }}
          size="lg"
        />
        <div>
          <h2>Profile</h2>
          <p>Your name and image identify you to group administrators.</p>
        </div>
      </div>
      {state.error && (
        <p className="form-message form-message-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="form-message form-message-success" role="status">
          {state.success}
        </p>
      )}
      <div className="field-row">
        <Field
          label="Display name"
          name="displayName"
          defaultValue={state.fields?.displayName ?? profile.displayName}
          required
        />
        <label className="field">
          <span>Email address</span>
          <input
            type="email"
            value={profile.email}
            readOnly
            aria-readonly="true"
          />
          <small>Email changes are not available in this version.</small>
        </label>
        <UploadField label="Replace profile image" />
      </div>
      <div className="form-actions">
        <button
          className="button button-primary"
          type="submit"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
