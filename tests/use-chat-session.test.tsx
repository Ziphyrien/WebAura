import { act, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createEmptyUsage } from "@/types/models"
import type { SessionData } from "@/types/storage"
import { useChatSession } from "@/hooks/use-chat-session"

const setSetting = vi.fn()
const hostInstances: FakeAgentHost[] = []

vi.mock("@/db/schema", () => ({
  setSetting,
}))

class FakeAgentHost {
  constructor(
    readonly session: SessionData,
    readonly onSnapshot: (snapshot: {
      error?: string
      isStreaming: boolean
      session: SessionData
    }) => void
  ) {
    hostInstances.push(this)
  }

  abort = vi.fn()
  dispose = vi.fn()
  prompt = vi.fn(async (_content: string) => {})
  setModelSelection = vi.fn(async (_provider: string, _model: string) => {})

  emit(snapshot: { error?: string; isStreaming: boolean; session: SessionData }) {
    this.onSnapshot(snapshot)
  }
}

vi.mock("@/agent/agent-host", () => ({
  AgentHost: FakeAgentHost,
}))

function createSession(id: string): SessionData {
  return {
    cost: 0,
    createdAt: "2026-03-24T12:00:00.000Z",
    id,
    messages: [],
    model: "gpt-5.1-codex-mini",
    preview: "",
    provider: "openai-codex",
    thinkingLevel: "medium",
    title: "New chat",
    updatedAt: "2026-03-24T12:00:00.000Z",
    usage: createEmptyUsage(),
  }
}

let latestHook: ReturnType<typeof useChatSession>

function Harness(props: { session: SessionData }) {
  latestHook = useChatSession(props.session)

  return (
    <div data-testid="session-id">
      {latestHook.session.id}:{latestHook.session.title}
    </div>
  )
}

describe("useChatSession", () => {
  beforeEach(() => {
    hostInstances.length = 0
    setSetting.mockReset()
  })

  it("mounts a host, forwards actions, and disposes on session switch", async () => {
    const firstSession = createSession("session-1")
    const secondSession = createSession("session-2")
    const rendered = render(<Harness session={firstSession} />)

    expect(hostInstances).toHaveLength(1)

    await act(async () => {
      await latestHook.send("hello")
    })
    expect(hostInstances[0]?.prompt).toHaveBeenCalledWith("hello")

    act(() => {
      hostInstances[0]?.emit({
        isStreaming: true,
        session: {
          ...firstSession,
          title: "Updated live session",
        },
      })
    })
    expect(rendered.getByTestId("session-id").textContent).toContain(
      "Updated live session"
    )

    rendered.rerender(<Harness session={secondSession} />)

    expect(hostInstances[0]?.dispose).toHaveBeenCalledTimes(1)
    expect(hostInstances).toHaveLength(2)

    await act(async () => {
      await latestHook.setModelSelection("anthropic", "claude-sonnet-4-6")
      await latestHook.replaceSession(secondSession)
    })

    expect(hostInstances[1]?.setModelSelection).toHaveBeenCalledWith(
      "anthropic",
      "claude-sonnet-4-6"
    )
    expect(setSetting).toHaveBeenCalledWith("last-used-model", "claude-sonnet-4-6")
    expect(setSetting).toHaveBeenCalledWith("last-used-provider", "anthropic")
    expect(setSetting).toHaveBeenCalledWith("active-session-id", "session-2")
  })
})
