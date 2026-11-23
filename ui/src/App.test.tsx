import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { Backend } from "./api";
import { createDemoBackend, resetDemo } from "./api/demo";
import { ApiError } from "./api/http";
import { App } from "./App";

function demo(): Backend {
  return { ...createDemoBackend({ latencyMs: 0 }), demo: true };
}

function column(name: RegExp | string) {
  return screen.getByRole("region", { name });
}

beforeEach(() => {
  resetDemo();
  window.history.replaceState(null, "", "/board");
});

describe("board", () => {
  it("shows every stage with its applications", async () => {
    render(<App backend={demo()} />);
    expect(await screen.findByText("Senior Frontend Engineer")).toBeInTheDocument();
    for (const name of ["Applied", "Phone screen", "Interview", "Offer", "Rejected"]) {
      expect(column(name)).toBeInTheDocument();
    }
    expect(within(column("Offer")).getByText("Northwind Systems")).toBeInTheDocument();
  });

  it("adds an application, filling the company from the link", async () => {
    const user = userEvent.setup();
    render(<App backend={demo()} />);
    await screen.findByText("Senior Frontend Engineer");

    await user.click(screen.getAllByRole("button", { name: /new application/i })[0]);
    const dialog = await screen.findByRole("dialog", { name: "New application" });
    await user.type(
      within(dialog).getByLabelText(/job posting link/i),
      "jobs.lever.co/acme-robotics/123",
    );
    expect(within(dialog).getByLabelText(/^company/i)).toHaveValue("Acme Robotics");
    expect(within(dialog).getByText(/filled in from the link/i)).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/^role/i), "Robotics Engineer");
    await user.click(within(dialog).getByRole("button", { name: "Add application" }));

    expect(await within(column("Applied")).findByText("Robotics Engineer")).toBeInTheDocument();
    expect(await screen.findByText("Added Robotics Engineer at Acme Robotics")).toBeInTheDocument();
  });

  it("explains what's missing instead of submitting an empty form", async () => {
    const user = userEvent.setup();
    render(<App backend={demo()} />);
    await screen.findByText("Senior Frontend Engineer");

    await user.keyboard("n");
    const dialog = await screen.findByRole("dialog", { name: "New application" });
    await user.click(within(dialog).getByRole("button", { name: "Add application" }));

    expect(within(dialog).getByText("Add the company name.")).toBeInTheDocument();
    expect(within(dialog).getByText("Add the role you applied for.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^company/i)).toHaveFocus();
    expect(within(dialog).getByLabelText(/^company/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("moves a card forward and can undo it", async () => {
    const user = userEvent.setup();
    render(<App backend={demo()} />);
    await screen.findByText("Senior Frontend Engineer");

    const card = within(column("Applied")).getByText("React Developer").closest("article")!;
    await user.click(within(card).getByRole("button", { name: "Move forward to Phone screen" }));
    expect(within(column("Phone screen")).getByText("React Developer")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(within(column("Applied")).getByText("React Developer")).toBeInTheDocument(),
    );
  });

  it("opens details, then deletes after confirming", async () => {
    const user = userEvent.setup();
    render(<App backend={demo()} />);
    await screen.findByText("Senior Frontend Engineer");

    await user.click(screen.getByRole("button", { name: /Product Engineer at Lumen Labs/ }));
    const panel = await screen.findByRole("dialog", { name: "Product Engineer" });
    expect(window.location.search).toMatch(/app=\d+/);
    expect(within(panel).getByText("Madrid")).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Delete application" }));
    await user.click(within(panel).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByText("Product Engineer")).not.toBeInTheDocument());
    expect(await screen.findByText("Deleted Product Engineer at Lumen Labs")).toBeInTheDocument();
  });

  it("shows a clear message and disables adding when applications are down", async () => {
    const backend = demo();
    backend.applications.list = () =>
      Promise.reject(new ApiError("unavailable", "Couldn't reach the server."));
    render(<App backend={backend} />);

    expect(await screen.findByText("Applications are temporarily unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new application/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("welcomes a first-time user with one clear action", async () => {
    const backend = demo();
    backend.applications.list = async () => [];
    render(<App backend={backend} />);
    expect(
      await screen.findByRole("heading", { name: "Start your shortlist" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add your first application" })).toBeInTheDocument();
  });
});

describe("landing page", () => {
  it("explains the product and leads to the board", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/");
    render(<App backend={demo()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Know where every job application stands" }),
    ).toBeInTheDocument();
    for (const name of [
      "One card per application",
      "Know who to follow up with",
      "See where your search stalls",
      "The board never waits on the numbers",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }

    const cta = screen.getAllByRole("link", { name: /open your board/i })[0];
    expect(cta).toHaveAttribute("href", "/board");
    await user.click(cta);
    expect(window.location.pathname).toBe("/board");
    expect(await screen.findByText("Senior Frontend Engineer")).toBeInTheDocument();
  });

  it("does not open app shortcuts on the landing page", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/");
    render(<App backend={demo()} />);
    await user.keyboard("n");
    expect(screen.queryByRole("dialog", { name: "New application" })).not.toBeInTheDocument();
  });

  it("switches between light and dark from the landing nav", async () => {
    const user = userEvent.setup();
    localStorage.removeItem("shortlist.theme");
    window.history.replaceState(null, "", "/");
    render(<App backend={demo()} />);

    await user.click(screen.getByRole("button", { name: /match system theme\. change theme/i }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("button", { name: /light theme\. change theme/i }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("shortlist.theme")).toBe("dark");
    await user.click(screen.getByRole("button", { name: /dark theme\. change theme/i }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});

describe("home / app switch", () => {
  it("goes from the landing page to the app and back", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/");
    render(<App backend={demo()} />);

    const toApp = within(screen.getByRole("navigation", { name: "Switch view" }));
    expect(toApp.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await user.click(toApp.getByRole("link", { name: "App" }));
    expect(window.location.pathname).toBe("/board");
    expect(await screen.findByText("Senior Frontend Engineer")).toBeInTheDocument();

    const toHome = within(screen.getAllByRole("navigation", { name: "Switch view" })[0]);
    expect(toHome.getByRole("link", { name: "App" })).toHaveAttribute("aria-current", "page");
    await user.click(toHome.getByRole("link", { name: "Home" }));
    expect(window.location.pathname).toBe("/");
    expect(
      screen.getByRole("heading", { level: 1, name: "Know where every job application stands" }),
    ).toBeInTheDocument();
  });
});

describe("insights", () => {
  it("summarises the pipeline in words and charts", async () => {
    window.history.replaceState(null, "", "/insights");
    render(<App backend={demo()} />);
    expect(await screen.findByText(/biggest drop-off/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Funnel" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Gone quiet" })).toBeInTheDocument();
  });

  it("keeps the board working when insights are down", async () => {
    const user = userEvent.setup();
    const backend = demo();
    const down = () => Promise.reject(new ApiError("unavailable", "Couldn't reach the server."));
    backend.insights.funnel = down;
    backend.insights.timeInStage = down;
    backend.insights.stale = down;
    window.history.replaceState(null, "", "/insights");
    render(<App backend={backend} />);

    expect(await screen.findByText("Insights are temporarily unavailable")).toBeInTheDocument();

    await user.click(screen.getAllByRole("link", { name: /board/i })[0]);
    expect(await screen.findByText("Senior Frontend Engineer")).toBeInTheDocument();
  });
});
