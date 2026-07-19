// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DateTimeControl } from "@/components/date-time-control";
import { SelectControl } from "@/components/select-control";

describe("shared form controls", () => {
  afterEach(cleanup);

  it("selects an option through the source-owned listbox", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <SelectControl
        name="competitionId"
        ariaLabel="Competition"
        value="chess"
        onValueChange={onValueChange}
        options={[
          { label: "Chess", value: "chess" },
          { label: "Table tennis", value: "table-tennis" }
        ]}
      />
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Competition" }));
    fireEvent.click(screen.getByRole("option", { name: "Table tennis" }));

    expect(onValueChange).toHaveBeenCalledWith("table-tennis");
    expect(container.querySelector('select[name="competitionId"]')).toHaveValue(
      "chess"
    );
  });

  it("blocks an empty required selection and focuses its combobox", () => {
    const submitted = vi.fn((event: FormEvent<HTMLFormElement>) =>
      event.preventDefault()
    );
    render(
      <form onSubmit={submitted}>
        <SelectControl
          name="score"
          ariaLabel="Side A score"
          value=""
          required
          placeholder="Choose a value"
          options={[
            { label: "Bronze", value: "Bronze" },
            { label: "Gold", value: "Gold" }
          ]}
        />
        <button type="submit">Save</button>
      </form>
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(submitted).not.toHaveBeenCalled();
    expect(
      screen.getByRole("combobox", { name: "Side A score" })
    ).toHaveFocus();
    expect(
      screen.getByRole("combobox", { name: "Side A score" })
    ).toHaveAttribute("aria-invalid", "true");
  });

  it("exposes the keyboard-highlighted option through aria-activedescendant", () => {
    render(
      <SelectControl
        ariaLabel="Competition"
        value="chess"
        options={[
          { label: "Chess", value: "chess" },
          { label: "Table tennis", value: "table-tennis" }
        ]}
      />
    );
    const trigger = screen.getByRole("combobox", { name: "Competition" });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const highlighted = screen.getByRole("option", { name: "Table tennis" });
    expect(trigger).toHaveAttribute("aria-activedescendant", highlighted.id);
    expect(highlighted).toHaveAttribute("tabindex", "-1");
  });

  it("opens the native date-time picker from the visible calendar button", () => {
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, "showPicker", {
      configurable: true,
      value: showPicker
    });

    render(
      <DateTimeControl
        name="playedAt"
        value=""
        ariaLabel="Date and time"
        onValueChange={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open date and time picker" })
    );
    expect(showPicker).toHaveBeenCalledOnce();

    Reflect.deleteProperty(HTMLInputElement.prototype, "showPicker");
  });
});
