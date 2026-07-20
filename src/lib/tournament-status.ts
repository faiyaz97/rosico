export const TOURNAMENT_STATUS_FILTERS = [
  "all",
  "active",
  "draft",
  "completed"
] as const;

export type TournamentStatusFilter = (typeof TOURNAMENT_STATUS_FILTERS)[number];

export type TournamentListStatus = Exclude<TournamentStatusFilter, "all">;

export function parseTournamentStatus(
  value: string | string[] | undefined
): TournamentStatusFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return TOURNAMENT_STATUS_FILTERS.includes(candidate as TournamentStatusFilter)
    ? (candidate as TournamentStatusFilter)
    : "all";
}

export function tournamentStatusOptions(baseHref: string) {
  return TOURNAMENT_STATUS_FILTERS.map((status) => ({
    label: status.charAt(0).toUpperCase() + status.slice(1),
    href: status === "all" ? baseHref : `${baseHref}?status=${status}`
  }));
}
