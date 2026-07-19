export type SelectablePlayer = {
  id: string;
  groupId: string;
  archivedAt?: Date | null;
};

export class TeamValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamValidationError";
  }
}

export function validateGameTeams(input: {
  groupId: string;
  playersPerSide: number;
  sideAPlayerIds: readonly string[];
  sideBPlayerIds: readonly string[];
  players: readonly SelectablePlayer[];
}): void {
  const { groupId, playersPerSide, sideAPlayerIds, sideBPlayerIds, players } =
    input;

  if (!Number.isSafeInteger(playersPerSide) || playersPerSide <= 0) {
    throw new TeamValidationError("The format must use a positive team size.");
  }
  if (
    sideAPlayerIds.length !== playersPerSide ||
    sideBPlayerIds.length !== playersPerSide
  ) {
    throw new TeamValidationError(
      `Each side must contain exactly ${playersPerSide} player(s).`
    );
  }

  const selected = [...sideAPlayerIds, ...sideBPlayerIds];
  if (new Set(selected).size !== selected.length) {
    throw new TeamValidationError("A player may appear only once in a game.");
  }

  const availablePlayers = new Map(
    players.map((player) => [player.id, player])
  );
  for (const playerId of selected) {
    const player = availablePlayers.get(playerId);
    if (!player || player.groupId !== groupId) {
      throw new TeamValidationError(
        "Every selected player must belong to this group."
      );
    }
    if (player.archivedAt) {
      throw new TeamValidationError(
        "Archived players cannot be selected for new games."
      );
    }
  }
}
