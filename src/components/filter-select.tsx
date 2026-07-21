"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { SelectControl } from "@/components/select-control";

export type FilterSelectOption = {
  label: string;
  href: string;
};

export function FilterSelect({
  label,
  options,
  active
}: {
  label: string;
  options: FilterSelectOption[];
  active: string;
}) {
  const router = useRouter();
  const activeHref =
    options.find((option) => option.label === active)?.href ??
    options[0]?.href ??
    "";
  const [isPending, startTransition] = useTransition();

  return (
    <div className="filter-select" aria-busy={isPending || undefined}>
      <SelectControl
        ariaLabel={label}
        value={activeHref}
        disabled={isPending || options.length === 0}
        onValueChange={(href) => {
          startTransition(() => router.push(href));
        }}
        options={options.map((option) => ({
          label: option.label,
          value: option.href
        }))}
      />
    </div>
  );
}
