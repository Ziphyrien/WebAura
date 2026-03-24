import type { RepoRuntime } from "@/repo/repo-types"
import { createBashTool } from "@/tools/bash"
import { createReadTool } from "@/tools/read"
import { toAgentTool, toProviderToolDefinition } from "@/tools/types"

export function createRepoTools(runtime: RepoRuntime) {
  const read = createReadTool(runtime)
  const bash = createBashTool(runtime)
  const definitions = [read, bash]

  return {
    agentTools: [toAgentTool(read), toAgentTool(bash)],
    definitions,
    providerTools: [
      toProviderToolDefinition(read),
      toProviderToolDefinition(bash),
    ],
  }
}
