# GitHub auth plan: OAuth-first, PAT fallback, still client-side

## locked product decisions

1. **OAuth-first. PAT stays, but hidden fallback.**
   - main CTA: `Sign in with GitHub`
   - advanced fallback: `Use PAT token instead`
   - PAT warning: **no free models / no account-linked features / no sync/share path**

2. **single-button first UX**
   - auth dialog = one primary GitHub button
   - PAT lives under the button, visually secondary
   - settings → GitHub repeats same primary CTA, with clear benefit table / copy

3. **stay client-side for repo auth**
   - Better Auth session + OAuth account data stay cookie-backed in stateless mode
   - browser still calls GitHub directly for authenticated repo/chat work
   - worker still gets a raw GitHub token string from main thread

4. **PAT fallback behaves like app-unauthenticated**
   - PAT may unlock GitHub API reads
   - but for product logic, PAT does **not** count as signed-in
   - free/premium/sync/share/subscription gates should check product auth, not PAT presence

5. **guest mode exists, but first-message UX informs before continuing**
   - first message ever opens auth dialog
   - dialog explains limits + recommends sign-in
   - user may continue without logging in
   - that dismissal is remembered once per browser/device in **Dexie settings**
   - if the user signs in from that dialog, the drafted first message should auto-send

6. **support signed-out public repo metadata**
   - stars + language should work for visitors without login
   - use a small internal API for public metadata only
   - do **not** route private repo/chat fetches through backend

7. **future product spine = product auth**
   - free usage controls
   - proxy rate limits
   - Dexie Cloud sync
   - public share URLs
   - subscription hooks
     all want a real product identity. PAT should not be the primary spine.

---

## upstream facts we can trust

### Better Auth DB-less mode is stateless + cookie-backed by default

Current app auth config passes **no database**:

- `packages/auth/src/index.ts:5-17`

```ts
return betterAuth({
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
  trustedOrigins: [env.CORS_ORIGIN],
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  plugins: [tanstackStartCookies()],
});
```

Better Auth source: when `database` is omitted, it auto-enables cookie session cache + account cookie storage:

- [`create-context.ts#L96-L112`](https://github.com/better-auth/better-auth/blob/d06b5865f47bd1f929b5d844c5a31e2762ceeef5/packages/better-auth/src/context/create-context.ts#L96-L112)

```ts
if (!options.database) {
  options = defu(options, {
    session: {
      cookieCache: {
        enabled: true,
        strategy: "jwe",
        refreshCache: true,
      },
    },
    account: {
      storeStateStrategy: "cookie",
      storeAccountCookie: true,
    },
  });
}
```

Better Auth stores account data in an encrypted/signed JWT-style cookie in stateless mode:

- [`session-store.ts#L280-L324`](https://github.com/better-auth/better-auth/blob/d06b5865f47bd1f929b5d844c5a31e2762ceeef5/packages/better-auth/src/cookies/session-store.ts#L280-L324)

```ts
const data = await symmetricEncodeJWT(
  accountData,
  c.context.secretConfig,
  "better-auth-account",
  options.maxAge,
);
```

Better Auth blog explicitly calls this **cookie-based account storage** for stateless apps:

- [`blogs/1-4.mdx#L375-L382`](https://github.com/better-auth/better-auth/blob/d06b5865f47bd1f929b5d844c5a31e2762ceeef5/docs/content/blogs/1-4.mdx#L375-L382)

So: the user’s correction is right.
**OAuth here does not require us to move to DB-backed auth storage.**

### Better Auth supports client-side social login + access-token retrieval

Docs:

- sign in + get token: [`oauth.mdx#L32-L95`](https://github.com/better-auth/better-auth/blob/d06b5865f47bd1f929b5d844c5a31e2762ceeef5/docs/content/docs/concepts/oauth.mdx#L32-L95)
- additional scopes via link flow: [`oauth.mdx#L116-L133`](https://github.com/better-auth/better-auth/blob/d06b5865f47bd1f929b5d844c5a31e2762ceeef5/docs/content/docs/concepts/oauth.mdx#L116-L133)

```ts
await authClient.signIn.social({ provider: "google" });

const { accessToken } = await authClient.getAccessToken({
  providerId: "google",
});

await authClient.linkSocial({
  provider: "google",
  scopes: ["..."],
});
```

Tests prove `getAccessToken()` works in client flows and returns the decrypted access token:

- [`account.test.ts#L160-L173`](https://github.com/better-auth/better-auth/blob/d06b5865f47bd1f929b5d844c5a31e2762ceeef5/packages/better-auth/src/api/routes/account.test.ts#L160-L173)

In stateless mode, account cookie is enough for `getAccessToken()` when `accountId` is omitted:

- [`account.test.ts#L520-L610`](https://github.com/better-auth/better-auth/blob/d06b5865f47bd1f929b5d844c5a31e2762ceeef5/packages/better-auth/src/api/routes/account.test.ts#L520-L610)

### GitHub provider default scopes are auth/profile only

Better Auth GitHub provider default scopes:

- [`github.ts#L73-L88`](https://github.com/better-auth/better-auth/blob/d06b5865f47bd1f929b5d844c5a31e2762ceeef5/packages/core/src/social-providers/github.ts#L73-L88)

```ts
const _scopes = options.disableDefaultScope ? [] : ["read:user", "user:email"];
```

So:

- plain GitHub sign-in != enough for repo API auth
- repo access must be explicit

### GitHub OAuth scope/rate-limit facts

GitHub OAuth scope docs show accepted/requested scopes headers:

- `X-OAuth-Scopes`
- `X-Accepted-OAuth-Scopes`
- source: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps

GitHub REST rate-limit docs:

- unauth public requests: **60/hour**
- authenticated user/OAuth token requests: **5,000/hour**
- OAuth app can use **client_id + client_secret** to fetch **public data** at **5,000/hour per app**
- source: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

This is the key enabler for the signed-out metadata API.

---

## current code reality

### PAT is the only GitHub token source right now

- `packages/pi/src/repo/github-token.ts:3-62`
- token lives in Dexie key `github.pat`
- UI says `Stored only in this browser.`

### all GitHub repo fetches are built around “optional raw token string”

- `packages/pi/src/repo/github-fetch.ts:178-223`
- worker host passes `githubRuntimeToken` into runtime start:
  - `packages/pi/src/agent/worker-backed-agent-host.ts:51-57`

This is good. We can swap token source without rewriting repo tools.

### repo cards are stricter than the fetch layer

Repo card metadata blocks itself if no PAT exists:

- `packages/ui/src/components/github-repo.tsx:58-78`

```ts
const token = await getGithubPersonalAccessToken();
if (!token) {
  setState({ status: "no-token" });
  return;
}
```

But header stars already prove anonymous GitHub fetch is supported by the lower-level fetch helper:

- `packages/pi/src/hooks/use-github-repo-stargazers.ts:18-29`

```ts
const res = await githubApiFetch(`/repos/${owner}/${repo}`);
```

So today the UX divergence is local, not architectural.

### chat/system notices are still PAT-worded

- `packages/pi/src/agent/runtime-errors.ts:229-280`
- `packages/pi/src/repo/github-fetch.ts:248-296`
- `packages/ui/src/components/chat-message.tsx:143-156`

Current CTA strings:

- `Add token`
- `Add GitHub token`
- `GitHub settings`

This all needs to become auth-state aware.

### current privacy copy will become partially stale

- `packages/ui/src/components/settings-dialog.tsx:347-380`
- `packages/ui/src/components/data-settings.tsx:143-168`

Current copy says everything is Dexie/IndexedDB-local and delete-all wipes IndexedDB only. That is no longer enough once auth cookies exist and a small metadata API is added.
Also, delete-all is now explicitly expected to clear auth cookies too.

---

## target architecture

## one GitHub auth resolver, not two product paths

Keep branching only at token acquisition.
Everything downstream gets one contract.

```ts
export type GitHubAccess =
  | { ok: true; token: string; source: "oauth" | "pat" }
  | {
      ok: false;
      reason:
        | "signed-out"
        | "oauth-not-linked"
        | "oauth-missing-scope"
        | "no-fallback-token"
        | "none";
    };
```

### primary resolver order

1. Better Auth session exists?
2. try `authClient.getAccessToken({ providerId: "github" })`
3. if missing but PAT exists, use PAT fallback
4. else return structured no-auth state

### important boundary

- **`apps/web` owns Better Auth client calls**
- **`packages/pi` stays token-source agnostic**

Do **not** import `apps/web/src/lib/auth-client.ts` from `packages/pi`.
Instead:

- `apps/web` resolves the token
- passes token into shared fetch/runtime helpers

This preserves current layering.

---

## UX design

## auth dialog

Reference patterns:

- old gitoverflow dialog: `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web/src/components/auth-dialog.tsx:16-72`
- tweakcn wrapper/post-login flow: `/Users/jeremy/Developer/tweakcn/components/auth-dialog-wrapper.tsx:10-42`
- old session guard: `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web/src/hooks/use-guards.ts:13-31`

### target dialog shape

**Title**

- `Sign in with GitHub`

**Primary CTA**

- `Sign in with GitHub`

**Subcopy**

- unlock free account features
- better limits
- future sync/share path
- repo access requested only when needed

**Secondary disclosure**

- inline link-button: `Use PAT token instead`
- clicking it closes the dialog and opens `Settings → GitHub`
- warning text:
  - stored only on this device
  - app still treats you as signed out for product perks/gates
  - no free-model/account-linked perks path
  - no sync/share/subscription path
  - best for privacy-sensitive / fallback use

### single-button but still progressive scope

User should only see **one main button**.
Behind the scenes:

#### flow A — product auth intent only

- `signIn.social({ provider: "github" })`
- land back with product session
- no repo scope yet

#### flow B — repo access intent

- same button
- if session missing: run sign-in first
- then, if GitHub repo scope missing: immediately chain `linkSocial({ provider: "github", scopes: [...] })`
- still one user-visible CTA

So the product keeps the “one button” feel without forcing broad repo scope at the earliest possible moment.

### settings → GitHub page

Replace PAT-first page with:

1. **Connected account card**
   - signed in / signed out
   - GitHub linked / not linked
   - source of repo auth: OAuth vs PAT fallback

2. **primary GitHub CTA**
   - `Sign in with GitHub` or `Reconnect GitHub`

3. **clear benefits list**
   - free usage / better limits / future sync-share-premium path

4. **advanced fallback disclosure**
   - current PAT UI, but visually de-emphasized

5. **privacy note**
   - session + GitHub connection stored in secure cookies in stateless mode
   - PAT fallback stored only in this browser
   - public metadata endpoint only fetches public stars/language

---

## public metadata API

## why

Signed-out repo cards should still show:

- stars
- language

Current repo cards show `No API token` instead:

- `packages/ui/src/components/github-repo.tsx:108-130`

That is bad first-run UX.

## design

Add a tiny internal route, e.g.

- `apps/web/src/routes/api/github/public.ts`

Input:

- owner
- repo

Output:

- `stargazers_count`
- `language`
- maybe `default_branch` if useful later

### how the route authenticates to GitHub

Use app credentials server-side for **public data only**.
GitHub docs allow OAuth app `client_id + client_secret` for public REST requests at **5,000/hour per app**.

This is strictly better than anonymous browser fetch for signed-out landing traffic.

### caching

- CDN / browser cache headers
- short server-side stale-while-revalidate if available
- only for public repo metadata

### rule

- **public metadata endpoint only** through backend
- **repo tree/file/chat** stays direct client-side with user token or PAT

## Fix the Github repo card once this is implemented so we don't see the no token path !

## auth hooks / state layer

Use the older gitoverflow / tweakcn patterns, but adapt for TanStack Start.

### add web-only hooks/store

Suggested files:

- `apps/web/src/store/auth-store.ts`
- `apps/web/src/components/auth-dialog.tsx`
- `apps/web/src/components/auth-dialog-wrapper.tsx`
- `apps/web/src/hooks/use-session-guard.ts`
- `apps/web/src/hooks/use-github-auth.ts`
- `apps/web/src/hooks/use-subscription.ts` (stub now, premium-ready)
- maybe `apps/web/src/lib/github-access.ts`

### responsibilities

#### `useSessionGuard()`

- open dialog if product session missing
- allow public browsing where intended
- gate free-account features, sync/share, premium flows

#### `useGithubAuth()`

returns derived state, not raw Better Auth everywhere:

```ts
type GitHubAuthState = {
  session: "signed-out" | "signed-in";
  githubLink: "linked" | "unlinked" | "unknown";
  repoAccess: "granted" | "missing" | "unknown";
  fallbackPat: boolean;
  preferredSource: "oauth" | "pat" | "none";
};
```

#### `useSubscription()`

Follow tweakcn pattern:

- gate by `authClient.useSession()` first
- then fetch subscription state
- no-op for signed-out users

---

## failure model

We need to rewrite failures around **actionable auth state**, not around “token missing”.

## failure classes

### 1. signed out

When a feature needs account benefits / free usage / repo auth but no session exists.

UI:

- open auth dialog
- CTA: `Sign in with GitHub`
- secondary inline link: `Use PAT token instead`
- if opened from first message with a draft:
  - preserve draft
  - auto-send after successful sign-in
- if user chooses `Continue without logging in`:
  - remember that choice once per browser/device
  - proceed in guest mode
- not “Add token”

### 2. signed in, GitHub not linked for repo auth

Session exists, but `getAccessToken({ providerId: "github" })` fails / no account cookie for GitHub repo access.

UI:

- CTA: `Connect GitHub`
- explanation: repo access not granted yet

### 3. signed in, GitHub linked, but missing scope

Need repo access; token exists but scope insufficient.
Use GitHub response headers if present for diagnostics:

- `X-OAuth-Scopes`
- `X-Accepted-OAuth-Scopes`

UI:

- CTA: `Grant repo access`
- do **not** send user to PAT-first wording

### 4. OAuth revoked / expired / bad cookie state

`getAccessToken` fails unexpectedly or GitHub rejects token.

UI:

- CTA: `Reconnect GitHub`
- fallback text: `or use PAT token instead`

### 5. PAT invalid / insufficient / expired

Keep current validation + anonymous fallback behavior where safe.
Current fallback-on-insufficient-PAT behavior is already tested:

- `tests/github-fetch.test.ts:163-220`
- lower-level rule lives in `packages/just-github/src/github-http.ts:14-31`

### 6. public metadata endpoint rate-limited / unavailable

This must not poison chat auth UX.
Show soft fallback:

- stars/language unavailable
- no modal
- no scary auth toast

---

## chat + system notice rewrite

Current behavior:

- runtime maps GitHub errors to `open-github-settings`
  - `packages/pi/src/agent/runtime-errors.ts:232-280`
- toast layer turns them into PAT/settings copy
  - `packages/pi/src/repo/github-fetch.ts:254-294`
- chat message button says `Add GitHub token`
  - `packages/ui/src/components/chat-message.tsx:143-156`

## replace with auth-aware CTA mapping

### suggested new CTA labels

| state                    | CTA                     |
| ------------------------ | ----------------------- |
| signed out               | `Sign in with GitHub`   |
| signed in, no repo link  | `Connect GitHub`        |
| signed in, missing scope | `Grant repo access`     |
| OAuth auth failed        | `Reconnect GitHub`      |
| PAT fallback only        | `Use PAT token instead` |

### implementation note

Keep the system notice action generic, e.g.

- `open-github-settings`

But when rendering CTA:

- inspect current `GitHubAuthState`
- choose label + deep link target based on state

This keeps persistence format small while making UI smarter.

---

## privacy / communication

## what we can honestly say

### OAuth-first path

- product session and GitHub account data are cookie-backed in stateless mode
- browser still talks to GitHub directly for repo/chat fetches
- chat transcripts / Dexie data remain local-first
- small internal metadata API only fetches **public** stars/language

### PAT fallback

- token stored only in this browser
- not tied to account perks
- private path remains viable

## copy updates required

### About / settings copy

Current line is too absolute:

- `packages/ui/src/components/settings-dialog.tsx:347-349`

Need new wording roughly:

- chats, repo state, provider keys, and usage stay local-first
- auth session / GitHub link can live in secure cookies
- public repo metadata may be fetched through a tiny server endpoint
- no backend repo mirror / no backend chat transcript store

### Delete-all copy

Current copy only mentions IndexedDB:

- `packages/ui/src/components/data-settings.tsx:165-168`

Need to also:

- sign out / clear auth cookies
- clear PAT + Dexie
- clear local caches

So delete-all becomes:

- wipe IndexedDB
- clear Better Auth session/account cookies
- optionally redirect to signed-out state

---

## files to read first before coding

### current repo

1. `packages/auth/src/index.ts`
2. `apps/web/src/lib/auth-client.ts`
3. `apps/web/src/routes/api/auth/$.ts`
4. `apps/web/src/middleware/auth.ts`
5. `apps/web/src/functions/get-user.ts`
6. `apps/web/src/routes/__root.tsx`
7. `packages/ui/src/components/settings-dialog.tsx`
8. `packages/ui/src/components/github-token-settings.tsx`
9. `packages/ui/src/components/github-repo.tsx`
10. `packages/pi/src/repo/github-token.ts`
11. `packages/pi/src/repo/github-fetch.ts`
12. `packages/pi/src/agent/runtime-errors.ts`
13. `packages/ui/src/components/chat-message.tsx`
14. `packages/ui/src/components/data-settings.tsx`
15. `packages/pi/src/hooks/use-github-repo-stargazers.ts`
16. `packages/pi/src/agent/worker-backed-agent-host.ts`
17. `packages/env/src/server.ts`

### previous local references

18. `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web/src/components/auth-dialog.tsx`
19. `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web/src/hooks/use-guards.ts`
20. `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web/src/store/auth-store.ts`
21. `/Users/jeremy/Developer/tweakcn/components/auth-dialog-wrapper.tsx`
22. `/Users/jeremy/Developer/tweakcn/hooks/use-subscription.ts`
23. `/Users/jeremy/Developer/tweakcn/app/(auth)/components/auth-dialog.tsx`

### upstream Better Auth / GitHub refs

24. Better Auth stateless defaults
25. Better Auth OAuth docs
26. Better Auth GitHub provider source
27. GitHub scopes docs
28. GitHub rate-limit docs

---

## guest-mode persistence detail

Persist the "continue without logging in" acknowledgement in **Dexie settings**, not localStorage.
This keeps the behavior consistent with the app’s existing local-first settings model.
Suggested key shape:

```ts
"auth.guest-chat-acknowledged": true
```

Optional future extension:

```ts
"auth.guest-chat-acknowledged-at": "2026-04-04T...Z"
```

---

## detailed implementation todo list

### phase 0 — align source-of-truth contracts

- [x] Re-read the files listed above before coding any auth changes.
- [x] Confirm the exact Better Auth client surface already available from `apps/web/src/lib/auth-client.ts`.
- [x] Confirm the exact session shape returned by `authClient.useSession()` / `authClient.getSession()` in this app.
- [x] Confirm the exact GitHub scopes needed for v1 private repo reads in this product.
- [x] Confirm whether current GitHub fetch call sites all flow through `githubApiFetch()` or whether any bypass it.
- [x] Confirm whether the recent GitHub Repo Card comment is fully covered by the repo-card tasks below; if not, add the missing card fix before implementation.

### phase 1 — add web auth state + dialog infrastructure

- [x] Create `apps/web/src/store/auth-store.ts` for dialog open state + post-login action payload.
- [x] Model dialog state after the older gitoverflow/tweakcn patterns, but keep it TanStack Start-native.
- [x] Create `apps/web/src/components/auth-dialog.tsx`.
- [x] Implement the primary CTA: `Sign in with GitHub`.
- [x] Implement the inline secondary link-button: `Use PAT token instead`.
- [x] Make PAT link close the dialog and deep-link to `Settings → GitHub`.
- [x] Add `Continue without logging in` to the first-message variant of the dialog.
- [x] Create `apps/web/src/components/auth-dialog-wrapper.tsx`.
- [x] Mount the wrapper in `apps/web/src/routes/__root.tsx` next to `AppSettingsDialog`.
- [x] Create `apps/web/src/hooks/use-session-guard.ts`.
- [x] Make `useSessionGuard()` open the auth dialog when product-auth-required actions are attempted without a session.
- [x] Support a post-login action payload so the first drafted chat message can auto-send after successful sign-in.
- [x] Persist `auth.guest-chat-acknowledged` in Dexie settings when user continues as guest.
- [x] Make the guest acknowledgement one-per-browser/device, not per tab.

### phase 2 — define GitHub auth derivation + token resolver

- [x] Create `apps/web/src/hooks/use-github-auth.ts`.
- [x] Define a single `GitHubAuthState` shape covering signed-out, signed-in, linked, missing-scope, PAT fallback, and preferred source.
- [x] Create `apps/web/src/lib/github-access.ts`.
- [x] Implement `signInWithGithub()`.
- [x] Implement `resolveGitHubAccess()` with priority: OAuth token → PAT fallback → none.
- [x] Implement `ensureGitHubRepoAccess()` for flows that need repo scope.
- [x] Keep all Better Auth client calls inside `apps/web`, not `packages/pi`.
- [x] Make PAT resolve as GitHub API capability only, not as app-authenticated state.
- [x] Ensure product feature gates depend on Better Auth session, never PAT presence.
- [x] Decide and encode the structured error reasons returned by the resolver (`signed-out`, `oauth-not-linked`, `oauth-missing-scope`, `no-fallback-token`, etc.).

### phase 3 — implement first-run chat gating + post-login auto-send

- [x] Detect “first message ever” or first guest-send condition in chat flow.
- [x] Open the auth dialog before sending that first message.
- [x] Explain guest limits + sign-in benefits in the dialog copy.
- [x] If user signs in successfully from that dialog, auto-send the drafted message.
- [x] If user continues without login, send the drafted message in guest mode.
- [x] Respect the Dexie guest acknowledgement flag on subsequent sends.
- [x] Keep the guest path available for signed-out public-repo chat.
- [x] Keep repo-scope request deferred until an action truly needs repo access.
- [x] If a guest later attempts a feature that truly requires product auth, re-open the auth dialog with the appropriate message.

### phase 4 — switch GitHub token consumers to the resolver contract

- [x] Update `packages/pi/src/agent/worker-backed-agent-host.ts` integration so runtime receives the resolved token string from the web layer.
- [x] Add any needed API for passing explicit GitHub token/source into shared runtime helpers.
- [x] Update shared GitHub fetch entrypoints to accept an explicit resolved token when available.
- [x] Preserve existing cache behavior in `packages/pi/src/repo/github-fetch.ts`.
- [x] Preserve existing anonymous fallback behavior for insufficient PATs where it is still useful.
- [x] Ensure OAuth-backed token use stays client-side for authenticated repo/chat fetches.
- [x] Ensure no Better Auth cookies/tokens are duplicated into Dexie unnecessarily.

### phase 5 — fix GitHub Repo Card + public metadata path

- [x] Add a tiny internal public metadata route for stars/language.
- [x] Restrict that route to public repo metadata only.
- [x] Use server-side app credentials for public GitHub metadata fetches.
- [x] Add caching headers / caching strategy for that metadata endpoint.
- [x] Update `packages/ui/src/components/github-repo.tsx` so signed-out visitors can still see stars/language.
- [x] Remove the current PAT-only gate for repo card metadata.
- [x] Keep GitHub Repo Card loading and error states visually clean.
- [x] If metadata API fails, omit metadata softly; do not trigger auth/settings CTAs.
- [x] Update any stargazer hooks that should also use the public metadata path when appropriate.
- [x] Verify the card still works when OAuth token exists.
- [x] Verify the card still works when only PAT exists.
- [x] Verify the card still works when no auth exists at all.

### phase 6 — settings → GitHub rewrite

- [x] Rewrite `packages/ui/src/components/github-token-settings.tsx` into an OAuth-first GitHub settings surface.
- [x] Primary headline: `Sign in with GitHub`.
- [x] Primary subcopy: `Recommended for free features and better limits`.
- [x] Add a primary sign-in/reconnect button.
- [x] Add a clear benefits section for OAuth path.
- [x] Add a clear explanation that PAT is fallback/private path only.
- [x] Keep PAT fallback visible even when signed out, inside the GitHub settings page.
- [x] Move PAT UI into an Advanced section or otherwise visually de-emphasized block while preserving discoverability.
- [x] Preserve PAT validation flow (`validateGithubPersonalAccessToken`).
- [x] Update GitHub settings copy so PAT users understand the app still treats them as signed out for product perks.
- [x] Add privacy copy describing cookie-backed auth + local-only PAT storage.
- [x] Add copy that explains repo access is requested only when needed.
- [x] Add copy that explains free/sync/share/subscription features hang off product auth, not PAT.

### phase 7 — chat/system notice/auth failure rewrite

- [x] Audit every `Add token` / `Add GitHub token` / `GitHub settings` string in chat and toasts.
- [x] Replace PAT-first CTA labels with auth-aware labels.
- [x] Map signed-out failures to `Sign in with GitHub`.
- [x] Map signed-in but unlinked failures to `Connect GitHub`.
- [x] Map missing-scope failures to `Grant repo access`.
- [x] Map revoked/bad OAuth failures to `Reconnect GitHub`.
- [x] Keep PAT fallback discoverable from these flows where appropriate, without making it the primary CTA.
- [x] Update `packages/pi/src/agent/runtime-errors.ts` classification only as much as needed; prefer smarter UI interpretation over bloating the stored notice format.
- [x] Update `packages/pi/src/repo/github-fetch.ts` toast CTA generation to be auth-state aware.
- [x] Update `packages/ui/src/components/chat-message.tsx` to render CTA labels based on current auth state, not hard-coded PAT wording.
- [x] Keep HTML debug details / sandbox preview behavior intact.
- [x] Make sure guest metadata failures do not masquerade as PAT/OAuth auth failures.

### phase 8 — product gating + subscription readiness

- [x] Add `apps/web/src/hooks/use-subscription.ts` patterned after tweakcn.
- [x] Gate subscription query on signed-in state.
- [x] Define app-level product gates that depend on product auth only.
- [x] Ensure PAT users are treated as unauthenticated for free-model/account-level features.
- [x] Make sure sync/share/public URL capabilities are designed around product auth only.
- [x] Add comments or helpers clarifying this rule so future premium work does not accidentally branch on PAT.
- [x] If proxy/rate-limit code needs auth context later, leave the abstraction seam in place now.

### phase 9 — privacy copy + delete-all correctness

- [x] Update About/settings copy that currently implies everything is Dexie-only.
- [x] Explain that chats/settings remain local-first, while auth session/account can be cookie-backed in stateless mode.
- [x] Explain that the public metadata endpoint only fetches public stars/language.
- [x] Update data wipe copy to mention auth cookies, not just IndexedDB.
- [x] Ensure delete-all clears IndexedDB data.
- [x] Ensure delete-all signs the user out / clears Better Auth cookies.
- [x] Ensure delete-all removes PAT fallback token.
- [x] Ensure delete-all clears relevant local caches.
- [x] Verify post-delete app state returns to clean signed-out baseline.

### phase 10 — tests to add or update

- [x] Add/update auth-dialog tests.
- [x] Test dialog opens from session guard.
- [x] Test callback URL preserves current route/search.
- [x] Test PAT inline link closes dialog and opens GitHub settings.
- [x] Test first-message sign-in path auto-sends drafted message after success.
- [x] Test continue-as-guest path persists Dexie acknowledgement.
- [x] Test guest acknowledgement suppresses repeat first-message prompt after reload.
- [x] Add/update token-resolution tests.
- [x] Test OAuth token is preferred when session + GitHub link exist.
- [x] Test PAT fallback is used when OAuth path unavailable.
- [x] Test structured resolver reasons for signed-out / unlinked / missing-scope cases.
- [x] Add/update repo-card tests.
- [x] Test signed-out visitor sees stars/language via internal API.
- [x] Test repo card soft-fails cleanly when metadata API fails.
- [x] Test PAT-only and OAuth-backed repo card states.
- [x] Add/update chat failure tests.
- [x] Test signed-out CTA copy.
- [x] Test missing-scope CTA copy.
- [x] Test reconnect CTA copy.
- [x] Test PAT invalid copy/fallback behavior.
- [x] Test guest metadata rate-limit/failure does not show scary auth toasts.
- [x] Add/update delete-all tests.
- [x] Verify IndexedDB wipe + cookie clear + PAT removal.

### phase 11 — final verification before coding is considered done

- [x] Manually walk the signed-out landing experience.
- [x] Manually walk first-message guest flow.
- [x] Manually walk first-message sign-in flow with post-login auto-send.
- [x] Manually walk signed-in/no-repo-scope flow.
- [x] Manually walk private-repo access flow.
- [x] Manually walk PAT fallback flow from dialog → settings.
- [x] Manually walk delete-all flow from a signed-in state.
- [x] Re-check all user-facing GitHub/auth copy for PAT-first regressions.
- [x] Re-check that the implementation still matches the central product rule: **OAuth-first, PAT viable, client-side repo auth, product auth is the real app spine**.
