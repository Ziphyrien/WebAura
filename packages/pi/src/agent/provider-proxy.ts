import type { Api, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import { getProxyConfig } from "@firefly/pi/proxy/settings";
import { buildProxiedUrl } from "@firefly/pi/proxy/url";

type StreamSimple = (typeof import("@earendil-works/pi-ai"))["streamSimple"];

export function shouldUseProxyForProvider(provider: string, apiKey: string): boolean {
  switch (provider.toLowerCase()) {
    case "anthropic":
      return apiKey.startsWith("sk-ant-oat") || apiKey.startsWith("{");
    case "openai":
    case "openai-codex":
    case "opencode":
    case "opencode-go":
    case "kimi-coding":
      return true;
    default:
      return false;
  }
}

function applyProxyIfNeeded<TApi extends Api>(
  model: Model<TApi>,
  apiKey: string,
  proxyUrl?: string,
): Model<TApi> {
  if (!proxyUrl || !model.baseUrl) {
    return model;
  }

  if (!shouldUseProxyForProvider(model.provider, apiKey)) {
    return model;
  }

  return {
    ...model,
    baseUrl: buildProxiedUrl(proxyUrl, model.baseUrl),
  };
}

export function createProxyAwareStreamFn() {
  return async <TApi extends Api>(
    model: Model<TApi>,
    context: Parameters<StreamSimple>[1],
    options?: SimpleStreamOptions,
  ) => {
    const { streamSimple } = await import("@earendil-works/pi-ai");
    const apiKey = options?.apiKey;

    if (!apiKey) {
      return await streamSimple(model, context, options);
    }

    const proxy = await getProxyConfig();
    const proxyUrl = proxy.enabled ? proxy.url : undefined;

    if (!proxyUrl) {
      return await streamSimple(model, context, options);
    }

    const proxiedModel = applyProxyIfNeeded(model, apiKey, proxyUrl);
    return await streamSimple(proxiedModel, context, options);
  };
}
