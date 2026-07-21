import Link from "next/link";
import { Status } from "./ui";

type Entry = { id: string; name: string };
type Match = {
  id: string;
  round: number;
  slot: number;
  sideAEntryId: string | null;
  sideBEntryId: string | null;
  sideAWins: number;
  sideBWins: number;
  winnerEntryId: string | null;
  status: string;
  legs?: Array<{
    id: string;
    scoreA: string;
    scoreB: string;
    outcome: "A" | "B" | "DRAW";
    href?: string;
    editHref?: string;
  }>;
};
type Standing = {
  position: number;
  entryId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scoreDifference: number;
  points: number;
};

export function EliminationView({
  entries,
  matches,
  resultBase,
  bestOf,
  canManage = true
}: {
  entries: Entry[];
  matches: Match[];
  resultBase: string;
  bestOf: number;
  canManage?: boolean;
}) {
  const entryName = (id: string | null) =>
    entries.find((entry) => entry.id === id)?.name ?? "Bye / TBD";
  const rounds = [...new Set(matches.map((match) => match.round))].sort(
    (a, b) => a - b
  );
  const legValue = (
    leg: NonNullable<Match["legs"]>[number] | undefined,
    side: "A" | "B"
  ) => {
    if (!leg)
      return (
        <>
          <span aria-hidden="true">–</span>
          <span className="sr-only">Not played</span>
        </>
      );
    const value = side === "A" ? leg.scoreA : leg.scoreB;
    return leg.href ? (
      <Link
        className="bracket-leg-link"
        href={leg.href}
        aria-label={`Open game result ${value}`}
      >
        {value}
      </Link>
    ) : (
      value
    );
  };
  return (
    <div
      className="bracket"
      role="region"
      aria-label="Single elimination bracket"
      tabIndex={0}
    >
      {rounds.map((round, index) => (
        <section className="bracket-round" key={round}>
          <h2>{index === rounds.length - 1 ? "Final" : `Round ${round}`}</h2>
          {matches
            .filter((match) => match.round === round)
            .map((match) => {
              const legs = match.legs ?? [];
              const legCount = Math.max(legs.length, bestOf);
              return (
                <article
                  className="bracket-match"
                  id={`match-${match.id}`}
                  key={match.id}
                >
                  <div className="bracket-score-wrap">
                    <table className="bracket-score">
                      <caption className="sr-only">
                        {entryName(match.sideAEntryId)} versus{" "}
                        {entryName(match.sideBEntryId)}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">
                            <span className="sr-only">Entry</span>
                          </th>
                          {Array.from({ length: legCount }, (_, legIndex) => (
                            <th scope="col" key={legIndex}>
                              G{legIndex + 1}
                            </th>
                          ))}
                          <th className="bracket-wins-heading" scope="col">
                            W<span className="sr-only">ins</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          className={
                            match.winnerEntryId === match.sideAEntryId
                              ? "winner"
                              : undefined
                          }
                        >
                          <th scope="row">{entryName(match.sideAEntryId)}</th>
                          {Array.from({ length: legCount }, (_, legIndex) => (
                            <td
                              className={
                                legs[legIndex]?.outcome === "A"
                                  ? "leg-winner"
                                  : undefined
                              }
                              key={legIndex}
                            >
                              {legValue(legs[legIndex], "A")}
                            </td>
                          ))}
                          <td className="bracket-wins">
                            <strong>{match.sideAWins}</strong>
                          </td>
                        </tr>
                        <tr
                          className={
                            match.winnerEntryId === match.sideBEntryId
                              ? "winner"
                              : undefined
                          }
                        >
                          <th scope="row">{entryName(match.sideBEntryId)}</th>
                          {Array.from({ length: legCount }, (_, legIndex) => (
                            <td
                              className={
                                legs[legIndex]?.outcome === "B"
                                  ? "leg-winner"
                                  : undefined
                              }
                              key={legIndex}
                            >
                              {legValue(legs[legIndex], "B")}
                            </td>
                          ))}
                          <td className="bracket-wins">
                            <strong>{match.sideBWins}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <footer>
                    {match.status === "READY" ||
                    match.status === "IN_PROGRESS" ? (
                      canManage ? (
                        <Link
                          className="text-link"
                          href={`${resultBase}&match=${match.id}`}
                        >
                          Record next game
                        </Link>
                      ) : (
                        <Status>in progress</Status>
                      )
                    ) : (
                      <>
                        <Status
                          tone={
                            match.status === "COMPLETED" ? "success" : "neutral"
                          }
                        >
                          {match.status.toLowerCase()}
                        </Status>
                        {canManage && legs.some((leg) => leg.editHref) && (
                          <span className="bracket-edit-links">
                            <span>Edit:</span>
                            {legs.map((leg, legIndex) =>
                              leg.editHref ? (
                                <Link
                                  className="text-link"
                                  href={leg.editHref}
                                  key={leg.id}
                                >
                                  Game {legIndex + 1}
                                </Link>
                              ) : null
                            )}
                          </span>
                        )}
                      </>
                    )}
                  </footer>
                </article>
              );
            })}
        </section>
      ))}
    </div>
  );
}

export function LeagueView({
  entries,
  standings,
  matches,
  resultBase,
  canManage = true
}: {
  entries: Entry[];
  standings: Standing[];
  matches: Match[];
  resultBase: string;
  canManage?: boolean;
}) {
  const name = (id: string) =>
    entries.find((entry) => entry.id === id)?.name ?? "Unknown entry";
  return (
    <>
      <div className="table-wrap">
        <table>
          <caption className="sr-only">League standings</caption>
          <thead>
            <tr>
              <th>Pos</th>
              <th>Entry</th>
              <th>Played</th>
              <th>Wins</th>
              <th>Draws</th>
              <th>Losses</th>
              <th>Score diff.</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.entryId}>
                <td className="rank-pos">{row.position}</td>
                <td>
                  <strong>{name(row.entryId)}</strong>
                </td>
                <td>{row.played}</td>
                <td>{row.wins}</td>
                <td>{row.draws}</td>
                <td>{row.losses}</td>
                <td
                  className={row.scoreDifference >= 0 ? "positive" : "negative"}
                >
                  {row.scoreDifference > 0 ? "+" : ""}
                  {row.scoreDifference}
                </td>
                <td>
                  <strong>{row.points}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="match-list" style={{ marginTop: 24 }}>
        {matches.map((match) => (
          <article
            className="entity-row"
            id={`match-${match.id}`}
            key={match.id}
          >
            <span className="competition-icon">{match.round}</span>
            <span className="entity-row-main">
              <b>
                {name(match.sideAEntryId ?? "")} vs{" "}
                {name(match.sideBEntryId ?? "")}
              </b>
              <small>Round {match.round}</small>
            </span>
            {match.status === "READY" && canManage ? (
              <Link
                className="text-link"
                href={`${resultBase}&match=${match.id}`}
              >
                Record result
              </Link>
            ) : match.status === "COMPLETED" && match.legs?.[0]?.href ? (
              <Link
                className="text-link"
                href={
                  canManage && match.legs[0].editHref
                    ? match.legs[0].editHref
                    : match.legs[0].href
                }
              >
                {canManage ? "Edit result" : "View result"}
              </Link>
            ) : (
              <Status
                tone={match.status === "COMPLETED" ? "success" : "neutral"}
              >
                {match.status.toLowerCase()}
              </Status>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
