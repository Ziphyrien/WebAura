import { setSetting } from "@/db/schema"
import { setLastUsedRepoSource } from "@/repo/settings"
import type { SessionData } from "@/types/storage"

type PersistedSessionSettings = Pick<
  SessionData,
  "id" | "model" | "provider" | "providerGroup" | "repoSource"
>

export function syncSessionToUrl(sessionId: string): void {
  if (typeof window === "undefined") {
    return
  }

  const url = new URL(window.location.href)
  url.searchParams.set("session", sessionId)
  window.history.replaceState({}, "", url)
}

export async function persistActiveSessionId(sessionId: string): Promise<void> {
  await setSetting("active-session-id", sessionId)
}

export async function persistLastUsedSessionSettings(
  session: PersistedSessionSettings
): Promise<void> {
  await Promise.all([
    persistActiveSessionId(session.id),
    setSetting("last-used-model", session.model),
    setSetting("last-used-provider", session.provider),
    setSetting(
      "last-used-provider-group",
      session.providerGroup ?? session.provider
    ),
    setLastUsedRepoSource(session.repoSource),
  ])
}
