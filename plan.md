# Repo Path Resolution Refactor Plan

Status: completed
Owner: Jeremy + agent
Goal: replace the current implicit repo path parsing flow with a small FSM-based design that is simpler, more explicit, and easier to test.

---

## 0. Decisions locked in for this implementation pass

These choices are now part of the implementation contract for this plan.

- [x] **Host scope:** A — GitHub.com only.
- [x] **Fallback policy:** A — unsupported GitHub repo pages fallback to repo root; explicit missing refs error.
- [x] **Library boundary:** A — URL parsing/resolution stays in `packages/pi/src/repo/*`.
- [x] **`tree/blob` parser contract:** B — parser always emits full page intent with full tail.
- [x] **Branch vs tag precedence:** A — branch first.
- [x] **`subpath` handling:** A — keep internally only.
- [x] **Search-box input forms:** A+B+C+D+E — support shorthand, no-scheme URL, full URL, `tree/blob/commit` URL, and `.git` URL.
- [x] **Route responsibility:** A — route only decodes params, then calls parser + resolver.
- [x] **Precedence source of truth:** A — keep current branch-first behavior.

### Note on canonical route policy

The repo-entry route only matters until the first message. After that the product collapses into `/chat/$sessionId` anyway. So canonical repo-route fidelity is a lower-stakes decision than parser correctness. Unless we explicitly need shareable pre-chat deep links to preserve `tree/blob`, we should optimize for simpler working code.

---

## 0.1 Detailed implementation checklist

### Phase 1 — types and contracts

- [x] Create `packages/pi/src/repo/path-intent.ts`.
- [x] Define `RepoPathIntent` with `type` as the discriminant.
- [x] Define `ResolvedRepoLocation` for resolver output.
- [x] Add `toResolvedRepoSource()` adapter.
- [x] Keep `ResolvedRepoRef` and persisted `ResolvedRepoSource` shape unchanged for now.

### Phase 2 — syntax parser

- [x] Create `packages/pi/src/repo/path-parser.ts`.
- [x] Implement `parseRepoRoutePath()` as a pure syntax parser.
- [x] Support GitHub-only route parsing for repo root, shorthand ref, `tree`, `blob`, `commit`, and unsupported repo pages.
- [x] Emit `{ type: "invalid" }` instead of `undefined` for invalid parse states.
- [x] Implement `parseRepoInput()` for search-box inputs.
- [x] Support `owner/repo`, `github.com/owner/repo`, full `https://github.com/...` URLs, full `tree/blob/commit` URLs, and `.git` URLs.
- [x] Reject non-GitHub hosts explicitly.
- [x] Remove `refPathTail` from parser-facing contracts.

### Phase 3 — semantic resolver

- [x] Rewrite resolver entrypoint to `resolveRepoIntent()`.
- [x] Separate exact ref resolution from `tree/blob` tail resolution.
- [x] Keep branch-first precedence when branch/tag names collide.
- [x] Resolve repo-root intents via default branch lookup.
- [x] Resolve shorthand refs via exact branch/tag/commit lookup.
- [x] Resolve `tree/blob` intents via longest-prefix ref matching.
- [x] Preserve leftover `subpath` internally.
- [x] Fallback unsupported repo pages to root with `fallbackReason`.
- [x] Throw explicit errors for invalid input and explicit missing refs.

### Phase 4 — route + UI integration

- [x] Remove route-level `startsWith("tree/") / startsWith("blob/") / startsWith("commit/")` logic.
- [x] Update `apps/web/src/routes/$owner.$repo.$.tsx` to call parser + resolver only.
- [x] Update repo-entry flows in search-box / landing-page / combobox to use parser + resolver.
- [x] Codify canonical pre-first-turn repo-route policy (working default: collapse `tree/blob` entries to shorthand repo-ref routes).
- [x] Keep working code over migration niceness: delete old code paths as soon as replacement callers are green.

### Phase 5 — migration and compatibility

- [x] Keep compatibility adapters only when they materially shorten time-to-green.
- [x] If direct call-site replacement is faster, do the direct replacement and skip temporary sugar.
- [x] Remove old wrappers once parser/resolver tests and route tests are green.
- [x] Remove `RepoTarget.refPathTail` after all callers are migrated.

### Phase 6 — tests

- [x] Replace parser tests so they assert explicit intent `type` states.
- [x] Add a matrix test for all supported input forms.
- [x] Add tests for unsupported-page fallback.
- [x] Add tests for explicit missing-ref errors.
- [x] Add tests for encoded tails and slash refs.
- [x] Add tests for branch-first precedence.
- [x] Simplify route tests so they verify composition, not parser internals.

### Phase 7 — cleanup

- [x] Delete dead parse helpers and wrappers.
- [x] Reduce `packages/pi/src/repo/url.ts` to serialization-only responsibilities.
- [x] Keep parser semantics out of `just-github`.
- [x] Document final parser/resolver contract in code comments and tests.

---

## 1. Why this refactor exists

Today repo path resolution is split across multiple places:

- `packages/pi/src/repo/parse.ts`
- `packages/pi/src/repo/url.ts`
- `packages/pi/src/repo/ref-resolver.ts`
- `apps/web/src/routes/$owner.$repo.$.tsx`

The same decision is being made in multiple layers.

### Current duplication

`apps/web/src/routes/$owner.$repo.$.tsx`

```tsx
const repoTarget: RepoTarget =
  rawRef.startsWith("blob/") || rawRef.startsWith("commit/") || rawRef.startsWith("tree/")
    ? (() => {
        const parsed = parseRepoPathname(`/${params.owner}/${params.repo}/${rawRef}`);
        return parsed
          ? parsedPathToRepoTarget(parsed)
          : { owner: params.owner, ref: rawRef, repo: params.repo };
      })()
    : {
        owner: params.owner,
        ref: rawRef,
        repo: params.repo,
      };
```

`packages/pi/src/repo/parse.ts`

```ts
export function parseRepoQuery(raw: string): RepoTarget | undefined {
  const slash = raw.trim().split("/").filter(Boolean);

  if (slash.length === 2 && !raw.includes(" ") && !raw.startsWith("http")) {
    const parsed = parseRepoPathname(`/${slash[0]}/${slash[1]}`);
    return parsed ? parsedPathToRepoTarget(parsed) : undefined;
  }

  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!url.hostname.endsWith("github.com")) {
    return undefined;
  }

  const parsed = parseRepoPathname(url.pathname);
  return parsed ? parsedPathToRepoTarget(parsed) : undefined;
}
```

`packages/pi/src/repo/url.ts`

```ts
export interface ParsedRepoPath {
  owner: string;
  ref?: string;
  refPathTail?: string;
  repo: string;
}
```

`packages/db/src/storage-types.ts`

```ts
export interface RepoTarget {
  owner: string;
  repo: string;
  ref?: string;
  refPathTail?: string;
  token?: string;
}
```

### Core problem

`RepoTarget` is encoding multiple states implicitly:

- repo root
- explicit shorthand ref
- `tree/...` page
- `blob/...` page
- `commit/...` page
- unsupported page fallback
- invalid input

That is exactly where bugs come from.

### Evidence of semantic drift

Current test expectation and implementation are already out of sync.

`tests/repo-url.test.ts`

```ts
expect(parseRepoPathname("/vercel/next.js/blob/main/README.md")).toEqual({
  owner: "vercel",
  ref: "main",
  repo: "next.js",
});
```

Current implementation returns `refPathTail: "main/README.md"` instead.

This means the parse contract is muddy.

---

## 2. First-principles design

We want two machines, not one blob of conditional logic.

## Machine A: syntax parser

Input:

- route path
- search box input
- pasted URL

Output:

- explicit intent only
- no network
- no ref resolution
- no fallback side effects

## Machine B: semantic resolver

Input:

- parsed intent

Output:

- resolved repo location
- fallback reason when relevant
- canonical `ResolvedRepoSource`

---

## 3. Product scope decisions

These decisions keep the system simple.

### 3.1 GitHub-only

We should stay GitHub-only for this product.

Reason:

- current product is GitHub-centric
- current UI/runtime assumes GitHub APIs
- gitingest multi-host support is useful, but out of scope here
- bringing in GitLab/Bitbucket/Gitea rules increases state count with no product value

#### Alignment question — host scope

Choose one:

- **A. GitHub.com only**
  - Pros: smallest FSM, least branching, easiest to test, matches current product.
  - Cons: rejects GitHub Enterprise / custom domains.
- **B. GitHub.com + GitHub Enterprise**
  - Pros: broader real-world usefulness, still GitHub API-shaped.
  - Cons: needs explicit host policy; heuristics get messy fast.
- **C. Multi-host like gitingest**
  - Pros: maximum URL compatibility.
  - Cons: much larger state space, lower confidence, little current product value.

**Chosen: A — GitHub.com only.**

### 3.2 Explicit fallback policy

We should only fallback to repo root for unsupported GitHub repo pages.

Examples:

- `/issues/123`
- `/pull/123`
- `/actions`
- `/releases`

We should **not** fallback for explicit ref failures.

Examples:

- `/owner/repo/not-a-real-ref`
- `/owner/repo/commit/not-a-real-sha`
- `/owner/repo/tree/not-a-real-ref/path`

Why:

- unsupported page means “user navigated a GitHub page we don’t model yet”
- explicit ref failure means “user asked for a specific thing and it does not exist”

#### Alignment question — fallback policy

Choose one:

- **A. Unsupported page => root fallback. Explicit missing ref => hard error**
  - Pros: simplest mental model, truthful, avoids hiding bad refs.
  - Cons: more visible errors for typoed refs.
- **B. Everything falls back to root**
  - Pros: soft UX, fewer visible failures.
  - Cons: hides real errors, makes debugging/path reasoning worse.
- **C. Everything errors**
  - Pros: maximal truth, least hidden behavior.
  - Cons: worse UX for normal GitHub pages like issues or releases.

**Chosen: A — unsupported pages fallback to root; explicit missing refs error.**

### 3.3 Keep URL semantics outside `just-github`

`just-github` / `lib/github` should stay filesystem/API only.

Path parsing belongs in app/runtime code, not the GitHub FS client.

#### Alignment question — library boundary

Choose one:

- **A. Keep URL parsing/resolution in `packages/pi/src/repo/*`**
  - Pros: clean separation, fewer responsibilities inside GitHub FS layer, easier future replacement.
  - Cons: one extra adapter layer.
- **B. Move URL semantics into `just-github`-style GitHub layer**
  - Pros: fewer top-level files.
  - Cons: mixes product URL semantics with filesystem concerns; harder to reuse.

**Chosen: A — keep URL parsing/resolution in `packages/pi/src/repo/*`.**

---

## 4. Target FSM model

## 4.1 Syntax states

```ts
type RepoPathIntent =
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
```

Key point:

- remove `refPathTail` from public parse state
- parser should say what type of thing it saw, not partially resolve it

#### Alignment question — parser contract for `tree/blob`

Choose one:

- **A. Keep mixed output (`ref` sometimes, tail sometimes)**
  - Pros: smaller immediate diff.
  - Cons: current source of drift; hidden semantics; harder to reason about.
- **B. Always emit full `tree-page/blob-page` intent with full `tail`**
  - Pros: regular FSM, syntax-only parser, fewer special cases.
  - Cons: resolver has to do a bit more work later.

**Chosen: B — always emit full page intent with full tail.**

## 4.2 Resolver output state

```ts
type ResolvedRepoLocation = {
  owner: string;
  repo: string;
  refOrigin: "default" | "explicit";
  resolvedRef: ResolvedRepoRef;
  ref: string;
  fallbackReason?: "unsupported-page";
  view: "repo" | "tree" | "blob";
  subpath?: string;
  token?: string;
};
```

App projection:

```ts
function toResolvedRepoSource(location: ResolvedRepoLocation): ResolvedRepoSource {
  return {
    owner: location.owner,
    ref: location.ref,
    refOrigin: location.refOrigin,
    repo: location.repo,
    resolvedRef: location.resolvedRef,
    token: location.token,
  };
}
```

If `view` and `subpath` are not needed for v0 UI, they can remain internal to resolver results only.

---

## 5. State transition table

## 5.1 Syntax parser transitions

| Input shape                                | Output intent                              | Notes                        |
| ------------------------------------------ | ------------------------------------------ | ---------------------------- |
| `owner/repo`                               | `repo-root`                                | GitHub shorthand             |
| `github.com/owner/repo`                    | `repo-root`                                | no scheme                    |
| `https://github.com/owner/repo`            | `repo-root`                                | full URL                     |
| `https://github.com/owner/repo/branchName` | `shorthand-ref`                            | single-segment shorthand ref |
| `/owner/repo/tree/main`                    | `tree-page` with `tail: "main"`            | parser does not resolve      |
| `/owner/repo/tree/feature/foo/src`         | `tree-page` with `tail: "feature/foo/src"` | slash ref handled later      |
| `/owner/repo/blob/main/README.md`          | `blob-page` with `tail: "main/README.md"`  | same rule as tree            |
| `/owner/repo/commit/<sha>`                 | `commit-page`                              | exact intent                 |
| `/owner/repo/issues/1`                     | `unsupported-repo-page`                    | fallback candidate           |
| invalid owner/repo shape                   | `invalid`                                  | hard error later             |

## 5.2 Resolver transitions

| Intent type             | Resolution behavior                                                  |
| ----------------------- | -------------------------------------------------------------------- |
| `repo-root`             | resolve default branch / HEAD                                        |
| `shorthand-ref`         | resolve exact ref as branch/tag/commit                               |
| `commit-page`           | verify commit exists                                                 |
| `tree-page`             | resolve longest matching ref from `tail`, leftover becomes `subpath` |
| `blob-page`             | resolve longest matching ref from `tail`, leftover becomes `subpath` |
| `unsupported-repo-page` | fallback to root, attach `fallbackReason: "unsupported-page"`        |
| `invalid`               | throw validation error                                               |

---

## 6. Desired behavior per state

## 6.1 `repo-root`

Input examples:

- `acme/demo`
- `https://github.com/acme/demo`
- `/acme/demo`

Behavior:

- fetch repo metadata
- resolve default branch
- produce:
  - `refOrigin: "default"`
  - `view: "repo"`

## 6.2 `shorthand-ref`

Input examples:

- `/acme/demo/canary`
- `/acme/demo/v1.2.3`
- `/acme/demo/012345...`

Behavior:

- branch lookup
- tag lookup
- commit lookup
- precedence must be explicit and tested

Recommendation:

- add a product decision section in tests
- do not guess forever

#### Alignment question — branch vs tag precedence

Choose one when names collide:

- **A. Branch first**
  - Pros: matches current app behavior, likely more intuitive for active development flows.
  - Cons: differs from gitingest’s tag-first policy.
- **B. Tag first**
  - Pros: closer to gitingest; release-oriented refs may feel more stable.
  - Cons: could surprise users expecting branch resolution.
- **C. Verify GitHub UI behavior, then copy it**
  - Pros: most grounded.
  - Cons: slightly more work before implementation.

**Chosen: A — branch first.**

## 6.3 `tree-page`

Input examples:

- `/acme/demo/tree/main`
- `/acme/demo/tree/feature/foo/src/lib`

Behavior:

- resolve longest prefix in `tail` as ref
- leftover becomes `subpath`
- produce `view: "tree"`

Pseudo-code:

```ts
function splitTail(tail: string): string[] {
  return tail
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

async function resolveTailAsRef(
  owner: string,
  repo: string,
  tail: string,
): Promise<{ resolvedRef: ResolvedRepoRef; subpath?: string }> {
  const segments = splitTail(tail);

  for (let index = segments.length; index >= 1; index -= 1) {
    const candidate = segments.slice(0, index).join("/");
    const remaining = segments.slice(index).join("/");

    const branch = await lookupBranch(owner, repo, candidate);
    if (branch) {
      return {
        resolvedRef: createBranchRepoRef(candidate),
        subpath: remaining || undefined,
      };
    }

    const tag = await lookupTag(owner, repo, candidate);
    if (tag) {
      return {
        resolvedRef: createTagRepoRef(candidate),
        subpath: remaining || undefined,
      };
    }
  }

  const first = segments[0];
  if (first && isFullCommitSha(first) && (await lookupCommit(owner, repo, first))) {
    return {
      resolvedRef: createCommitRepoRef(first),
      subpath: segments.slice(1).join("/") || undefined,
    };
  }

  throw new RepoRefNotFoundError(tail);
}
```

## 6.4 `blob-page`

Same as `tree-page`.

Difference:

- output `view: "blob"`
- `subpath` is a file path candidate

Even if chat UI ignores `subpath` in v0, we should preserve it internally.

Reason:

- correctness
- future citations
- future file-focused chat bootstrapping

#### Alignment question — `subpath` handling

Choose one:

- **A. Keep `subpath` internally only**
  - Pros: correctness now, low migration cost, no Dexie/schema churn.
  - Cons: not yet visible in product state.
- **B. Persist `subpath` in stored session/repo state now**
  - Pros: full fidelity, future UI features easier.
  - Cons: more schema and migration work now.
- **C. Drop `subpath` completely**
  - Pros: smallest implementation.
  - Cons: loses information; weaker future support for file-aware UX.

**Chosen: A — keep `subpath` internally only.**

## 6.5 `commit-page`

Input example:

- `/acme/demo/commit/0123456789abcdef0123456789abcdef01234567`

Behavior:

- verify commit exists
- return commit ref
- `view: "repo"`
- no fallback

## 6.6 `unsupported-repo-page`

Input examples:

- `/acme/demo/issues/123`
- `/acme/demo/pull/4`
- `/acme/demo/releases`

Behavior:

- resolve root/default branch
- attach `fallbackReason: "unsupported-page"`
- preserve UX simplicity

## 6.7 `invalid`

Input examples:

- malformed URL
- non-GitHub host
- missing repo segment
- impossible path shape

Behavior:

- throw validation error
- no fallback

---

## 7. File-by-file implementation plan

## Phase 1 — Introduce explicit types

### 7.1 Add new types file

Create:

- `packages/pi/src/repo/path-intent.ts`

```ts
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
  refOrigin: "default" | "explicit";
  resolvedRef: ResolvedRepoRef;
  ref: string;
  fallbackReason?: "unsupported-page";
  view: "repo" | "tree" | "blob";
  subpath?: string;
  token?: string;
};
```

### 7.2 Keep `ResolvedRepoSource` unchanged initially

Do not rewrite Dexie state yet **unless implementation proves it is the fastest path to green**.

Why not by default:

- this FSM refactor is mostly about transient parse + resolve state, not persisted session identity
- the new fields (`type`, `view`, `fallbackReason`) are resolver concerns, not obviously durable state
- we already decided `subpath` stays internal only for now, so a schema migration would mostly add churn without product value
- if a direct Dexie rewrite makes the code materially simpler, we should do it; otherwise keep storage stable and avoid coupling parser bugs with storage migration bugs

Use an adapter.

```ts
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
```

---

## Phase 2 — Rewrite parser as syntax-only

### 8.1 Replace `parseRepoPathname()` contract

Current file:

- `packages/pi/src/repo/url.ts`

New responsibility:

- parse a pathname into `RepoPathIntent`
- no `refPathTail`
- no partial semantic resolution

Suggested API:

```ts
export function parseRepoRoutePath(pathname: string): RepoPathIntent;
```

Suggested implementation sketch:

```ts
const RESERVED_ROOT_SEGMENTS = new Set(["api", "auth", "chat"]);
const UNSUPPORTED_REPO_PAGES = new Set([
  "actions",
  "activity",
  "archive",
  "branches",
  "compare",
  "contributors",
  "discussions",
  "forks",
  "graphs",
  "insights",
  "issues",
  "labels",
  "milestones",
  "network",
  "packages",
  "projects",
  "pull",
  "pulls",
  "pulse",
  "releases",
  "search",
  "security",
  "settings",
  "stargazers",
  "tags",
  "watchers",
  "wiki",
]);

export function parseRepoRoutePath(pathname: string): RepoPathIntent {
  const segments = pathname
    .trim()
    .split("/")
    .map((segment) => decodePathSegment(segment.trim()))
    .filter(Boolean);

  if (segments.length < 2) {
    return { type: "invalid", reason: "Missing owner/repo" };
  }

  const owner = segments[0];
  const repo = stripDotGit(segments[1]);

  if (!owner || !repo) {
    return { type: "invalid", reason: "Missing owner or repo" };
  }

  if (RESERVED_ROOT_SEGMENTS.has(owner)) {
    return { type: "invalid", reason: `Reserved root path: ${owner}` };
  }

  if (segments.length === 2) {
    return { type: "repo-root", owner, repo };
  }

  const third = segments[2];

  if (third === "tree") {
    const tail = segments.slice(3).join("/");
    return tail ? { type: "tree-page", owner, repo, tail } : { type: "repo-root", owner, repo };
  }

  if (third === "blob") {
    const tail = segments.slice(3).join("/");
    return tail ? { type: "blob-page", owner, repo, tail } : { type: "repo-root", owner, repo };
  }

  if (third === "commit") {
    const sha = segments[3]?.trim();
    return sha ? { type: "commit-page", owner, repo, sha } : { type: "repo-root", owner, repo };
  }

  if (UNSUPPORTED_REPO_PAGES.has(third)) {
    return { type: "unsupported-repo-page", owner, page: third, repo };
  }

  if (segments.length === 3) {
    return { type: "shorthand-ref", owner, repo, rawRef: third };
  }

  return { type: "invalid", reason: `Unrecognized repo path: ${pathname}` };
}
```

### 8.2 Replace `parseRepoQuery()` to return intent

Current file:

- `packages/pi/src/repo/parse.ts`

Suggested API:

```ts
export function parseRepoInput(raw: string): RepoPathIntent;
```

Rules:

- blank => invalid
- `owner/repo` => `repo-root`
- GitHub URL/no-scheme URL => parse pathname through route parser
- non-GitHub URL => invalid

#### Alignment question — accepted search-box input forms

Choose desired support set:

- **A. `owner/repo`**
  - Pros: simplest and common.
  - Cons: excludes copied URLs.
- **B. `github.com/owner/repo`**
  - Pros: common paste form without scheme.
  - Cons: one more normalization path.
- **C. `https://github.com/owner/repo`**
  - Pros: obvious and user-friendly.
  - Cons: none meaningful.
- **D. Full `tree/blob/commit` URLs**
  - Pros: strongest UX; pasting GitHub URLs just works.
  - Cons: requires route parser reuse.
- **E. `.git` URLs**
  - Pros: useful from clone URLs and docs.
  - Cons: minor normalization branch.
- **F. SSH clone URLs**
  - Pros: power-user friendly.
  - Cons: extra parser complexity; low product value.

**Chosen: support A+B+C+D+E, not F.**

Suggested sketch:

```ts
export function parseRepoInput(raw: string): RepoPathIntent {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { type: "invalid", reason: "Empty repository input" };
  }

  const slash = trimmed.split("/").filter(Boolean);
  if (slash.length === 2 && !trimmed.includes(" ") && !trimmed.startsWith("http")) {
    return parseRepoRoutePath(`/${slash[0]}/${slash[1]}`);
  }

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);

    if (!url.hostname.endsWith("github.com")) {
      return { type: "invalid", reason: `Unsupported host: ${url.hostname}` };
    }

    return parseRepoRoutePath(url.pathname);
  } catch {
    return { type: "invalid", reason: `Invalid repository input: ${trimmed}` };
  }
}
```

---

## Phase 3 — Rewrite resolver around intent, not `RepoTarget`

### 9.1 Add new resolver entrypoint

Current file:

- `packages/pi/src/repo/ref-resolver.ts`

Suggested API:

```ts
export async function resolveRepoIntent(intent: RepoPathIntent): Promise<ResolvedRepoLocation>;
```

### 9.2 Keep ref lookup helpers small

```ts
async function lookupBranch(owner: string, repo: string, name: string): Promise<boolean> {
  return (await lookupCommitByRef(owner, repo, `heads/${name}`)) !== undefined;
}

async function lookupTag(owner: string, repo: string, name: string): Promise<boolean> {
  return (await lookupCommitByRef(owner, repo, `tags/${name}`)) !== undefined;
}

async function lookupCommit(owner: string, repo: string, sha: string): Promise<boolean> {
  return (await lookupCommitByRef(owner, repo, sha)) !== undefined;
}
```

### 9.3 Separate exact ref resolution from tail resolution

```ts
async function resolveExplicitRef(
  owner: string,
  repo: string,
  rawRef: string,
): Promise<ResolvedRepoRef> {
  const input = rawRef.trim();

  if (input.startsWith("refs/heads/")) {
    const name = input.slice("refs/heads/".length);
    if (await lookupBranch(owner, repo, name)) {
      return createBranchRepoRef(name);
    }
  }

  if (input.startsWith("refs/tags/")) {
    const name = input.slice("refs/tags/".length);
    if (await lookupTag(owner, repo, name)) {
      return createTagRepoRef(name);
    }
  }

  if (isFullCommitSha(input) && (await lookupCommit(owner, repo, input))) {
    return createCommitRepoRef(input);
  }

  if (await lookupBranch(owner, repo, input)) {
    return createBranchRepoRef(input);
  }

  if (await lookupTag(owner, repo, input)) {
    return createTagRepoRef(input);
  }

  if (await lookupCommit(owner, repo, input)) {
    return createCommitRepoRef(input);
  }

  throw new RepoRefNotFoundError(input);
}
```

### 9.4 Main resolver switch

```ts
export async function resolveRepoIntent(intent: RepoPathIntent): Promise<ResolvedRepoLocation> {
  switch (intent.type) {
    case "invalid":
      throw new Error(intent.reason);

    case "repo-root": {
      const branch = await fetchDefaultBranch(intent.owner, intent.repo);
      const resolvedRef = await resolveExplicitRef(intent.owner, intent.repo, branch);
      return {
        owner: intent.owner,
        repo: intent.repo,
        ref: displayResolvedRepoRef(resolvedRef),
        refOrigin: "default",
        resolvedRef,
        token: intent.token,
        view: "repo",
      };
    }

    case "shorthand-ref": {
      const resolvedRef = await resolveExplicitRef(intent.owner, intent.repo, intent.rawRef);
      return {
        owner: intent.owner,
        repo: intent.repo,
        ref: displayResolvedRepoRef(resolvedRef),
        refOrigin: "explicit",
        resolvedRef,
        token: intent.token,
        view: "repo",
      };
    }

    case "commit-page": {
      const resolvedRef = await resolveExplicitRef(intent.owner, intent.repo, intent.sha);
      return {
        owner: intent.owner,
        repo: intent.repo,
        ref: displayResolvedRepoRef(resolvedRef),
        refOrigin: "explicit",
        resolvedRef,
        token: intent.token,
        view: "repo",
      };
    }

    case "tree-page": {
      const result = await resolveTailAsRef(intent.owner, intent.repo, intent.tail);
      return {
        owner: intent.owner,
        repo: intent.repo,
        ref: displayResolvedRepoRef(result.resolvedRef),
        refOrigin: "explicit",
        resolvedRef: result.resolvedRef,
        subpath: result.subpath,
        token: intent.token,
        view: "tree",
      };
    }

    case "blob-page": {
      const result = await resolveTailAsRef(intent.owner, intent.repo, intent.tail);
      return {
        owner: intent.owner,
        repo: intent.repo,
        ref: displayResolvedRepoRef(result.resolvedRef),
        refOrigin: "explicit",
        resolvedRef: result.resolvedRef,
        subpath: result.subpath,
        token: intent.token,
        view: "blob",
      };
    }

    case "unsupported-repo-page": {
      const branch = await fetchDefaultBranch(intent.owner, intent.repo);
      const resolvedRef = await resolveExplicitRef(intent.owner, intent.repo, branch);
      return {
        owner: intent.owner,
        repo: intent.repo,
        ref: displayResolvedRepoRef(resolvedRef),
        refOrigin: "default",
        resolvedRef,
        fallbackReason: "unsupported-page",
        token: intent.token,
        view: "repo",
      };
    }
  }
}
```

### 9.5 Adapter for old API during migration

Use a thin adapter **only if it is the fastest way to get working code**.

```ts
export async function resolveRepoTarget(target: RepoTarget): Promise<ResolvedRepoSource> {
  const intent = repoTargetToIntent(target);
  const location = await resolveRepoIntent(intent);
  return toResolvedRepoSource(location);
}
```

Blunt rule:

- if the adapter shortens time-to-green, keep it briefly
- if direct caller replacement is simpler, skip the adapter and delete the old path immediately

---

## Phase 4 — Simplify route layer

Current route loader duplicates parse/classify logic.

#### Alignment question — route responsibility

Choose one:

- **A. Route only decodes params, then calls parser + resolver**
  - Pros: one source of truth, best separation, easiest tests.
  - Cons: larger parser/resolver boundary.
- **B. Route keeps tiny `tree/blob/commit` fast-path logic**
  - Pros: smaller diff.
  - Cons: duplication survives; FSM story gets weaker.

**Chosen: A — route only decodes params, then calls parser + resolver.**

Target:

```tsx
import { parseRepoRoutePath } from "@gitinspect/pi/repo/path-parser"
import { resolveRepoIntent } from "@gitinspect/pi/repo/ref-resolver"
import { toResolvedRepoSource } from "@gitinspect/pi/repo/ref-resolver"

export const Route = createFileRoute("/$owner/$repo/$")({
  loader: async ({ params }) => {
    const decoded = decodePathFragment(params._splat ?? "")
    const intent = parseRepoRoutePath(`/${params.owner}/${params.repo}/${decoded}`)
    const location = await resolveRepoIntent(intent)
    return toResolvedRepoSource(location)
  },
  ...
})
```

Benefits:

- route no longer knows about `blob/tree/commit`
- route no longer creates ad hoc `RepoTarget`
- one source of truth

---

## Phase 5 — Canonical path generation

`repoSourceToPath()` should remain small.

But document its scope clearly:

- canonical chat route path only
- not a round-trip representation of GitHub UI pages
- intentionally drops unsupported page kinds and subpaths in v0 if product does not need them

If we later need round-trip fidelity, add a new serializer for `ResolvedRepoLocation`, not `ResolvedRepoSource`.

#### Alignment question — canonical URL policy

When user opens a `tree/blob` GitHub-like path, choose one:

- **A. Preserve exact `tree/blob` path in app URLs**
  - Pros: highest fidelity, easiest to reason about route round-trips, closest to source URL.
  - Cons: more route shapes to preserve.
- **B. Collapse to shorthand `/owner/repo/<ref>`**
  - Pros: simpler canonical URL model, likely enough because the app collapses into `/chat/$sessionId` after the first user message anyway.
  - Cons: loses `subpath` and original page intent before the first turn.
- **C. Collapse to repo root `/owner/repo`**
  - Pros: minimal routing surface.
  - Cons: throws away too much meaning; weak UX.

**Working default: B unless we explicitly decide pre-first-turn deep-link fidelity matters.**

---

## 10. Tests to add/update

## 10.1 Replace parse tests to assert intent

New tests should target `RepoPathIntent`.

### route parser tests

```ts
describe("parseRepoRoutePath", () => {
  it("parses repo root", () => {
    expect(parseRepoRoutePath("/vercel/next.js")).toEqual({
      type: "repo-root",
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("parses shorthand refs", () => {
    expect(parseRepoRoutePath("/vercel/next.js/canary")).toEqual({
      type: "shorthand-ref",
      owner: "vercel",
      repo: "next.js",
      rawRef: "canary",
    });
  });

  it("parses tree pages", () => {
    expect(parseRepoRoutePath("/vercel/next.js/tree/feature/foo/src/lib")).toEqual({
      type: "tree-page",
      owner: "vercel",
      repo: "next.js",
      tail: "feature/foo/src/lib",
    });
  });

  it("parses blob pages", () => {
    expect(parseRepoRoutePath("/vercel/next.js/blob/main/README.md")).toEqual({
      type: "blob-page",
      owner: "vercel",
      repo: "next.js",
      tail: "main/README.md",
    });
  });

  it("classifies unsupported pages explicitly", () => {
    expect(parseRepoRoutePath("/vercel/next.js/issues/1")).toEqual({
      type: "unsupported-repo-page",
      owner: "vercel",
      page: "issues",
      repo: "next.js",
    });
  });
});
```

### search input parser tests

```ts
describe("parseRepoInput", () => {
  it("accepts owner/repo shorthand", () => {
    expect(parseRepoInput("vercel/next.js")).toMatchObject({
      type: "repo-root",
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("accepts github.com URLs without scheme", () => {
    expect(parseRepoInput("github.com/vercel/next.js/tree/main/packages")).toMatchObject({
      type: "tree-page",
      owner: "vercel",
      repo: "next.js",
      tail: "main/packages",
    });
  });

  it("rejects non-GitHub hosts", () => {
    expect(parseRepoInput("https://gitlab.com/foo/bar")).toEqual({
      type: "invalid",
      reason: "Unsupported host: gitlab.com",
    });
  });
});
```

## 10.2 Resolver tests by state

### exact ref resolution

- default branch
- explicit branch
- explicit tag
- explicit commit
- ambiguous same-name tag/branch
- refs/heads/\* input
- refs/tags/\* input

### tail resolution

- `tree/main`
- `tree/feature/foo/src/lib`
- `blob/release/candidate/README.md`
- commit SHA prefix not full SHA should not be accepted as commit
- full SHA tail + subpath

### fallback

- unsupported page -> root with `fallbackReason`
- invalid input -> throw
- explicit missing ref -> throw

## 10.3 Route tests should get simpler

Current route tests are over-involved because route loader reimplements parsing.

After refactor:

- route tests only assert it calls parser + resolver correctly
- parser/resolver behavior lives in their own suites

---

## 11. Precedence policy section

We must decide branch vs tag precedence when both exist.

Current behavior:

- branch first

gitingest behavior:

- tag first

Do not leave this implicit.

#### Alignment question — source of truth for precedence

Choose one:

- **A. Keep current branch-first behavior**
  - Pros: no behavior change vs today.
  - Cons: may not match external expectations or GitHub UI.
- **B. Switch to gitingest-style tag-first**
  - Pros: aligns with that reference implementation.
  - Cons: behavior change; may surprise existing users.
- **C. Research GitHub UI and lock to that**
  - Pros: strongest external grounding.
  - Cons: one extra research step.

**Chosen: A — keep current branch-first behavior.**

Add a dedicated test describing the product decision.

Example:

```ts
it("prefers branches over tags when names collide", async () => {
  ...
})
```

or

```ts
it("prefers tags over branches when names collide", async () => {
  ...
})
```

Pick one. codify it. stop guessing.

---

## 12. Non-goals

These should not be part of this refactor.

### 12.1 Multi-host support

No GitLab/Bitbucket/Gitea support in this change.

### 12.2 `just-github` URL parsing

Do not move route parsing into `just-github`.

### 12.3 Dexie schema migration

Do not change stored `ResolvedRepoSource` shape **by default**.

Reason:

- current chosen plan keeps `subpath` internal only
- parser `type` is transient state, not persisted session identity
- changing Dexie should be justified by simpler working code, not by purity alone

If implementation shows that updating Dexie removes more code than it adds, do the migration.

### 12.4 Full UI support for blob subpath focus

Keep resolver capable of returning `subpath`, but do not block this refactor on UI features that consume it.

---

## 13. Migration order

- [x] add `RepoPathIntent` + `ResolvedRepoLocation`
- [x] add new parser APIs
- [x] add new resolver APIs
- [x] keep adapter from old `RepoTarget` -> new intent only if it speeds delivery
- [x] switch route loader to parser+resolver
- [x] switch search input flow to parser+resolver
- [x] replace old parse tests with intent tests
- [x] remove `refPathTail` from `RepoTarget` after all callers are migrated

---

## 14. Final desired file layout

```txt
packages/pi/src/repo/
  path-intent.ts        # discriminated unions
  path-parser.ts        # syntax-only parse
  ref-resolver.ts       # async semantic resolution
  refs.ts               # ref value constructors
  url.ts                # canonical path builders only
  parse.ts              # optional compatibility wrapper; delete later
```

Target responsibility split:

- `path-intent.ts` → types only
- `path-parser.ts` → pure FSM A
- `ref-resolver.ts` → pure FSM B
- `url.ts` → serializers only
- route files → composition only

---

## 15. Success criteria

The refactor is done when:

- there is exactly one parser for route paths
- there is exactly one parser for text input
- route loader contains no `startsWith("blob/")` / `startsWith("tree/")` logic
- `RepoTarget.refPathTail` is gone, or exists only as a short-lived migration shim that is scheduled for deletion
- tests assert explicit intent states
- unsupported repo pages fallback explicitly
- explicit ref failures throw explicitly
- branch/tag precedence is documented in a test

---

## 16. Optional follow-up after this lands

After the FSM refactor is stable:

1. evaluate whether `ResolvedRepoLocation.subpath` should drive file-focused context
2. improve annotated tag handling in GitHub ref resolution
3. revisit GitHub Enterprise host support if product wants it
4. revisit whether `RepoTarget` should be deleted entirely

---

## 17. Implementation note

The biggest simplification is not a clever parser.

It is this:

- parse into **explicit intent**
- resolve intent in **one place**
- stop encoding state through optional fields

That is the line count reduction that matters.
