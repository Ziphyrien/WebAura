import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { MouseEvent } from "react";
import { Settings } from "lucide-react";

import {
  Sidebar,
  SidebarFooter,
  SidebarRail,
  SidebarHeader,
  SidebarTrigger,
} from "@firefly/ui/components/sidebar";
import { ChatFooter } from "@firefly/ui/components/chat-footer";
import { ChatSessionList } from "@firefly/ui/components/chat-session-list";
import { listSessionLeases, listSessions } from "@firefly/db";
import { getCurrentTabId } from "@firefly/pi/agent/tab-id";
import { isSessionLeaseStale } from "@firefly/db/session-leases";
import {
  buildSessionHref,
  deleteSessionAndResolveNext,
  persistLastUsedSessionSettings,
} from "@firefly/pi/sessions/session-actions";
import { Button } from "@firefly/ui/components/button";
import { useSettingsDialog } from "@firefly/ui/components/settings-state";

export function AppSidebar({ showGetPro = true }: { showGetPro?: boolean } = {}) {
  const navigate = useNavigate();
  const settingsDialog = useSettingsDialog();
  const currentMatch = useRouterState({
    select: (state) => state.matches[state.matches.length - 1],
  });
  const sessions = useLiveQuery(() => listSessions(), []);
  const leases = useLiveQuery(async () => await listSessionLeases(), []);

  const sessionList = sessions ?? [];
  const leaseList = leases ?? [];
  const activeSessionId =
    currentMatch.routeId === "/chat/$sessionId" ? currentMatch.params.sessionId : "";
  const activeSession = sessionList.find((session) => session.id === activeSessionId);
  const currentTabId = typeof window === "undefined" ? "" : getCurrentTabId();
  const runningSessionIds = sessionList
    .filter((session) => session.isStreaming)
    .map((session) => session.id);
  const lockedSessionIds = leaseList
    .filter((lease) => lease.ownerTabId !== currentTabId && !isSessionLeaseStale(lease))
    .map((lease) => lease.sessionId);

  const openTargetInNewTab = (sessionId?: string) => {
    const href = sessionId ? buildSessionHref(sessionId) : "/chat";

    window.open(href, "_blank", "noopener,noreferrer");
  };

  const handleCreateSessionClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (activeSession?.isStreaming) {
      event.preventDefault();
      openTargetInNewTab();
    }
  };

  const handleSelectSession = (sessionId: string) => {
    const session = sessionList.find((item) => item.id === sessionId);

    if (!session) {
      return;
    }

    if (activeSession?.isStreaming && activeSession.id !== sessionId) {
      return;
    }

    void persistLastUsedSessionSettings({
      model: session.model,
      provider: session.provider,
      providerGroup: session.providerGroup,
    });
  };

  const handleSessionClick = (event: MouseEvent<HTMLAnchorElement>, sessionId: string) => {
    const session = sessionList.find((item) => item.id === sessionId);

    if (!session) {
      event.preventDefault();
      return;
    }

    if (activeSession?.isStreaming && activeSession.id !== sessionId) {
      event.preventDefault();
      openTargetInNewTab(sessionId);
      return;
    }

    handleSelectSession(sessionId);
  };

  const handleDeleteSession = (sessionId: string) => {
    void (async () => {
      const wasSelected = sessionId === activeSessionId;
      const { nextSessionId } = await deleteSessionAndResolveNext({
        sessionId,
        siblingSessions: sessionList,
      });

      if (!wasSelected) {
        return;
      }

      if (!nextSessionId) {
        await navigate({
          replace: true,
          search: {},
          to: "/chat",
        });
        return;
      }

      const nextMetadata = sessionList.find((session) => session.id === nextSessionId);

      if (nextMetadata) {
        await persistLastUsedSessionSettings({
          model: nextMetadata.model,
          provider: nextMetadata.provider,
          providerGroup: nextMetadata.providerGroup,
        });
      }

      await navigate({
        params: {
          sessionId: nextSessionId,
        },
        replace: true,
        search: {},
        to: "/chat/$sessionId",
      });
    })();
  };

  return (
    <Sidebar className="border-r-0">
      <SidebarTrigger className="fixed top-3 left-4 z-40 h-8 w-8" />
      <SidebarHeader className="flex flex-row items-center justify-end px-3 py-2 shrink-0 h-14 border-b border-sidebar-border">
        <Button
          aria-label="Open settings"
          className="h-8 w-8 shadow-none text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => settingsDialog.openSettings("appearance")}
          size="icon-sm"
          variant="ghost"
        >
          <Settings className="size-4" />
        </Button>
      </SidebarHeader>
      <ChatSessionList
        activeSessionId={activeSessionId}
        createSessionTarget={{
          search: {},
          to: "/chat",
        }}
        getSessionTarget={(session) => ({
          params: {
            sessionId: session.id,
          },
          search: {},
          to: "/chat/$sessionId",
        })}
        lockedSessionIds={lockedSessionIds}
        onCreateSession={handleCreateSessionClick}
        onDeleteSession={handleDeleteSession}
        onSelectSession={handleSessionClick}
        runningSessionIds={runningSessionIds}
        sessions={sessionList}
      />
      <SidebarFooter className="border-t border-sidebar-border md:hidden">
        <ChatFooter showGetPro={showGetPro} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
