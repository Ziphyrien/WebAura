import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { runtimeClient } from "@firefly/pi/agent/runtime-client";
import type { UserTurnInput } from "@firefly/pi/agent/user-turn-input";
import { getRuntimeCommandErrorMessage } from "@firefly/pi/agent/runtime-command-errors";
import {
  createSessionForChat,
  persistLastUsedSessionSettings,
} from "@firefly/pi/sessions/session-actions";
import { getCanonicalProvider } from "@firefly/pi/models/catalog";
import type { ProviderGroupId, ThinkingLevel } from "@firefly/pi/types/models";

export function useConversationStarter() {
  const navigate = useNavigate();
  const [isStartingSession, setIsStartingSession] = React.useState(false);

  const startNewConversation = React.useCallback(
    async (input: {
      initialPrompt: string | UserTurnInput;
      model: string;
      providerGroup: ProviderGroupId;
      thinkingLevel: ThinkingLevel;
    }) => {
      if (isStartingSession) {
        return undefined;
      }

      setIsStartingSession(true);

      try {
        const base = {
          model: input.model,
          provider: getCanonicalProvider(input.providerGroup),
          providerGroup: input.providerGroup,
          thinkingLevel: input.thinkingLevel,
        };
        const session = await createSessionForChat(base);

        await runtimeClient.startInitialTurn(session, input.initialPrompt);
        await navigate({
          params: {
            sessionId: session.id,
          },
          search: {},
          to: "/chat/$sessionId",
        });

        void persistLastUsedSessionSettings(session);
        return session;
      } catch (error) {
        const runtimeError = error instanceof Error ? error : new Error(String(error));
        toast.error(getRuntimeCommandErrorMessage(runtimeError));
        console.error("[firefly:runtime] command_failed", {
          message: runtimeError.message,
        });
        throw runtimeError;
      } finally {
        setIsStartingSession(false);
      }
    },
    [isStartingSession, navigate],
  );

  return {
    isStartingSession,
    startNewConversation,
  };
}
