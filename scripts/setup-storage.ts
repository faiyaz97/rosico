import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) loadEnvFile(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !secretKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required."
  );
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const current = await supabase.storage.getBucket("media");

if (!current.error) {
  console.info("The private media bucket is ready.");
  process.exit(0);
}
if (!current.error.message.toLowerCase().includes("not found")) {
  throw current.error;
}

const created = await supabase.storage.createBucket("media", {
  public: false,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"]
});
if (created.error) throw created.error;
console.info("Created the private media bucket.");
