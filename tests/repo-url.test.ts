import { describe, expect, it } from "vitest";
import { parseRepoInput, parseRepoRoutePath } from "@/repo/path-parser";
import { githubOwnerAvatarUrl, repoSourceToPath } from "@/repo/url";

describe("parseRepoRoutePath", () => {
  it("parses repo root", () => {
    expect(parseRepoRoutePath("/vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
      type: "repo-root",
    });
  });

  it("parses shorthand refs", () => {
    expect(parseRepoRoutePath("/vercel/next.js/canary")).toEqual({
      owner: "vercel",
      rawRef: "canary",
      repo: "next.js",
      type: "shorthand-ref",
    });
  });

  it("parses tree pages with full tails", () => {
    expect(parseRepoRoutePath("/vercel/next.js/tree/feature/foo/src/lib")).toEqual({
      owner: "vercel",
      repo: "next.js",
      tail: "feature/foo/src/lib",
      type: "tree-page",
    });
  });

  it("parses blob pages with full tails", () => {
    expect(parseRepoRoutePath("/vercel/next.js/blob/main/README.md")).toEqual({
      owner: "vercel",
      repo: "next.js",
      tail: "main/README.md",
      type: "blob-page",
    });
  });

  it("parses commit pages", () => {
    expect(
      parseRepoRoutePath("/vercel/next.js/commit/0123456789abcdef0123456789abcdef01234567"),
    ).toEqual({
      owner: "vercel",
      repo: "next.js",
      sha: "0123456789abcdef0123456789abcdef01234567",
      type: "commit-page",
    });
  });

  it("classifies unsupported repo pages explicitly", () => {
    expect(parseRepoRoutePath("/vercel/next.js/issues/1")).toEqual({
      owner: "vercel",
      page: "issues",
      repo: "next.js",
      type: "unsupported-repo-page",
    });
  });

  it("returns invalid for missing owner or repo", () => {
    expect(parseRepoRoutePath("/vercel")).toEqual({
      reason: "Missing owner/repo",
      type: "invalid",
    });
  });

  it("returns invalid for reserved root paths", () => {
    expect(parseRepoRoutePath("/chat")).toEqual({
      reason: "Missing owner/repo",
      type: "invalid",
    });
  });

  it("decodes encoded tails", () => {
    expect(parseRepoRoutePath("/vercel/next.js/tree/feature%2Ffoo/src%20lib")).toEqual({
      owner: "vercel",
      repo: "next.js",
      tail: "feature/foo/src lib",
      type: "tree-page",
    });
  });
});

describe("parseRepoInput", () => {
  it("supports owner/repo shorthand", () => {
    expect(parseRepoInput("vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
      type: "repo-root",
    });
  });

  it("supports github.com URLs without a scheme", () => {
    expect(parseRepoInput("github.com/vercel/next.js/tree/main/packages")).toEqual({
      owner: "vercel",
      repo: "next.js",
      tail: "main/packages",
      type: "tree-page",
    });
  });

  it("supports full GitHub URLs", () => {
    expect(parseRepoInput("https://github.com/vercel/next.js/blob/main/README.md")).toEqual({
      owner: "vercel",
      repo: "next.js",
      tail: "main/README.md",
      type: "blob-page",
    });
  });

  it("supports .git clone URLs", () => {
    expect(parseRepoInput("https://github.com/vercel/next.js.git")).toEqual({
      owner: "vercel",
      repo: "next.js",
      type: "repo-root",
    });
  });

  it("rejects non-GitHub hosts", () => {
    expect(parseRepoInput("https://gitlab.com/foo/bar")).toEqual({
      reason: "Unsupported host: gitlab.com",
      type: "invalid",
    });
  });
});

describe("githubOwnerAvatarUrl", () => {
  it("builds github avatar URL for owner", () => {
    expect(githubOwnerAvatarUrl("vercel")).toBe("https://github.com/vercel.png");
  });

  it("encodes special characters in owner", () => {
    expect(githubOwnerAvatarUrl("foo/bar")).toBe("https://github.com/foo%2Fbar.png");
  });
});

describe("repoSourceToPath", () => {
  it("omits the default branch from canonical paths", () => {
    expect(
      repoSourceToPath({
        owner: "acme",
        ref: "main",
        refOrigin: "default",
        repo: "demo",
      }),
    ).toBe("/acme/demo");
  });

  it("collapses explicit slash refs to shorthand repo-ref routes", () => {
    expect(
      repoSourceToPath({
        owner: "acme",
        ref: "feature/foo",
        refOrigin: "explicit",
        repo: "demo",
      }),
    ).toBe("/acme/demo/feature/foo");
  });

  it("includes commit refs when they are explicitly selected", () => {
    expect(
      repoSourceToPath({
        owner: "acme",
        ref: "0123456789abcdef0123456789abcdef01234567",
        refOrigin: "explicit",
        repo: "demo",
      }),
    ).toBe("/acme/demo/0123456789abcdef0123456789abcdef01234567");
  });
});
