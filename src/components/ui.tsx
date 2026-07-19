import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Inbox, RotateCcw } from "lucide-react";
import { formatPercentage } from "@/lib/format";
import { ImageUploadField } from "@/components/image-upload-field";
import { SelectControl } from "@/components/select-control";

export type AvatarPerson = {
  name: string;
  initials?: string;
  imagePath?: string | null;
  tone?: "green" | "gold" | "blue" | "coral";
};

export type MatchDisplay = {
  id: string;
  competition: string;
  format: string;
  playedAt: string;
  location?: string;
  sideA: string;
  sideB: string;
  scoreA: string;
  scoreB: string;
  winner: "A" | "B" | "draw";
};

export function Avatar({
  player,
  size = "md"
}: {
  player: AvatarPerson;
  size?: "sm" | "md" | "lg";
}) {
  const imageUrl = player.imagePath
    ? `/api/media/${player.imagePath
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`
    : undefined;

  return (
    <span
      className={`avatar avatar-${size} avatar-${player.tone ?? "green"}`}
      aria-label={player.name}
      role="img"
      style={
        imageUrl
          ? {
              backgroundImage: `url("${imageUrl}")`,
              backgroundPosition: "center",
              backgroundSize: "cover"
            }
          : undefined
      }
    >
      {!imageUrl &&
        (player.initials ??
          player.name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase())}
    </span>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = ""
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  className?: string;
}) {
  return (
    <Link href={href} className={`button button-${variant} ${className}`}>
      {children}
    </Link>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  backHref,
  backLabel = "Back"
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="page-header">
      <div>
        {backHref && (
          <Link className="back-link" href={backHref}>
            <ArrowLeft size={17} aria-hidden="true" />
            <span>{backLabel}</span>
          </Link>
        )}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-action">{action}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className = ""
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`section ${className}`}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  detail
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export function Status({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return <span className={`status status-${tone}`}>{children}</span>;
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={24} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState() {
  return (
    <div className="empty-state" role="alert">
      <span className="empty-icon">
        <RotateCcw size={24} />
      </span>
      <h2>We could not load this view</h2>
      <p>Your data is safe. Check your connection and try again.</p>
      <button className="button button-secondary" type="button">
        Try again
      </button>
    </div>
  );
}

export function MatchRow({
  game,
  groupId,
  href
}: {
  game: MatchDisplay;
  groupId: string;
  href?: string;
}) {
  const destination = href ?? `/app/groups/${groupId}/games/${game.id}`;
  const outcome =
    game.winner === "draw"
      ? "Draw"
      : `${game.winner === "A" ? game.sideA : game.sideB} won`;
  const details = [game.format, game.playedAt, game.location]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      className="match-row"
      href={destination}
      aria-label={`${game.competition}, ${game.sideA} versus ${game.sideB}, ${game.scoreA} to ${game.scoreB}, ${outcome}, ${game.playedAt}${game.location ? `, at ${game.location}` : ""}`}
    >
      <div className="match-meta">
        <span>{game.competition}</span>
        <small>{details}</small>
      </div>
      <div className="match-contest">
        <div
          className={`match-side ${game.winner === "A" ? "winner" : ""} ${game.winner === "draw" ? "draw" : ""}`}
        >
          <span className="match-team-name">{game.sideA}</span>
          <span className="match-outcome">
            {game.winner === "A"
              ? "Winner"
              : game.winner === "draw"
                ? "Draw"
                : ""}
          </span>
          <strong className="match-score">{game.scoreA}</strong>
        </div>
        <div
          className={`match-side ${game.winner === "B" ? "winner" : ""} ${game.winner === "draw" ? "draw" : ""}`}
        >
          <span className="match-team-name">{game.sideB}</span>
          <span className="match-outcome">
            {game.winner === "B"
              ? "Winner"
              : game.winner === "draw"
                ? "Draw"
                : ""}
          </span>
          <strong className="match-score">{game.scoreB}</strong>
        </div>
      </div>
      <ChevronRight
        className="match-row-chevron"
        size={18}
        aria-hidden="true"
      />
    </Link>
  );
}

export function Segmented({
  label,
  options,
  active
}: {
  label: string;
  options: Array<string | { label: string; href: string }>;
  active: string;
}) {
  return (
    <div className="segment-wrap">
      <span className="sr-only">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) =>
          typeof option === "string" ? (
            <button
              key={option}
              type="button"
              className={option === active ? "active" : ""}
              aria-pressed={option === active}
            >
              {option}
            </button>
          ) : (
            <Link
              key={option.href}
              href={option.href}
              className={option.label === active ? "active" : ""}
              aria-current={option.label === active ? "page" : undefined}
            >
              {option.label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}

export function CompactRankingTable({
  rows,
  playerBaseHref
}: {
  rows: Array<{
    playerId: string;
    position: number;
    displayName: string;
    imagePath?: string | null;
    gamesPlayed: number;
    wins: number;
    winPercentage: number;
    currentStreak: string;
  }>;
  playerBaseHref: string;
}) {
  return (
    <div className="table-wrap compact-ranking">
      <table>
        <thead>
          <tr>
            <th>Pos</th>
            <th>Player</th>
            <th>Wins</th>
            <th>Win %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.playerId}>
              <td className="rank-pos">{row.position}</td>
              <td>
                <Link
                  className="rank-player"
                  href={`${playerBaseHref}/${row.playerId}`}
                >
                  <Avatar
                    player={{
                      name: row.displayName,
                      imagePath: row.imagePath
                    }}
                    size="sm"
                  />
                  {row.displayName}
                </Link>
              </td>
              <td>{row.wins}</td>
              <td>{formatPercentage(row.winPercentage)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  placeholder,
  description,
  required,
  defaultValue,
  autoComplete
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  defaultValue?: string;
  autoComplete?: string;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <em aria-hidden="true"> *</em>}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
      />
      {description && <small>{description}</small>}
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  description,
  defaultValue
}: {
  label: string;
  name: string;
  options: Array<string | { label: string; value: string }>;
  description?: string;
  defaultValue?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <SelectControl
        name={name}
        ariaLabel={label}
        defaultValue={defaultValue}
        options={options.map((option) =>
          typeof option === "string" ? { label: option, value: option } : option
        )}
      />
      {description && <small>{description}</small>}
    </label>
  );
}

export function UploadField({ label = "Image" }: { label?: string }) {
  return <ImageUploadField label={label} />;
}

export function FormActions({
  submit = "Save changes",
  cancelHref
}: {
  submit?: string;
  cancelHref?: string;
}) {
  return (
    <div className="form-actions">
      {cancelHref && (
        <ButtonLink href={cancelHref} variant="quiet">
          Cancel
        </ButtonLink>
      )}
      <button className="button button-primary" type="submit">
        {submit}
      </button>
    </div>
  );
}
