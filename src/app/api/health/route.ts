import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json(
      { status: "ok", service: "rosica" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable", service: "rosica" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
