import type { ReactNode } from "react";
import { Logo } from "./logo";

export function AuthFrame({
  children,
  quote = "Every match deserves a proper score."
}: {
  children: ReactNode;
  quote?: string;
}) {
  return (
    <main className="auth-page">
      <aside className="auth-brand" aria-label="Rosica">
        <Logo />
        <div className="auth-quote">
          <strong>{quote}</strong>
          <p>
            Simple competitions, clear rankings, and just enough bragging
            rights.
          </p>
        </div>
        <small>rosica.it</small>
      </aside>
      <section className="auth-main">
        <Logo />
        {children}
      </section>
    </main>
  );
}
