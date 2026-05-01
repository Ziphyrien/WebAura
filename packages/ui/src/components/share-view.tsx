"use client";

import * as React from "react";
import { readShareFromFragment, ShareError, type ShareSnapshot } from "@webaura/pi/lib/share";
import type { DisplayChatMessage } from "@webaura/pi/types/chat";
import { ChatMessage } from "@webaura/ui/components/chat-message";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@webaura/ui/components/ai-elements/conversation";
import { Button } from "@webaura/ui/components/button";

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

function shareSnapshotToMessages(snapshot: ShareSnapshot): DisplayChatMessage[] {
  return snapshot.messages.map<DisplayChatMessage>((message, index) => {
    const timestamp = message.timestamp ?? Date.parse(snapshot.createdAt) + index;
    const id = `share-${index}`;

    switch (message.role) {
      case "user":
        return {
          attachments: message.attachments?.map((attachment, attachmentIndex) => ({
            fileName: attachment.fileName,
            id: `${id}-attachment-${attachmentIndex}`,
            mediaType: attachment.mediaType,
            size: attachment.size,
            type: attachment.type,
          })),
          content: message.content,
          displayText: message.content,
          id,
          role: "user",
          timestamp,
        };
      case "assistant":
        return {
          api: "openai-responses",
          content: [{ text: message.content, type: "text" }],
          id,
          model: snapshot.metadata?.model ?? "shared-chat",
          provider: snapshot.metadata?.provider ?? "openai",
          role: "assistant",
          stopReason: "stop",
          timestamp,
          usage: {
            cacheRead: 0,
            cacheWrite: 0,
            cost: {
              cacheRead: 0,
              cacheWrite: 0,
              input: 0,
              output: 0,
              total: 0,
            },
            input: 0,
            output: 0,
            totalTokens: 0,
          },
        } as DisplayChatMessage;
      case "system":
        return {
          fingerprint: `${id}:${message.content}`,
          id,
          kind: "shared_notice",
          message: message.content,
          role: "system",
          severity: "info",
          source: "runtime",
          timestamp,
        };
      default:
        return assertNever(message.role);
    }
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ShareError) {
    switch (error.code) {
      case "decrypt_failed":
        return "This share link could not decrypt the conversation. Check that the full link, including the fragment, was copied.";
      case "missing_manifest":
        return "The Nostr share manifest could not be found on the relays in this link.";
      case "missing_chunks":
        return "Some encrypted Nostr chunks are missing or invalid. Try again later or ask for a new share link.";
      case "oversized":
        return "This shared conversation is larger than WebAura can open safely.";
      case "publish_failed":
      case "relay_failed":
        return "WebAura could not read enough data from the public relays in this link.";
      case "unsupported_version":
        return "This share link was created by an unsupported WebAura version.";
      case "invalid_link":
        return error.message;
      default:
        return assertNever(error.code);
    }
  }

  return "This share link could not be opened.";
}

function ShareLoadingState() {
  return (
    <div className="flex size-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
      Opening shared conversation...
    </div>
  );
}

function ShareErrorState({ message }: { message: string }) {
  return (
    <div className="flex size-full items-center justify-center px-6">
      <div className="max-w-md rounded-lg border border-border bg-card p-5 text-center shadow-sm">
        <h1 className="text-base font-medium text-foreground">Could not open share</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button asChild className="mt-4" size="sm" variant="outline">
          <a href="/">Back to chat</a>
        </Button>
      </div>
    </div>
  );
}

export function ShareView() {
  const [state, setState] = React.useState<
    | { error: string; status: "error" }
    | { snapshot: ShareSnapshot; status: "ready" }
    | { status: "loading" }
  >({ status: "loading" });

  React.useEffect(() => {
    let cancelled = false;

    async function loadShare() {
      try {
        const snapshot = await readShareFromFragment(window.location.hash);

        if (!cancelled) {
          setState({ snapshot, status: "ready" });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ error: getErrorMessage(error), status: "error" });
        }
      }
    }

    void loadShare();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <ShareLoadingState />;
  }

  if (state.status === "error") {
    return <ShareErrorState message={state.error} />;
  }

  const messages = shareSnapshotToMessages(state.snapshot);
  const title = state.snapshot.metadata?.title ?? "Shared chat";
  const subtitle = [state.snapshot.metadata?.model, state.snapshot.metadata?.provider]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex size-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Read-only share
          </div>
          <h1 className="line-clamp-2 text-lg font-semibold text-foreground">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-4xl px-4 py-6">
          {messages.map((message, index) => (
            <ChatMessage
              followingMessages={messages.slice(index + 1)}
              isStreamingReasoning={false}
              key={message.id}
              message={message}
            />
          ))}
        </ConversationContent>
        <ConversationScrollButton className="z-[15]" />
      </Conversation>
    </div>
  );
}
