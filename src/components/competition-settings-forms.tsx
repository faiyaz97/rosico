"use client";

import { useActionState } from "react";

import {
  type CompetitionSettingsActionState,
  updateCompetitionIdentityAction,
  updateCompetitionRulesAction
} from "@/app/actions/competition-settings";
import {
  CompetitionFormatFields,
  CompetitionScoringFields
} from "@/components/competition-format-fields";
import { Field, UploadField } from "@/components/ui";

const initialState: CompetitionSettingsActionState = {};

function ActionMessage({ state }: { state: CompetitionSettingsActionState }) {
  if (state.error) {
    return (
      <p className="form-message form-message-error" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="form-message form-message-success" role="status">
        {state.success}
      </p>
    );
  }
  return null;
}

export function CompetitionIdentitySettingsForm({
  groupId,
  competitionId,
  name,
  description
}: {
  groupId: string;
  competitionId: string;
  name: string;
  description: string | null;
}) {
  const [state, action, pending] = useActionState(
    updateCompetitionIdentityAction,
    initialState
  );

  return (
    <form
      className="surface competition-settings-panel competition-settings-identity"
      action={action}
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <header className="competition-settings-heading">
        <h2>Competition identity</h2>
        <p>Shown in this group and on shared images.</p>
      </header>
      <ActionMessage state={state} />
      <div className="field-row">
        <Field
          label="Name"
          name="name"
          defaultValue={state.fields?.name ?? name}
          required
        />
        <label className="field">
          <span>Description</span>
          <textarea
            name="description"
            defaultValue={state.fields?.description ?? description ?? ""}
          />
        </label>
        <UploadField label="Competition image" />
      </div>
      <div className="form-actions">
        <button
          className="button button-primary"
          type="submit"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save identity"}
        </button>
      </div>
    </form>
  );
}

export function CompetitionRulesSettingsForm({
  groupId,
  competitionId,
  formats,
  rule,
  orderedValues
}: {
  groupId: string;
  competitionId: string;
  formats: number[];
  rule: {
    scoreType: string;
    winnerDirection: string;
    allowsDraws: boolean;
  };
  orderedValues: string;
}) {
  const [state, action, pending] = useActionState(
    updateCompetitionRulesAction,
    initialState
  );
  const submitted = state.ruleFields;
  const formStateKey = submitted
    ? JSON.stringify(submitted)
    : "persisted-configuration";

  return (
    <form
      key={formStateKey}
      className="surface competition-settings-panel competition-settings-rules"
      action={action}
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <header className="competition-settings-heading">
        <h2>Formats and scoring</h2>
        <p>
          Saving creates a new rule version. Existing games are never
          recalculated.
        </p>
      </header>
      <ActionMessage state={state} />
      <div className="competition-settings-config-grid">
        <CompetitionFormatFields
          key={`formats-${formStateKey}`}
          initialSizes={submitted?.formats ?? formats}
          description="Add each equal-team size this competition supports."
          headingLevel="h3"
        />
        <CompetitionScoringFields
          key={`scoring-${formStateKey}`}
          defaultScoreType={submitted?.scoreType ?? rule.scoreType}
          defaultWinnerDirection={
            submitted?.winnerDirection ?? rule.winnerDirection
          }
          defaultOrderedValues={submitted?.orderedValues ?? orderedValues}
          defaultAllowsDraws={submitted?.allowsDraws ?? rule.allowsDraws}
          headingLevel="h3"
        />
      </div>
      <div className="form-actions">
        <button
          className="button button-primary"
          type="submit"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save new rule version"}
        </button>
      </div>
    </form>
  );
}
