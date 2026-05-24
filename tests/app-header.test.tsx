import * as React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    search: _search,
    to: _to,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement("a", props, children),
}));

vi.mock("@firefly/ui/components/button", () => ({
  Button: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? children : React.createElement("button", undefined, children),
}));

vi.mock("@firefly/ui/components/separator", () => ({
  Separator: () => null,
}));

vi.mock("@firefly/ui/components/sidebar", () => ({
  SidebarTrigger: () => React.createElement("button", { type: "button" }, "Sidebar"),
}));

vi.mock("@firefly/ui/components/theme-toggle", () => ({
  ThemeToggle: () => React.createElement("button", { type: "button" }, "Theme"),
}));

vi.mock("@firefly/ui/components/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", undefined, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", undefined, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", undefined, children),
}));

describe("AppHeader", () => {
  it("renders no top header chrome", async () => {
    const { AppHeader } = await import("@/components/app-header");

    const { container } = render(<AppHeader />);

    expect(container.childElementCount).toBe(0);
  });
});
