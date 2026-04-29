import * as React from "react";
import {
  ClientOnly,
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
  retainSearchParams,
} from "@tanstack/react-router";
import { parseSettingsSection } from "@webaura/ui/lib/search-state";
import appCss from "../styles.css?url";

const RootAppChrome = React.lazy(async () => {
  const module = await import("../components/root-app-chrome.client");
  return { default: module.RootAppChrome };
});

type RootSearchInput = {
  settings?: string;
  sidebar?: string;
};

type RootSearch = {
  settings?: ReturnType<typeof parseSettingsSection>;
  sidebar?: "open";
};

export const Route = createRootRoute({
  validateSearch: (search: RootSearchInput): RootSearch => ({
    settings: parseSettingsSection(search.settings),
    sidebar: search.sidebar === "open" ? "open" : undefined,
  }),
  search: {
    middlewares: [retainSearchParams(["settings", "sidebar"])],
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "WebAura",
      },
      {
        name: "description",
        content: "Local-first AI tools, running in your browser.",
      },
      {
        name: "apple-mobile-web-app-title",
        content: "WebAura",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/png",
        href: "/favicon-96x96.png",
        sizes: "96x96",
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
      {
        rel: "shortcut icon",
        href: "/favicon.ico",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "manifest",
        href: "/site.webmanifest",
      },
    ],
  }),
  notFoundComponent: NotFoundPage,
  shellComponent: RootDocument,
  component: RootAppChromeBoundary,
  ssr: false,
});

function RootAppChromeBoundary() {
  return (
    <ClientOnly>
      <React.Suspense fallback={null}>
        <RootAppChrome />
      </React.Suspense>
    </ClientOnly>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-medium">Page not found</h1>
      <p className="max-w-md text-xs text-muted-foreground">
        The route does not exist or the dev server reloaded while the router was resolving the page.
      </p>
      <Link
        className="text-xs underline underline-offset-4 hover:text-foreground"
        search={{
          settings: undefined,
          sidebar: undefined,
        }}
        to="/"
      >
        Go to chat
      </Link>
    </div>
  );
}
