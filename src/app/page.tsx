import Link from "next/link";
import { BarChart3, Image, ShieldCheck, Trophy } from "lucide-react";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui";

export default function LandingPage() {
  return (
    <div className="public-shell">
      <nav className="public-nav" aria-label="Public navigation">
        <Logo />
        <div className="public-nav-links">
          <Link className="button button-quiet" href="/login">
            Log in
          </Link>
          <Link className="button button-primary" href="/register">
            Get started
          </Link>
        </div>
      </nav>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="kicker">Competition for real life</p>
            <h1>
              Settle it on the <span>scoreboard.</span>
            </h1>
            <p>
              Rosica keeps every office rivalry, club ladder and friendly
              tournament organised—without taking the fun out of it.
            </p>
            <div className="hero-actions">
              <ButtonLink href="/register">Create your group</ButtonLink>
              <ButtonLink href="/login" variant="secondary">
                I already have an account
              </ButtonLink>
            </div>
          </div>
          <div
            className="hero-board"
            aria-label="Example table football result"
          >
            <div className="board-top">
              <span>Google Milano</span>
              <span>Table football · 2v2</span>
            </div>
            <div className="board-score">
              <div>
                <span>Elena & Sofia</span>
                <strong>10</strong>
              </div>
              <i>:</i>
              <div>
                <span>Marco & Luca</span>
                <strong>7</strong>
              </div>
            </div>
            <div className="winner-line">
              <Trophy size={17} /> Elena & Sofia win
            </div>
          </div>
        </section>
        <section className="feature-strip" aria-label="What Rosica does">
          {[
            [
              BarChart3,
              "Rank every game",
              "Format-aware rankings, useful stats and predictable period filters."
            ],
            [
              Trophy,
              "Run tournaments",
              "Single elimination brackets and round-robin league tables."
            ],
            [
              ShieldCheck,
              "Keep groups separate",
              "Clear admin controls and server-enforced group boundaries."
            ],
            [
              Image,
              "Share the result",
              "Polished branded images, ready for your favourite group chat."
            ]
          ].map(([Icon, title, copy]) => {
            const FeatureIcon = Icon as typeof BarChart3;
            return (
              <article className="feature" key={title as string}>
                <span>
                  <FeatureIcon size={20} />
                </span>
                <h2>{title as string}</h2>
                <p>{copy as string}</p>
              </article>
            );
          })}
        </section>
      </main>
      <footer className="public-footer">
        © 2026 Rosica · Built for friendly competition.
      </footer>
    </div>
  );
}
