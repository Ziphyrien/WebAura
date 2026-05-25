import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { SessionData } from "@/types/storage";
import { createEmptyUsage } from "@/types/models";

const deleteSession = vi.fn(async () => {});
const getSetting = vi.fn();
const listProviderKeys = vi.fn();
const setSetting = vi.fn(async () => {});
const persistSessionSnapshot = vi.fn(async () => {});
const createSession = vi.fn();
const releaseSessionAndDrain = vi.fn(async () => {});
const getConnectedProviders = vi.fn(() => [] as string[]);
const getPreferredProviderGroup = vi.fn(() => "openai-codex");
const getVisibleProviderGroups = vi.fn(() => ["anthropic", "openai-codex"]);

vi.mock("@firefly/db", () => ({
  deleteSession,
  getSetting,
  listProviderKeys,
  setSetting,
}));

vi.mock("@/sessions/session-service", () => ({
  createSession,
  persistSessionSnapshot,
}));

vi.mock("@/agent/runtime-client", () => ({
  runtimeClient: {
    releaseSessionAndDrain,
  },
}));

vi.mock("@/models/catalog", () => ({
  getCanonicalProvider: (providerGroup: string) => providerGroup,
  getConnectedProviders,
  getDefaultModelForGroup: () => ({
    id: "gpt-5.1-codex-mini",
  }),
  getDefaultProviderGroup: (provider: string) => provider,
  getPreferredProviderGroup,
  getProviderGroups: () => ["anthropic", "openai-codex"],
  getVisibleProviderGroups,
  hasModelForGroup: () => true,
  isProviderGroupId: (value: string) => value === "anthropic" || value === "openai-codex",
  NO_CONFIGURED_PROVIDERS_MESSAGE:
    "No AI provider configured. Add an API key or sign in to a provider in Settings > Providers.",
  SELECTED_PROVIDER_NOT_CONFIGURED_MESSAGE:
    "The selected AI provider is not configured. Add credentials or switch to a configured provider.",
}));

function buildSession(id: string, overrides: Partial<SessionData> = {}): SessionData {
  const session = {
    cost: 0,
    createdAt: "2026-03-23T12:00:00.000Z",
    error: undefined,
    id,
    isStreaming: false,
    messageCount: 0,
    model: "gpt-5.1-codex-mini",
    preview: "",
    provider: "openai-codex" as SessionData["provider"],
    providerGroup: "openai-codex" as SessionData["providerGroup"],
    thinkingLevel: "medium" as SessionData["thinkingLevel"],
    title: "New chat",
    updatedAt: "2026-03-23T12:00:00.000Z",
    usage: createEmptyUsage(),
    ...overrides,
  };

  return session;
}

describe("session-actions", () => {
  beforeEach(() => {
    createSession.mockReset();
    deleteSession.mockReset();
    getSetting.mockReset();
    listProviderKeys.mockReset();
    persistSessionSnapshot.mockReset();
    releaseSessionAndDrain.mockReset();
    setSetting.mockReset();
    getConnectedProviders.mockReset();
    getConnectedProviders.mockReturnValue([]);
    getPreferredProviderGroup.mockReset();
    getPreferredProviderGroup.mockReturnValue("openai-codex");
    getVisibleProviderGroups.mockReset();
    getVisibleProviderGroups.mockReturnValue(["anthropic", "openai-codex"]);
  });

  it("builds canonical session hrefs", async () => {
    const { buildSessionHref } = await import("@/sessions/session-actions");

    expect(buildSessionHref("session-1")).toBe("/chat/session-1");
  });

  it("creates empty chat sessions from provider defaults", async () => {
    const created = buildSession("session-new");
    createSession.mockReturnValue(created);
    getConnectedProviders.mockReturnValue(["openai-codex"]);
    getSetting.mockResolvedValue(undefined);
    getVisibleProviderGroups.mockReturnValue(["openai-codex"]);
    listProviderKeys.mockResolvedValue([{ provider: "openai-codex", value: "oauth-token" }]);

    const { createSessionForChat } = await import("@/sessions/session-actions");
    const session = await createSessionForChat();

    expect(createSession).toHaveBeenCalledWith({
      model: "gpt-5.1-codex-mini",
      providerGroup: "openai-codex",
    });
    expect(persistSessionSnapshot).not.toHaveBeenCalled();
    expect(session.id).toBe("session-new");
  });

  it("rejects chat session creation when no provider is configured", async () => {
    getSetting.mockResolvedValue(undefined);
    getVisibleProviderGroups.mockReturnValue([]);
    listProviderKeys.mockResolvedValue([]);

    const { createSessionForChat } = await import("@/sessions/session-actions");

    await expect(createSessionForChat()).rejects.toThrow("No AI provider configured");
    expect(createSession).not.toHaveBeenCalled();
    expect(persistSessionSnapshot).not.toHaveBeenCalled();
  });

  it("persists last-used session settings", async () => {
    const { persistLastUsedSessionSettings } = await import("@/sessions/session-actions");

    await persistLastUsedSessionSettings({
      model: "gpt-5.1-codex-mini",
      provider: "openai-codex",
      providerGroup: "openai-codex",
    });

    expect(setSetting).toHaveBeenCalledWith("last-used-model", "gpt-5.1-codex-mini");
    expect(setSetting).toHaveBeenCalledWith("last-used-provider", "openai-codex");
    expect(setSetting).toHaveBeenCalledWith("last-used-provider-group", "openai-codex");
  });

  it("deletes the session and falls back to a sibling", async () => {
    const { deleteSessionAndResolveNext } = await import("@/sessions/session-actions");

    const sibling = buildSession("session-next");
    const result = await deleteSessionAndResolveNext({
      sessionId: "session-current",
      siblingSessions: [buildSession("session-current"), sibling],
    });

    expect(releaseSessionAndDrain).toHaveBeenCalledWith("session-current");
    expect(deleteSession).toHaveBeenCalledWith("session-current");
    expect(result).toEqual({
      nextSessionId: "session-next",
    });
  });

  it("clears the selection when no fallback session remains", async () => {
    const { deleteSessionAndResolveNext } = await import("@/sessions/session-actions");

    const result = await deleteSessionAndResolveNext({
      sessionId: "session-current",
      siblingSessions: [buildSession("session-current")],
    });

    expect(result).toEqual({
      nextSessionId: undefined,
    });
  });

  it("waits for release to drain before deleting a running session", async () => {
    let resolveRelease: (() => void) | undefined;
    releaseSessionAndDrain.mockImplementationOnce(
      async () =>
        await new Promise<void>((resolve) => {
          resolveRelease = resolve;
        }),
    );

    const { deleteSessionAndResolveNext } = await import("@/sessions/session-actions");
    const deletePromise = deleteSessionAndResolveNext({
      sessionId: "session-current",
      siblingSessions: [buildSession("session-current")],
    });

    await Promise.resolve();
    expect(deleteSession).not.toHaveBeenCalled();

    resolveRelease?.();
    await deletePromise;

    expect(deleteSession).toHaveBeenCalledWith("session-current");
  });
});
