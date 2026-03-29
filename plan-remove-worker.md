# Remove Worker Runtime Plan

Date: 2026-03-29

## Decision Gate

- this plan intentionally removes the current worker architecture in `src/agent/runtime-client.ts`
- this plan does **not** promise continuation of the same provider HTTP stream after page/tab death
- this plan **does** promise recoverable interruption:
  - no stuck fake streaming
  - no lost durable history
  - deterministic owner handoff
  - clear mirror/read-only behavior

## Goal

- page-owned runtime
- no workers
- single owner tab per session
- read-only mirrors in other tabs
- no long-lived agent host per session
- ephemeral turn runner per in-flight assistant turn
- full recovery after tab/browser interruption
- simpler code than the current worker + Comlink split

## Ground Truth From Current Code

### 1. Current app complexity is mostly transport + split ownership

`src/agent/runtime-client.ts` creates `SharedWorker` or `Worker` per session:

```ts
if (sharedWorkerSupported) {
  const worker = new SharedWorker(url, opts)
  return {
    worker,
    api: wrap<SessionWorkerApi>(worker.port),
    workerType: "shared",
  }
}

const worker = new Worker(url, opts)
return {
  worker,
  api: wrap<SessionWorkerApi>(worker),
  workerType: "dedicated",
}
```

`src/agent/runtime-worker-api.ts` still has one host per worker instance:

```ts
let host: AgentHost | undefined
let activeSessionId: string | undefined
```

Meaning:

- worker lifecycle exists only to hold `AgentHost` outside the page
- transport, init, disposal, and recovery are separate moving parts

### 2. Same-tab navigation already does not require a worker

`src/components/chat.tsx`:

```ts
await runtimeClient.startInitialTurn(session, content)
await navigate({
  ...sessionDestination({
    id: session.id,
    repoSource: session.repoSource,
  }),
  ...
})
```

`src/routes/__root.tsx` uses a single TanStack Router shell with `Outlet`.

Meaning:

- same-tab route navigation is SPA navigation
- a page-owned runtime can survive normal in-app navigation
- worker is not needed just to survive route changes

### 3. Current session model is session-scoped, not message-scoped

`src/types/storage.ts`:

```ts
export interface SessionData {
  id: string
  isStreaming: boolean
  model: string
  provider: ProviderId
  providerGroup?: ProviderGroupId
  repoSource?: RepoSource
  thinkingLevel: ThinkingLevel
  ...
}
```

`src/agent/session-adapter.ts` rebuilds agent state from `session + messages + tools`:

```ts
export function buildInitialAgentState(
  session: SessionData,
  messages: MessageRow[],
  model: Model<any>,
  tools: AgentTool[]
): Partial<AgentState> {
  return {
    messages: toAgentMessages(messages),
    model,
    systemPrompt: SYSTEM_PROMPT,
    thinkingLevel: session.thinkingLevel,
    tools,
  }
}
```

Meaning:

- the durable unit is still the session
- a single message is not enough state to reconstruct runtime behavior
- the right simplification is not "agent per message"
- the right simplification is "fresh turn runner per in-flight assistant turn, rebuilt from persisted session history"

### 4. `AgentHost.startTurn()` already matches the needed contract

`src/agent/agent-host.ts`:

```ts
async startTurn(content: string): Promise<void> {
  ...
  await this.persistPromptStart(userRow, assistantRow)
  ...
  this.runningTurn = this.runTurnToCompletion(userMessage).finally(() => {
    this.runningTurn = undefined
  })
}
```

Meaning:

- the app already has the correct high-level turn contract:
  - durable prompt start first
  - background completion second
- the big simplification is removing worker transport, not rewriting turn semantics from scratch

### 5. Sitegeist local code uses page-owned agent + lock ownership, not immortal background streaming

`docs/sitegeist/src/sidepanel.ts`:

```ts
let agent: Agent;
```

```ts
agent = new Agent({
  initialState: ...,
  streamFn: createStreamFn(async () => { ... }),
})
```

`docs/sitegeist/src/background.ts`:

```ts
const success = !ownerWindowId || !ownerSidepanelOpen || ownerWindowId === reqWindowId;
```

```ts
port.onDisconnect.addListener(() => {
  closeSidepanel(windowId, false);
});
```

`docs/sitegeist/src/sidepanel.ts`:

```ts
// Navigation will disconnect port and auto-release locks
window.location.href = url.toString();
```

Meaning:

- Sitegeist sidepanel owns the live `Agent`
- background owns lock state, not runtime execution
- closing/navigating the sidepanel releases ownership
- reopen behavior is reacquire + rebuild, not keep-the-same-stream-alive

That is the closest local reference point for the architecture below.

## Target Architecture

### Core shape

- page-owned runtime, not worker-owned runtime
- owner lease per session, not shared session runtime
- fresh `TurnRunner` per active turn
- Dexie as durable truth
- optional `BroadcastChannel` as fast signal only

### Durable state

Keep:

- `sessions`
- `messages`
- `settings`
- `providerKeys`
- `dailyCosts`

Add:

- `session_leases`
- `session_runtime`

### Runtime ownership model

- exactly one tab may own a session at a time
- other tabs can read the session from Dexie but cannot mutate it
- owner tab renews a heartbeat while it owns the session
- if owner dies, lease goes stale
- next tab may take over only after stale detection

### Turn model

- do not keep one long-lived `AgentHost` per session in memory
- create a fresh `TurnRunner` from persisted session + messages when a send starts
- keep the runner only while that turn is active
- persist checkpoints during the turn
- destroy the runner when the turn finishes, aborts, or errors

### Interruption model

- if the page is closed / discarded / frozen and the provider request dies, we do not try to continue the same request
- instead:
  - detect stale owner lease
  - reconcile any streaming rows into interrupted/error state
  - keep partial assistant output if it exists
  - allow clean retry/resume

## New Data Model

### New durable rows

Add to `src/types/storage.ts`:

```ts
export interface SessionLeaseRow {
  acquiredAt: string
  heartbeatAt: string
  ownerTabId: string
  ownerToken: string
  sessionId: string
}

export type SessionRuntimeStatus =
  | "idle"
  | "streaming"
  | "interrupted"
  | "aborted"
  | "error"
  | "completed"

export interface SessionRuntimeRow {
  assistantMessageId?: string
  lastError?: string
  lastProgressAt?: string
  ownerTabId?: string
  sessionId: string
  startedAt?: string
  status: SessionRuntimeStatus
  turnId?: string
  updatedAt: string
}
```

### Why separate tables instead of extending `SessionData`

- `SessionData.updatedAt` currently drives ordering in `listSessions()`
- heartbeat writes must not reorder the sidebar every few seconds
- `exportAllChatData()` currently exports `sessions + messages`
- lease/runtime rows are transient and should not ship in exports

Current export path in `src/db/schema.ts`:

```ts
return {
  exportVersion: 1,
  exportedAt: new Date().toISOString(),
  sessions: sessionsWithMessages,
}
```

So:

- keep lease/runtime metadata outside exported session history

### Dexie schema changes

In `src/db/schema.ts`, bump the DB version and add tables:

```ts
this.version(2).stores({
  daily_costs: "date",
  messages:
    "id, sessionId, [sessionId+timestamp], [sessionId+status], timestamp, status",
  "provider-keys": "provider, updatedAt",
  repositories: "[owner+repo+ref], lastOpenedAt",
  session_leases: "sessionId, ownerTabId, heartbeatAt",
  session_runtime: "sessionId, status, ownerTabId, lastProgressAt, updatedAt",
  sessions: "id, updatedAt, createdAt, provider, model, isStreaming",
  settings: "key, updatedAt",
})
```

Add helpers:

- `getSessionLease(sessionId)`
- `putSessionLease(row)`
- `deleteSessionLease(sessionId)`
- `getSessionRuntime(sessionId)`
- `putSessionRuntime(row)`
- `deleteSessionRuntime(sessionId)`

Also extend `deleteAllLocalData()` to clear both new stores.

## Recommended UX Policy

To keep the runtime simpler than the current worker model:

- one tab can own multiple sessions over time
- but do **not** allow a single tab to silently keep streaming session A while the user navigates that same tab into session B
- if the current tab owns a streaming session and the user tries to open another session:
  - open the target session in a new tab
  - keep the current tab attached to the active stream

This keeps the model simple:

- one active streaming session per tab
- one owner tab per session
- mirrors are read-only

If product later wants one tab to own multiple simultaneous streams, that can be added later, but it is not part of this plan.

## Detailed Implementation Phases

### Phase 0: Lock the contract and remove worker assumptions from docs

#### Tasks

- [ ] update `AGENTS.md` to remove the `SharedWorker` / `Worker` requirement
- [ ] update `SPEC.md` architecture text so it no longer implies background worker ownership
- [ ] document the hard guarantee:
  - recoverable interruption
  - not immortal stream continuation after page death
- [ ] document the UX policy:
  - same-tab navigation away from a streaming session opens a new tab

#### Acceptance

- [ ] docs no longer contradict the implementation plan

### Phase 1: Add explicit tab identity and lease persistence

#### New files

- [ ] `src/agent/tab-id.ts`
- [ ] `src/agent/session-lease.ts`
- [ ] `src/agent/runtime-channel.ts` (optional but recommended)

#### Tasks

- [ ] create a stable tab id using `sessionStorage`
- [ ] expose `getCurrentTabId()`
- [ ] implement `claimSessionLease(sessionId)`
- [ ] implement `renewSessionLease(sessionId)`
- [ ] implement `releaseSessionLease(sessionId)`
- [ ] implement `loadSessionLeaseState(sessionId)`
- [ ] make Dexie the source of truth
- [ ] use `BroadcastChannel` only as a fast invalidation layer, never as correctness storage
- [ ] add best-effort release handlers for:
  - `pagehide`
  - `beforeunload`
- [ ] add stale lease constants:
  - `LEASE_HEARTBEAT_MS`
  - `LEASE_STALE_MS`

#### Claim algorithm

Use compare-then-confirm, not blind overwrite:

```ts
export async function claimSessionLease(
  sessionId: string
): Promise<LeaseClaimResult> {
  const now = getIsoNow()
  const ownerTabId = getCurrentTabId()
  const ownerToken = createId()

  await db.transaction("rw", db.sessionLeases, async () => {
    const current = await db.sessionLeases.get(sessionId)

    if (
      current &&
      current.ownerTabId !== ownerTabId &&
      !isLeaseStale(current, now)
    ) {
      return
    }

    await db.sessionLeases.put({
      acquiredAt: current?.acquiredAt ?? now,
      heartbeatAt: now,
      ownerTabId,
      ownerToken,
      sessionId,
    })
  })

  const persisted = await db.sessionLeases.get(sessionId)

  if (persisted?.ownerToken === ownerToken) {
    return { kind: "owned", lease: persisted }
  }

  return {
    kind: "locked",
    ownerTabId: persisted?.ownerTabId,
  }
}
```

#### Acceptance

- [ ] two tabs cannot both believe they own the same fresh lease
- [ ] stale owner can be taken over
- [ ] refresh in the same tab preserves tab identity

### Phase 2: Add durable turn runtime state

#### New file

- [ ] `src/agent/session-runtime-store.ts`

#### Tasks

- [ ] add CRUD helpers for `session_runtime`
- [ ] record:
  - `status`
  - `turnId`
  - `assistantMessageId`
  - `ownerTabId`
  - `startedAt`
  - `lastProgressAt`
  - `lastError`
- [ ] keep `session.isStreaming` for existing UI compatibility
- [ ] treat `session_runtime` as canonical for recovery timing
- [ ] create `markTurnStarted`
- [ ] create `markTurnProgress`
- [ ] create `markTurnCompleted`
- [ ] create `markTurnInterrupted`
- [ ] create `clearTurnRuntime`

#### Snippet

```ts
export async function markTurnStarted(params: {
  assistantMessageId: string
  sessionId: string
  turnId: string
}): Promise<void> {
  const now = getIsoNow()
  await db.sessionRuntime.put({
    assistantMessageId: params.assistantMessageId,
    lastProgressAt: now,
    ownerTabId: getCurrentTabId(),
    sessionId: params.sessionId,
    startedAt: now,
    status: "streaming",
    turnId: params.turnId,
    updatedAt: now,
  })
}
```

#### Acceptance

- [ ] a session can be `isStreaming: true` and still have explicit runtime timing metadata
- [ ] recovery code no longer has to guess based only on `session.updatedAt`

### Phase 3: Replace worker transport with page-owned runtime registry

#### Files to refactor

- [ ] `src/agent/runtime-client.ts`
- [ ] `src/agent/agent-host.ts`
- [ ] `src/agent/runtime-command-errors.ts`

#### Files to delete

- [ ] `src/agent/runtime-worker.ts`
- [ ] `src/agent/runtime-worker-api.ts`
- [ ] `src/agent/runtime-worker-types.ts`

#### Tasks

- [ ] replace worker-handle map with page-owned active-runner map
- [ ] delete Comlink-specific transport code
- [ ] remove worker init / dispose / transport retry logic
- [ ] keep the public runtime API shape where useful:
  - `startTurn`
  - `startInitialTurn`
  - `abort`
  - `setModelSelection`
  - `setThinkingLevel`
- [ ] rework the implementation so `startTurn` directly loads session data and creates a fresh runner
- [ ] keep at most one active runner per session id
- [ ] keep `BusyRuntimeError` for same-session double-send
- [ ] remove or simplify `MissingSessionRuntimeError` transport-specific branches where no longer needed

#### Recommended refactor

Rename `AgentHost` to `TurnRunner`, or keep the file and change the semantics:

- before: session-bound runtime owner
- after: active-turn runner built from persisted state

#### Snippet

```ts
export class PageRuntimeClient {
  private readonly activeTurns = new Map<string, TurnRunner>()

  async startTurn(sessionId: string, content: string): Promise<void> {
    if (this.activeTurns.has(sessionId)) {
      throw new BusyRuntimeError(sessionId)
    }

    const loaded = await loadSessionWithMessages(sessionId)

    if (!loaded) {
      throw new MissingSessionRuntimeError(sessionId)
    }

    const runner = new TurnRunner(loaded.session, loaded.messages)
    this.activeTurns.set(sessionId, runner)

    try {
      await runner.start(content)
    } finally {
      if (!runner.isRunning()) {
        this.activeTurns.delete(sessionId)
      }
    }
  }

  abort(sessionId: string): void {
    this.activeTurns.get(sessionId)?.abort()
  }
}
```

#### Acceptance

- [ ] there is no worker creation anywhere in the app
- [ ] runtime calls are page-local method calls
- [ ] same-session double-send still fails deterministically

### Phase 4: Rebuild runtime as ephemeral turn runner, not session host

#### Files to refactor

- [ ] `src/agent/agent-host.ts`
- [ ] `src/agent/session-adapter.ts`
- [ ] `src/agent/provider-stream.ts`

#### Tasks

- [ ] make runner construction always start from persisted `session + messages`
- [ ] keep the current `persistPromptStart()` behavior
- [ ] checkpoint draft assistant text and `lastProgressAt` on every meaningful event
- [ ] update `session_runtime` on:
  - turn start
  - text delta / message delta
  - completion
  - abort
  - error
- [ ] flush queued persistence before terminal cleanup
- [ ] on terminal cleanup:
  - write final assistant state if available
  - clear `session.isStreaming`
  - mark `session_runtime.status`
  - release the lease if appropriate

#### Important rule

Do **not** create one long-lived `Agent` at session open time.

Do:

- create one `Agent` when a turn starts
- seed it from durable history
- destroy it when the turn ends

#### Snippet

```ts
export class TurnRunner {
  private readonly agent: Agent
  private running = false

  constructor(
    private readonly session: SessionData,
    private readonly messages: MessageRow[]
  ) {
    const model = getModel(session.provider, session.model)

    this.agent = new Agent({
      convertToLlm: webMessageTransformer,
      getApiKey: async (provider) =>
        await resolveApiKeyForProvider(provider as ProviderId, session.providerGroup),
      initialState: buildInitialAgentState(
        session,
        messages,
        model,
        getAgentToolsForSession(session)
      ),
      streamFn: streamChatWithPiAgent,
      toolExecution: "sequential",
    })
  }

  async start(content: string): Promise<void> {
    this.running = true
    await this.persistPromptStart(content)
    void this.runToCompletion()
  }

  isRunning(): boolean {
    return this.running
  }
}
```

#### Acceptance

- [ ] idle sessions do not hold live `Agent` instances
- [ ] active runtime exists only for active turns
- [ ] model/thinking settings remain durable session state, not hidden runtime memory

### Phase 5: Move first-send persistence boundary into runtime start

#### Files to refactor

- [ ] `src/sessions/session-actions.ts`
- [ ] `src/components/chat.tsx`
- [ ] `src/sessions/session-bootstrap.ts`

#### Tasks

- [ ] stop persisting empty sessions during `createSessionForChat` / `createSessionForRepo`
- [ ] return an in-memory draft session instead
- [ ] move first durable write into `startInitialTurn`
- [ ] persist session row + first user row + first assistant streaming row atomically
- [ ] delete `session-bootstrap.ts`
- [ ] delete bootstrap-only failure state if it becomes dead code
- [ ] navigate only after `startInitialTurn` resolves
- [ ] keep post-navigation settings persistence out of the critical path

#### Why

Current `src/sessions/session-service.ts` persists too early:

```ts
const session = createSession(...)
await persistSessionSnapshot(session)
return session
```

That creates provisional empty rows.

#### Snippet

```ts
export type SessionDraft = Omit<SessionData, "createdAt" | "id" | "updatedAt"> & {
  createdAt?: string
  id?: string
  updatedAt?: string
}

async function startInitialTurn(
  draft: SessionDraft,
  content: string
): Promise<SessionData> {
  const session = materializeSession(draft)
  const turn = buildInitialTurn(session, content)

  await putSessionAndMessages(session, [turn.userRow, turn.assistantRow])
  await markTurnStarted({
    assistantMessageId: turn.assistantRow.id,
    sessionId: session.id,
    turnId: turn.turnId,
  })

  void createRunnerAndCompleteTurn(session, [turn.userRow, turn.assistantRow], turn)

  return session
}
```

#### Acceptance

- [ ] new chat creation does not leave empty chat shells in Dexie on failure
- [ ] first send and existing send share the same runtime boundary

### Phase 6: Add owner-aware UI and read-only mirrors

#### Files to add/refactor

- [ ] `src/hooks/use-session-ownership.ts`
- [ ] `src/hooks/use-runtime-session.ts`
- [ ] `src/components/chat.tsx`
- [ ] `src/components/chat-footer.tsx`
- [ ] `src/components/app-sidebar.tsx`
- [ ] `src/components/chat-session-list.tsx`

#### Tasks

- [ ] expose ownership state:
  - `owned`
  - `locked`
  - `stale`
  - `none`
- [ ] disable composer in non-owner tabs
- [ ] disable model/thinking mutations in non-owner tabs
- [ ] show a clear banner when viewing a mirror:
  - "This session is active in another tab"
- [ ] add action buttons:
  - `Open in new tab`
  - `Take over` only when stale
- [ ] in session list/sidebar, mark sessions as locked if another tab owns them
- [ ] if current tab owns a streaming session and the user clicks another session:
  - open target in a new tab instead of navigating away in-place

#### Snippet

```ts
export function useSessionOwnership(sessionId: string | undefined) {
  return useLiveQuery(async () => {
    if (!sessionId) {
      return { kind: "none" } as const
    }

    const lease = await getSessionLease(sessionId)

    if (!lease) {
      return { kind: "none" } as const
    }

    if (lease.ownerTabId === getCurrentTabId()) {
      return { kind: "owned", lease } as const
    }

    if (isLeaseStale(lease)) {
      return { kind: "stale", lease } as const
    }

    return { kind: "locked", lease } as const
  }, [sessionId])
}
```

#### Acceptance

- [ ] mirror tabs never mutate runtime state
- [ ] owner state is visible in UI
- [ ] switching sessions while streaming does not silently orphan the active turn

### Phase 7: Move recovery into one runtime-recovery layer

#### Files to refactor

- [ ] `src/sessions/session-notices.ts`
- [ ] `src/components/chat.tsx`
- [ ] `src/hooks/use-runtime-session.ts`
- [ ] `src/agent/agent-host.ts` or new `src/agent/turn-recovery.ts`

#### Tasks

- [ ] split visible notice dedupe from repair logic
- [ ] preserve the existing behavior that rewrites streaming assistant rows
- [ ] stop using `session.updatedAt` as the only stale signal
- [ ] recover based on:
  - `session.isStreaming`
  - `session_runtime.status`
  - `session_runtime.lastProgressAt`
  - `session_leases.heartbeatAt`
- [ ] if a lease is stale and runtime row is still streaming:
  - rewrite streaming assistant rows to interrupted/error
  - clear `session.isStreaming`
  - mark runtime `interrupted`
  - append deduped system notice
- [ ] if repair throws, surface it in UI instead of swallowing it
- [ ] remove UI-side runtime-error persistence ownership where possible

#### Snippet

```ts
export async function recoverInterruptedTurn(sessionId: string): Promise<void> {
  const [loaded, lease, runtime] = await Promise.all([
    loadSessionWithMessages(sessionId),
    getSessionLease(sessionId),
    getSessionRuntime(sessionId),
  ])

  if (!loaded || !loaded.session.isStreaming) {
    return
  }

  if (lease && !isLeaseStale(lease)) {
    return
  }

  const classified = classifyRuntimeError(new StreamInterruptedRuntimeError())
  const nextMessages = rewriteStreamingAssistantRows(
    loaded.messages,
    classified.message
  )

  await putSessionAndMessages(
    buildPersistedSession(
      {
        ...loaded.session,
        error: undefined,
        isStreaming: false,
        updatedAt: getIsoNow(),
      },
      nextMessages
    ),
    changedRowsFromRewrite(loaded.messages, nextMessages)
  )

  await db.sessionRuntime.put({
    ...(runtime ?? { sessionId }),
    lastError: classified.message,
    ownerTabId: undefined,
    status: "interrupted",
    updatedAt: getIsoNow(),
  })
}
```

#### Acceptance

- [ ] page close during streaming never leaves permanent fake streaming
- [ ] repeated same-fingerprint failures still repair state
- [ ] read-only mirrors recover cleanly after stale owner detection

### Phase 8: Remove worker-only code and stale terminology

#### Files to clean up

- [ ] `src/components/data-settings.tsx`
- [ ] `src/lib/runtime-debug.ts`
- [ ] `src/agent/runtime-command-errors.ts`
- [ ] any worker-only imports or debug event names

#### Tasks

- [ ] replace "release runtime workers before calling" wording in `src/db/schema.ts`
- [ ] remove best-effort worker teardown from delete-all flow
- [ ] replace worker debug events:
  - `worker_init_started`
  - `worker_init_completed`
- [ ] add new debug events:
  - `lease_claim_started`
  - `lease_claimed`
  - `turn_runner_started`
  - `turn_runner_progress`
  - `turn_runner_completed`
  - `turn_recovered`

#### Cleanup snippet

Current delete-all path in `src/components/data-settings.tsx`:

```ts
for (const session of sessions) {
  try {
    await runtimeClient.releaseSession(session.id)
  } catch {
    // Best-effort worker teardown.
  }
}
```

After refactor:

```ts
await runtimeClient.releaseAll()
await deleteAllLocalData()
```

Where `releaseAll()` only:

- aborts active page-owned turn runners
- releases owned leases

#### Acceptance

- [ ] there are no worker-specific terms left in runtime code paths

## Manual Verification Matrix

No test-first gating here. app behavior first.

- [ ] new session first send:
  - send first prompt
  - navigate completes
  - assistant streams
  - no empty session shells if start fails
- [ ] same session, two tabs:
  - owner tab can send
  - second tab is read-only
  - second tab sees lock state
- [ ] owner tab reload during stream:
  - lease eventually goes stale
  - session reconciles to interrupted
  - no infinite spinner
- [ ] owner tab closed during stream:
  - mirror tab becomes stale candidate after timeout
  - takeover works
  - interrupted state visible
- [ ] same-tab navigation away from streaming chat:
  - target opens in new tab
  - original stream stays attached to original tab
- [ ] idle reopen of old session:
  - session loads from Dexie
  - no live runtime required
- [ ] provider/model change while idle:
  - next turn uses new settings
- [ ] provider/model change while another tab owns session:
  - change is blocked in mirror mode
- [ ] hidden tab:
  - if browser keeps it alive, stream may finish
  - if browser kills it, stale recovery still works

## Typecheck / Stabilization

- [ ] run `bun run typecheck` continuously during implementation
- [ ] do not treat broad test work as the main path until the app behavior is stable
- [ ] after app behavior is stable, add only the minimum regression coverage needed for:
  - lease claim race
  - stale lease recovery
  - first-send atomic persistence

## Files Expected To Be Deleted

- [ ] `src/agent/runtime-worker.ts`
- [ ] `src/agent/runtime-worker-api.ts`
- [ ] `src/agent/runtime-worker-types.ts`
- [ ] `src/sessions/session-bootstrap.ts`

## Files Expected To Be Added

- [ ] `src/agent/tab-id.ts`
- [ ] `src/agent/session-lease.ts`
- [ ] `src/agent/session-runtime-store.ts`
- [ ] `src/hooks/use-session-ownership.ts`
- [ ] optionally `src/agent/runtime-channel.ts`

## Files Expected To Be Heavily Refactored

- [ ] `src/agent/runtime-client.ts`
- [ ] `src/agent/agent-host.ts`
- [ ] `src/components/chat.tsx`
- [ ] `src/components/app-sidebar.tsx`
- [ ] `src/components/chat-footer.tsx`
- [ ] `src/db/schema.ts`
- [ ] `src/types/storage.ts`
- [ ] `src/sessions/session-actions.ts`
- [ ] `src/sessions/session-notices.ts`

## Final Architecture Check

If the implementation ends with:

- worker transport
- shared runtime across tabs
- long-lived session-bound agent hosts
- UI-side runtime failure repair

then the refactor failed.

If the implementation ends with:

- page-owned runtime
- explicit owner lease
- read-only mirrors
- fresh turn runner per active turn
- durable interruption recovery

then it matched the plan.
