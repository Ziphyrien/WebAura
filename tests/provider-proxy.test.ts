import { describe, expect, it } from "vite-plus/test";
import { shouldUseProxyForProvider } from "@/agent/provider-proxy";

describe("provider-proxy", () => {
  it("proxies direct OpenAI-compatible providers", () => {
    expect(shouldUseProxyForProvider("openai", "sk-openai")).toBe(true);
    expect(shouldUseProxyForProvider("opencode", "sk-opencode")).toBe(true);
  });

  it("does not proxy providers outside the supported proxy set", () => {
    expect(shouldUseProxyForProvider("mistral", "mistral-key")).toBe(false);
  });
});
