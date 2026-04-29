import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Type } from "typebox";
import { deleteAllLocalData } from "@webaura/db";
import { githubExtensionPackage } from "@webaura/extensions/github";
import { createExtensionRuntimeSnapshot } from "@webaura/pi/extensions/registry";
import { getEnabledExtensionRuntime, getExtensionCatalog } from "@webaura/pi/extensions/runtime";
import { setExtensionEnabled } from "@webaura/pi/extensions/settings";
import type { ExtensionPackage, WebAuraExtension } from "@webaura/pi/extensions/types";

const customExtension: WebAuraExtension = {
  manifest: {
    description: "Test extension",
    id: "test-extension",
    name: "Test Extension",
    version: "1.0.0",
  },
  register(api) {
    api.registerTool({
      description: "Echo a string",
      label: "Echo",
      name: "test_echo",
      parameters: Type.Object({
        text: Type.String(),
      }),
      async execute(_toolCallId, params) {
        return {
          content: [{ text: params.text, type: "text" }],
          details: { text: params.text },
        };
      },
    });
  },
};

const installedExtensions = [githubExtensionPackage] satisfies readonly ExtensionPackage[];

describe("extensions", () => {
  beforeEach(async () => {
    await deleteAllLocalData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps installed extensions disabled by default", async () => {
    const catalog = await getExtensionCatalog(installedExtensions);
    const runtime = await getEnabledExtensionRuntime(installedExtensions);

    expect(catalog).toEqual([
      expect.objectContaining({
        enabled: false,
        manifest: expect.objectContaining({ id: "github" }),
      }),
    ]);
    expect(runtime.enabledExtensions).toEqual([]);
    expect(runtime.tools).toEqual([]);
  });

  it("loads package runtime only after the package is enabled", async () => {
    const loadRuntime = vi.fn(async () => customExtension);
    const lazyPackage = {
      defaultEnabled: false,
      loadRuntime,
      manifest: customExtension.manifest,
      source: {
        kind: "uploaded" as const,
        packageId: customExtension.manifest.id,
      },
    } satisfies ExtensionPackage;

    expect(await getEnabledExtensionRuntime([lazyPackage])).toEqual({
      enabledExtensions: [],
      tools: [],
    });
    expect(loadRuntime).not.toHaveBeenCalled();

    await setExtensionEnabled(customExtension.manifest.id, true);

    const runtime = await getEnabledExtensionRuntime([lazyPackage]);

    expect(loadRuntime).toHaveBeenCalledTimes(1);
    expect(runtime.enabledExtensions.map((extension) => extension.id)).toEqual([
      customExtension.manifest.id,
    ]);
  });

  it("registers GitHub tools only after the extension is enabled", async () => {
    await setExtensionEnabled("github", true);

    const runtime = await getEnabledExtensionRuntime(installedExtensions);

    expect(runtime.enabledExtensions.map((extension) => extension.id)).toEqual(["github"]);
    expect(runtime.tools.map((tool) => tool.name).sort()).toEqual([
      "github_api",
      "github_repo",
      "github_search",
      "github_status",
    ]);
  });

  it("maps repository searches to GitHub's repositories search endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ incomplete_results: false, items: [], total_count: 0 }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    await setExtensionEnabled("github", true);

    const runtime = await getEnabledExtensionRuntime(installedExtensions);
    const tool = runtime.tools.find((candidate) => candidate.name === "github_search");

    if (!tool) {
      throw new Error("github_search tool was not registered");
    }

    const result = await tool.execute(
      "call-1",
      {
        query: "mariozechner pi-ai",
        type: "repos",
      },
      undefined,
    );
    const [contentPart] = result.content;

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "https://api.github.com/search/repositories?",
    );
    expect(contentPart?.text).toContain('repos query="mariozechner pi-ai"');
    expect(contentPart?.text).not.toContain("Structured result");
  });

  it("returns compact line-windowed file reads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          content: btoa("alpha\nbeta\ngamma\ndelta"),
          encoding: "base64",
          html_url: "https://github.com/owner/repo/blob/main/src/index.ts",
          name: "index.ts",
          path: "src/index.ts",
          sha: "abc123",
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      ),
    );
    await setExtensionEnabled("github", true);

    const runtime = await getEnabledExtensionRuntime(installedExtensions);
    const tool = runtime.tools.find((candidate) => candidate.name === "github_repo");

    if (!tool) {
      throw new Error("github_repo tool was not registered");
    }

    const result = await tool.execute(
      "call-1",
      {
        lineNumbers: true,
        limit: 2,
        offset: 2,
        operation: "read",
        path: "src/index.ts",
        repo: "owner/repo",
      },
      undefined,
    );
    const [contentPart] = result.content;

    expect(contentPart?.text).toBe(
      "owner/repo src/index.ts lines 2-3/4 nextOffset=4\n2: beta\n3: gamma",
    );
    expect(result.details).toMatchObject({
      lines: {
        endLine: 3,
        nextOffset: 4,
        offset: 2,
        totalLines: 4,
        truncated: true,
      },
    });
  });

  it("does not call raw GitHub mutations unless confirmed", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await setExtensionEnabled("github", true);

    const runtime = await getEnabledExtensionRuntime(installedExtensions);
    const tool = runtime.tools.find((candidate) => candidate.name === "github_api");

    if (!tool) {
      throw new Error("github_api tool was not registered");
    }

    await expect(
      tool.execute(
        "call-1",
        {
          bodyJson: "{}",
          method: "POST",
          operation: "rest",
          path: "/repos/owner/repo/issues",
        },
        undefined,
      ),
    ).rejects.toThrow("confirmMutation=true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("wraps extension tools with execution context", async () => {
    const runtime = await createExtensionRuntimeSnapshot([customExtension]);
    const [tool] = runtime.tools;

    const result = await tool.execute("call-1", { text: "hello" }, undefined);

    expect(result).toEqual({
      content: [{ text: "hello", type: "text" }],
      details: { text: "hello" },
    });
  });

  it("rejects duplicate tool names across enabled extensions", async () => {
    await expect(
      createExtensionRuntimeSnapshot([customExtension, customExtension]),
    ).rejects.toThrow("Tool test_echo is already registered");
  });
});
