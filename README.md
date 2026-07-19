# Rosica

<p align="center">
  <img src="./public/rosica-mark.svg" width="72" height="72" alt="Rosica logo">
</p>

<p align="center">
  A mobile-first application for running friendly competitions in offices,
  clubs, communities, and groups of friends.
</p>

<p align="center">
  <a href="https://github.com/faiyaz97/rosico/actions/workflows/ci.yml">
    <img src="https://github.com/faiyaz97/rosico/actions/workflows/ci.yml/badge.svg" alt="CI status">
  </a>
  <img src="https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 22 or newer">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="Strict TypeScript">
</p>

Rosica turns informal matches into organised competitions. Administrators
create a group, add players and competitions, record results, and let Rosica
calculate rankings, statistics, and tournament progress automatically. Public
groups can be viewed without an account; private groups remain visible only to
their administrators.

## Highlights

- Group-scoped administration with public and private visibility
- Accountless player profiles with archive-safe history
- Predefined and custom competitions
- Numeric, ordered-value, and direct winner-selection scoring
- Singles, doubles, and configurable equal team sizes
- Per-format and combined rankings with calendar filters
- Player statistics, recent form, and match history
- Single-elimination brackets and round-robin leagues
- Private image uploads for groups, players, competitions, and tournaments
- Downloadable result and tournament graphics
- Responsive navigation designed separately for mobile and desktop

## How it works

1. A registered user creates a group and becomes its administrator.
2. Administrators add players, invite other administrators, and configure
   competitions.
3. Results are recorded using the competition's team-size and scoring rules.
4. Rosica validates the match, calculates its outcome, and updates individual
   statistics and rankings.
5. The same scoring engine is reused by elimination and league tournaments.

Players do not need user accounts. Tournament games contribute to normal
rankings and statistics, while immutable competition-rule versions keep
historical results reproducible after settings change.

## Technology

| Area        | Implementation                                             |
| ----------- | ---------------------------------------------------------- |
| Application | Next.js 16, React 19, App Router, Server Actions           |
| Language    | Strict TypeScript                                          |
| Database    | PostgreSQL, Drizzle ORM, checked-in migrations             |
| Platform    | Supabase Auth, PostgreSQL, and private Storage             |
| Interface   | Tailwind CSS 4 and source-owned accessible components      |
| Images      | Sharp for uploads, Next.js `ImageResponse` for share cards |
| Validation  | Zod                                                        |
| Tests       | Vitest, Testing Library, Playwright, axe                   |

Rosica is a single Next.js application rather than separate frontend and
backend services. Reads and mutations run on the server, and all group-owned
records are authorised against their owning group.

## Run locally

### Requirements

- [Node.js](https://nodejs.org/) 22 or newer
- [pnpm](https://pnpm.io/) 11
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or another
  Docker-compatible runtime

The repository pins the Supabase CLI as a development dependency, so a global
Supabase installation is not required.

### Setup

```bash
git clone https://github.com/faiyaz97/rosico.git
cd rosico
pnpm install
pnpm setup:local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

`pnpm setup:local` performs the complete development setup:

- starts local Supabase services in Docker;
- creates `.env.local` from the generated local credentials;
- applies the Drizzle migrations;
- creates the private media bucket;
- loads deterministic sample data.

The local Supabase output includes links for Studio and Mailpit. Mailpit captures
authentication messages without sending real email, and invitations print a
local signup URL when no Resend API key is configured.

To stop the local services:

```bash
pnpm supabase:stop
```

### Manual environment setup

Most contributors should use `pnpm setup:local`. For manual configuration, copy
`.env.example` to `.env.local` and provide:

| Variable                               | Purpose                                     |
| -------------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | Application origin                          |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase publishable key       |
| `SUPABASE_SECRET_KEY`                  | Server-only Auth and Storage administration |
| `DATABASE_URL`                         | Pooled PostgreSQL connection                |
| `DATABASE_DIRECT_URL`                  | Direct PostgreSQL migration connection      |
| `RESEND_API_KEY`                       | Optional email delivery                     |
| `EMAIL_FROM`                           | Verified sender when email is enabled       |
| `APP_TIMEZONE`                         | Application calendar timezone               |

Never expose the secret key or database connections through a
`NEXT_PUBLIC_` variable.

## Useful commands

```bash
pnpm dev             # Start the development server
pnpm build           # Create a production build
pnpm start           # Run the production build
pnpm lint            # Run ESLint
pnpm typecheck       # Run strict TypeScript checks
pnpm format:check    # Verify formatting
pnpm test            # Run unit and domain tests
pnpm test:e2e        # Run browser tests at phone and desktop sizes
pnpm db:generate     # Generate a migration from the Drizzle schema
pnpm db:migrate      # Apply pending migrations
pnpm db:seed         # Reload deterministic development data
pnpm db:reset        # Reset, migrate, and seed a localhost database
pnpm storage:setup   # Create or verify the private media bucket
pnpm supabase:start  # Start local Supabase services
pnpm supabase:stop   # Stop local Supabase services
```

`db:reset` refuses to run against database hosts other than `localhost` or
`127.0.0.1`.

## Project structure

```text
src/app/             Routes, pages, Server Actions, and Route Handlers
src/components/      Shared interface and domain-facing components
src/db/              Drizzle schema and database client
src/lib/domain/      Pure scoring, ranking, period, and tournament logic
src/lib/server/      Authorised group-scoped data operations
drizzle/             Versioned PostgreSQL migrations
scripts/             Local setup, migration, seed, and storage utilities
supabase/            Local Supabase configuration
e2e/                 Playwright browser tests
```

## Data integrity and security

- Passwords, verification, recovery, and sessions are handled by Supabase Auth.
- Important validation and every mutation run on the server.
- Public-schema tables use RLS and deny direct browser Data API access.
- Composite foreign keys prevent records from crossing group boundaries.
- Competition scoring rules are versioned so old games never change meaning.
- Game edits and deletions preserve audit snapshots.
- Images are decoded, limited to 5 MB, stripped of metadata, resized, converted
  to WebP, and stored privately.
- Calendar periods use `Europe/Rome` boundaries and UTC storage.

## Current scope

Rosica currently has an English-only interface. The first release deliberately
does not include player accounts, granular roles, uneven teams, free-for-all
formats, double elimination, home-and-away leagues, realtime updates, offline
mode, or direct social-network integrations.
