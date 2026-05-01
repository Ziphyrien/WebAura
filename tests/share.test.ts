import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import {
  buildNostrShareEvents,
  buildShareSnapshot,
  createShareLink,
  NOSTR_PAYLOAD_LIMIT_BYTES,
  parseShareFragment,
  readShareFromFragment,
  ShareError,
  URL_FRAGMENT_LIMIT_BYTES,
  type NostrEvent,
  type NostrRelayCandidate,
  type NostrRelayDiscovery,
  type NostrRelayProbeResult,
  type NostrRelayTransport,
} from "@webaura/pi/lib/share";
import { createEmptyUsage } from "@webaura/pi/types/models";
import type { DisplayChatMessage } from "@webaura/pi/types/chat";

class FakeRelayDiscovery implements NostrRelayDiscovery {
  readonly probes: string[] = [];

  constructor(
    private readonly candidates: readonly NostrRelayCandidate[],
    private readonly results: ReadonlyMap<string, NostrRelayProbeResult> = new Map(),
  ) {}

  async discoverRelays(): Promise<NostrRelayCandidate[]> {
    return [...this.candidates];
  }

  async probeRelay(candidate: NostrRelayCandidate): Promise<NostrRelayProbeResult> {
    this.probes.push(candidate.url);
    return this.results.get(candidate.url) ?? {};
  }
}

class MemoryRelayTransport implements NostrRelayTransport {
  readonly byRelay = new Map<string, Map<string, NostrEvent>>();
  readonly failPublish = new Set<string>();
  readonly failFetch = new Set<string>();
  readonly publishedBatches: Array<{ events: NostrEvent[]; relayUrl: string }> = [];

  async fetchEvents(relayUrl: string, eventIds: readonly string[]): Promise<NostrEvent[]> {
    if (this.failFetch.has(relayUrl)) {
      throw new Error("fetch failed");
    }

    const relay = this.byRelay.get(relayUrl);
    return eventIds.flatMap((eventId) => {
      const event = relay?.get(eventId);
      return event ? [event] : [];
    });
  }

  async publishEvents(relayUrl: string, events: readonly NostrEvent[]): Promise<void> {
    if (this.failPublish.has(relayUrl)) {
      throw new Error("publish failed");
    }

    const relay = this.byRelay.get(relayUrl) ?? new Map<string, NostrEvent>();

    for (const event of events) {
      relay.set(event.id, event);
    }

    this.byRelay.set(relayUrl, relay);
    this.publishedBatches.push({ events: [...events], relayUrl });
  }
}

function buildMessages(): DisplayChatMessage[] {
  return [
    {
      attachments: [
        {
          contentPartIndex: 1,
          fileName: "diagram.png",
          id: "attachment-1",
          mediaType: "image/png",
          size: 42,
          type: "image",
        },
      ],
      content: [
        { text: "Explain this image", type: "text" },
        { data: "plaintext-image-data-should-not-survive", mimeType: "image/png", type: "image" },
      ],
      id: "user-1",
      role: "user",
      timestamp: 1,
    },
    {
      api: "openai-responses",
      content: [
        { thinking: "private chain of thought should not be shared", type: "thinking" },
        { text: "This is the answer.", type: "text" },
        {
          arguments: { secret: "tool arg should not be shared" },
          id: "tool-call-1",
          name: "example_tool",
          type: "toolCall",
        },
      ],
      id: "assistant-1",
      model: "gpt-5.1-codex-mini",
      provider: "openai-codex",
      role: "assistant",
      stopReason: "stop",
      timestamp: 2,
      usage: createEmptyUsage(),
    },
    {
      content: [{ text: "tool result should not be shared", type: "text" }],
      id: "tool-result-1",
      isError: false,
      parentAssistantId: "assistant-1",
      role: "toolResult",
      timestamp: 3,
      toolCallId: "tool-call-1",
      toolName: "example_tool",
    },
  ];
}

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: webcrypto,
  });
});

function encodeTestFragment(fragment: unknown): string {
  return `#wa1.${Buffer.from(JSON.stringify(fragment), "utf8").toString("base64url")}`;
}

function fakeBase64UrlBytes(length: number): string {
  return Buffer.from(new Uint8Array(length)).toString("base64url");
}

describe("share links", () => {
  it("builds a sanitized read-only snapshot", () => {
    const snapshot = buildShareSnapshot(buildMessages(), {
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      model: "gpt-5.1-codex-mini",
      provider: "openai-codex",
      title: "Image help",
    });

    expect(snapshot.metadata).toEqual({
      model: "gpt-5.1-codex-mini",
      provider: "openai-codex",
      title: "Image help",
    });
    expect(snapshot.messages).toEqual([
      {
        attachments: [
          {
            fileName: "diagram.png",
            mediaType: "image/png",
            size: 42,
            type: "image",
          },
        ],
        content: "Explain this image",
        role: "user",
        timestamp: 1,
      },
      {
        content: "This is the answer.",
        role: "assistant",
        timestamp: 2,
      },
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("private chain of thought");
    expect(JSON.stringify(snapshot)).not.toContain("tool arg should not be shared");
    expect(JSON.stringify(snapshot)).not.toContain("plaintext-image-data-should-not-survive");
  });

  it("creates and reads a small encrypted URL-fragment share", async () => {
    const snapshot = buildShareSnapshot(buildMessages(), {
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      title: "Small share",
    });
    const share = await createShareLink(snapshot, {
      baseUrl: "https://example.test",
      compression: "identity",
    });

    expect(share.mode).toBe("url");
    expect(share.link.startsWith("https://example.test/share#wa1.")).toBe(true);
    expect(share.link.length).toBeLessThan(URL_FRAGMENT_LIMIT_BYTES);
    expect(share.link.split("#")[0]).not.toContain("Small share");
    expect(parseShareFragment(new URL(share.link).hash).t).toBe("url");
    await expect(readShareFromFragment(new URL(share.link).hash)).resolves.toEqual(snapshot);
  });

  it("rejects payloads over 300KB before publishing", async () => {
    const transport = new MemoryRelayTransport();
    const snapshot = buildShareSnapshot(
      [
        {
          content: "x".repeat(NOSTR_PAYLOAD_LIMIT_BYTES + 1),
          id: "user-large",
          role: "user",
          timestamp: 1,
        },
      ],
      { createdAt: new Date("2026-05-01T00:00:00.000Z") },
    );

    await expect(
      createShareLink(snapshot, {
        baseUrl: "https://example.test",
        compression: "identity",
        relayTransport: transport,
        relays: ["wss://relay-a.test", "wss://relay-b.test"],
      }),
    ).rejects.toMatchObject({ code: "oversized" });
    expect(transport.publishedBatches).toHaveLength(0);
  });

  it("publishes larger shares as chunks before manifest and reads through surviving relays", async () => {
    const transport = new MemoryRelayTransport();
    const snapshot = buildShareSnapshot(
      [
        {
          content: "medium transcript ".repeat(1500),
          id: "user-medium",
          role: "user",
          timestamp: 1,
        },
      ],
      {
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        title: "Medium share",
      },
    );
    const share = await createShareLink(snapshot, {
      baseUrl: "https://example.test",
      compression: "identity",
      now: new Date("2026-05-01T00:00:00.000Z"),
      relayTransport: transport,
      relays: ["wss://relay-a.test", "wss://relay-b.test", "wss://relay-c.test"],
    });

    expect(share.mode).toBe("nostr");
    expect(share.relays).toEqual([
      "wss://relay-a.test",
      "wss://relay-b.test",
      "wss://relay-c.test",
    ]);
    expect(parseShareFragment(new URL(share.link).hash).t).toBe("nostr");

    const firstRelayBatches = transport.publishedBatches.filter(
      (batch) => batch.relayUrl === "wss://relay-a.test",
    );
    expect(
      firstRelayBatches[0]?.events.every((event) => event.tags.some((tag) => tag[1] === "chunk")),
    ).toBe(true);
    expect(firstRelayBatches[1]?.events[0]?.tags.some((tag) => tag[1] === "manifest")).toBe(true);

    transport.failFetch.add("wss://relay-a.test");
    transport.byRelay.delete("wss://relay-c.test");

    await expect(
      readShareFromFragment(new URL(share.link).hash, { relayTransport: transport }),
    ).resolves.toEqual(snapshot);
  });

  it("builds Nostr manifest chunk metadata without plaintext content", async () => {
    const ciphertext = new TextEncoder().encode("encrypted bytes only".repeat(1000));
    const built = await buildNostrShareEvents({
      ciphertext,
      compression: "identity",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(built.chunkEvents.length).toBeGreaterThan(1);
    expect(built.manifest.chunks).toHaveLength(built.chunkEvents.length);
    expect(built.manifest.encryptedBytes).toBe(ciphertext.byteLength);
    expect(JSON.stringify(built.manifestEvent)).not.toContain("encrypted bytes only");
  });

  it("rejects tampered Nostr events returned by relays", async () => {
    const transport = new MemoryRelayTransport();
    const snapshot = buildShareSnapshot(
      [
        {
          content: "medium transcript ".repeat(1500),
          id: "user-medium",
          role: "user",
          timestamp: 1,
        },
      ],
      { createdAt: new Date("2026-05-01T00:00:00.000Z") },
    );
    const share = await createShareLink(snapshot, {
      baseUrl: "https://example.test",
      compression: "identity",
      now: new Date("2026-05-01T00:00:00.000Z"),
      relayTransport: transport,
      relays: ["wss://relay-a.test", "wss://relay-b.test"],
    });
    const relay = transport.byRelay.get("wss://relay-a.test");
    const chunkEvent = [...(relay?.values() ?? [])].find((event) =>
      event.tags.some((tag) => tag[0] === "type" && tag[1] === "chunk"),
    );

    expect(chunkEvent).toBeDefined();
    relay?.set(chunkEvent!.id, { ...chunkEvent!, content: fakeBase64UrlBytes(16) });
    transport.byRelay.delete("wss://relay-b.test");

    await expect(
      readShareFromFragment(new URL(share.link).hash, { relayTransport: transport }),
    ).rejects.toMatchObject({ code: "missing_chunks" });
  });

  it("rejects signed Nostr manifests that exceed the encrypted payload safety limit", async () => {
    const transport = new MemoryRelayTransport();
    const built = await buildNostrShareEvents({
      ciphertext: new Uint8Array(NOSTR_PAYLOAD_LIMIT_BYTES + 17),
      compression: "identity",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    await transport.publishEvents("wss://relay-a.test", [built.manifestEvent]);

    const hash = encodeTestFragment({
      iv: fakeBase64UrlBytes(12),
      k: fakeBase64UrlBytes(32),
      m: built.manifestEvent.id,
      p: built.pubkey,
      r: ["wss://relay-a.test"],
      t: "nostr",
      v: 1,
    });

    await expect(readShareFromFragment(hash, { relayTransport: transport })).rejects.toMatchObject({
      code: "missing_manifest",
    });
  });

  it("discovers and ranks Nostr relays instead of using a static fallback pool", async () => {
    const transport = new MemoryRelayTransport();
    const discovery = new FakeRelayDiscovery(
      [
        { latencyMs: 90, url: "wss://relay-slow.test" },
        { latencyMs: 10, url: "wss://relay-fast.test" },
        { latencyMs: 40, url: "wss://relay-mid.test" },
      ],
      new Map<string, NostrRelayProbeResult>([
        ["wss://relay-slow.test", { read: true, write: true }],
        ["wss://relay-fast.test", { read: true, write: true }],
        ["wss://relay-mid.test", { read: true, write: true }],
      ]),
    );
    const snapshot = buildShareSnapshot([
      {
        content: "medium transcript ".repeat(1500),
        id: "user-medium",
        role: "user",
        timestamp: 1,
      },
    ]);

    const share = await createShareLink(snapshot, {
      baseUrl: "https://example.test",
      compression: "identity",
      relayDiscovery: discovery,
      relayTransport: transport,
    });

    expect(share.mode).toBe("nostr");
    expect(share.relays).toEqual([
      "wss://relay-fast.test",
      "wss://relay-mid.test",
      "wss://relay-slow.test",
    ]);
    expect(discovery.probes).toEqual([
      "wss://relay-fast.test",
      "wss://relay-mid.test",
      "wss://relay-slow.test",
    ]);
    expect([...transport.byRelay.keys()].sort()).toEqual([
      "wss://relay-fast.test",
      "wss://relay-mid.test",
      "wss://relay-slow.test",
    ]);
  });

  it("fails Nostr publishing when discovery cannot provide enough relays without fallback", async () => {
    const transport = new MemoryRelayTransport();
    const discovery = new FakeRelayDiscovery(
      [{ url: "wss://relay-only.test" }],
      new Map<string, NostrRelayProbeResult>([
        ["wss://relay-only.test", { read: true, write: true }],
      ]),
    );
    const snapshot = buildShareSnapshot([
      {
        content: "medium transcript ".repeat(1500),
        id: "user-medium",
        role: "user",
        timestamp: 1,
      },
    ]);

    await expect(
      createShareLink(snapshot, {
        baseUrl: "https://example.test",
        compression: "identity",
        relayDiscovery: discovery,
        relayTransport: transport,
      }),
    ).rejects.toMatchObject({ code: "publish_failed" });
    expect(transport.publishedBatches).toHaveLength(0);
  });

  it("filters paid, auth-required, non-writable, and small-limit discovered relays", async () => {
    const transport = new MemoryRelayTransport();
    const discovery = new FakeRelayDiscovery(
      [
        { latencyMs: 1, paymentRequired: true, url: "wss://paid.test" },
        { authRequired: true, latencyMs: 2, url: "wss://auth.test" },
        { latencyMs: 3, maxContentLength: 1024, url: "wss://small-content.test" },
        { latencyMs: 4, maxMessageLength: 1024, url: "wss://small-message.test" },
        { latencyMs: 5, url: "wss://not-writable.test", write: false },
        { latencyMs: 6, url: "wss://good-a.test" },
        { latencyMs: 7, url: "wss://good-b.test" },
        { latencyMs: 8, url: "wss://good-c.test" },
        { latencyMs: 9, url: "wss://probe-paid.test" },
        { latencyMs: 10, url: "wss://probe-small.test" },
        { latencyMs: 11, url: "wss://probe-unknown.test" },
      ],
      new Map<string, NostrRelayProbeResult>([
        ["wss://good-a.test", { read: true, write: true }],
        ["wss://good-b.test", { read: true, write: true }],
        ["wss://good-c.test", { read: true, write: true }],
        ["wss://probe-paid.test", { paymentRequired: true, read: true, write: true }],
        ["wss://probe-small.test", { maxContentLength: 1024, read: true, write: true }],
      ]),
    );
    const snapshot = buildShareSnapshot([
      {
        content: "medium transcript ".repeat(1500),
        id: "user-medium",
        role: "user",
        timestamp: 1,
      },
    ]);

    const share = await createShareLink(snapshot, {
      baseUrl: "https://example.test",
      compression: "identity",
      relayDiscovery: discovery,
      relayTransport: transport,
    });

    expect(share.relays).toEqual(["wss://good-a.test", "wss://good-b.test", "wss://good-c.test"]);
    expect(transport.publishedBatches.map((batch) => batch.relayUrl)).not.toContain(
      "wss://paid.test",
    );
    expect(transport.publishedBatches.map((batch) => batch.relayUrl)).not.toContain(
      "wss://auth.test",
    );
    expect(transport.publishedBatches.map((batch) => batch.relayUrl)).not.toContain(
      "wss://small-content.test",
    );
    expect(transport.publishedBatches.map((batch) => batch.relayUrl)).not.toContain(
      "wss://small-message.test",
    );
    expect(transport.publishedBatches.map((batch) => batch.relayUrl)).not.toContain(
      "wss://not-writable.test",
    );
    expect(transport.publishedBatches.map((batch) => batch.relayUrl)).not.toContain(
      "wss://probe-paid.test",
    );
    expect(transport.publishedBatches.map((batch) => batch.relayUrl)).not.toContain(
      "wss://probe-small.test",
    );
    expect(transport.publishedBatches.map((batch) => batch.relayUrl)).not.toContain(
      "wss://probe-unknown.test",
    );
  });

  it("requires redundant Nostr publication", async () => {
    const transport = new MemoryRelayTransport();
    transport.failPublish.add("wss://relay-b.test");
    const snapshot = buildShareSnapshot([
      {
        content: "medium transcript ".repeat(1500),
        id: "user-medium",
        role: "user",
        timestamp: 1,
      },
    ]);

    await expect(
      createShareLink(snapshot, {
        baseUrl: "https://example.test",
        compression: "identity",
        relayTransport: transport,
        relays: ["wss://relay-a.test", "wss://relay-b.test"],
      }),
    ).rejects.toBeInstanceOf(ShareError);
  });
});
