import type { ResolvedRepoSource } from "@gitaura/db";
import { createReadTool } from "@gitaura/pi/tools/read";
import { toAgentTool, toProviderToolDefinition } from "@gitaura/pi/tools/types";

export function createRepoTools(
  source: ResolvedRepoSource,
  options?: {
    onRepoError?: (error: unknown) => void | Promise<void>;
  },
) {
  const read = createReadTool(source, options?.onRepoError);
  const definitions = [read];

  return {
    agentTools: [toAgentTool(read)],
    definitions,
    providerTools: [toProviderToolDefinition(read)],
  };
}
