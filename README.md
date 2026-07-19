# Rosica

Rosica is a responsive web application for running casual competitions inside
offices, clubs, friend groups, and communities. Group administrators can manage
players, configure competitions, record results, calculate rankings, run
tournaments, and download branded result images.

The interface is English-only in v1. Dates are displayed with the `en-GB`
locale, calendar filters use `Europe/Rome`, and all stored timestamps are UTC.

## Stack

- Next.js 16, React 19, and strict TypeScript
- Tailwind CSS 4 and source-owned accessible UI components
- PostgreSQL with Drizzle ORM and checked-in migrations
- Supabase Auth, managed PostgreSQL, and private Storage
- Resend for production email
- Vitest and Playwright
- Vercel deployment

The browser never receives database or Supabase privileged credentials.
Application data is accessed through authenticated server code. Public-schema
tables have RLS enabled and Data API privileges revoked as defence in depth.

## Prerequisites

- Node.js 22 or newer
- pnpm 11
- Docker Desktop or another Docker-compatible runtime

Docker is required by the local Supabase stack. A global Supabase CLI install is
not required; the project pins it as a development dependency.

## Local setup

```bash
pnpm install
pnpm setup:local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). `setup:local` starts
Supabase, creates `.env.local` from the local credentials, applies every Drizzle
migration, creates the private media bucket, and loads deterministic demo data.

Supabase Studio and Mailpit URLs are printed by `pnpm supabase:start`. Mailpit
captures confirmation and password-reset messages locally. Group invitations
are also logged with a usable local signup URL when `RESEND_API_KEY` is empty.

### Demo accounts

All seeded accounts use the password `RosicaDemo!2026`.

- `alex@rosica.test`
- `sam@rosica.test`
- `jordan@rosica.test`

The seed includes two groups, shared administrators, accountless players,
table-football singles and doubles, chess, an ordered-value custom competition,
recorded games, rankings, a single-elimination bracket, and a round-robin
league. The seed command is idempotent and is intended only for local or
throwaway development environments.

`Google Milano` is seeded as a public, unlisted group and can be viewed without
signing in at
[http://localhost:3000/app/groups/10000000-0000-4000-8000-000000000001](http://localhost:3000/app/groups/10000000-0000-4000-8000-000000000001).
`Navigli Club` remains private.

## Commands

```bash
pnpm dev             # Start the Next.js development server
pnpm build           # Create a production build
pnpm start           # Run the production build
pnpm lint            # Run ESLint
pnpm typecheck       # Run strict TypeScript checking
pnpm format          # Format source files
pnpm format:check    # Check formatting without rewriting
pnpm test            # Run domain and unit tests
pnpm test:e2e        # Run Playwright at phone and desktop sizes
pnpm db:generate     # Generate a migration from the Drizzle schema
pnpm db:migrate      # Apply pending migrations
pnpm db:seed         # Load deterministic development data
pnpm db:reset        # Reset only a localhost database, then migrate and seed
pnpm storage:setup    # Create/verify the private media bucket
pnpm supabase:start  # Start local Auth, Postgres, Storage, Studio, and Mailpit
pnpm supabase:stop   # Stop the local stack
```

`db:reset` refuses to run when the configured database host is not
`127.0.0.1` or `localhost`.

## Environment

Copy `.env.example` only when configuring the application manually:

| Variable                               | Purpose                                               |
| -------------------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | Canonical application origin                          |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key                          |
| `SUPABASE_SECRET_KEY`                  | Server-only Auth and Storage administration           |
| `DATABASE_URL`                         | Pooled server connection                              |
| `DATABASE_DIRECT_URL`                  | Direct migration connection                           |
| `RESEND_API_KEY`                       | Optional locally; required for production invitations |
| `EMAIL_FROM`                           | Verified production sender                            |
| `APP_TIMEZONE`                         | Must be `Europe/Rome`                                 |

Never expose `SUPABASE_SECRET_KEY` or either database connection as a
`NEXT_PUBLIC_` variable.

## Database and security model

- Supabase owns the `auth`, `storage`, and `realtime` schemas. Rosica migrations
  do not alter their internal tables.
- Application tables live in `public`, have RLS enabled, and grant no Data API
  access to `anon` or `authenticated`.
- Every group mutation requires a verified Supabase session and an active
  `(group_id, user_id)` membership.
- Groups are private by default. An administrator can make a group public,
  which enables the canonical `/app/groups/[groupId]` pages in unlisted,
  `noindex`, read-only mode. Private group reads still require membership.
  Invitations, audit actors, settings, and mutations are never exposed to
  public viewers.
- Composite foreign keys prevent players, formats, competitions, games, and
  tournament entries from crossing group boundaries.
- Competition rule versions and ordered score values are immutable after
  creation.
- Game mutations write audit snapshots in the same transaction.
- Images are decoded, bounded to 5 MB, resized, stripped of metadata, encoded
  as WebP, and stored in a private bucket.

## Ranking and tournament rules

Rankings are calculated from non-deleted game history. They sort by win
percentage, head-to-head performance inside the tied cohort, total wins, score
difference, games played, and most recent win. Exact remaining ties share a
position. Team results contribute individual statistics to every team member.

Calendar filters use Rome-local year, quarter, month, and ISO Monday-to-Sunday
week boundaries before conversion to UTC.

Elimination tournaments support odd best-of values up to 99, byes, fixed
teams, series legs that count as normal games, and automatic winner
progression. Leagues use one round robin with configurable win/draw/loss
points.

## Production deployment

1. Create a Supabase project in an appropriate EU region.
2. Configure email/password Auth, require email confirmation, add
   `https://rosica.it/auth/callback` to allowed redirects, and use Resend as
   custom SMTP.
3. Configure the Vercel environment variables from the table above.
4. Run `pnpm db:migrate` and `pnpm storage:setup` from a protected CI
   deployment job.
5. Deploy the Next.js application to Vercel only after migrations succeed.
6. Attach `rosica.it`, redirect `www.rosica.it` to the apex, and verify the
   Resend sending subdomain.

Production data is never seeded automatically. Database migrations should be
forward-compatible and backed up before destructive changes. Vercel and
Supabase logs provide the initial operational diagnostics; `/api/health` is the
deployment health probe.

## Deliberately deferred

V1 does not include additional languages, viewer roles, player accounts,
uneven teams, free-for-all formats, double elimination, home-and-away leagues,
set-by-set scoring, provisional rankings, advanced analytics, realtime
updates, a native application, offline mode, a searchable public group
directory, public share links, or direct social-network integrations.
