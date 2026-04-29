import { describe, expect, it } from "vite-plus/test";
import { createEmptyUsage } from "@/types/models";
import { serializeOAuthCredentials } from "@/auth/oauth-types";
import {
  DEFAULT_MODELS,
  calculateCost,
  getConnectedProviders,
  getDefaultModel,
  getModel,
  getModelsForGroup,
  getProviderGroups,
} from "@/models/catalog";

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

  it("limits OpenAI groups to GPT-5.4 / Mini / Nano in that order", () => {
    const expected = ["gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"];
    expect(getModelsForGroup("openai").map((m) => m.id)).toEqual(expected);
    expect(getModelsForGroup("openai-codex").map((m) => m.id)).toEqual(expected);
  });

  it("sorts non-OpenAI models by id descending (newer ids first)", () => {
    const models = getModelsForGroup("anthropic");
    const ids = models.map((model) => model.id);
    const sorted = [...ids].sort((left, right) =>
      right.localeCompare(left, undefined, { numeric: true, sensitivity: "base" }),
    );

    expect(ids).toEqual(sorted);
  });

  it("returns the configured default models", () => {
    expect(getDefaultModel("openai-codex").id).toBe(DEFAULT_MODELS["openai-codex"]);
    expect(getDefaultModel("anthropic").id).toBe(DEFAULT_MODELS.anthropic);
    expect(getDefaultModel("kimi-coding").id).toBe("kimi-for-coding");
  });

  it("keeps Kimi's canonical API model name", () => {
    expect(getModel("kimi-coding", "kimi-for-coding").name).toBe("Kimi For Coding");
  });

  it("falls back to the provider default when the requested model is missing", () => {
    expect(getModel("github-copilot", "missing-model").id).toBe("gpt-4o");
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
