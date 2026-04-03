import { beforeEach, describe, expect, it, vi } from "vitest";

const githubApiFetchMock = vi.fn<(path: string) => Promise<Response>>();

vi.mock("@/repo/github-fetch", () => ({
  githubApiFetch: (path: string) => githubApiFetchMock(path),
}));

function createJsonResponse(value: object, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}

function createNotFoundResponse(): Response {
  return createJsonResponse({ message: "Not Found" }, 404);
}

function createCommitResponse(sha: string): Response {
  return createJsonResponse({ sha });
}

describe("resolveRepoIntent", () => {
  beforeEach(() => {
    githubApiFetchMock.mockReset();
  });

  it("resolves repo-root intents to the default branch", async () => {
    githubApiFetchMock.mockImplementation(async (path) => {
      if (path === "/repos/acme/demo") {
        return createJsonResponse({ default_branch: "main" });
      }

      if (path === "/repos/acme/demo/commits/heads%2Fmain") {
        return createCommitResponse("commit-main");
      }

      return createNotFoundResponse();
    });

    const { resolveRepoIntent } = await import("@/repo/ref-resolver");

    await expect(
      resolveRepoIntent({
        owner: "acme",
        repo: "demo",
        type: "repo-root",
      }),
    ).resolves.toEqual({
      owner: "acme",
      ref: "main",
      refOrigin: "default",
      repo: "demo",
      resolvedRef: {
        apiRef: "heads/main",
        fullRef: "refs/heads/main",
        kind: "branch",
        name: "main",
      },
      token: undefined,
      view: "repo",
    });
  });

  it("resolves explicit branches", async () => {
    githubApiFetchMock.mockImplementation(async (path) => {
      if (path === "/repos/acme/demo/commits/heads%2Fcanary") {
        return createCommitResponse("commit-canary");
      }

      if (path === "/repos/acme/demo/commits/tags%2Fcanary") {
        return createNotFoundResponse();
      }

      if (path === "/repos/acme/demo/commits/canary") {
        return createNotFoundResponse();
      }

      return createNotFoundResponse();
    });

    const { resolveRepoIntent } = await import("@/repo/ref-resolver");

    await expect(
      resolveRepoIntent({
        owner: "acme",
        rawRef: "canary",
        repo: "demo",
        type: "shorthand-ref",
      }),
    ).resolves.toMatchObject({
      ref: "canary",
      refOrigin: "explicit",
      resolvedRef: {
        apiRef: "heads/canary",
        fullRef: "refs/heads/canary",
        kind: "branch",
        name: "canary",
      },
      view: "repo",
    });
  });

  it("resolves explicit tags", async () => {
    githubApiFetchMock.mockImplementation(async (path) => {
      if (path === "/repos/acme/demo/commits/heads%2Fv1.2.3") {
        return createNotFoundResponse();
      }

      if (path === "/repos/acme/demo/commits/tags%2Fv1.2.3") {
        return createCommitResponse("commit-tag");
      }

      if (path === "/repos/acme/demo/commits/v1.2.3") {
        return createNotFoundResponse();
      }

      return createNotFoundResponse();
    });

    const { resolveRepoIntent } = await import("@/repo/ref-resolver");

    await expect(
      resolveRepoIntent({
        owner: "acme",
        rawRef: "v1.2.3",
        repo: "demo",
        type: "shorthand-ref",
      }),
    ).resolves.toMatchObject({
      ref: "v1.2.3",
      refOrigin: "explicit",
      resolvedRef: {
        apiRef: "tags/v1.2.3",
        fullRef: "refs/tags/v1.2.3",
        kind: "tag",
        name: "v1.2.3",
      },
      view: "repo",
    });
  });

  it("resolves commit pages", async () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";

    githubApiFetchMock.mockImplementation(async (path) => {
      if (path === `/repos/acme/demo/commits/${sha}`) {
        return createCommitResponse(sha);
      }

      return createNotFoundResponse();
    });

    const { resolveRepoIntent } = await import("@/repo/ref-resolver");

    await expect(
      resolveRepoIntent({
        owner: "acme",
        repo: "demo",
        sha,
        type: "commit-page",
      }),
    ).resolves.toMatchObject({
      ref: sha,
      refOrigin: "explicit",
      resolvedRef: {
        kind: "commit",
        sha,
      },
      view: "repo",
    });
  });

  it("resolves tree pages with slash refs and preserves leftover subpath", async () => {
    githubApiFetchMock.mockImplementation(async (path) => {
      if (path === "/repos/acme/demo/commits/heads%2Ffeature%2Ffoo%2Fsrc%2Flib") {
        return createNotFoundResponse();
      }

      if (path === "/repos/acme/demo/commits/tags%2Ffeature%2Ffoo%2Fsrc%2Flib") {
        return createNotFoundResponse();
      }

      if (path === "/repos/acme/demo/commits/heads%2Ffeature%2Ffoo%2Fsrc") {
        return createNotFoundResponse();
      }

      if (path === "/repos/acme/demo/commits/tags%2Ffeature%2Ffoo%2Fsrc") {
        return createNotFoundResponse();
      }

      if (path === "/repos/acme/demo/commits/heads%2Ffeature%2Ffoo") {
        return createCommitResponse("commit-feature-foo");
      }

      return createNotFoundResponse();
    });

    const { resolveRepoIntent } = await import("@/repo/ref-resolver");

    await expect(
      resolveRepoIntent({
        owner: "acme",
        repo: "demo",
        tail: "feature/foo/src/lib",
        type: "tree-page",
      }),
    ).resolves.toMatchObject({
      ref: "feature/foo",
      refOrigin: "explicit",
      resolvedRef: {
        apiRef: "heads/feature/foo",
        fullRef: "refs/heads/feature/foo",
        kind: "branch",
        name: "feature/foo",
      },
      subpath: "src/lib",
      view: "tree",
    });
  });

  it("resolves blob pages with slash refs and preserves leftover subpath", async () => {
    githubApiFetchMock.mockImplementation(async (path) => {
      if (path === "/repos/acme/demo/commits/heads%2Frelease%2Fcandidate%2FREADME.md") {
        return createNotFoundResponse();
      }

      if (path === "/repos/acme/demo/commits/tags%2Frelease%2Fcandidate%2FREADME.md") {
        return createNotFoundResponse();
      }

      if (path === "/repos/acme/demo/commits/heads%2Frelease%2Fcandidate") {
        return createCommitResponse("commit-release-candidate");
      }

      return createNotFoundResponse();
    });

    const { resolveRepoIntent } = await import("@/repo/ref-resolver");

    await expect(
      resolveRepoIntent({
        owner: "acme",
        repo: "demo",
        tail: "release/candidate/README.md",
        type: "blob-page",
      }),
    ).resolves.toMatchObject({
      ref: "release/candidate",
      refOrigin: "explicit",
      resolvedRef: {
        apiRef: "heads/release/candidate",
        fullRef: "refs/heads/release/candidate",
        kind: "branch",
        name: "release/candidate",
      },
      subpath: "README.md",
      view: "blob",
    });
  });

  it("falls back unsupported repo pages to the repo root", async () => {
    githubApiFetchMock.mockImplementation(async (path) => {
      if (path === "/repos/acme/demo") {
        return createJsonResponse({ default_branch: "main" });
      }

      if (path === "/repos/acme/demo/commits/heads%2Fmain") {
        return createCommitResponse("commit-main");
      }

      return createNotFoundResponse();
    });

    const { resolveRepoIntent } = await import("@/repo/ref-resolver");

    await expect(
      resolveRepoIntent({
        owner: "acme",
        page: "issues",
        repo: "demo",
        type: "unsupported-repo-page",
      }),
    ).resolves.toMatchObject({
      fallbackReason: "unsupported-page",
      ref: "main",
      refOrigin: "default",
      view: "repo",
    });
  });

  it("throws explicit errors for invalid input", async () => {
    const { resolveRepoIntent } = await import("@/repo/ref-resolver");

    await expect(
      resolveRepoIntent({
        reason: "Empty repository input",
        type: "invalid",
      }),
    ).rejects.toThrow("Empty repository input");
  });

  it("throws explicit missing-ref errors", async () => {
    githubApiFetchMock.mockResolvedValue(createNotFoundResponse());

    const { resolveRepoIntent } = await import("@/repo/ref-resolver");

    await expect(
      resolveRepoIntent({
        owner: "acme",
        rawRef: "does-not-exist",
        repo: "demo",
        type: "shorthand-ref",
      }),
    ).rejects.toMatchObject({
      message: "GitHub ref not found: does-not-exist",
    });
  });

  it("prefers branches over tags when names collide", async () => {
    githubApiFetchMock.mockImplementation(async (path) => {
      if (path === "/repos/acme/demo/commits/heads%2Fstable") {
        return createCommitResponse("branch-commit");
      }

      if (path === "/repos/acme/demo/commits/tags%2Fstable") {
        return createCommitResponse("tag-commit");
      }

      return createNotFoundResponse();
    });

    const { resolveRepoIntent } = await import("@/repo/ref-resolver");

    await expect(
      resolveRepoIntent({
        owner: "acme",
        rawRef: "stable",
        repo: "demo",
        type: "shorthand-ref",
      }),
    ).resolves.toMatchObject({
      ref: "stable",
      resolvedRef: {
        apiRef: "heads/stable",
        fullRef: "refs/heads/stable",
        kind: "branch",
        name: "stable",
      },
    });
  });
});
