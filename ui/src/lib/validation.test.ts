import { describe, expect, it } from "vitest";
import { emptyValues, toInput, validateForm, valuesFrom } from "./validation";
import { adjacentStage, isStage } from "./stages";
import { quietDays, matchesQuery } from "./follow-up";
import { funnelHeadline, formatDays, slowestStage } from "./headline";
import type { Application } from "./types";

const base = { ...emptyValues(), company: "Acme", role: "Engineer" };

describe("validateForm", () => {
  it("passes with company and role", () => {
    expect(validateForm(base)).toEqual({});
  });

  it("requires company and role, ignoring whitespace", () => {
    const errors = validateForm({ ...base, company: "  ", role: "" });
    expect(errors.company).toBeDefined();
    expect(errors.role).toBeDefined();
  });

  it("checks the link looks like a link", () => {
    expect(validateForm({ ...base, url: "not a link" }).url).toBeDefined();
    expect(validateForm({ ...base, url: "acme.com/jobs/1" }).url).toBeUndefined();
  });

  it("rejects future dates", () => {
    expect(validateForm({ ...base, applied_at: "2999-01-01" }).applied_at).toBeDefined();
  });
});

describe("toInput", () => {
  it("trims, nulls empty optionals and normalises the link", () => {
    const input = toInput(
      { ...base, company: " Acme ", url: "acme.com/jobs", location: " ", applied_at: "" },
      true,
    );
    expect(input).toEqual({
      company: "Acme",
      role: "Engineer",
      url: "https://acme.com/jobs",
      location: null,
      salary_range: null,
      applied_at: null,
      stage: "applied",
    });
  });

  it("leaves stage out when editing", () => {
    expect(toInput(base, false)).not.toHaveProperty("stage");
  });
});

const app = (overrides: Partial<Application> = {}): Application => ({
  id: 1,
  company: "Acme",
  role: "Engineer",
  url: null,
  stage: "applied",
  location: "Madrid",
  salary_range: null,
  applied_at: "2026-11-01",
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-01T10:00:00Z",
  ...overrides,
});

describe("valuesFrom", () => {
  it("turns nulls into empty strings for the form", () => {
    expect(valuesFrom(app()).url).toBe("");
    expect(valuesFrom(app()).applied_at).toBe("2026-11-01");
  });
});

describe("stages and follow-ups", () => {
  it("knows neighbouring stages", () => {
    expect(adjacentStage("applied", -1)).toBeNull();
    expect(adjacentStage("applied", 1)).toBe("screen");
    expect(adjacentStage("offer", 1)).toBeNull();
    expect(adjacentStage("rejected", 1)).toBeNull();
    expect(isStage("screen")).toBe(true);
    expect(isStage("phone")).toBe(false);
  });

  it("flags open applications quiet for more than 14 days", () => {
    const now = new Date("2026-11-20T10:00:00Z");
    expect(quietDays(app(), now)).toBe(19);
    expect(quietDays(app({ updated_at: "2026-11-10T10:00:00Z" }), now)).toBeNull();
    expect(quietDays(app({ stage: "offer" }), now)).toBeNull();
  });

  it("matches search on company, role and location", () => {
    expect(matchesQuery(app(), "madr")).toBe(true);
    expect(matchesQuery(app(), "ENGIN")).toBe(true);
    expect(matchesQuery(app(), "berlin")).toBe(false);
    expect(matchesQuery(app(), "  ")).toBe(true);
  });
});

describe("headline", () => {
  it("names the biggest drop-off", () => {
    const sentence = funnelHeadline({
      total: 10,
      rejected: 0,
      steps: [
        { stage: "applied", count: 10 },
        { stage: "screen", count: 4 },
        { stage: "interview", count: 3 },
        { stage: "offer", count: 1 },
      ],
    });
    expect(sentence).toBe("Your biggest drop-off is Interview → Offer: 33% move on.");
  });

  it("says nothing with no data", () => {
    expect(funnelHeadline({ total: 0, rejected: 0, steps: [] })).toBeNull();
  });

  it("finds the slowest stage and formats days", () => {
    expect(
      slowestStage([
        { stage: "applied", medianDays: 2 },
        { stage: "screen", medianDays: 6 },
        { stage: "interview", medianDays: null },
      ])?.stage,
    ).toBe("screen");
    expect(formatDays(0.4)).toBe("<1 day");
    expect(formatDays(1)).toBe("1 day");
    expect(formatDays(3.25)).toBe("3 days");
    expect(formatDays(12.6)).toBe("13 days");
  });
});
