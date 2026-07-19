import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import postgres from "postgres";

if (existsSync(".env.local")) {
  loadEnvFile(".env.local");
}

const databaseUrl = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_DIRECT_URL or DATABASE_URL is required.");
}

const parsed = new URL(databaseUrl);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
  throw new Error("db:reset is restricted to a local database.");
}

const client = postgres(databaseUrl, { max: 1 });
try {
  await client.unsafe("drop schema if exists public cascade");
  await client.unsafe("drop schema if exists drizzle cascade");
  await client.unsafe("drop schema if exists private cascade");
  await client.unsafe("create schema public");
  await client.unsafe("grant all on schema public to postgres");
  await client.unsafe("grant usage on schema public to anon, authenticated");
} finally {
  await client.end();
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
execFileSync(pnpm, ["db:migrate"], { stdio: "inherit", env: process.env });
execFileSync(pnpm, ["db:seed"], { stdio: "inherit", env: process.env });
