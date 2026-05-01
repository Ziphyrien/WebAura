# Implement Share Links

## Goal

Implement client-side share links for WebAura conversations without adding a hosted backend. Small shares are fully embedded in the URL fragment. Larger shares are encrypted in the browser and published as chunked Nostr events to public relay nodes.

## Requirements

- Add a user-facing share action for non-empty chat sessions near the existing session utility actions.
- Build a sanitized read-only share snapshot from the current displayed conversation, including title/model metadata where available and message content that is safe to render publicly.
- Support URL fragment shares for payloads whose encoded/compressed share data is at or below 16KB.
- Support Nostr encrypted chunk shares for payloads over 16KB and up to 300KB.
- Reject payloads over 300KB with an actionable UI error that reports the size and suggests sharing a shorter conversation.
- Use browser-only crypto and transport. WebAura must not add a backend API, database table, hosted storage, account requirement, analytics, access statistics, deletion flow, edit flow, or permanent availability guarantee.
- Generate a fresh random encryption key per share. The key must stay in the URL fragment and must not be sent to relays.
- Generate a fresh one-time Nostr signing key per Nostr share. Users must not need to configure or understand Nostr keys.
- Publish Nostr data as a manifest plus encrypted chunks. Publish chunks before the manifest.
- Discover candidate relays dynamically from Nostr.watch where practical, prefer low-latency public/free relays, probe/filter relays where practical, and require redundant publication so the share is not dependent on one relay.
- Do not publish through hardcoded relay fallbacks when discovery/probing cannot prove enough suitable relays. If discovery cannot produce enough relays, fail clearly instead of silently guessing.
- Include the actually successful relay set in the generated share link so readers know where to fetch the data.
- Add a share route/page that can open both URL fragment and Nostr share links and render the shared conversation read-only.
- Handle read failures clearly: invalid link, unsupported version, decryption failure, missing manifest, missing chunks, relay failures, and oversized/invalid payload.
- Preserve existing copy-as-Markdown behavior.

## Acceptance Criteria

- [ ] A chat with a small transcript can generate a `/share#...` link that contains all data in the fragment, copies to clipboard, and opens into a read-only share page.
- [ ] A transcript between 16KB and 300KB is encrypted, chunked, published to multiple discovered and verified free/public Nostr relays, copied as a `/share#...` link, and can be read back from any successful relay copy.
- [ ] The Nostr reader tolerates some relay failures as long as every manifest/chunk can be recovered from at least one relay.
- [ ] Relay-stored content is encrypted; the decryption key is only present in the URL fragment.
- [ ] Oversized conversations fail before publishing and do not produce partial links.
- [ ] Unit tests cover share encoding/decoding, URL-fragment mode selection, payload size rejection, Nostr chunk manifest assembly, and share snapshot sanitization.
- [ ] Existing chat/copy tests continue to pass.
- [ ] Type-check and test commands pass for changed packages where feasible.

## Definition of Done

- Tests added or updated for protocol utilities and UI plumbing where practical.
- `bun run check-types` or targeted package type-check passes.
- `bun run test` or targeted Vitest tests pass.
- The generated share links never put plaintext conversation content or the encryption key in HTTP query/path components.
- No server-side persistence, DB migration, auth, stats, delete, edit, or permanent-share feature is introduced.

## Technical Approach

- Add a pure frontend share module under `@webaura/pi` for snapshot creation, encoding, encryption, URL parsing, and Nostr publish/read helpers.
- Use `CompressionStream`/`DecompressionStream` when available, with a deterministic fallback if needed for tests/runtime compatibility.
- Use `crypto.subtle` AES-GCM for payload encryption and SHA-256 for integrity metadata.
- Add a light Nostr signing implementation/dependency if no existing Schnorr/secp256k1 helper is available.
- Represent Nostr shares as a manifest event plus chunk events. The manifest records version, app id, encoding, byte sizes, chunk size, and chunk event ids/hashes.
- Default chunk size should be conservative, around 8KB, to fit public relay event-size policies.
- Add dynamic relay discovery using Nostr.watch where practical. Score/filter candidates for low latency and public/free write/read behavior.
- Probe relay metadata where practical and exclude relays that require auth/payment, report too small a content limit, or cannot be verified through the browser.
- Do not keep a hardcoded publish fallback relay list. If Nostr.watch discovery and relay probing cannot produce enough candidates, return an actionable publish error.
- Add a `/share` client route in `apps/web` that parses `location.hash`, loads the share, and renders a read-only transcript using existing UI primitives.
- Extend `SessionUtilityActions` with a Share action and wire it from `Chat`.

## Decision (ADR-lite)

**Context**: The project is local-first and the user explicitly wants only `<=16KB URL fragment` and `16KB-300KB Nostr encrypted chunks`, with no durable hosted service or additional long-term product surface.

**Decision**: Implement two client-only share transports: URL fragment for small payloads and encrypted Nostr chunks for medium payloads. Do not implement deletion, editing, statistics, accounts, GitHub/Gist fallback, WebTorrent, or Cloudflare storage.

**Consequences**: WebAura avoids backend cost and preserves local-first architecture. URL shares are reliable but size-limited. Nostr shares are cheap and direct but cannot guarantee retention, deletion, or relay availability.

## Out of Scope

- Delete share.
- Edit share.
- Access stats.
- Password prompt beyond possession of the full fragment link.
- Login/account integration.
- GitHub Gist, Cloudflare, WebTorrent, IPFS, or any other fallback storage.
- Permanent availability guarantees.
- Server APIs or database schema changes.

## Technical Notes

- Existing chat UI lives in `packages/ui/src/components/chat.tsx` and utility actions in `packages/ui/src/components/session-utility-actions.tsx`.
- Existing route files live under `apps/web/src/routes`; generated `routeTree.gen.ts` is build-generated and should not be hand-edited unless the project convention requires test fixtures to be updated.
- Existing display messages use `@webaura/pi/types/chat` and text extraction helpers in `@webaura/pi/lib/chat-adapter`.
- Existing copy-to-markdown behavior is implemented in `@webaura/pi/lib/copy-session-markdown.ts`.
- Relevant specs: web/ui/pi frontend indexes plus shared cross-layer and code-reuse guides.
