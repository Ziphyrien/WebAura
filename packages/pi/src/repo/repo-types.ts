import type { Bash, BashExecResult } from "just-bash/browser";
import type { GitHubFs } from "@gitaura/just-github/github-fs";
import type { ResolvedRepoSource } from "@gitaura/db";

export interface RepoRuntime {
  bash: Bash;
  fs: GitHubFs;
  getCwd(): string;
  getWarnings(): string[];
  refresh(): void;
  setCwd(next: string): void;
  source: ResolvedRepoSource;
}

export interface RepoExecResult extends BashExecResult {
  cwd: string;
}
