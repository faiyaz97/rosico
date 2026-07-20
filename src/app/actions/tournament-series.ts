"use server";

import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";

import type { EntityActionState } from "@/app/actions/entities";
import { APPLICATION_TIME_ZONE } from "@/lib/domain";
import { publicError } from "@/lib/server/errors";
import { recordTournamentSeries } from "@/lib/server/games";

export type TournamentSeriesActionState = EntityActionState;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function applicationDateTime(value: string): Date | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  return /(?:z|[+-]\d{2}:\d{2})$/i.test(normalized)
    ? new Date(normalized)
    : fromZonedTime(normalized, APPLICATION_TIME_ZONE);
}

type SeriesLeg = {
  scoreA?: string;
  scoreB?: string;
  result?: "A" | "B" | "DRAW";
};

function legs(formData: FormData): SeriesLeg[] {
  try {
    const parsed: unknown = JSON.parse(text(formData, "legs"));
    return Array.isArray(parsed) ? (parsed as SeriesLeg[]) : [];
  } catch {
    return [];
  }
}

/** Server Action for an atomic best-of elimination-series submission. */
export async function recordTournamentSeriesAction(
  _state: TournamentSeriesActionState,
  formData: FormData
): Promise<TournamentSeriesActionState> {
  try {
    const groupId = text(formData, "groupId");
    const games = await recordTournamentSeries({
      groupId,
      competitionId: text(formData, "competitionId"),
      formatId: text(formData, "formatId"),
      tournamentMatchId: text(formData, "tournamentMatchId"),
      sideAPlayerIds: formData.getAll("sideAPlayerIds").map(String),
      sideBPlayerIds: formData.getAll("sideBPlayerIds").map(String),
      playedAt: applicationDateTime(text(formData, "playedAt")),
      location: text(formData, "location"),
      legs: legs(formData)
    });
    revalidatePath(`/app/groups/${groupId}`);
    return {
      success: `${games.length} ${games.length === 1 ? "result" : "results"} recorded.`,
      id: games.at(-1)?.id
    };
  } catch (error) {
    return { error: publicError(error) };
  }
}
