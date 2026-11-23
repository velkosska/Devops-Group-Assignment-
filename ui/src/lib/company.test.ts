import { describe, expect, it } from "vitest";
import { companyFromUrl, displayHost, monogram, normalizeUrl } from "./company";

describe("companyFromUrl", () => {
  it.each([
    ["https://jobs.lever.co/northwind/1182", "Northwind"],
    ["boards.greenhouse.io/lumen-labs/jobs/4471", "Lumen Labs"],
    ["https://job-boards.greenhouse.io/acme/jobs/1", "Acme"],
    ["https://jobs.ashbyhq.com/paperplane/devops", "Paperplane"],
    ["https://quarry.bamboohr.com/careers/12", "Quarry"],
    ["https://careers.fieldnote.io/fullstack", "Fieldnote"],
    ["www.tessera.dev/careers/payments", "Tessera"],
    ["https://jobs.example.co.uk/role", "Example"],
  ])("reads %s as %s", (url, company) => {
    expect(companyFromUrl(url)).toBe(company);
  });

  it.each([
    "https://www.linkedin.com/jobs/view/123",
    "https://indeed.com/viewjob?jk=1",
    "not a url",
    "localhost",
    "",
  ])("returns null for %s", (url) => {
    expect(companyFromUrl(url)).toBeNull();
  });
});

describe("monogram", () => {
  it("uses the first letters of the first two words", () => {
    expect(monogram("Lumen Labs")).toBe("LL");
    expect(monogram("Kettle & Co")).toBe("KC");
  });
  it("uses two letters of a single word", () => {
    expect(monogram("acme")).toBe("AC");
  });
  it("falls back to a question mark", () => {
    expect(monogram("  ")).toBe("?");
  });
});

describe("normalizeUrl / displayHost", () => {
  it("adds https when missing", () => {
    expect(normalizeUrl("acme.com/jobs")).toBe("https://acme.com/jobs");
    expect(normalizeUrl("http://acme.com")).toBe("http://acme.com");
    expect(normalizeUrl("  ")).toBe("");
  });
  it("shows the host without www", () => {
    expect(displayHost("https://www.acme.com/jobs/1")).toBe("acme.com");
  });
});
