import * as React from "react"
import { AgentHost, type AgentHostSnapshot } from "@/agent/agent-host"
import { setSetting } from "@/db/schema"
import type { ProviderId } from "@/types/models"
import type { SessionData } from "@/types/storage"

export function useChatSession(initialSession: SessionData) {
  const hostRef = React.useRef<AgentHost | undefined>(undefined)
  const [mountedSession, setMountedSession] = React.useState(initialSession)
  const [snapshot, setSnapshot] = React.useState<AgentHostSnapshot>({
    isStreaming: false,
    session: initialSession,
  })

  React.useEffect(() => {
    setMountedSession(initialSession)
    setSnapshot({
      isStreaming: false,
      session: initialSession,
    })
  }, [initialSession])

  React.useEffect(() => {
    hostRef.current?.dispose()

    const host = new AgentHost(mountedSession, (nextSnapshot) => {
      setSnapshot(nextSnapshot)
    })

    hostRef.current = host
    setSnapshot({
      isStreaming: false,
      session: mountedSession,
    })

    return () => {
      host.dispose()
      if (hostRef.current === host) {
        hostRef.current = undefined
      }
    }
  }, [mountedSession])

  const replaceSession = React.useEffectEvent(async (nextSession: SessionData) => {
    setMountedSession(nextSession)
    setSnapshot({
      isStreaming: false,
      session: nextSession,
    })
    await setSetting("active-session-id", nextSession.id)
    await setSetting("last-used-model", nextSession.model)
    await setSetting("last-used-provider", nextSession.provider)
  })

  const setModelSelection = React.useEffectEvent(
    async (provider: ProviderId, model: string) => {
      await hostRef.current?.setModelSelection(provider, model)
      await setSetting("last-used-model", model)
      await setSetting("last-used-provider", provider)
    }
  )

  const send = React.useEffectEvent(async (content: string) => {
    if (!content.trim() || snapshot.isStreaming) {
      return
    }

    await hostRef.current?.prompt(content)
  })

  const abort = React.useEffectEvent(() => {
    hostRef.current?.abort()
  })

  return {
    abort,
    error: snapshot.error,
    isStreaming: snapshot.isStreaming,
    replaceSession,
    send,
    session: snapshot.session,
    setModelSelection,
  }
}
