import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const pnpmEntry = process.env.npm_execpath;
const command = pnpmEntry ? process.execPath : "pnpm";
const commandPrefix = pnpmEntry ? [pnpmEntry] : [];

function run(args: string[]) {
  execFileSync(command, [...commandPrefix, ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env
  });
}

function capture(args: string[]) {
  return execFileSync(command, [...commandPrefix, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env
  });
}

run(["exec", "supabase", "start"]);

const status = capture(["exec", "supabase", "status", "-o", "env"]);
const values = Object.fromEntries(
  status
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      const key = line.slice(0, index);
      const value = line.slice(index + 1).replace(/^"|"$/g, "");
      return [key, value];
    })
);

const apiUrl = values.API_URL;
const publishableKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY;
const secretKey = values.SECRET_KEY ?? values.SERVICE_ROLE_KEY;
const databaseUrl =
  values.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (!apiUrl || !publishableKey || !secretKey) {
  throw new Error("Could not read local Supabase credentials.");
}

const envFile = [
  "NEXT_PUBLIC_APP_URL=http://localhost:3000",
  `NEXT_PUBLIC_SUPABASE_URL=${apiUrl}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
  `SUPABASE_SECRET_KEY=${secretKey}`,
  `DATABASE_URL=${databaseUrl}`,
  `DATABASE_DIRECT_URL=${databaseUrl}`,
  "RESEND_API_KEY=",
  "EMAIL_FROM=Rosica <hello@rosica.it>",
  "APP_TIMEZONE=Europe/Rome",
  ""
].join("\n");

writeFileSync(".env.local", envFile, { encoding: "utf8", mode: 0o600 });

run(["db:migrate"]);
run(["storage:setup"]);
run(["db:seed"]);

console.info("Rosica is ready. Run `pnpm dev` and open http://localhost:3000.");
