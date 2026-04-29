import * as React from "react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";

const ChatPage = React.lazy(async () => {
  const module = await import("../components/chat-page.client");
  return { default: module.ChatPage };
});

export const Route = createFileRoute("/chat/")({
  component: ChatPageBoundary,
});

function ChatPageBoundary() {
  return (
    <ClientOnly>
      <React.Suspense fallback={null}>
        <ChatPage />
      </React.Suspense>
    </ClientOnly>
  );
}
