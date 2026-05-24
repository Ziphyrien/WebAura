import type { ProviderId } from "@firefly/pi/types/models";

export type ProviderAuthKind = "api-key" | "none" | "oauth";

export interface ProviderAuthState {
  authKind: ProviderAuthKind;
  hasValue: boolean;
  provider: ProviderId;
  updatedAt?: string;
}
