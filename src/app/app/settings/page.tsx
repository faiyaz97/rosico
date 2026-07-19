import { KeyRound, LogOut, ShieldCheck } from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import { AccountSettingsForm } from "@/components/account-settings-form";
import { PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/server/authorization";

export const metadata = { title: "Account settings" };

export default async function AccountSettingsPage() {
  const actor = await requireActor();
  return (
    <div className="app-content account-settings">
      <PageHeader
        title="Account settings"
        description="Manage your Rosica profile and sign-in security."
      />
      <div className="settings-layout">
        <section className="surface settings-card settings-profile-card">
          <AccountSettingsForm profile={actor.profile} />
        </section>
        <aside className="settings-side">
          <section className="surface settings-card">
            <span className="settings-icon">
              <ShieldCheck size={21} />
            </span>
            <h2>Sign-in account</h2>
            <p>
              Your password and active session are protected by Supabase Auth.
            </p>
          </section>
          <section className="surface settings-card">
            <span className="settings-icon">
              <KeyRound size={21} />
            </span>
            <h2>Password</h2>
            <p>We will email you a secure link to choose a new password.</p>
            <a className="button button-secondary" href="/forgot-password">
              Reset password
            </a>
          </section>
          <section className="surface settings-card">
            <span className="settings-icon">
              <LogOut size={21} />
            </span>
            <h2>Session</h2>
            <p>Sign out of Rosica on this device.</p>
            <form action={logoutAction}>
              <button className="button button-secondary" type="submit">
                Log out
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
