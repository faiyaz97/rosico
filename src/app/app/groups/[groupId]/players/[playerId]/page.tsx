import Link from "next/link";
import { Archive, Pencil } from "lucide-react";
import { revalidatePath } from "next/cache";
import { listCompetitions, listGroupFormats } from "@/lib/server/competitions";
import { listGames } from "@/lib/server/games";
import { listPlayers, setPlayerArchived } from "@/lib/server/players";
import { getCompetitionRanking } from "@/lib/server/rankings";
import {
  getPeriodRange,
  isWithinPeriod,
  type RankingPeriod
} from "@/lib/domain";
import { gameForDisplay } from "@/components/presentation";
import { formatPercentage } from "@/lib/format";
import {
  Avatar,
  EmptyState,
  ButtonLink,
  MatchRow,
  PageHeader,
  Section,
  Segmented,
  Stat,
  Status
} from "@/components/ui";
import { notFound } from "next/navigation";
import { getGroupAccess } from "@/lib/server/authorization";
import { SelectControl } from "@/components/select-control";

export default async function PlayerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ groupId: string; playerId: string }>;
  searchParams: Promise<{ period?: string; format?: string }>;
}) {
  const { groupId, playerId } = await params;
  const filters = await searchParams;
  const [players, games, competitions, formats, access] = await Promise.all([
    listPlayers(groupId),
    listGames(groupId),
    listCompetitions(groupId),
    listGroupFormats(groupId),
    getGroupAccess(groupId)
  ]);
  const player = players.find((item) => item.id === playerId);
  if (!player) notFound();
  const isArchived = Boolean(player.archivedAt);
  const allowedPeriods: RankingPeriod[] = [
    "all",
    "year",
    "quarter",
    "month",
    "week"
  ];
  const period = allowedPeriods.includes(filters.period as RankingPeriod)
    ? (filters.period as RankingPeriod)
    : "all";
  const selectedFormat = formats.find((format) => format.id === filters.format);
  const formatId = selectedFormat?.id ?? "all";
  const periodRange =
    period === "all" ? null : getPeriodRange(period, new Date());
  const playerGames = games.filter(
    (game) =>
      (formatId === "all" || game.formatId === formatId) &&
      (!periodRange || isWithinPeriod(game.playedAt, periodRange)) &&
      [...game.sideA, ...game.sideB].some(
        (participant) => participant.playerId === playerId
      )
  );
  const competitionNames = new Map(
    competitions.map((competition) => [competition.id, competition.name])
  );
  const positions = (
    await Promise.all(
      competitions.map(async (competition) => ({
        competition,
        row: (
          await getCompetitionRanking({
            groupId,
            competitionId: competition.id,
            formatId,
            period
          })
        ).rows.find((row) => row.playerId === playerId)
      }))
    )
  ).filter((item) => item.row);
  const wins = playerGames.filter(
    (game) =>
      (game.outcome === "A" &&
        game.sideA.some((p) => p.playerId === playerId)) ||
      (game.outcome === "B" && game.sideB.some((p) => p.playerId === playerId))
  ).length;
  const draws = playerGames.filter((game) => game.outcome === "DRAW").length;
  const scoreDifference = playerGames.reduce((total, game) => {
    if (game.scoreType === "RESULT") return total;
    const isSideA = game.sideA.some(
      (participant) => participant.playerId === playerId
    );
    const difference =
      Number(game.comparableScoreA) - Number(game.comparableScoreB);
    return total + (isSideA ? difference : -difference);
  }, 0);
  const periodLabels: Record<RankingPeriod, string> = {
    all: "All time",
    year: "Year",
    quarter: "Quarter",
    month: "Month",
    week: "Week"
  };
  const playerHref = (nextPeriod: RankingPeriod, nextFormat: string) => {
    const query = new URLSearchParams();
    if (nextPeriod !== "all") query.set("period", nextPeriod);
    if (nextFormat !== "all") query.set("format", nextFormat);
    const suffix = query.toString();
    return `/app/groups/${groupId}/players/${playerId}${suffix ? `?${suffix}` : ""}`;
  };
  async function toggleArchive() {
    "use server";
    await setPlayerArchived(groupId, playerId, !isArchived);
    revalidatePath(`/app/groups/${groupId}/players/${playerId}`);
  }
  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/players`}
        backLabel="Players"
        eyebrow="Player profile"
        title={player.displayName}
        description={
          player.archivedAt
            ? "Archived player"
            : `Active since ${new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(player.createdAt)}`
        }
        action={
          access.canManage ? (
            <>
              <ButtonLink
                href={`/app/groups/${groupId}/players/${playerId}/edit`}
                variant="secondary"
              >
                <Pencil size={16} /> Edit
              </ButtonLink>
              <form action={toggleArchive}>
                <button className="button button-secondary" type="submit">
                  <Archive size={16} />{" "}
                  {player.archivedAt ? "Restore" : "Archive"}
                </button>
              </form>
            </>
          ) : undefined
        }
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 26
        }}
      >
        <Avatar
          player={{ name: player.displayName, imagePath: player.imagePath }}
          size="lg"
        />
        <div>
          <Status tone={player.archivedAt ? "neutral" : "success"}>
            {player.archivedAt ? "Archived" : "Active"}
          </Status>
          <p style={{ margin: "7px 0 0", color: "var(--muted)" }}>
            {positions.length} competitions played
          </p>
        </div>
      </div>
      <div className="filter-bar">
        <Segmented
          label="Statistics period"
          options={(
            Object.entries(periodLabels) as Array<[RankingPeriod, string]>
          ).map(([value, label]) => ({
            label,
            href: playerHref(value, formatId)
          }))}
          active={periodLabels[period]}
        />
        <form method="get" className="field-row two">
          {period !== "all" && (
            <input type="hidden" name="period" value={period} />
          )}
          <label className="field">
            <span>Game format</span>
            <SelectControl
              name="format"
              ariaLabel="Game format"
              defaultValue={formatId}
              options={[
                { label: "All formats", value: "all" },
                ...formats.map((format) => ({
                  label: `${format.competitionName} - ${format.label}`,
                  value: format.id
                }))
              ]}
            />
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button className="button button-secondary" type="submit">
              Apply format
            </button>
          </div>
        </form>
        <span className="active-period">
          {periodRange
            ? `${periodRange.start.toLocaleDateString("en-GB", { timeZone: "Europe/Rome" })} to ${periodRange.end.toLocaleDateString("en-GB", { timeZone: "Europe/Rome" })}`
            : "All recorded games"}{" "}
          - Europe/Rome
        </span>
      </div>
      <div className="stats-grid">
        <Stat label="Games" value={playerGames.length} />
        <Stat
          label="Wins"
          value={wins}
          detail={
            playerGames.length
              ? `${formatPercentage((wins / playerGames.length) * 100)}% win rate`
              : "No completed games"
          }
        />
        <Stat label="Draws" value={draws} />
        <Stat label="Losses" value={playerGames.length - wins - draws} />
        <Stat
          label="Score difference"
          value={`${scoreDifference > 0 ? "+" : ""}${scoreDifference}`}
        />
      </div>
      <div className="split-grid">
        <Section title="Recent games">
          {playerGames.length ? (
            <div className="match-list">
              {playerGames.slice(0, 5).map((game) => (
                <MatchRow
                  groupId={groupId}
                  game={gameForDisplay(game, {
                    competition: competitionNames.get(game.competitionId)
                  })}
                  key={game.id}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No games yet"
              description="This player has not completed a game."
            />
          )}
        </Section>
        <Section title="Ranking positions">
          {positions.length ? (
            <div className="entity-list">
              {positions.map(({ competition, row }) => (
                <Link
                  className="entity-row"
                  href={`/app/groups/${groupId}/competitions/${competition.id}/ranking`}
                  key={competition.id}
                >
                  <span className="competition-icon">#{row!.position}</span>
                  <span className="entity-row-main">
                    <b>{competition.name}</b>
                    <small>
                      {row!.gamesPlayed} games -{" "}
                      {formatPercentage(row!.winPercentage)}% wins
                    </small>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Not ranked yet"
              description="A ranking position appears after the first completed game."
            />
          )}
        </Section>
      </div>
    </div>
  );
}
