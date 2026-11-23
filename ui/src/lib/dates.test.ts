import { describe, expect, it } from "vitest";
import { daysSince, longAgo, parseDate, shortAgo, todayIso } from "./dates";

const now = new Date("2026-11-23T12:00:00");

describe("dates", () => {
  it("reads plain dates as local midnight", () => {
    expect(parseDate("2026-11-20")?.getHours()).toBe(0);
    expect(parseDate("nope")).toBeNull();
    expect(parseDate(null)).toBeNull();
  });

  it("counts whole days and never goes negative", () => {
    expect(daysSince("2026-11-20", now)).toBe(3);
    expect(daysSince("2026-12-01", now)).toBe(0);
    expect(daysSince(null, now)).toBeNull();
  });

  it("formats short relative labels", () => {
    expect(shortAgo("2026-11-23T08:00:00", now)).toBe("Today");
    expect(shortAgo("2026-11-18", now)).toBe("5d");
    expect(shortAgo("2026-10-26", now)).toBe("4w");
    expect(shortAgo("2026-07-01", now)).toBe("4mo");
    expect(shortAgo(null, now)).toBe("—");
  });

  it("formats long relative labels", () => {
    expect(longAgo("2026-11-22T09:00:00", now)).toBe("yesterday");
    expect(longAgo("2026-11-11", now)).toBe("12 days ago");
    expect(longAgo("2026-08-01", now)).toBe("3 months ago");
  });

  it("gives today as YYYY-MM-DD", () => {
    expect(todayIso(now)).toBe("2026-11-23");
  });
});
