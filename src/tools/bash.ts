import { Type, type Static } from "@sinclair/typebox"
import { execInRepoShell } from "@/repo/repo-runtime"
import type { RepoRuntime } from "@/repo/repo-types"
import { truncateTail, type TruncationResult } from "@/tools/truncate"
import type { AppToolDefinition } from "@/tools/types"

const bashSchema = Type.Object({
  command: Type.String({
    description:
      "Command to execute in the active repository's virtual read-only shell",
  }),
})

export type BashToolParams = Static<typeof bashSchema>

export interface BashToolDetails {
  command: string
  cwd: string
  exitCode: number
  truncation?: TruncationResult
  warnings?: string[]
}

export function createBashTool(
  runtime: RepoRuntime,
  onRepoError?: (error: unknown) => void | Promise<void>
): AppToolDefinition<typeof bashSchema, BashToolDetails> {
  return {
    description:
      "Execute a command in the active repository's virtual read-only shell. " +
      "This is not system bash and only has access to the selected GitHub repository.",
    async execute(_toolCallId, params, signal) {
      if (signal?.aborted) {
        throw new Error("Command aborted")
      }

      let result: Awaited<ReturnType<typeof execInRepoShell>>

      try {
        result = await execInRepoShell(runtime, params.command, signal)
      } catch (error) {
        if (onRepoError) {
          await onRepoError(error)
        }

        throw error
      }

      const combined = [result.stdout, result.stderr].filter(Boolean).join("\n")
      const truncation = truncateTail(combined || "(no output)")
      let output = truncation.content || "(no output)"

      if (truncation.truncated) {
        output += "\n\n[Output truncated. Showing the tail of the command output.]"
      }

      if (result.exitCode !== 0) {
        output += `\n\nCommand exited with code ${result.exitCode}`
        const err = new Error(output)
        if (onRepoError) {
          await onRepoError(err)
        }

        throw err
      }

      return {
        content: [{ text: output, type: "text" }],
        details: {
          command: params.command,
          cwd: result.cwd,
          exitCode: result.exitCode,
          truncation: truncation.truncated ? truncation : undefined,
          warnings: runtime.getWarnings(),
        },
      }
    },
    label: "Bash",
    name: "bash",
    parameters: bashSchema,
  }
}
