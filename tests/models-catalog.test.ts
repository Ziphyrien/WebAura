import { describe, expect, it } from "vite-plus/test";
import { getModels as getRegistryModels } from "@mariozechner/pi-ai";
import { createEmptyUsage } from "@/types/models";
import { serializeOAuthCredentials } from "@/auth/oauth-types";
import {
  calculateCost,
  getCanonicalProvider,
  getConnectedProviders,
  getDefaultModel,
  getDefaultModelForGroup,
  getModel,
  getModelsForGroup,
  getProviderGroups,
} from "@/models/catalog";
import type { ProviderId } from "@/types/models";

function firstRegistryModelId(provider: ProviderId): string {
  const first = (getRegistryModels(provider as never) as Array<{ id: string }>).at(0);

  if (!first) {
    throw new Error(`Missing pi-ai registry model for ${provider}`);
  }

  return first.id;
}

describe("model catalog", () => {
  it("does not treat a non-OAuth openai-codex key as connected", () => {
    const connected = getConnectedProviders([{ provider: "openai-codex", value: "sk-not-oauth" }]);

    expect(connected).not.toContain("openai-codex");
  });

  it("treats valid OpenAI Codex OAuth credentials as connected", () => {
    const connected = getConnectedProviders([
      {
        provider: "openai-codex",
        value: serializeOAuthCredentials({
          access: "access-token",
          accountId: "acct-1",
          expires: Date.now() + 60_000,
          providerId: "openai-codex",
          refresh: "refresh-token",
        }),
      },
    ]);

    expect(connected).toContain("openai-codex");
  });

  it("sorts displayed models by id descending (newer ids first)", () => {
    const models = getModelsForGroup("anthropic");
    const ids = models.map((model) => model.id);
    const sorted = [...ids].sort((left, right) =>
      right.localeCompare(left, undefined, { numeric: true, sensitivity: "base" }),
    );

    expect(ids).toEqual(sorted);
  });

  it("uses pi-ai registry order as the only default model source", () => {
    for (const group of getProviderGroups()) {
      const provider = getCanonicalProvider(group);
      const expected = firstRegistryModelId(provider);
      expect(getDefaultModel(provider).id).toBe(expected);
      expect(getDefaultModelForGroup(group).id).toBe(expected);
    }
  });

  it("keeps Kimi's canonical API model name", () => {
    expect(getModel("kimi-coding", "kimi-for-coding").name).toBe("Kimi For Coding");
  });

  it("falls back to the pi-ai provider default when the requested model is missing", () => {
    expect(getModel("github-copilot", "missing-model").id).toBe(
      firstRegistryModelId("github-copilot"),
    );
  });

  it("exposes provider groups from the shared registry", () => {
    expect(getProviderGroups()).toEqual(
      expect.arrayContaining(["opencode", "openai-codex", "kimi-coding"]),
    );
  });

  it("calculates per-message cost from usage totals", () => {
    const model = getModel("openai-codex", "gpt-5.1-codex-mini");
    const usage = createEmptyUsage();
    usage.input = 1_000;
    usage.output = 500;
    usage.totalTokens = 1_500;

    expect(calculateCost(model, usage)).toEqual({
      cacheRead: 0,
      cacheWrite: 0,
      input: 0.00025,
      output: 0.001,
      total: 0.00125,
    });
  });
});
