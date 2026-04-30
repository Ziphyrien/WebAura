import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("../packages/extensions/src/github/token", () => ({
  getGithubPersonalAccessToken: vi.fn(async () => undefined),
}));

describe("githubRequest", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("aborts hung GitHub requests after the request timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;

        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }

        signal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { githubRequest } = await import("../packages/extensions/src/github/client");

    const request = githubRequest("/user");
    const expectedRejection = expect(request).rejects.toThrow(
      "GitHub API request timed out after 45000ms: /user",
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(45_000);

    await expectedRejection;
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal).toBeInstanceOf(
      AbortSignal,
    );
  });
});
