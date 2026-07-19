import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type Database = ReturnType<typeof createDatabase>;

function createDatabase() {
  if (typeof window !== "undefined") {
    throw new Error("The database client is server-only.");
  }
  const connectionString =
    process.env.DATABASE_URL ?? process.env.DATABASE_DIRECT_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or DATABASE_DIRECT_URL must be configured.");
  }

  const client = postgres(connectionString, {
    max: process.env.NODE_ENV === "development" ? 5 : 10,
    prepare: false
  });
  return drizzle(client, { schema });
}

const globalDatabase = globalThis as typeof globalThis & {
  __rosicaDatabase?: Database;
};

export function getDb(): Database {
  globalDatabase.__rosicaDatabase ??= createDatabase();
  return globalDatabase.__rosicaDatabase;
}

export type RosicaDatabase = Database;
