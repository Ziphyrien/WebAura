import { Type } from "typebox";
import {
  appendQuery,
  decodeBase64Text,
  encodeRepoPath,
  getSearchEndpoint,
  githubRequest,
  normalizeRepo,
  parseJsonInput,
  parseQueryJson,
  stringifyForTool,
  toJsonValue,
} from "./client";
import { getGithubPersonalAccessToken } from "./token";
import { GITHUB_EXTENSION_DEFAULT_ENABLED, githubExtensionManifest } from "./manifest";
import type { JsonValue } from "@webaura/pi/types/common";
import type { WebAuraExtension } from "@webaura/pi/extensions/types";

type RepoOperation = "branches" | "contents" | "get" | "read" | "readme" | "tags";
type SearchType = "code" | "issues" | "prs" | "repos" | "users";

const HttpMethod = Type.Union([
  Type.Literal("GET"),
  Type.Literal("POST"),
  Type.Literal("PUT"),
  Type.Literal("PATCH"),
  Type.Literal("DELETE"),
]);

const SearchTypeSchema = Type.Union([
  Type.Literal("code"),
  Type.Literal("issues"),
  Type.Literal("prs"),
  Type.Literal("repos"),
  Type.Literal("users"),
]);

const RepoOperationSchema = Type.Union([
  Type.Literal("get"),
  Type.Literal("readme"),
  Type.Literal("read"),
  Type.Literal("contents"),
  Type.Literal("branches"),
  Type.Literal("tags"),
]);

function clampInteger(
  value: number | undefined,
  defaultValue: number,
  min: number,
  max: number,
): number {
  const next = Math.floor(value ?? defaultValue);
  return Math.min(Math.max(next, min), max);
}

function toolResult(text: string, details: unknown) {
  return {
    content: [{ text, type: "text" as const }],
    details: toJsonValue(details),
  };
}

function oneLine(value: string | null | undefined, fallback = ""): string {
  return (value ?? fallback).replace(/\s+/g, " ").trim();
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n[truncated ${value.length - maxLength} chars]`;
}

function compactJson(value: unknown): string {
  return trimText(stringifyForTool(value), 16_000);
}

function compactRepo(value: unknown) {
  const repo = value as {
    default_branch?: string;
    description?: string | null;
    fork?: boolean;
    forks_count?: number;
    full_name?: string;
    html_url?: string;
    language?: string | null;
    open_issues_count?: number;
    private?: boolean;
    stargazers_count?: number;
    updated_at?: string;
  };

  return {
    defaultBranch: repo.default_branch,
    description: repo.description ?? undefined,
    fork: Boolean(repo.fork),
    forks: repo.forks_count ?? 0,
    fullName: repo.full_name,
    language: repo.language ?? undefined,
    openIssues: repo.open_issues_count ?? 0,
    private: Boolean(repo.private),
    stars: repo.stargazers_count ?? 0,
    updatedAt: repo.updated_at,
    url: repo.html_url,
  };
}

function formatRepo(repo: ReturnType<typeof compactRepo>): string {
  const flags = [repo.private ? "private" : "public", repo.fork ? "fork" : undefined]
    .filter(Boolean)
    .join(",");
  return [
    `${repo.fullName ?? "unknown"}`,
    `branch=${repo.defaultBranch ?? "unknown"}`,
    `stars=${repo.stars}`,
    `forks=${repo.forks}`,
    `issues=${repo.openIssues}`,
    `visibility=${flags}`,
    repo.description ? `desc=${repo.description}` : undefined,
    repo.url,
  ]
    .filter(Boolean)
    .join(" | ");
}

function compactDirectory(value: unknown) {
  if (!Array.isArray(value)) {
    const file = value as {
      html_url?: string;
      name?: string;
      path?: string;
      sha?: string;
      size?: number;
      type?: string;
    };
    return {
      entries: [
        {
          name: file.name,
          path: file.path,
          sha: file.sha,
          size: file.size,
          type: file.type ?? "file",
          url: file.html_url,
        },
      ],
      kind: "file" as const,
    };
  }

  return {
    entries: (value as Array<Record<string, unknown>>).map((entry) => ({
      name: entry.name as string | undefined,
      path: entry.path as string | undefined,
      sha: entry.sha as string | undefined,
      size: entry.size as number | undefined,
      type: entry.type as string | undefined,
      url: entry.html_url as string | undefined,
    })),
    kind: "directory" as const,
  };
}

function formatDirectory(entries: ReturnType<typeof compactDirectory>["entries"]): string[] {
  return entries.map((entry) => {
    const size = typeof entry.size === "number" ? ` ${entry.size}b` : "";
    return `${entry.type ?? "item"} ${entry.path ?? entry.name ?? "unknown"}${size}`;
  });
}

function compactNameList(value: unknown): Array<{ name: string; sha?: string }> {
  return Array.isArray(value)
    ? (value as Array<{ commit?: { sha?: string }; name?: string }>).map((entry) => ({
        name: entry.name ?? "unknown",
        sha: entry.commit?.sha,
      }))
    : [];
}

function formatLineWindow(params: {
  content: string;
  lineNumbers: boolean | undefined;
  limit: number;
  offset: number;
}) {
  const allLines = params.content.split(/\r?\n/);
  const startIndex = Math.max(params.offset - 1, 0);
  const lines = allLines.slice(startIndex, startIndex + params.limit);
  const rendered = params.lineNumbers
    ? lines.map((line, index) => `${params.offset + index}: ${line}`).join("\n")
    : lines.join("\n");
  const endLine = lines.length > 0 ? params.offset + lines.length - 1 : params.offset;
  const nextOffset = endLine < allLines.length ? endLine + 1 : undefined;

  return {
    count: lines.length,
    endLine,
    limit: params.limit,
    nextOffset,
    offset: params.offset,
    rendered,
    totalLines: allLines.length,
    truncated: nextOffset !== undefined,
  };
}

function compactSearchItem(type: SearchType, item: Record<string, unknown>) {
  if (type === "repos") {
    return {
      description: item.description as string | null | undefined,
      fullName: item.full_name as string | undefined,
      language: item.language as string | null | undefined,
      stars: item.stargazers_count as number | undefined,
      url: item.html_url as string | undefined,
    };
  }

  if (type === "users") {
    return {
      login: item.login as string | undefined,
      type: item.type as string | undefined,
      url: item.html_url as string | undefined,
    };
  }

  if (type === "code") {
    const repository = item.repository as { full_name?: string } | undefined;
    return {
      path: item.path as string | undefined,
      repo: repository?.full_name,
      sha: item.sha as string | undefined,
      url: item.html_url as string | undefined,
    };
  }

  return {
    number: item.number as number | undefined,
    repo: (item.repository_url as string | undefined)?.replace("https://api.github.com/repos/", ""),
    state: item.state as string | undefined,
    title: item.title as string | undefined,
    url: item.html_url as string | undefined,
  };
}

function formatSearchItem(type: SearchType, item: ReturnType<typeof compactSearchItem>): string {
  if (type === "repos") {
    const repo = item as ReturnType<typeof compactSearchItem> & {
      description?: string | null;
      fullName?: string;
      language?: string | null;
      stars?: number;
    };
    const desc = oneLine(repo.description, "");
    return `${repo.fullName ?? "unknown"} ★${repo.stars ?? 0}${repo.language ? ` ${repo.language}` : ""}${desc ? ` — ${desc}` : ""}`;
  }

  if (type === "users") {
    const user = item as ReturnType<typeof compactSearchItem> & { login?: string; type?: string };
    return `${user.login ?? "unknown"} ${user.type ?? "user"}`;
  }

  if (type === "code") {
    const code = item as ReturnType<typeof compactSearchItem> & { path?: string; repo?: string };
    return `${code.repo ?? "unknown"}/${code.path ?? "unknown"}`;
  }

  const issue = item as ReturnType<typeof compactSearchItem> & {
    number?: number;
    repo?: string;
    state?: string;
    title?: string;
  };
  return `${issue.repo ?? "unknown"}#${issue.number ?? "?"} ${issue.state ?? "?"} ${oneLine(issue.title, "Untitled")}`;
}

function compactSearchResponse(type: SearchType, value: unknown) {
  const body = value as {
    incomplete_results?: boolean;
    items?: Array<Record<string, unknown>>;
    total_count?: number;
  };
  const items = (body.items ?? []).map((item) => compactSearchItem(type, item));

  return {
    incomplete: Boolean(body.incomplete_results),
    items,
    returned: items.length,
    total: body.total_count ?? 0,
  };
}

function assertMutationAllowed(params: {
  confirmMutation: boolean | undefined;
  isMutation: boolean;
}): void {
  if (!params.isMutation || params.confirmMutation) {
    return;
  }

  throw new Error("Non-read GitHub API calls require confirmMutation=true.");
}

function formatReadOutput(params: {
  content: string;
  nextOffset?: number;
  path: string;
  repo: string;
  window: ReturnType<typeof formatLineWindow>;
}): string {
  const continuation = params.nextOffset ? ` nextOffset=${params.nextOffset}` : "";
  return `${params.repo} ${params.path} lines ${params.window.offset}-${params.window.endLine}/${params.window.totalLines}${continuation}\n${params.content}`;
}

export const githubExtension: WebAuraExtension = {
  defaultEnabled: GITHUB_EXTENSION_DEFAULT_ENABLED,
  manifest: githubExtensionManifest,
  register(api) {
    api.registerTool({
      description: "GitHub auth status.",
      label: "GitHub Status",
      name: "github_status",
      parameters: Type.Object({}),
      async execute() {
        const authenticated = Boolean(await getGithubPersonalAccessToken());
        return toolResult(`authenticated=${authenticated} host=github.com`, {
          authenticated,
          host: "github.com",
        });
      },
    });

    api.registerTool({
      description: "GitHub repo metadata, README, directories, branches, tags, or file lines.",
      label: "GitHub Repository",
      name: "github_repo",
      parameters: Type.Object({
        lineNumbers: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number()),
        offset: Type.Optional(Type.Number()),
        operation: RepoOperationSchema,
        page: Type.Optional(Type.Number()),
        path: Type.Optional(Type.String()),
        ref: Type.Optional(Type.String()),
        repo: Type.String(),
      }),
      async execute(_toolCallId, params) {
        const repo = normalizeRepo(params.repo);
        const operation = params.operation as RepoOperation;
        const perPage = clampInteger(params.limit, 20, 1, 100);
        const page = clampInteger(params.page, 1, 1, 100);

        switch (operation) {
          case "branches": {
            const response = await githubRequest(
              appendQuery(`/repos/${repo}/branches`, { page, per_page: perPage }),
            );
            const branches = compactNameList(response);
            return toolResult(
              `${repo} branches page=${page} returned=${branches.length}\n${branches.map((branch) => branch.name).join("\n")}`,
              { branches, page, repo },
            );
          }
          case "contents": {
            const response = await githubRequest(
              appendQuery(`/repos/${repo}/contents/${encodeRepoPath(params.path)}`, {
                ref: params.ref,
              }),
            );
            const contents = compactDirectory(response);
            const path = params.path?.trim() || "/";
            return toolResult(
              `${repo} ${path} ${contents.kind} entries=${contents.entries.length}\n${formatDirectory(contents.entries).join("\n")}`,
              { ...contents, path, ref: params.ref, repo },
            );
          }
          case "get": {
            const response = await githubRequest(`/repos/${repo}`);
            const compact = compactRepo(response);
            return toolResult(formatRepo(compact), compact);
          }
          case "read": {
            if (!params.path?.trim()) {
              throw new Error("path is required for operation=read");
            }

            const response = await githubRequest(
              appendQuery(`/repos/${repo}/contents/${encodeRepoPath(params.path)}`, {
                ref: params.ref,
              }),
            );

            if (Array.isArray(response)) {
              throw new Error("Path points to a directory; use operation=contents instead");
            }

            const file = response as {
              content?: string;
              encoding?: string;
              html_url?: string;
              name?: string;
              path?: string;
              sha?: string;
            };

            if (file.encoding !== "base64" || typeof file.content !== "string") {
              throw new Error("GitHub response did not include base64 file content");
            }

            const limit = clampInteger(params.limit, 200, 1, 2_000);
            const offset = clampInteger(params.offset, 1, 1, Number.MAX_SAFE_INTEGER);
            const window = formatLineWindow({
              content: decodeBase64Text(file.content),
              lineNumbers: params.lineNumbers,
              limit,
              offset,
            });
            const path = file.path ?? params.path;

            return toolResult(
              formatReadOutput({
                content: window.rendered,
                nextOffset: window.nextOffset,
                path,
                repo,
                window,
              }),
              {
                content: window.rendered,
                file: {
                  name: file.name,
                  path,
                  sha: file.sha,
                  url: file.html_url,
                },
                lines: {
                  count: window.count,
                  endLine: window.endLine,
                  limit: window.limit,
                  nextOffset: window.nextOffset,
                  offset: window.offset,
                  totalLines: window.totalLines,
                  truncated: window.truncated,
                },
                ref: params.ref,
                repo,
              },
            );
          }
          case "readme": {
            const response = (await githubRequest(
              appendQuery(`/repos/${repo}/readme`, { ref: params.ref }),
            )) as {
              content?: string;
              encoding?: string;
              html_url?: string;
              name?: string;
              path?: string;
              sha?: string;
            };

            if (response.encoding !== "base64" || typeof response.content !== "string") {
              throw new Error("GitHub response did not include base64 README content");
            }

            const limit = clampInteger(params.limit, 400, 1, 2_000);
            const offset = clampInteger(params.offset, 1, 1, Number.MAX_SAFE_INTEGER);
            const window = formatLineWindow({
              content: decodeBase64Text(response.content),
              lineNumbers: params.lineNumbers,
              limit,
              offset,
            });
            const path = response.path ?? response.name ?? "README";

            return toolResult(
              formatReadOutput({
                content: window.rendered,
                nextOffset: window.nextOffset,
                path,
                repo,
                window,
              }),
              {
                content: window.rendered,
                file: {
                  name: response.name,
                  path,
                  sha: response.sha,
                  url: response.html_url,
                },
                lines: {
                  count: window.count,
                  endLine: window.endLine,
                  limit: window.limit,
                  nextOffset: window.nextOffset,
                  offset: window.offset,
                  totalLines: window.totalLines,
                  truncated: window.truncated,
                },
                ref: params.ref,
                repo,
              },
            );
          }
          case "tags": {
            const response = await githubRequest(
              appendQuery(`/repos/${repo}/tags`, { page, per_page: perPage }),
            );
            const tags = compactNameList(response);
            return toolResult(
              `${repo} tags page=${page} returned=${tags.length}\n${tags.map((tag) => tag.name).join("\n")}`,
              { page, repo, tags },
            );
          }
        }
      },
    });

    api.registerTool({
      description: "GitHub search for repos, users, issues, PRs, or code.",
      label: "GitHub Search",
      name: "github_search",
      parameters: Type.Object({
        limit: Type.Optional(Type.Number()),
        page: Type.Optional(Type.Number()),
        query: Type.String(),
        repo: Type.Optional(Type.String()),
        type: SearchTypeSchema,
      }),
      async execute(_toolCallId, params) {
        const type = params.type as SearchType;
        const limit = clampInteger(params.limit, 10, 1, 100);
        const page = clampInteger(params.page, 1, 1, 100);
        const scopedRepo = params.repo ? ` repo:${normalizeRepo(params.repo)}` : "";
        const query = `${params.query}${scopedRepo}${type === "prs" ? " is:pr" : ""}`.trim();
        const endpoint = getSearchEndpoint(type);
        const response = await githubRequest(
          appendQuery(`/search/${endpoint}`, {
            page,
            per_page: limit,
            q: query,
          }),
        );
        const compact = compactSearchResponse(type, response);
        const lines = compact.items.map((item) => formatSearchItem(type, item));

        return toolResult(
          `${type} query=${JSON.stringify(query)} page=${page} total=${compact.total} returned=${compact.returned} incomplete=${compact.incomplete}\n${lines.join("\n")}`,
          {
            endpoint: `/search/${endpoint}`,
            page,
            query,
            type,
            ...compact,
          },
        );
      },
    });

    api.registerTool({
      description: "Raw GitHub REST/GraphQL. Mutations require confirmMutation=true.",
      label: "GitHub API",
      name: "github_api",
      parameters: Type.Object({
        bodyJson: Type.Optional(Type.String()),
        confirmMutation: Type.Optional(Type.Boolean()),
        graphqlQuery: Type.Optional(Type.String()),
        method: Type.Optional(HttpMethod),
        operation: Type.Union([Type.Literal("rest"), Type.Literal("graphql")]),
        path: Type.Optional(Type.String()),
        queryJson: Type.Optional(Type.String()),
        variablesJson: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        let response: unknown;
        let request: Record<string, JsonValue>;

        if (params.operation === "graphql") {
          const query = params.graphqlQuery?.trim();

          if (!query) {
            throw new Error("graphqlQuery is required for GraphQL requests");
          }

          assertMutationAllowed({
            confirmMutation: params.confirmMutation,
            isMutation: /^\s*mutation\b/i.test(query),
          });
          response = await githubRequest("/graphql", {
            body: JSON.stringify({
              query,
              variables: parseJsonInput(params.variablesJson, "variablesJson") ?? {},
            }),
            method: "POST",
          });
          request = {
            method: "POST",
            operation: "graphql",
            path: "/graphql",
          };
        } else {
          const path = params.path?.trim();

          if (!path) {
            throw new Error("path is required for REST requests");
          }

          const query = parseQueryJson(params.queryJson);
          const body = parseJsonInput(params.bodyJson, "bodyJson");
          const method = params.method ?? (body === undefined ? "GET" : "POST");
          assertMutationAllowed({
            confirmMutation: params.confirmMutation,
            isMutation: method !== "GET",
          });
          const resolvedPath = query ? appendQuery(path, query) : path;
          response = await githubRequest(resolvedPath, {
            body: body === undefined ? undefined : JSON.stringify(body),
            method,
          });
          request = {
            method,
            operation: "rest",
            path: resolvedPath,
          };
        }

        return toolResult(`${request.method} ${request.path}\n${compactJson(response)}`, {
          request,
          responsePreview: toJsonValue(compactJson(response)),
        });
      },
    });
  },
};
