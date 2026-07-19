// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  CompetitionFormatFields,
  CompetitionScoringFields
} from "@/components/competition-format-fields";

describe("CompetitionFormatFields", () => {
  it("adds unique team sizes and keeps repeated formats serializable", () => {
    const { container } = render(
      <CompetitionFormatFields initialSizes={[8]} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add team size" }));

    const values = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[name="formats"]')
    ).map((input) => input.value);
    expect(values).toEqual(["8", "1"]);
  });

  it("prevents an invalid duplicate from being submitted by browser validation", () => {
    render(<CompetitionFormatFields initialSizes={[1, 2]} />);

    fireEvent.change(screen.getAllByLabelText("Players on each side")[1]!, {
      target: { value: "1" }
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Each team size can be added only once."
    );
    expect(screen.getAllByLabelText(/Players on each side/)[1]).toBeInvalid();
  });
});

afterEach(cleanup);

describe("CompetitionScoringFields", () => {
  it("explains that winner direction is unused for result scoring", () => {
    const { container } = render(<CompetitionScoringFields />);

    fireEvent.click(screen.getByRole("combobox", { name: /^Score type/ }));
    fireEvent.click(screen.getByRole("option", { name: "Result" }));

    expect(
      screen.getByText(/winning side when recording/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /^Winner rule/ })
    ).toBeDisabled();
    expect(
      container.querySelector<HTMLInputElement>('input[name="winnerDirection"]')
        ?.value
    ).toBe("HIGHER_WINS");
  });

  it("only requires ordered values when ordered scoring is selected", () => {
    render(<CompetitionScoringFields />);

    const orderedValues = screen.getByRole("textbox", {
      name: /^Ordered values/
    });
    expect(orderedValues).toBeDisabled();
    expect(orderedValues).not.toBeRequired();

    fireEvent.click(screen.getByRole("combobox", { name: /^Score type/ }));
    fireEvent.click(screen.getByRole("option", { name: "Ordered values" }));

    expect(orderedValues).toBeEnabled();
    expect(orderedValues).toBeRequired();
    expect(screen.getByText(/position in the list/i)).toBeInTheDocument();
  });
});
