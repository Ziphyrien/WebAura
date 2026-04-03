import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("a", props, children),
}));

vi.mock("@gitinspect/ui/components/icons", () => ({
  Icons: {
    gitHub: () => React.createElement("span", undefined, "GitHub"),
  },
}));

vi.mock("@gitinspect/ui/components/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) =>
    React.createElement("button", { type: "button" }, children),
}));

vi.mock("@gitinspect/ui/components/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", undefined, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", undefined, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", undefined, children),
}));

vi.mock("@gitinspect/pi/repo/github-fetch", () => ({
  githubApiFetch: vi.fn(
    async () =>
      new Response(JSON.stringify({ language: "TypeScript", stargazers_count: 1234 }), {
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      }),
  ),
  handleGithubError: vi.fn(async () => false),
  openGithubTokenSettings: vi.fn(),
}));

vi.mock("@gitinspect/pi/repo/github-token", () => ({
  getGithubPersonalAccessToken: vi.fn(async () => "token"),
}));

describe("GithubRepo", () => {
  it("shows refs in brackets", async () => {
    const { GithubRepo } = await import("@/components/github-repo");

    render(
      <GithubRepo
        owner="acme"
        ref="feature/foo"
        refOrigin="explicit"
        repo="demo"
        to="/acme/demo/feature/foo"
      />,
    );

    expect(screen.getByText("[feature/foo]")).toBeTruthy();
  });

  it("shows default refs in brackets too", async () => {
    const { GithubRepo } = await import("@/components/github-repo");

    render(<GithubRepo owner="acme" ref="main" refOrigin="default" repo="demo" to="/acme/demo" />);

    expect(screen.getByText("[main]")).toBeTruthy();
  });
});
