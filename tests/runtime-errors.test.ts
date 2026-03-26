import { describe, expect, it } from "vitest"
import { GitHubFsError } from "@/repo/github-fs"
import { classifyRuntimeError } from "@/agent/runtime-errors"

describe("classifyRuntimeError", () => {
  it("detects GitHub rate limit from GitHubFsError message", () => {
    const err = new GitHubFsError(
      "EACCES",
      "GitHub API rate limit exceeded (resets at 3:00:00 PM): /",
      "/"
    )
    const c = classifyRuntimeError(err)
    expect(c.kind).toBe("github_rate_limit")
    expect(c.action).toBe("open-github-settings")
    expect(c.severity).toBe("error")
  })

  it("detects provider connection failures", () => {
    const c = classifyRuntimeError(new Error("Connection error."))
    expect(c.kind).toBe("provider_connection")
    expect(c.source).toBe("provider")
  })
})
