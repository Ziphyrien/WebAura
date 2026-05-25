"use client";

import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { getFoldedToolResultIds } from "@firefly/pi/lib/chat-adapter";
import { ChatComposer } from "./chat-composer";
import { SessionUtilityActions } from "./session-utility-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@firefly/ui/components/dialog";
import { Button } from "@firefly/ui/components/button";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatMessage as ChatMessageBlock } from "./chat-message";
import {
  createUserMessageFromTurnInput,
  type UserTurnInput,
} from "@firefly/pi/agent/user-turn-input";
import { createId } from "@firefly/pi/lib/ids";
import type { ProviderGroupId, ThinkingLevel } from "@firefly/pi/types/models";
import type { AssistantMessage, DisplayChatMessage } from "@firefly/pi/types/chat";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@firefly/ui/components/ai-elements/conversation";
import { Spinner } from "@firefly/ui/components/spinner";
import { StatusShimmer } from "@firefly/ui/components/ai-elements/shimmer";
import { ProgressiveBlur } from "@firefly/ui/components/progressive-blur";
import {
  buildShareSnapshot,
  createShareLink,
  ShareError,
  type CreatedShareLink,
} from "@firefly/pi/lib/share";
import { db } from "@firefly/db";
import { runtimeClient } from "@firefly/pi/agent/runtime-client";
import { getRuntimeCommandErrorMessage } from "@firefly/pi/agent/runtime-command-errors";
import { useRuntimeSession } from "@firefly/pi/hooks/use-runtime-session";
import { useSessionOwnership } from "@firefly/pi/hooks/use-session-ownership";
import {
  getCanonicalProvider,
  getConnectedProviders,
  getDefaultModelForGroup,
  getDefaultProviderGroup,
  getVisibleProviderGroups,
  NO_CONFIGURED_PROVIDERS_MESSAGE,
  SELECTED_PROVIDER_NOT_CONFIGURED_MESSAGE,
} from "@firefly/pi/models/catalog";
import {
  persistLastUsedSessionSettings,
  resolveProviderDefaults,
} from "@firefly/pi/sessions/session-actions";
import { reconcileInterruptedSession } from "@firefly/pi/sessions/session-notices";
import {
  loadSessionViewModel,
  type SessionViewModel,
} from "@firefly/pi/sessions/session-view-model";
import {
  deriveActiveSessionViewState,
  deriveBannerState,
  deriveComposerState,
  deriveRecoveryIntent,
  deriveResumeAction,
  shouldDisplayConversationStreaming,
} from "@firefly/pi/sessions/session-view-state";
import { useConversationStarter } from "@firefly/ui/hooks/use-conversation-starter";
import { useSettingsDialog } from "@firefly/ui/components/settings-state";

type EmptyChatDraft = {
  model: string;
  providerGroup: ProviderGroupId;
  thinkingLevel: ThinkingLevel;
};

type LoadedSessionState =
  | { kind: "active"; viewModel: SessionViewModel }
  | { kind: "missing" }
  | { kind: "none" };

type ChatPanelMode = "empty" | "messages" | "pending" | "starting" | "streaming_pending";

type PendingFirstMessage = {
  message: DisplayChatMessage;
  sessionId?: string;
};

export interface ChatProps {
  sessionId?: string;
}

function isSystemNotice(
  message: DisplayChatMessage,
): message is Extract<DisplayChatMessage, { role: "system" }> {
  return message.role === "system";
}

function LoadingState({ label }: { label: string }) {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    // 延迟 150ms 渲染加载状态，如果在这期间加载完成，用户完全不会看到任何闪烁
    const timer = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(timer);
  }, []);

  if (!show) {
    return null;
  }

  return (
    <div className="flex h-[50vh] w-full animate-in fade-in duration-200 items-center justify-center px-6">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-5 text-muted-foreground/70" />
        <span className="text-xs font-medium text-muted-foreground/80 tracking-wide">{label}</span>
      </div>
    </div>
  );
}

function getChatPanelMode(input: {
  hasAssistantMessage: boolean;
  isSessionPending: boolean;
  isStartingSession: boolean;
  isStreaming: boolean;
  messageCount: number;
}): ChatPanelMode {
  if (input.isSessionPending && input.messageCount === 0) {
    return "pending";
  }

  if (input.isStartingSession && input.messageCount === 0) {
    return "starting";
  }

  if (input.isStreaming && input.messageCount > 0 && !input.hasAssistantMessage) {
    return "streaming_pending";
  }

  if (input.messageCount === 0) {
    return "empty";
  }

  return "messages";
}

function formatRelativeProgress(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  const elapsedMs = Math.max(0, Date.now() - timestamp);
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);

  if (elapsedMinutes < 1) {
    return "just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

function getLastAssistantMessage(
  messages: ReadonlyArray<DisplayChatMessage>,
): AssistantMessage | undefined {
  return [...messages]
    .reverse()
    .find((message): message is AssistantMessage => message.role === "assistant");
}

export function Chat(props: ChatProps) {
  const navigate = useNavigate();
  const settingsDialog = useSettingsDialog();
  const loadedSessionState = useLiveQuery(async (): Promise<LoadedSessionState> => {
    if (!props.sessionId) {
      return { kind: "none" };
    }

    const viewModel = await loadSessionViewModel(props.sessionId);

    if (!viewModel) {
      return { kind: "missing" };
    }

    return {
      kind: "active",
      viewModel,
    };
  }, [props.sessionId]);
  const defaults = useLiveQuery(async () => {
    const resolved = await resolveProviderDefaults();

    return {
      model: resolved.model,
      providerGroup: resolved.providerGroup,
      thinkingLevel: "medium" as ThinkingLevel,
    } satisfies EmptyChatDraft;
  }, []);
  const providerKeysResult = useLiveQuery(() => db.providerKeys.toArray(), []);
  const providerKeys = Array.isArray(providerKeysResult) ? providerKeysResult : [];
  const [draft, setDraft] = React.useState<EmptyChatDraft | undefined>(undefined);
  const [manualShareLink, setManualShareLink] = React.useState<CreatedShareLink | undefined>(
    undefined,
  );
  const [isSharePending, setIsSharePending] = React.useState(false);
  const [pendingFirstMessage, setPendingFirstMessage] = React.useState<
    PendingFirstMessage | undefined
  >(undefined);
  const isSharePendingRef = React.useRef(false);
  const firstSendInFlightRef = React.useRef(false);
  const runtime = useRuntimeSession(props.sessionId);
  const { isStartingSession, startNewConversation } = useConversationStarter();
  const ownership = useSessionOwnership(
    loadedSessionState?.kind === "active" ? loadedSessionState.viewModel.session.id : undefined,
  );
  const observerRef = React.useRef<ResizeObserver | null>(null);
  const recoveryInFlightRef = React.useRef(false);
  const surfacedSystemNoticeFingerprintsRef = React.useRef(new Set<string>());
  const surfacedSystemNoticeSessionIdRef = React.useRef<string | undefined>(undefined);
  const [promptHeight, setPromptHeight] = React.useState(0);

  const promptRef = React.useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateHeight = () => {
      setPromptHeight(node.offsetHeight);
    };

    updateHeight();

    observerRef.current = new ResizeObserver(updateHeight);
    observerRef.current.observe(node);
  }, []);

  const sessionViewModel =
    loadedSessionState?.kind === "active" ? loadedSessionState.viewModel : undefined;
  const activeSession = sessionViewModel?.session;
  const sessionRuntime = sessionViewModel?.runtime;
  const connectedProviders = React.useMemo(
    () => getConnectedProviders(providerKeys),
    [providerKeys],
  );
  const messages = sessionViewModel?.displayMessages ?? [];
  const displayMessages = React.useMemo(() => {
    if (!pendingFirstMessage || messages.length > 0) {
      return messages;
    }

    if (props.sessionId && pendingFirstMessage.sessionId !== props.sessionId) {
      return messages;
    }

    return [pendingFirstMessage.message];
  }, [messages, pendingFirstMessage, props.sessionId]);

  React.useEffect(() => {
    if (!defaults) {
      return;
    }

    setDraft((currentDraft) => currentDraft ?? defaults);
  }, [defaults]);

  React.useEffect(() => {
    if (!pendingFirstMessage?.sessionId) {
      return;
    }

    if (props.sessionId !== pendingFirstMessage.sessionId) {
      return;
    }

    if (messages.length > 0) {
      setPendingFirstMessage(undefined);
    }
  }, [messages.length, pendingFirstMessage, props.sessionId]);

  React.useEffect(() => {
    if (activeSession || !draft) {
      return;
    }

    const visibleProviderGroups = getVisibleProviderGroups(connectedProviders);

    if (visibleProviderGroups.length === 0 || visibleProviderGroups.includes(draft.providerGroup)) {
      return;
    }

    const fallbackProviderGroup = visibleProviderGroups[0];
    setDraft((currentDraft) => {
      if (!currentDraft || visibleProviderGroups.includes(currentDraft.providerGroup)) {
        return currentDraft;
      }

      const model = getDefaultModelForGroup(fallbackProviderGroup).id;

      if (currentDraft.providerGroup === fallbackProviderGroup && currentDraft.model === model) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        model,
        providerGroup: fallbackProviderGroup,
      };
    });
  }, [activeSession, connectedProviders, draft]);

  const hasAssistantMessage = React.useMemo(
    () => messages.some((message) => message.role === "assistant"),
    [messages],
  );
  const foldedToolResultIds = React.useMemo(
    () => getFoldedToolResultIds(displayMessages),
    [displayMessages],
  );
  const lastAssistantMessage = React.useMemo(
    () => getLastAssistantMessage(displayMessages),
    [displayMessages],
  );
  const lastAssistantMessageId = React.useMemo(
    () => lastAssistantMessage?.id,
    [lastAssistantMessage],
  );
  const hasPartialAssistantText = sessionViewModel?.hasPartialAssistantText ?? false;
  const activeSessionViewState = React.useMemo(
    () =>
      activeSession
        ? deriveActiveSessionViewState({
            hasLocalRunner: runtimeClient.hasActiveTurn(activeSession.id),
            hasPartialAssistantText,
            lastProgressAt: sessionRuntime?.lastProgressAt,
            leaseState: ownership,
            runtimePhase: sessionRuntime?.phase,
            runtimeStatus: sessionRuntime?.status,
            sessionIsStreaming: activeSession.isStreaming,
          })
        : undefined,
    [
      activeSession,
      hasPartialAssistantText,
      ownership,
      sessionRuntime?.lastProgressAt,
      sessionRuntime?.phase,
      sessionRuntime?.status,
    ],
  );

  React.useEffect(() => {
    if (surfacedSystemNoticeSessionIdRef.current === activeSession?.id) {
      return;
    }

    surfacedSystemNoticeSessionIdRef.current = activeSession?.id;
    surfacedSystemNoticeFingerprintsRef.current = new Set(
      messages.filter(isSystemNotice).map((message) => message.fingerprint),
    );
  }, [activeSession?.id, messages]);

  React.useEffect(() => {
    if (!activeSession?.id) {
      return;
    }

    if (surfacedSystemNoticeSessionIdRef.current !== activeSession.id) {
      return;
    }

    const seenFingerprints = surfacedSystemNoticeFingerprintsRef.current;
    const unseenErrors = messages.filter(
      (message): message is Extract<DisplayChatMessage, { role: "system" }> =>
        isSystemNotice(message) &&
        message.severity === "error" &&
        !seenFingerprints.has(message.fingerprint),
    );

    for (const message of unseenErrors) {
      seenFingerprints.add(message.fingerprint);
      toast.error(getRuntimeCommandErrorMessage(new Error(message.message)));
    }
  }, [activeSession?.id, messages]);

  const recoveryIntent = React.useMemo(
    () => (activeSessionViewState ? deriveRecoveryIntent(activeSessionViewState) : "none"),
    [activeSessionViewState],
  );
  const bannerState = React.useMemo(
    () => (activeSessionViewState ? deriveBannerState(activeSessionViewState) : undefined),
    [activeSessionViewState],
  );
  const resumeAction = React.useMemo(
    () => (activeSessionViewState ? deriveResumeAction(activeSessionViewState) : undefined),
    [activeSessionViewState],
  );
  const activeComposerState = React.useMemo(
    () => (activeSessionViewState ? deriveComposerState(activeSessionViewState) : undefined),
    [activeSessionViewState],
  );
  const lastProgressLabel = React.useMemo(
    () => formatRelativeProgress(sessionRuntime?.lastProgressAt),
    [sessionRuntime?.lastProgressAt],
  );
  const displayConversationStreaming = React.useMemo(
    () =>
      activeSessionViewState ? shouldDisplayConversationStreaming(activeSessionViewState) : false,
    [activeSessionViewState],
  );

  const maybeRecoverInterruptedSession = React.useEffectEvent(
    async (trigger: "mount" | "visibility") => {
      if (!activeSession || recoveryIntent !== "run-now") {
        return;
      }

      if (recoveryInFlightRef.current) {
        return;
      }

      recoveryInFlightRef.current = true;

      try {
        const outcome = await reconcileInterruptedSession(activeSession.id, {
          hasLocalRunner: runtimeClient.hasActiveTurn(activeSession.id),
        });

        if (outcome.kind === "reconciled") {
          console.info("[firefly:runtime] interrupted_session_reconciled", {
            lastProgressAt: outcome.lastProgressAt,
            sessionId: activeSession.id,
            trigger,
          });
        }
      } catch (error) {
        console.error("[firefly:runtime] stale_stream_reconcile_failed", {
          error,
          sessionId: activeSession.id,
          trigger,
        });
      } finally {
        recoveryInFlightRef.current = false;
      }
    },
  );

  React.useEffect(() => {
    if (!activeSession || recoveryIntent !== "run-now") {
      return;
    }

    void maybeRecoverInterruptedSession("mount");
  }, [activeSession?.id, maybeRecoverInterruptedSession, recoveryIntent]);

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (!activeSession || recoveryIntent !== "run-now") {
        return;
      }

      void maybeRecoverInterruptedSession("visibility");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeSession?.id, maybeRecoverInterruptedSession, recoveryIntent]);

  React.useEffect(() => {
    if (loadedSessionState?.kind !== "missing") {
      return;
    }

    void navigate({
      replace: true,
      search: {},
      to: "/chat",
    });
  }, [loadedSessionState, navigate]);

  const persistDraft = React.useCallback((nextDraft: EmptyChatDraft) => {
    setDraft(nextDraft);
    void persistLastUsedSessionSettings({
      model: nextDraft.model,
      provider: getCanonicalProvider(nextDraft.providerGroup),
      providerGroup: nextDraft.providerGroup,
    });
  }, []);

  const reportRuntimeFailure = React.useCallback(
    (error: Error) => {
      toast.error(getRuntimeCommandErrorMessage(error));
      console.error("[firefly:runtime] command_failed", {
        message: error.message,
        sessionId: activeSession?.id,
      });
    },
    [activeSession?.id],
  );

  const handleFirstSend = React.useCallback(
    async (input: UserTurnInput) => {
      if (!draft) {
        return;
      }

      if (connectedProviders.length === 0) {
        toast.error(NO_CONFIGURED_PROVIDERS_MESSAGE);
        settingsDialog.openSettings("providers");
        return;
      }

      if (firstSendInFlightRef.current) {
        return;
      }

      firstSendInFlightRef.current = true;

      try {
        const optimisticMessage = await createUserMessageFromTurnInput({
          id: createId(),
          input,
          timestamp: Date.now(),
        });

        if (optimisticMessage) {
          setPendingFirstMessage({ message: optimisticMessage });
        }

        void startNewConversation({
          initialPrompt: input,
          model: draft.model,
          onSessionCreated: (sessionId) => {
            if (!optimisticMessage) {
              return;
            }

            setPendingFirstMessage((current) =>
              current?.message.id === optimisticMessage.id ? { ...current, sessionId } : current,
            );
          },
          providerGroup: draft.providerGroup,
          thinkingLevel: draft.thinkingLevel,
        })
          .catch(() => {
            setPendingFirstMessage(undefined);
          })
          .finally(() => {
            firstSendInFlightRef.current = false;
          });
      } catch (error) {
        firstSendInFlightRef.current = false;
        setPendingFirstMessage(undefined);
        throw error;
      }
    },
    [connectedProviders.length, draft, settingsDialog, startNewConversation],
  );

  const handleSend = React.useCallback(
    async (input: UserTurnInput) => {
      if (activeSession) {
        if (!connectedProviders.includes(activeSession.provider)) {
          toast.error(
            connectedProviders.length === 0
              ? NO_CONFIGURED_PROVIDERS_MESSAGE
              : SELECTED_PROVIDER_NOT_CONFIGURED_MESSAGE,
          );
          settingsDialog.openSettings("providers");
          return;
        }

        if (!activeComposerState?.canSend) {
          if (activeComposerState?.disabledReason) {
            toast.error(activeComposerState.disabledReason);
          }
          return;
        }

        try {
          await runtime.send(input);
        } catch (error) {
          const runtimeError = error instanceof Error ? error : new Error(String(error));
          reportRuntimeFailure(runtimeError);
          throw runtimeError;
        }
        return;
      }

      await handleFirstSend(input);
    },
    [
      activeComposerState,
      activeSession,
      connectedProviders,
      handleFirstSend,
      reportRuntimeFailure,
      runtime,
      settingsDialog,
    ],
  );

  const handleResumeInterrupted = React.useCallback(async () => {
    if (!resumeAction) {
      return;
    }

    try {
      await runtime.resumeInterrupted(resumeAction.mode);
    } catch (error) {
      reportRuntimeFailure(error instanceof Error ? error : new Error(String(error)));
    }
  }, [reportRuntimeFailure, resumeAction, runtime]);

  const handleCopyManualShareLink = React.useCallback(() => {
    if (!manualShareLink) {
      return;
    }

    void navigator.clipboard.writeText(manualShareLink.link).then(
      () => toast.success("Copied share link"),
      () => toast.error("Failed to copy share link"),
    );
  }, [manualShareLink]);

  const handleShareSession = React.useCallback(() => {
    if (isSharePendingRef.current) {
      return;
    }

    isSharePendingRef.current = true;
    setIsSharePending(true);

    const snapshot = buildShareSnapshot(messages, {
      model: activeSession?.model ?? draft?.model,
      provider: activeSession?.provider,
      title: activeSession?.title,
    });

    void createShareLink(snapshot)
      .then(async (share) => {
        try {
          await navigator.clipboard.writeText(share.link);
          if (share.mode === "nostr") {
            // Only show toast for Nostr since it's a special encrypted share,
            // standard share copies link silently as visual button handles success feedback
            toast.success("Copied encrypted Nostr share link");
          }
        } catch {
          setManualShareLink(share);
          toast.error("Share link created, but clipboard access was blocked");
        }
      })
      .catch((error: unknown) => {
        if (error instanceof ShareError) {
          toast.error(error.message);
          return;
        }

        toast.error("Failed to create share link");
      })
      .finally(() => {
        isSharePendingRef.current = false;
        setIsSharePending(false);
      });
  }, [activeSession?.model, activeSession?.provider, activeSession?.title, draft?.model, messages]);

  const isSessionPending = props.sessionId !== undefined && loadedSessionState === undefined;
  const isFirstMessagePending =
    props.sessionId !== undefined &&
    props.sessionId === pendingFirstMessage?.sessionId &&
    messages.length === 0;

  if (loadedSessionState?.kind === "missing") {
    return null;
  }

  if (!activeSession && !draft && !isSessionPending) {
    return <LoadingState label="Loading composer..." />;
  }

  const currentModel = activeSession?.model ?? draft?.model ?? "";
  const currentProviderGroup =
    activeSession?.providerGroup ??
    (activeSession ? getDefaultProviderGroup(activeSession.provider) : undefined) ??
    draft?.providerGroup ??
    getVisibleProviderGroups(connectedProviders)[0];
  const currentThinkingLevel = activeSession?.thinkingLevel ?? draft?.thinkingLevel ?? "medium";
  const isStreaming = activeComposerState?.isStreaming ?? false;
  const composerDisabled = activeComposerState?.disabled === true;
  const composerDisabledReason = activeComposerState?.disabledReason;
  const showSessionUtilityActions =
    activeSession !== undefined || pendingFirstMessage !== undefined || messages.length > 0;
  const chatPanelMode = getChatPanelMode({
    hasAssistantMessage,
    isSessionPending: isSessionPending || isFirstMessagePending,
    isStartingSession,
    isStreaming: displayConversationStreaming,
    messageCount: displayMessages.length,
  });
  const isChatEmpty = chatPanelMode === "empty";
  const shouldHideChatPanel = chatPanelMode === "pending" || chatPanelMode === "starting";

  return (
    <div
      className="relative flex size-full min-h-0 flex-col overflow-hidden"
      style={{ "--chat-input-height": `${promptHeight}px` } as React.CSSProperties}
    >
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setManualShareLink(undefined);
          }
        }}
        open={manualShareLink !== undefined}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Link Ready</DialogTitle>
            <DialogDescription>
              Browser clipboard access was blocked after the encrypted share finished publishing.
              Copy the generated link manually.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/40 p-2">
            <textarea
              className="h-28 w-full resize-none bg-transparent font-mono text-xs text-foreground outline-none"
              readOnly
              value={manualShareLink?.link ?? ""}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleCopyManualShareLink} type="button">
              Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent
          className={`mx-auto w-full max-w-4xl px-4 py-6 ${
            displayMessages.length === 0 ? "min-h-full" : ""
          }`}
        >
          {bannerState?.kind === "remote-live" ? (
            <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              Read-only mirror. This session is active in another tab.
              {lastProgressLabel ? ` Last progress ${lastProgressLabel}.` : ""}
            </div>
          ) : bannerState?.kind === "remote-stale" ? (
            <div className="mb-4 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Read-only mirror. Another tab still owns this streaming session.
              {lastProgressLabel ? ` Last progress ${lastProgressLabel}.` : ""}
            </div>
          ) : null}
          {shouldHideChatPanel ? null : chatPanelMode === "streaming_pending" ? (
            <div className="mb-4 flex justify-start">
              <StatusShimmer>Assistant is streaming...</StatusShimmer>
            </div>
          ) : chatPanelMode === "empty" ? (
            <ChatEmptyState />
          ) : (
            displayMessages.map((message, index) => {
              if (message.role === "toolResult" && foldedToolResultIds.has(message.id)) {
                return null;
              }

              return (
                <ChatMessageBlock
                  followingMessages={displayMessages.slice(index + 1)}
                  isStreamingReasoning={
                    displayConversationStreaming &&
                    message.role === "assistant" &&
                    lastAssistantMessageId === message.id
                  }
                  key={message.id}
                  message={message}
                />
              );
            })
          )}
        </ConversationContent>
        <ConversationScrollButton className="z-[15]" />
        {displayMessages.length > 0 ? (
          <>
            <ProgressiveBlur className="z-[5]" height="32px" position="top" />
            <ProgressiveBlur
              className="z-[5]"
              position="bottom"
              style={{ bottom: "var(--chat-input-height, 0px)" }}
            />
          </>
        ) : null}
      </Conversation>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end">
        <div
          className="pointer-events-auto w-full"
          style={{
            transform: isChatEmpty && !isStreaming ? "translateY(-30vh)" : "translateY(0px)",
          }}
        >
          <div className="mx-auto w-full max-w-4xl px-4 pb-4">
            {bannerState?.kind === "interrupted" && resumeAction && activeSession ? (
              <div className="mb-3 rounded-lg border border-border bg-muted px-3 py-3 text-sm text-foreground">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium">Response interrupted</div>
                    <div className="text-muted-foreground">
                      {bannerState.resumeMode === "continue"
                        ? "A partial assistant response was saved locally."
                        : "The last response stopped before any assistant text was saved."}
                      {lastProgressLabel ? ` Last progress ${lastProgressLabel}.` : ""}
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      void handleResumeInterrupted();
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {resumeAction.label}
                  </Button>
                </div>
              </div>
            ) : null}
            <div ref={promptRef}>
              <ChatComposer
                composerDisabled={composerDisabled}
                disabledReason={composerDisabledReason}
                isStreaming={isStreaming}
                model={currentModel}
                onAbort={activeSession && activeComposerState?.canAbort ? runtime.abort : () => {}}
                onSelectModel={(providerGroup, model) => {
                  if (activeSession) {
                    return runtime.setModelSelection(providerGroup, model);
                  }

                  persistDraft({
                    model,
                    providerGroup,
                    thinkingLevel: currentThinkingLevel,
                  });
                }}
                onSend={handleSend}
                onThinkingLevelChange={(thinkingLevel) => {
                  if (activeSession) {
                    return runtime.setThinkingLevel(thinkingLevel);
                  }

                  persistDraft({
                    model: currentModel,
                    providerGroup: currentProviderGroup,
                    thinkingLevel,
                  });
                }}
                providerGroup={currentProviderGroup}
                showNewChatAction={showSessionUtilityActions}
                thinkingLevel={currentThinkingLevel}
                utilityActions={
                  showSessionUtilityActions ? (
                    <SessionUtilityActions
                      disabled={messages.length === 0}
                      isSharing={isSharePending}
                      onShare={handleShareSession}
                    />
                  ) : null
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
