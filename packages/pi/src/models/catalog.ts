// App-facing catalog helpers layered on the shared pi-ai registry.
import { getModel as getRegistryModel, getModels as getRegistryModels } from "@mariozechner/pi-ai";
import type { ModelDefinition, ProviderGroupId, ProviderId, Usage } from "@webaura/pi/types/models";
import { isOAuthCredentials, parseOAuthCredentials } from "@webaura/pi/auth/oauth-types";
import {
  getAtlasProviderGroups,
  getCanonicalProvider,
  getDefaultProviderGroup,
  getProviderGroupMetadata,
  getRuntimeSupportedProviders,
  isProviderGroupId,
} from "@webaura/pi/models/provider-registry";

const SUPPORTED_PROVIDERS = getRuntimeSupportedProviders();

function requireProviderGroups(): Array<ProviderGroupId> {
  const groups = getProviderGroups();
  if (groups.length === 0) {
    throw new Error("No providers available");
  }
  return groups;
}

function defaultProviderGroup(): ProviderGroupId {
  const first = requireProviderGroups()[0];
  if (!first) {
    throw new Error("No providers available");
  }
  return first;
}

function normalizeLegacyProviderGroupId(group: string): ProviderGroupId {
  if (isProviderGroupId(group)) {
    return group;
  }

  return defaultProviderGroup();
}

export function getProviders(): Array<ProviderId> {
  return SUPPORTED_PROVIDERS;
}

export function getPiAiModels(provider: ProviderId): ModelDefinition[] {
  return getRegistryModels(provider as never) as ModelDefinition[];
}

export function getPiAiModel(provider: ProviderId, modelId: string): ModelDefinition | undefined {
  const direct = getRegistryModel(provider as never, modelId as never) as
    | ModelDefinition
    | undefined;
  return direct;
}

export function getProviderGroups(): Array<ProviderGroupId> {
  return getAtlasProviderGroups().filter((providerGroup) => {
    const provider = getCanonicalProvider(providerGroup);
    return SUPPORTED_PROVIDERS.includes(provider);
  });
}

export function hasStoredProviderCredential(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function isOpenAiCodexOAuthConnected(value: string): boolean {
  if (!isOAuthCredentials(value)) {
    return false;
  }

  try {
    const credentials = parseOAuthCredentials(value);
    return (
      credentials.providerId === "openai-codex" &&
      Boolean(credentials.access?.trim()) &&
      Boolean(credentials.refresh?.trim())
    );
  } catch {
    return false;
  }
}

function isProviderRecordConnected(record: { provider: ProviderId; value: string }): boolean {
  if (record.provider === "openai-codex") {
    return isOpenAiCodexOAuthConnected(record.value);
  }

  return hasStoredProviderCredential(record.value);
}

export function getConnectedProviders(
  providerRecords: Array<{ provider: ProviderId; value: string }>,
): Array<ProviderId> {
  const connectedProviders = new Set(
    providerRecords
      .filter((record) => isProviderRecordConnected(record))
      .map((record) => record.provider),
  );

  return getProviderGroups()
    .map((providerGroup) => getCanonicalProvider(providerGroup))
    .filter((provider, index, providers) => {
      return connectedProviders.has(provider) && providers.indexOf(provider) === index;
    });
}

export function getVisibleProviderGroups(
  connectedProviders: Array<ProviderId>,
): Array<ProviderGroupId> {
  const connectedProviderSet = new Set(connectedProviders);
  const connectedProviderGroups = getProviderGroups().filter((providerGroup) => {
    return connectedProviderSet.has(getCanonicalProvider(providerGroup));
  });

  return connectedProviderGroups.length > 0 ? connectedProviderGroups : getProviderGroups();
}

export function getModels(provider: ProviderId): Array<ModelDefinition> {
  return getPiAiModels(provider);
}

export function getModel(provider: ProviderId, modelId: string): ModelDefinition {
  return getPiAiModel(provider, modelId) ?? getDefaultModel(provider);
}

/** Newer / higher-version ids first (display order only). */
function sortModelsForDisplay(models: Array<ModelDefinition>): Array<ModelDefinition> {
  return [...models].sort((left, right) =>
    right.id.localeCompare(left.id, undefined, { numeric: true, sensitivity: "base" }),
  );
}

export function getModelsForGroup(providerGroup: ProviderGroupId): Array<ModelDefinition> {
  const group = normalizeLegacyProviderGroupId(providerGroup as string);
  const provider = getCanonicalProvider(group);
  const models = getModels(provider);

  return sortModelsForDisplay(models);
}

export function getDefaultModelForGroup(providerGroup: ProviderGroupId): ModelDefinition {
  const group = normalizeLegacyProviderGroupId(providerGroup as string);
  return getDefaultModel(getCanonicalProvider(group));
}

export function hasModelForGroup(providerGroup: ProviderGroupId, modelId: string): boolean {
  const group = normalizeLegacyProviderGroupId(providerGroup as string);
  return getModelsForGroup(group).some((model) => model.id === modelId);
}

export function getModelForGroup(providerGroup: ProviderGroupId, modelId: string): ModelDefinition {
  const group = normalizeLegacyProviderGroupId(providerGroup as string);
  return (
    getModelsForGroup(group).find((model) => model.id === modelId) ?? getDefaultModelForGroup(group)
  );
}

export function getDefaultModel(provider: ProviderId): ModelDefinition {
  const first = getRegistryModels(provider as never).at(0) as ModelDefinition | undefined;
  if (!first) {
    throw new Error(`Missing default model for provider: ${provider}`);
  }

  return first;
}

export function hasModel(provider: ProviderId, modelId: string): boolean {
  return Boolean(getPiAiModel(provider, modelId));
}

export function getPreferredProviderGroup(providersWithAuth: Array<ProviderId>): ProviderGroupId {
  return getVisibleProviderGroups(providersWithAuth)[0] ?? defaultProviderGroup();
}

export {
  getCanonicalProvider,
  getDefaultProviderGroup,
  getProviderGroupMetadata,
  isProviderGroupId,
};

export function calculateCost(model: ModelDefinition, usage: Usage): Usage["cost"] {
  const input = (model.cost.input / 1_000_000) * usage.input;
  const output = (model.cost.output / 1_000_000) * usage.output;
  const cacheRead = (model.cost.cacheRead / 1_000_000) * usage.cacheRead;
  const cacheWrite = (model.cost.cacheWrite / 1_000_000) * usage.cacheWrite;

  return {
    cacheRead,
    cacheWrite,
    input,
    output,
    total: input + output + cacheRead + cacheWrite,
  };
}
