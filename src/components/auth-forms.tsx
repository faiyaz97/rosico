"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  type AuthActionState
} from "@/app/actions/auth";
import { Field } from "./ui";

const initialState: AuthActionState = {};

function Message({ state }: { state: AuthActionState }) {
  if (state.error)
    return (
      <p className="form-message form-message-error" role="alert">
        {state.error}
      </p>
    );
  if (state.success)
    return (
      <p className="form-message form-message-success" role="status">
        {state.success}
      </p>
    );
  return null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return (
    <form className="auth-form" action={action}>
      <Message state={state} />
      <Field
        label="Email address"
        name="email"
        type="email"
        placeholder="you@example.com"
        defaultValue={state.fields?.email}
        required
        autoComplete="email"
      />
      <Field
        label="Password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
      />
      <div className="forgot-line">
        <Link className="forgot-link" href="/forgot-password">
          Forgot password?
        </Link>
      </div>
      <button
        className="button button-primary"
        type="submit"
        disabled={pending}
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initialState);
  return (
    <form className="auth-form" action={action}>
      <Message state={state} />
      <Field
        label="Display name"
        name="displayName"
        placeholder="Faiyaz Ahmed"
        defaultValue={state.fields?.displayName}
        required
        autoComplete="name"
      />
      <Field
        label="Email address"
        name="email"
        type="email"
        placeholder="you@example.com"
        defaultValue={state.fields?.email}
        required
        autoComplete="email"
      />
      <Field
        label="Password"
        name="password"
        type="password"
        description="Use at least 10 characters."
        required
        autoComplete="new-password"
      />
      <label className="choice">
        <input type="checkbox" name="terms" required />
        <span>
          <strong>I agree to the terms</strong>
          <small>And confirm I am allowed to create this account.</small>
        </span>
      </label>
      <button
        className="button button-primary"
        type="submit"
        disabled={pending}
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    forgotPasswordAction,
    initialState
  );
  return (
    <form className="auth-form" action={action}>
      <Message state={state} />
      <Field
        label="Email address"
        name="email"
        type="email"
        placeholder="you@example.com"
        required
        autoComplete="email"
      />
      <button
        className="button button-primary"
        type="submit"
        disabled={pending}
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(
    resetPasswordAction,
    initialState
  );
  return (
    <form className="auth-form" action={action}>
      <Message state={state} />
      <Field
        label="New password"
        name="password"
        type="password"
        description="Use at least 10 characters."
        required
        autoComplete="new-password"
      />
      <Field
        label="Confirm password"
        name="passwordConfirm"
        type="password"
        required
        autoComplete="new-password"
      />
      <button
        className="button button-primary"
        type="submit"
        disabled={pending}
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
