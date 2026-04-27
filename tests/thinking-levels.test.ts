import { describe, expect, it } from "vite-plus/test";
import { clampThinkingLevel, getAvailableThinkingLevels } from "@/agent/thinking-levels";
import { getModel } from "@/models/catalog";

describe("thinking levels", () => {
  it("includes xhigh only for models that support it", () => {
    const xhighModel = getModel("openai-codex", "gpt-5.4");
    const standardModel = getModel("openai-codex", "gpt-5.1-codex-mini");

    expect(getAvailableThinkingLevels(xhighModel)).toEqual([
      "off",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(getAvailableThinkingLevels(standardModel)).toEqual([
      "off",
      "minimal",
      "low",
      "medium",
      "high",
    ]);
  });

  it("clamps unavailable thinking levels to the closest supported level", () => {
    const standardModel = getModel("openai-codex", "gpt-5.1-codex-mini");
    const nonThinkingModel = getModel("github-copilot", "gpt-4o");

    expect(clampThinkingLevel("xhigh", standardModel)).toBe("high");
    expect(clampThinkingLevel("high", nonThinkingModel)).toBe("off");
  });
});
