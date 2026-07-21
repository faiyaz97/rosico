// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterSelect } from "@/components/filter-select";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

describe("FilterSelect", () => {
  afterEach(() => {
    cleanup();
    push.mockReset();
  });

  it("shows only the active filter and navigates to the selected URL", () => {
    render(
      <FilterSelect
        label="Status"
        active="All"
        options={[
          { label: "All", href: "/tournaments" },
          { label: "Draft", href: "/tournaments?status=draft" }
        ]}
      />
    );

    const filter = screen.getByRole("combobox", { name: "Status" });
    expect(filter).toHaveTextContent("All");
    expect(screen.queryByRole("option", { name: "Draft" })).toBeNull();

    fireEvent.click(filter);
    fireEvent.click(screen.getByRole("option", { name: "Draft" }));

    expect(push).toHaveBeenCalledWith("/tournaments?status=draft");
  });
});
