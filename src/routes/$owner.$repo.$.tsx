import { createFileRoute } from "@tanstack/react-router"
import type { RepoTarget } from "@/types/storage"
import { Chat } from "@/components/chat"
import { resolveRepoTarget } from "@/repo/ref-resolver"
import {
  parseRepoPathname,
  parsedPathToRepoTarget,
} from "@/repo/url"

type RepoSplatSearch = {
  q?: string
}

export const Route = createFileRoute("/$owner/$repo/$")({
  loader: async ({ params }) => {
    const rawRef = decodePathFragment(params._splat ?? "")
    const repoTarget: RepoTarget =
      rawRef.startsWith("blob/") ||
      rawRef.startsWith("commit/") ||
      rawRef.startsWith("tree/")
        ? (() => {
            const parsed = parseRepoPathname(
              `/${params.owner}/${params.repo}/${rawRef}`
            )

            return parsed
              ? parsedPathToRepoTarget(parsed)
              : {
                  owner: params.owner,
                  ref: rawRef,
                  repo: params.repo,
                }
          })()
        : {
            owner: params.owner,
            ref: rawRef,
            repo: params.repo,
          }

    return await resolveRepoTarget(repoTarget)
  },
  validateSearch: (search: RepoSplatSearch) => ({
    q:
      typeof search.q === "string" && search.q.trim().length > 0
        ? search.q
        : undefined,
  }),
  component: RepoChatRoute,
})

function RepoChatRoute() {
  const repoSource = Route.useLoaderData()

  return <Chat repoSource={repoSource} />
}

function decodePathFragment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
