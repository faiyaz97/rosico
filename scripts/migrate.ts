import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

if (existsSync(".env.local")) {
  loadEnvFile(".env.local");
}

const databaseUrl = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_DIRECT_URL or DATABASE_URL is required.");
}

const client = postgres(databaseUrl, { max: 1 });

try {
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.info("Rosica database migrations are up to date.");
} finally {
  await client.end();
}
