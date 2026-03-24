import type { AgentMessage } from "@mariozechner/pi-agent-core"
import type { Message } from "@mariozechner/pi-ai"
import { SYSTEM_PROMPT } from "@/agent/system-prompt"
import type { JsonValue } from "@/types/common"

function isLlmMessage(message: AgentMessage): message is Message {
  return (
    typeof message === "object" &&
    message !== null &&
    "role" in message &&
    (message.role === "assistant" ||
      message.role === "toolResult" ||
      message.role === "user")
  )
}

function getMessageText(message: Message): string {
  if (message.role === "assistant") {
    return message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
  }

  if (message.role === "user") {
    if (typeof message.content === "string") {
      return message.content
    }

    return message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
  }

  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
}

function toTextParts(message: Message): Array<Record<string, JsonValue>> {
  if (message.role === "assistant") {
    const text = message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")

    return [{ text, type: "output_text" }]
  }

  if (message.role === "toolResult") {
    const text = message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")

    return [{ text, type: "input_text" }]
  }

  return [{ text: getMessageText(message), type: "input_text" }]
}

export function webMessageTransformer(messages: AgentMessage[]): Message[] {
  return messages.filter(isLlmMessage)
}

export function toOpenAIChatMessages(messages: Message[]) {
  return [
    {
      content: SYSTEM_PROMPT,
      role: "system",
    },
    ...messages
      .filter((message) => message.role === "assistant" || message.role === "user")
      .map((message) => ({
        content: getMessageText(message),
        role: message.role,
      })),
  ]
}

export function toOpenAIResponsesInput(messages: Message[]) {
  return messages
    .filter((message) => message.role === "assistant" || message.role === "user")
    .map((message) => ({
      content: toTextParts(message),
      role: message.role,
    }))
}

export function toAnthropicMessages(messages: Message[]) {
  return messages
    .filter((message) => message.role === "assistant" || message.role === "user")
    .map((message) => ({
      content: getMessageText(message),
      role: message.role,
    }))
}

export function toGoogleContents(messages: Message[]) {
  return messages
    .filter((message) => message.role === "assistant" || message.role === "user")
    .map((message) => ({
      parts: [{ text: getMessageText(message) }],
      role: message.role === "assistant" ? "model" : "user",
    }))
}
