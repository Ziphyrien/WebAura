import type { UserTurnInput } from "@firefly/pi/agent/user-turn-input";
import type { ProviderGroupId, ThinkingLevel } from "@firefly/pi/types/models";

export interface SessionRunner {
  abort(): void | Promise<void>;
  dispose(): void | Promise<void>;
  isBusy(): boolean;
  setModelSelection(providerGroup: ProviderGroupId, modelId: string): Promise<void>;
  setThinkingLevel(thinkingLevel: ThinkingLevel): Promise<void>;
  startTurn(input: string | UserTurnInput): Promise<void>;
  waitForTurn(): Promise<void>;
}
