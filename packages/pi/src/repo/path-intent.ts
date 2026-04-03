import type {
  RepoRefOrigin,
  ResolvedRepoRef,
  ResolvedRepoSource,
} from "@gitinspect/db/storage-types";

export type RepoPathIntent =
  | {
      type: "repo-root";
      owner: string;
      repo: string;
      token?: string;
    }
  | {
      type: "shorthand-ref";
      owner: string;
      repo: string;
      rawRef: string;
      token?: string;
    }
  | {
      type: "commit-page";
      owner: string;
      repo: string;
      sha: string;
      token?: string;
    }
  | {
      type: "tree-page";
      owner: string;
      repo: string;
      tail: string;
      token?: string;
    }
  | {
      type: "blob-page";
      owner: string;
      repo: string;
      tail: string;
      token?: string;
    }
  | {
      type: "unsupported-repo-page";
      owner: string;
      repo: string;
      page: string;
      token?: string;
    }
  | {
      type: "invalid";
      reason: string;
    };

export type ResolvedRepoLocation = {
  owner: string;
  repo: string;
  refOrigin: RepoRefOrigin;
  resolvedRef: ResolvedRepoRef;
  ref: string;
  fallbackReason?: "unsupported-page";
  view: "repo" | "tree" | "blob";
  subpath?: string;
  token?: string;
};

export function toResolvedRepoSource(location: ResolvedRepoLocation): ResolvedRepoSource {
  return {
    owner: location.owner,
    ref: location.ref,
    refOrigin: location.refOrigin,
    repo: location.repo,
    resolvedRef: location.resolvedRef,
    token: location.token,
  };
}
