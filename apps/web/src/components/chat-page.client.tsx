import { Chat } from "@webaura/ui/components/chat";

export function ChatPage() {
  return <Chat />;
}

export function SessionChatPage({ sessionId }: { sessionId: string }) {
  return <Chat sessionId={sessionId} />;
}
