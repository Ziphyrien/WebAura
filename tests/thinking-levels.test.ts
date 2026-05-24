import { describe, expect, it } from "vite-plus/test";
import { clampThinkingLevel, getAvailableThinkingLevels } from "@/agent/thinking-levels";
import { getModel } from "@/models/catalog";

describe("thinking levels", () => {
  it("reflects model-specific thinking levels from the pi-ai registry", () => {
    const xhighModel = getModel("openai-codex", "gpt-5.1-codex-mini");
    const highOnlyModel = getModel("amazon-bedrock", "anthropic.claude-haiku-4-5-20251001-v1:0");

    expect(getAvailableThinkingLevels(xhighModel)).toEqual([
      "off",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(getAvailableThinkingLevels(highOnlyModel)).toEqual([
      "off",
      "minimal",
      "low",
      "medium",
      "high",
    ]);
  });

  it("clamps unavailable thinking levels to the closest supported level", () => {
    const highOnlyModel = getModel("amazon-bedrock", "anthropic.claude-haiku-4-5-20251001-v1:0");
    const nonThinkingModel = getModel("github-copilot", "gpt-4o");

    expect(clampThinkingLevel("xhigh", highOnlyModel)).toBe("high");
    expect(clampThinkingLevel("high", nonThinkingModel)).toBe("off");
  });
});
