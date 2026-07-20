export type TournamentFormatOption = {
  id: string;
  label: string;
  playersPerSide: number;
};

export function tournamentFormatCapacity(
  format: TournamentFormatOption,
  playerCount: number
) {
  return Math.min(8, Math.floor(playerCount / format.playersPerSide));
}

export function selectInitialTournamentFormat(
  formats: TournamentFormatOption[],
  playerCount: number,
  requestedFormatId?: string
) {
  const requested = formats.find((format) => format.id === requestedFormatId);
  if (requested && tournamentFormatCapacity(requested, playerCount) >= 2) {
    return requested;
  }
  return formats.find(
    (format) => tournamentFormatCapacity(format, playerCount) >= 2
  );
}
