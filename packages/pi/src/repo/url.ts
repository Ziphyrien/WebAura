import type { ResolvedRepoSource } from "@gitinspect/db/storage-types";

function buildRepoPathname(owner: string, repo: string, ref?: string): string {
  const encodedOwner = encodeURIComponent(owner.trim());
  const encodedRepo = encodeURIComponent(repo.trim());
  const encodedRef = ref
    ?.trim()
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return encodedRef
    ? `/${encodedOwner}/${encodedRepo}/${encodedRef}`
    : `/${encodedOwner}/${encodedRepo}`;
}

export function repoSourceToPath(
  source: Pick<ResolvedRepoSource, "owner" | "repo" | "ref" | "refOrigin">,
): string {
  return buildRepoPathname(
    source.owner,
    source.repo,
    source.refOrigin === "default" ? undefined : source.ref,
  );
}

export function githubOwnerAvatarUrl(owner: string): string {
  return `https://github.com/${encodeURIComponent(owner)}.png`;
}
