import type {
  Api,
  ImagesApi,
  ImagesModel,
  KnownImagesProvider,
  KnownProvider,
  Model,
  Usage as PiUsage,
} from "@earendil-works/pi-ai";

export type { KnownImagesProvider, KnownProvider };

/** Canonical provider ids come directly from the shared pi-ai registry. */
export type ProviderId = KnownProvider;

export type ProviderGroupId = KnownProvider;

export interface ProviderGroupDefinition {
  canonicalProvider: ProviderId;
  description: string;
  id: ProviderGroupId;
  label: string;
}

export type ApiType = Api;
export type ImagesApiType = ImagesApi;
export type { ThinkingLevel } from "@earendil-works/pi-agent-core";

export type ImageProviderId = KnownImagesProvider;
export type ModelInput = "image" | "text";

export type Usage = PiUsage;

export interface UsageCost {
  cacheRead: number;
  cacheWrite: number;
  input: number;
  output: number;
  total: number;
}

export type ModelDefinition = Model<ApiType> & {
  free?: boolean;
};

export type ImageModelDefinition = ImagesModel<ImagesApiType>;

export function createEmptyUsage(): Usage {
  return {
    cacheRead: 0,
    cacheWrite: 0,
    cost: {
      cacheRead: 0,
      cacheWrite: 0,
      input: 0,
      output: 0,
      total: 0,
    },
    input: 0,
    output: 0,
    totalTokens: 0,
  };
}
