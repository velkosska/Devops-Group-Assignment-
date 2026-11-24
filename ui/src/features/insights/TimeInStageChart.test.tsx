import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TimeInStageChart } from "./TimeInStageChart";

const durations = [
  { stage: "applied" as const, medianDays: 7.7 },
  { stage: "screen" as const, medianDays: null },
];

describe("time in stage", () => {
  it("shows the median per stage and says when a stage has no data yet", () => {
    render(<TimeInStageChart durations={durations} />);
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("8 days")).toBeInTheDocument();
    expect(within(rows[1]).getByText("No data yet")).toBeInTheDocument();
    expect(within(rows[1]).queryByText(/^0/)).not.toBeInTheDocument();
  });

  it("uses the same wording in the table view", async () => {
    const user = userEvent.setup();
    render(<TimeInStageChart durations={durations} />);
    await user.click(screen.getByRole("button", { name: "Show as table" }));
    const row = screen.getByRole("row", { name: /Phone screen/ });
    expect(within(row).getByText("No data yet")).toBeInTheDocument();
  });
});
