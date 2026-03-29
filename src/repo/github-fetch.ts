import { toast } from "sonner"
import { classifyRuntimeError } from "@/agent/runtime-errors"
import { getGithubPersonalAccessToken } from "@/repo/github-token"
import { appendSessionNotice } from "@/sessions/session-notices"
import type { SystemMessage } from "@/types/chat"

const CACHE_NAME = "github-api"
const FRESH_MS = 2 * 60 * 1000
const STALE_MS = 10 * 60 * 1000
const TIMESTAMP_HEADER = "x-cached-at"
const SECONDARY_RATE_LIMIT_FLOOR_MS = 60 * 1000
const SECONDARY_RATE_LIMIT_MAX_MS = 15 * 60 * 1000
const TOAST_DEDUPE_MS = 5 * 1000

type GitHubRateLimitKind = "primary" | "secondary" | "unknown"

let blockedUntilMs = 0
let secondaryBackoffMs = SECONDARY_RATE_LIMIT_FLOOR_MS
let lastToastSignature = ""
let lastToastAt = 0

export class GitHubRateLimitError extends Error {
  readonly blockedUntilMs?: number
  readonly kind: GitHubRateLimitKind
  readonly status: number

  constructor(options?: {
    blockedUntilMs?: number
    kind?: GitHubRateLimitKind
    message?: string
    status?: number
  }) {
    super(
      options?.message ??
        buildRateLimitMessage(options?.kind ?? "unknown", options?.blockedUntilMs)
    )
    this.name = "GitHubRateLimitError"
    this.blockedUntilMs = options?.blockedUntilMs
    this.kind = options?.kind ?? "unknown"
    this.status = options?.status ?? 429
  }
}

function buildGithubHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

function formatRetryTime(value: number | undefined): string | undefined {
  if (!value || !Number.isFinite(value)) {
    return undefined
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
}

function buildRateLimitMessage(
  kind: GitHubRateLimitKind,
  retryAtMs?: number
): string {
  const retryLabel = formatRetryTime(retryAtMs)

  if (kind === "primary" && retryLabel) {
    return `GitHub API rate limit exceeded until ${retryLabel}. Add a token to raise the limit.`
  }

  if (kind === "secondary" && retryLabel) {
    return `GitHub API secondary rate limit exceeded until ${retryLabel}. Add a token or wait before retrying.`
  }

  if (retryLabel) {
    return `GitHub API rate limit exceeded until ${retryLabel}. Add a token or wait before retrying.`
  }

  return "GitHub API rate limit exceeded. Add a token or wait before retrying."
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function shouldSuppressToast(signature: string): boolean {
  const now = Date.now()

  if (
    signature === lastToastSignature &&
    now - lastToastAt < TOAST_DEDUPE_MS
  ) {
    return true
  }

  lastToastSignature = signature
  lastToastAt = now
  return false
}

function clearExpiredRateLimitWindow(): void {
  if (blockedUntilMs !== 0 && blockedUntilMs <= Date.now()) {
    blockedUntilMs = 0
  }
}

function recordRateLimitWindow(kind: GitHubRateLimitKind, retryAtMs?: number): number {
  const now = Date.now()
  let nextBlockedUntilMs = retryAtMs

  if (!nextBlockedUntilMs || nextBlockedUntilMs <= now) {
    nextBlockedUntilMs = now + secondaryBackoffMs
  }

  blockedUntilMs = Math.max(blockedUntilMs, nextBlockedUntilMs)

  if (kind === "secondary" || kind === "unknown") {
    secondaryBackoffMs = Math.min(
      secondaryBackoffMs * 2,
      SECONDARY_RATE_LIMIT_MAX_MS
    )
  } else {
    secondaryBackoffMs = SECONDARY_RATE_LIMIT_FLOOR_MS
  }

  return blockedUntilMs
}

function updateRateLimitWindowFromHeaders(res: Response): void {
  const remaining = parsePositiveInt(res.headers.get("x-ratelimit-remaining"))
  const resetAtSeconds = parsePositiveInt(res.headers.get("x-ratelimit-reset"))

  if (remaining === 0 && resetAtSeconds !== undefined) {
    blockedUntilMs = Math.max(blockedUntilMs, resetAtSeconds * 1000)
    secondaryBackoffMs = SECONDARY_RATE_LIMIT_FLOOR_MS
    return
  }

  if (res.ok && remaining !== undefined && remaining > 0 && blockedUntilMs <= Date.now()) {
    blockedUntilMs = 0
    secondaryBackoffMs = SECONDARY_RATE_LIMIT_FLOOR_MS
  }
}

async function readGitHubErrorMessage(res: Response): Promise<string | undefined> {
  try {
    const data = (await res.clone().json()) as { message?: unknown }
    if (typeof data.message === "string" && data.message.trim().length > 0) {
      return data.message.trim()
    }
  } catch {}

  try {
    const text = (await res.clone().text()).trim()
    return text.length > 0 ? text : undefined
  } catch {
    return undefined
  }
}

function isRateLimitedResponse(res: Response, detail: string | undefined): boolean {
  if (res.status === 429) {
    return true
  }

  if (res.status !== 403) {
    return false
  }

  if (parsePositiveInt(res.headers.get("retry-after")) !== undefined) {
    return true
  }

  if (parsePositiveInt(res.headers.get("x-ratelimit-remaining")) === 0) {
    return true
  }

  const lower = detail?.toLowerCase()
  return lower?.includes("rate limit") === true
}

async function createRateLimitError(res: Response): Promise<GitHubRateLimitError> {
  const detail = await readGitHubErrorMessage(res)
  const retryAfterSeconds = parsePositiveInt(res.headers.get("retry-after"))
  const remaining = parsePositiveInt(res.headers.get("x-ratelimit-remaining"))
  const resetAtSeconds = parsePositiveInt(res.headers.get("x-ratelimit-reset"))
  const lower = detail?.toLowerCase()

  const kind: GitHubRateLimitKind =
    remaining === 0
      ? "primary"
      : lower?.includes("secondary rate limit") || retryAfterSeconds !== undefined
        ? "secondary"
        : "unknown"

  const retryAtMs =
    retryAfterSeconds !== undefined
      ? Date.now() + retryAfterSeconds * 1000
      : remaining === 0 && resetAtSeconds !== undefined
        ? resetAtSeconds * 1000
        : undefined

  const blockedUntil = recordRateLimitWindow(kind, retryAtMs)

  return new GitHubRateLimitError({
    blockedUntilMs: blockedUntil,
    kind,
    status: res.status,
  })
}

function throwIfBlockedByRateLimit(): void {
  clearExpiredRateLimitWindow()

  if (blockedUntilMs <= Date.now()) {
    return
  }

  throw new GitHubRateLimitError({
    blockedUntilMs,
    kind: "unknown",
    status: 429,
  })
}

async function networkFetch(
  url: string,
  token: string | undefined,
  signal?: AbortSignal
): Promise<Response> {
  throwIfBlockedByRateLimit()

  const res = await fetch(url, {
    headers: buildGithubHeaders(token),
    signal,
  })

  updateRateLimitWindowFromHeaders(res)

  const detail =
    res.status === 403 || res.status === 429
      ? await readGitHubErrorMessage(res)
      : undefined

  if (isRateLimitedResponse(res, detail)) {
    throw await createRateLimitError(res)
  }

  return res
}

async function putCache(cache: Cache, url: string, res: Response) {
  const body = await res.clone().arrayBuffer()
  const cached = new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: new Headers(res.headers),
  })
  cached.headers.set(TIMESTAMP_HEADER, Date.now().toString())
  await cache.put(url, cached)
}

function revalidateInBackground(
  cache: Cache,
  url: string,
  token: string | undefined
) {
  void networkFetch(url, token)
    .then((res) => {
      if (res.ok) return putCache(cache, url, res)
    })
    .catch(() => {})
}

/** Opens app settings on the GitHub token section (same URL pattern as rate-limit toast). */
export function openGithubTokenSettings(): void {
  const url = new URL(window.location.href)
  url.searchParams.set("settings", "github")
  window.history.pushState({}, "", url)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

export async function githubApiFetch(
  path: string,
  options?: { signal?: AbortSignal }
): Promise<Response> {
  const url = `https://api.github.com${path}`
  const token = await getGithubPersonalAccessToken()

  if (typeof caches !== "undefined") {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(url)

    if (cached) {
      clearExpiredRateLimitWindow()

      if (blockedUntilMs > Date.now()) {
        return cached
      }

      const cachedAt = Number(cached.headers.get(TIMESTAMP_HEADER) ?? 0)
      const age = Date.now() - cachedAt

      if (age < FRESH_MS) {
        return cached
      }

      if (age < STALE_MS) {
        revalidateInBackground(cache, url, token)
        return cached
      }
    }

    try {
      const res = await networkFetch(url, token, options?.signal)
      if (res.ok) {
        await putCache(cache, url, res)
      }
      return res
    } catch (error) {
      if (cached && isRateLimitError(error)) {
        return cached
      }

      throw error
    }
  }

  return networkFetch(url, token, options?.signal)
}

export function showRateLimitToast() {
  showGithubErrorToast(
    new GitHubRateLimitError({
      blockedUntilMs,
      kind: "unknown",
    })
  )
}

export function isRateLimitError(err: unknown): err is GitHubRateLimitError {
  return err instanceof GitHubRateLimitError
}

function showGithubActionToast(input: {
  actionLabel: string
  message: string
  signature: string
}): void {
  if (shouldSuppressToast(input.signature)) {
    return
  }

  toast.error(input.message, {
    action: {
      label: input.actionLabel,
      onClick: () => {
        openGithubTokenSettings()
      },
    },
  })
}

function showClassifiedGithubToast(
  kind: SystemMessage["kind"],
  signature: string,
  error?: unknown
): void {
  if (kind === "github_rate_limit") {
    const retryAt =
      error instanceof GitHubRateLimitError
        ? formatRetryTime(error.blockedUntilMs)
        : undefined

    showGithubActionToast({
      actionLabel: "Add token",
      message: retryAt
        ? `GitHub requests are rate limited until ${retryAt}. Add a token to raise the limit.`
        : "GitHub requests are rate limited right now. Add a token to raise the limit.",
      signature,
    })
    return
  }

  if (kind === "github_auth") {
    showGithubActionToast({
      actionLabel: "GitHub settings",
      message: "GitHub authentication failed. Update your token in Settings.",
      signature,
    })
    return
  }

  if (kind === "github_permission") {
    showGithubActionToast({
      actionLabel: "GitHub settings",
      message: "GitHub denied repository access. Check your token permissions in Settings.",
      signature,
    })
    return
  }

  if (kind === "github_api") {
    showGithubActionToast({
      actionLabel: "GitHub settings",
      message: "GitHub request failed. Open Settings to review your GitHub token.",
      signature,
    })
  }
}

export function showGithubSystemNoticeToast(
  notice: Extract<SystemMessage, { role: "system" }>
): boolean {
  if (notice.source !== "github") {
    return false
  }

  showClassifiedGithubToast(notice.kind, notice.fingerprint)
  return true
}

export function showGithubErrorToast(error: unknown): boolean {
  const normalized = error instanceof Error ? error : new Error(String(error))
  const classified = classifyRuntimeError(normalized)

  if (classified.source !== "github") {
    return false
  }

  showClassifiedGithubToast(classified.kind, classified.fingerprint, normalized)
  return true
}

export async function handleGithubError(
  error: unknown,
  options?: { sessionId?: string }
): Promise<boolean> {
  const normalized = error instanceof Error ? error : new Error(String(error))
  const classified = classifyRuntimeError(normalized)

  if (classified.source !== "github") {
    return false
  }

  if (options?.sessionId) {
    await appendSessionNotice(options.sessionId, normalized)
  }

  showClassifiedGithubToast(classified.kind, classified.fingerprint, normalized)
  return true
}
