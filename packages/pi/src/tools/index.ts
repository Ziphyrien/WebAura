import type { RepoRuntime } from "@gitaura/pi/repo/repo-types";
import { createBashTool } from "@gitaura/pi/tools/bash";
import { createReadTool } from "@gitaura/pi/tools/read";
import { toAgentTool, toProviderToolDefinition } from "@gitaura/pi/tools/types";

export function createRepoTools(
  runtime: RepoRuntime,
  options?: {
    onRepoError?: (error: unknown) => void | Promise<void>;
  },
) {
  const read = createReadTool(runtime, options?.onRepoError);
  const bash = createBashTool(runtime, options?.onRepoError);
  const definitions = [read, bash];

  return {
    agentTools: [toAgentTool(read), toAgentTool(bash)],
    definitions,
    providerTools: [toProviderToolDefinition(read), toProviderToolDefinition(bash)],
  };
}
