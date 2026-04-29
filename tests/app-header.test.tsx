import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    search: _search,
    to: _to,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("a", props, children),
}));

vi.mock("@webaura/ui/components/button", () => ({
  Button: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? children : React.createElement("button", undefined, children),
}));

vi.mock("@webaura/ui/components/separator", () => ({
  Separator: () => null,
}));

vi.mock("@webaura/ui/components/sidebar", () => ({
  SidebarTrigger: () => React.createElement("button", { type: "button" }, "Sidebar"),
}));

vi.mock("@webaura/ui/components/theme-toggle", () => ({
  ThemeToggle: () => React.createElement("button", { type: "button" }, "Theme"),
}));

vi.mock("@webaura/ui/components/icons", () => ({
  Icons: {
    cog: () => React.createElement("span", undefined, "Cog"),
  },
}));

vi.mock("@webaura/ui/components/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", undefined, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", undefined, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", undefined, children),
}));

describe("AppHeader", () => {
  it("shows standard chat actions without a header brand", async () => {
    const { AppHeader } = await import("@/components/app-header");

    render(<AppHeader />);

    expect(screen.queryByText("WebAura")).toBeNull();
    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.getAllByText("Cog").length).toBeGreaterThan(0);
  });
});
