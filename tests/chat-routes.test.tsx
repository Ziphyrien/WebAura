import * as React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const routerState = vi.hoisted(() => ({
  matches: [] as Array<{ params?: Record<string, string>; routeId: string }>,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();

  return {
    ...actual,
    ClientOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useRouterState: ({ select }: { select: (state: typeof routerState) => unknown }) =>
      select(routerState),
  };
});

vi.mock("@firefly/ui/components/chat", () => ({
  Chat: (props: { sessionId?: string }) => (
    <div data-testid="chat-view">{props.sessionId ? `session:${props.sessionId}` : "global"}</div>
  ),
}));

describe("chat routes", () => {
  beforeEach(() => {
    routerState.matches = [];
  });

  it("redirects / to the persistent /chat frame", async () => {
    const { Route } = await import("@/routes/index");

    expect(Route.options.beforeLoad).toBeTypeOf("function");
    expect(() => Route.options.beforeLoad?.({} as never)).toThrow();
  });

  it("renders the persistent shared chat component on /chat", async () => {
    const { Route } = await import("@/routes/chat");
    const Component = Route.options.component;

    if (!Component) {
      throw new Error("Missing route component");
    }

    render(<Component />);

    expect((await screen.findByTestId("chat-view")).textContent).toBe("global");
  });

  it("passes the matched session id into the persistent shared chat component", async () => {
    routerState.matches = [
      {
        params: { sessionId: "session-1" },
        routeId: "/chat/$sessionId",
      },
    ];

    const { Route } = await import("@/routes/chat");
    const Component = Route.options.component;

    if (!Component) {
      throw new Error("Missing route component");
    }

    render(<Component />);

    expect((await screen.findByTestId("chat-view")).textContent).toBe("session:session-1");
  });

  it("keeps chat child routes renderless", async () => {
    const [{ Route: IndexRoute }, { Route: SessionRoute }] = await Promise.all([
      import("@/routes/chat.index"),
      import("@/routes/chat.$sessionId"),
    ]);

    expect(IndexRoute.options.component?.({} as never)).toBeNull();
    expect(SessionRoute.options.component?.({} as never)).toBeNull();
  });
});
