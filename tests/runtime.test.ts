import { beforeEach, describe, expect, it, vi } from "vitest"
import { createEmptyUsage } from "@/types/models"
import type { SessionData } from "@/types/storage"

const streamChat = vi.fn()
const recordUsage = vi.fn()
const persistSession = vi.fn()

vi.mock("@/agent/provider-stream", () => ({
  streamChat,
}))

vi.mock("@/db/schema", () => ({
  recordUsage,
}))

vi.mock("@/sessions/session-service", async () => {
  const actual = await vi.importActual<typeof import("@/sessions/session-service")>(
    "@/sessions/session-service"
  )

  return {
    ...actual,
    persistSession,
  }
})

function createSession(): SessionData {
  return {
    cost: 0,
    createdAt: "2026-03-23T12:00:00.000Z",
    id: "session-1",
    messages: [],
    model: "gpt-5.1-codex-mini",
    preview: "",
    provider: "openai-codex",
    thinkingLevel: "medium",
    title: "New chat",
    updatedAt: "2026-03-23T12:00:00.000Z",
    usage: createEmptyUsage(),
  }
}

describe("sendMessage", () => {
  beforeEach(() => {
    streamChat.mockReset()
    recordUsage.mockReset()
    persistSession.mockReset()
  })

  it("streams a response and persists the completed session", async () => {
    streamChat.mockImplementation(
      async ({
        model,
        onTextDelta,
        provider,
      }: {
        model: string
        onTextDelta: (delta: string) => void
        provider: SessionData["provider"]
      }) => {
        onTextDelta("Hello")

        return {
          assistantMessage: {
            api: "openai-codex-responses",
            content: [{ text: "Hello", type: "text" }],
            id: "assistant-1",
            model,
            provider,
            role: "assistant",
            stopReason: "stop",
            timestamp: 2,
            usage: {
              cacheRead: 0,
              cacheWrite: 0,
              cost: {
                cacheRead: 0,
                cacheWrite: 0,
                input: 0.1,
                output: 0.2,
                total: 0.3,
              },
              input: 100,
              output: 200,
              totalTokens: 300,
            },
          },
        }
      }
    )

    const { sendMessage } = await import("@/agent/runtime")
    const onSessionChange = vi.fn()
    const result = await sendMessage({
      content: "Audit the local runtime architecture",
      model: "gpt-5.1-codex-mini",
      onSessionChange,
      provider: "openai-codex",
      session: createSession(),
      signal: new AbortController().signal,
    })

    expect(onSessionChange).toHaveBeenCalled()
    expect(result.title).toBe("Audit the local runtime architecture")
    expect(result.preview).toContain("Audit the local runtime architecture")
    expect(result.preview).toContain("Hello")
    expect(result.cost).toBe(0.3)
    expect(result.messages).toHaveLength(2)
    expect(persistSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "session-1",
        title: "Audit the local runtime architecture",
      })
    )
    expect(recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        cost: expect.objectContaining({
          total: 0.3,
        }),
      }),
      "openai-codex",
      "gpt-5.1-codex-mini",
      expect.any(Number)
    )
  })
})
