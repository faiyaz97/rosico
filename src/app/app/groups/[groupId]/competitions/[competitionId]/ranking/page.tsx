import Link from "next/link";
import { getCompetitionGameSetup } from "@/lib/server/games";
import { getCompetitionRanking } from "@/lib/server/rankings";
import { CompetitionTabs } from "@/components/context-tabs";
import { FilterSelect } from "@/components/filter-select";
import { formatPercentage } from "@/lib/format";
import { Avatar, EmptyState, PageHeader, Status } from "@/components/ui";

export default async function RankingPage({
  params,
  searchParams
}: {
  params: Promise<{ groupId: string; competitionId: string }>;
  searchParams: Promise<{
    format?: string;
    period?: "all" | "year" | "quarter" | "month" | "week";
  }>;
}) {
  const { groupId, competitionId } = await params;
  const filters = await searchParams;
  const [setup, ranking] = await Promise.all([
    getCompetitionGameSetup(groupId, competitionId),
    getCompetitionRanking({
      groupId,
      competitionId,
      formatId: filters.format ?? "all",
      period: filters.period ?? "all"
    })
  ]);
  const activeFormat =
    setup.formats.find((format) => format.id === filters.format)?.label ??
    "All formats";
  const periodLabels = {
    all: "All time",
    year: "Year",
    quarter: "Quarter",
    month: "Month",
    week: "Week"
  } as const;
  const activePeriod = periodLabels[filters.period ?? "all"];
  const rankingHref = (format: string, period: string) => {
    const query = new URLSearchParams();
    if (format !== "all") query.set("format", format);
    if (period !== "all") query.set("period", period);
    const suffix = query.toString();
    return `/app/groups/${groupId}/competitions/${competitionId}/ranking${suffix ? `?${suffix}` : ""}`;
  };
  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}/competitions/${competitionId}`}
        backLabel={setup.competition.name}
        title={`${setup.competition.name} ranking`}
        description="Players appear after completing at least one game in the selected format and period."
      />
      <CompetitionTabs
        groupId={groupId}
        competitionId={competitionId}
        active="Ranking"
      />
      <div className="filter-bar">
        <FilterSelect
          label="Game format"
          options={[
            {
              label: "All formats",
              href: rankingHref("all", filters.period ?? "all")
            },
            ...setup.formats.map((format) => ({
              label: format.label,
              href: rankingHref(format.id, filters.period ?? "all")
            }))
          ]}
          active={activeFormat}
        />
        <FilterSelect
          label="Period"
          options={Object.entries(periodLabels).map(([value, label]) => ({
            label,
            href: rankingHref(filters.format ?? "all", value)
          }))}
          active={activePeriod}
        />
      </div>
      <p className="active-period">
        {ranking.period
          ? `${ranking.period.start.toLocaleDateString("en-GB")} to ${ranking.period.end.toLocaleDateString("en-GB")}`
          : "All recorded games"}{" "}
        - Europe/Rome
      </p>
      {ranking.rows.length ? (
        <>
          <div className="ranking-mobile">
            {ranking.rows.map((row) => (
              <Link
                className="ranking-card"
                href={`/app/groups/${groupId}/players/${row.playerId}`}
                key={row.playerId}
              >
                <strong className="rank-pos">{row.position}</strong>
                <span className="rank-person">
                  <Avatar
                    player={{
                      name: row.displayName,
                      imagePath: row.imagePath
                    }}
                    size="sm"
                  />
                  <span>{row.displayName}</span>
                </span>
                <span className="rank-pct">
                  <strong>{formatPercentage(row.winPercentage)}%</strong>
                  <small>
                    {row.wins}-{row.losses} - {row.currentStreak}
                  </small>
                </span>
              </Link>
            ))}
          </div>
          <div className="rank-table-wrap desktop-only-table">
            <table>
              <caption className="sr-only">
                {setup.competition.name} ranking
              </caption>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Player</th>
                  <th>Played</th>
                  <th>Wins</th>
                  <th>Draws</th>
                  <th>Losses</th>
                  <th>Win %</th>
                  <th>Score diff.</th>
                  <th>Streak</th>
                </tr>
              </thead>
              <tbody>
                {ranking.rows.map((row) => (
                  <tr key={row.playerId}>
                    <td className="rank-pos">{row.position}</td>
                    <td>
                      <Link
                        className="rank-player"
                        href={`/app/groups/${groupId}/players/${row.playerId}`}
                      >
                        <Avatar
                          player={{
                            name: row.displayName,
                            imagePath: row.imagePath
                          }}
                          size="sm"
                        />
                        {row.displayName}
                      </Link>
                    </td>
                    <td>{row.gamesPlayed}</td>
                    <td>{row.wins}</td>
                    <td>{row.draws}</td>
                    <td>{row.losses}</td>
                    <td>
                      <strong>{formatPercentage(row.winPercentage)}%</strong>
                    </td>
                    <td
                      className={
                        row.scoreDifference >= 0 ? "positive" : "negative"
                      }
                    >
                      {row.scoreDifference > 0 ? "+" : ""}
                      {row.scoreDifference}
                    </td>
                    <td>
                      <Status
                        tone={
                          row.currentStreak.startsWith("W")
                            ? "success"
                            : row.currentStreak.startsWith("L")
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {row.currentStreak}
                      </Status>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState
          title="No ranked players"
          description="Record a completed game in this format and period to populate the ranking."
        />
      )}
      <p style={{ color: "var(--muted)", fontSize: ".82rem", marginTop: 14 }}>
        Tie-breakers: head-to-head, total wins, score difference, games played,
        then most recent win.
      </p>
    </div>
  );
}
