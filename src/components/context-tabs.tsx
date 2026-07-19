import Link from "next/link";

export function CompetitionTabs({
  groupId,
  competitionId,
  active
}: {
  groupId: string;
  competitionId: string;
  active: string;
}) {
  const base = `/app/groups/${groupId}/competitions/${competitionId}`;
  const items = [
    ["Overview", base],
    ["Ranking", `${base}/ranking`],
    ["Games", `${base}/games`],
    ["Tournaments", `${base}/tournaments`]
  ];
  return (
    <nav className="tabs" aria-label="Competition sections">
      {items.map(([label, href]) => (
        <Link
          className={active === label ? "active" : ""}
          href={href!}
          key={label}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
