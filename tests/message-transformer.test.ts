import { describe, expect, it } from "vitest"
import { webMessageTransformer } from "@/agent/message-transformer"

describe("webMessageTransformer", () => {
  it("forwards only llm-compatible message roles", () => {
    const transformed = webMessageTransformer([
      {
        content: "hello",
        role: "user",
        timestamp: 1,
      },
      {
        content: [{ text: "hi", type: "text" }],
        role: "toolResult",
        timestamp: 2,
        toolCallId: "call-1",
        toolName: "noop",
        isError: false,
      },
      {
        content: [{ text: "done", type: "text" }],
        role: "assistant",
        api: "openai-codex-responses",
        model: "gpt-5.1-codex-mini",
        provider: "openai-codex",
        stopReason: "stop",
        timestamp: 3,
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
      },
      {
        label: "ui-only",
        role: "notice",
      } as never,
    ])

    expect(transformed.map((message) => message.role)).toEqual([
      "user",
      "toolResult",
      "assistant",
    ])
  })
})
