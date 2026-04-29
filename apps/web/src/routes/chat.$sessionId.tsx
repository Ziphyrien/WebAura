import * as React from "react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";

const SessionChatPage = React.lazy(async () => {
  const module = await import("../components/chat-page.client");
  return { default: module.SessionChatPage };
});

export const Route = createFileRoute("/chat/$sessionId")({
  component: SessionChatRoute,
});

function SessionChatRoute() {
  const { sessionId } = Route.useParams();

  return (
    <ClientOnly>
      <React.Suspense fallback={null}>
        <SessionChatPage sessionId={sessionId} />
      </React.Suspense>
    </ClientOnly>
  );
}
