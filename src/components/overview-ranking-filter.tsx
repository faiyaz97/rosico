"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SelectControl } from "@/components/select-control";

export function OverviewRankingFilter({
  competitions,
  value
}: {
  competitions: Array<{ id: string; name: string }>;
  value: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div className="overview-ranking-filter">
      <SelectControl
        ariaLabel="Leaderboard competition"
        value={value}
        onValueChange={(nextValue) => {
          const query = new URLSearchParams(searchParams.toString());
          if (nextValue === "all") {
            query.delete("leaders");
          } else {
            query.set("leaders", nextValue);
          }
          const suffix = query.toString();
          router.replace(`${pathname}${suffix ? `?${suffix}` : ""}`, {
            scroll: false
          });
        }}
        options={[
          { label: "All competitions", value: "all" },
          ...competitions.map((competition) => ({
            label: competition.name,
            value: competition.id
          }))
        ]}
      />
    </div>
  );
}
