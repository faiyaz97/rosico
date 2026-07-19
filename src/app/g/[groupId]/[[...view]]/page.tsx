import { notFound, redirect } from "next/navigation";

import { getTournament } from "@/lib/server/tournaments";

export default async function LegacyPublicGroupPage({
  params
}: {
  params: Promise<{ groupId: string; view?: string[] }>;
}) {
  const { groupId, view = [] } = await params;
  if (view[0] === "tournaments" && view[1]) {
    let tournament: Awaited<ReturnType<typeof getTournament>>["tournament"];
    try {
      tournament = (await getTournament(groupId, view[1])).tournament;
    } catch {
      notFound();
    }
    redirect(
      `/app/groups/${groupId}/competitions/${tournament.competitionId}/tournaments/${tournament.id}`
    );
  }
  redirect(`/app/groups/${groupId}${view.length ? `/${view.join("/")}` : ""}`);
}
