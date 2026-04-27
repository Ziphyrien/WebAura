export type GitHubRateLimitKind = "primary" | "secondary" | "unknown";

export interface ParsedGitHubRateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
}

export type GitHubErrorKind =
  | "not_found"
  | "auth"
  | "permission"
  | "rate_limit"
  | "conflict"
  | "validation"
  | "unsupported"
  | "network"
  | "unknown";

export class GitHubApiError extends Error {
  code: string;
  githubMessage?: string;
  isRetryable?: boolean;
  kind: GitHubErrorKind;
  path?: string;
  rateLimitKind?: GitHubRateLimitKind;
  retryAt?: number;
  status?: number;

  constructor(options: {
    cause?: unknown;
    code: string;
    githubMessage?: string;
    isRetryable?: boolean;
    kind: GitHubErrorKind;
    message: string;
    path?: string;
    rateLimitKind?: GitHubRateLimitKind;
    retryAt?: number;
    status?: number;
  });
  constructor(code: string, message: string, path?: string);
  constructor(
    input:
      | {
          cause?: unknown;
          code: string;
          githubMessage?: string;
          isRetryable?: boolean;
          kind: GitHubErrorKind;
          message: string;
          path?: string;
          rateLimitKind?: GitHubRateLimitKind;
          retryAt?: number;
          status?: number;
        }
      | string,
    legacyMessage?: string,
    legacyPath?: string,
  ) {
    const options =
      typeof input === "string"
        ? {
            code: input,
            isRetryable: input === "EIO",
            kind: kindFromLegacyCode(input),
            message: legacyMessage ?? input,
            path: legacyPath,
          }
        : input;

    super(options.message, options.cause ? { cause: options.cause } : undefined);
    this.name = "GitHubApiError";
    this.code = options.code;
    this.githubMessage = options.githubMessage;
    this.isRetryable = options.isRetryable;
    this.kind = options.kind;
    this.path = options.path;
    this.rateLimitKind = options.rateLimitKind;
    this.retryAt = options.retryAt;
    this.status = options.status;
  }
}

export function parseGitHubRateLimitInfo(res: Response): ParsedGitHubRateLimitInfo | null {
  const limit = parsePositiveInt(res.headers.get("x-ratelimit-limit"));
  const remaining = parsePositiveInt(res.headers.get("x-ratelimit-remaining"));
  const resetAtSeconds = parsePositiveInt(res.headers.get("x-ratelimit-reset"));

  if (limit === undefined || remaining === undefined || resetAtSeconds === undefined) {
    return null;
  }

  return {
    limit,
    remaining,
    reset: new Date(resetAtSeconds * 1000),
  };
}

export async function readGitHubErrorMessage(res: Response): Promise<string | undefined> {
  try {
    const data = (await res.clone().json()) as { message?: unknown };
    if (typeof data.message === "string" && data.message.trim().length > 0) {
      return data.message.trim();
    }
  } catch {}

  try {
    const text = (await res.clone().text()).trim();
    return text.length > 0 ? text : undefined;
  } catch {
    return undefined;
  }
}

export function shouldRetryUnauthenticated(res: Response, detail: string | undefined): boolean {
  if (res.status === 401) {
    return true;
  }

  if (res.status !== 403) {
    return false;
  }

  const lower = detail?.toLowerCase();
  if (!lower) {
    return false;
  }

  return (
    lower.includes("resource not accessible by personal access token") ||
    lower.includes("personal access token") ||
    lower.includes("bad credentials")
  );
}

export function stripAuthorization(headers: Record<string, string>): Record<string, string> {
  const nextHeaders = { ...headers };
  delete nextHeaders.Authorization;
  return nextHeaders;
}

export function toGitHubApiError(
  res: Response,
  path: string,
  detail?: string,
  options?: {
    isRetryable?: boolean;
    rateLimitKind?: GitHubRateLimitKind;
    retryAt?: number;
  },
): GitHubApiError {
  if (isRateLimitResponse(res, detail)) {
    return new GitHubApiError({
      code: "EACCES",
      githubMessage: detail,
      isRetryable: true,
      kind: "rate_limit",
      message: buildRateLimitMessage(path, options?.retryAt),
      path,
      rateLimitKind: options?.rateLimitKind ?? "unknown",
      retryAt: options?.retryAt,
      status: res.status,
    });
  }

  const input = githubErrorFromStatus(res.status);

  return new GitHubApiError({
    code: input.code,
    githubMessage: detail,
    isRetryable: options?.isRetryable ?? input.isRetryable,
    kind: input.kind,
    message: input.message(path, res.status),
    path,
    rateLimitKind: options?.rateLimitKind,
    retryAt: options?.retryAt,
    status: res.status,
  });
}

function githubErrorFromStatus(status: number): {
  code: string;
  isRetryable: boolean;
  kind: GitHubErrorKind;
  message(path: string, actualStatus: number): string;
} {
  switch (status) {
    case 404:
      return {
        code: "ENOENT",
        isRetryable: false,
        kind: "not_found",
        message: (path) => `No such file or directory: ${path}`,
      };
    case 401:
      return {
        code: "EACCES",
        isRetryable: false,
        kind: "auth",
        message: (path) => `Authentication required: ${path}`,
      };
    case 403:
      return {
        code: "EACCES",
        isRetryable: false,
        kind: "permission",
        message: (path) => `Permission denied: ${path}`,
      };
    case 409:
      return {
        code: "EIO",
        isRetryable: true,
        kind: "conflict",
        message: (path, actualStatus) => `GitHub API conflict (${actualStatus}): ${path}`,
      };
    case 422:
      return {
        code: "EINVAL",
        isRetryable: false,
        kind: "validation",
        message: (path, actualStatus) => `GitHub API validation error (${actualStatus}): ${path}`,
      };
    default:
      return {
        code: "EIO",
        isRetryable: false,
        kind: "unknown",
        message: (path, actualStatus) => `GitHub API error (${actualStatus}): ${path}`,
      };
  }
}

function isRateLimitResponse(res: Response, detail: string | undefined): boolean {
  if (res.status === 429) {
    return true;
  }

  if (res.status !== 403) {
    return false;
  }

  return detail?.toLowerCase().includes("rate limit") === true;
}

function buildRateLimitMessage(path: string, retryAt: number | undefined): string {
  if (!retryAt) {
    return `GitHub API rate limit exceeded: ${path}`;
  }

  return `GitHub API rate limit exceeded (retry after ${new Date(retryAt).toLocaleTimeString()}): ${path}`;
}

function kindFromLegacyCode(code: string): GitHubErrorKind {
  switch (code) {
    case "ENOENT":
      return "not_found";
    case "EACCES":
      return "permission";
    case "EINVAL":
      return "validation";
    case "EFBIG":
    case "EISDIR":
    case "ENOTDIR":
    case "ENOTSUP":
      return "unsupported";
    default:
      return "unknown";
  }
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
