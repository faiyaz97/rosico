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
  canManage = true
}: {
  entries: Entry[];
  matches: Match[];
  resultBase: string;
  canManage?: boolean;
}) {
  const entryName = (id: string | null) =>
    entries.find((entry) => entry.id === id)?.name ?? "Bye / TBD";
  const rounds = [...new Set(matches.map((match) => match.round))].sort(
    (a, b) => a - b
  );
  return (
    <div className="bracket" aria-label="Single elimination bracket">
      {rounds.map((round, index) => (
        <section className="bracket-round" key={round}>
          <h2>{index === rounds.length - 1 ? "Final" : `Round ${round}`}</h2>
          {matches
            .filter((match) => match.round === round)
            .map((match) => (
              <article className="bracket-match" key={match.id}>
                <div
                  className={`bracket-side ${match.winnerEntryId === match.sideAEntryId ? "winner" : ""}`}
                >
                  <span>{entryName(match.sideAEntryId)}</span>
                  <strong>{match.sideAWins}</strong>
                </div>
                <div
                  className={`bracket-side ${match.winnerEntryId === match.sideBEntryId ? "winner" : ""}`}
                >
                  <span>{entryName(match.sideBEntryId)}</span>
                  <strong>{match.sideBWins}</strong>
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
                    <Status
                      tone={
                        match.status === "COMPLETED" ? "success" : "neutral"
                      }
                    >
                      {match.status.toLowerCase()}
                    </Status>
                  )}
                </footer>
              </article>
            ))}
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
          <article className="entity-row" key={match.id}>
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
