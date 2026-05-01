import * as React from "react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";

const SharePage = React.lazy(async () => {
  const module = await import("../components/share-page.client");
  return { default: module.SharePage };
});

export const Route = createFileRoute("/share")({
  component: ShareRoute,
});

function ShareRoute() {
  return (
    <ClientOnly>
      <React.Suspense fallback={null}>
        <SharePage />
      </React.Suspense>
    </ClientOnly>
  );
}
