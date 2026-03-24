# UI Research for `/chat`

## Scope

This document compares the old UI in `~/Developer/v1/gitoverflow-v0/apps/web-old` with the current gitinspect.com client in this repo, with a focus on the layout and composition pieces needed for a new `/chat` route.

The goal is to understand:

- how the old chat UI is structured
- which parts are real layout decisions versus sample/demo content
- what already exists in this repo and can be reused
- what needs to be extracted into `components/new/*` for the `/chat` experience

This is UI-only research. It does not assume backend wiring.

---

## Executive Summary

The old app’s chat UI is not a single page component. It is a shell composed of:

- a left session sidebar
- a sticky top header with route controls and status pills
- a central message column with a bottom composer
- a settings modal for provider/repo/proxy/cost configuration

The current repo already has most of the functional equivalents, but they are arranged differently:

- `src/components/app-shell.tsx` currently owns the main live shell
- `src/routes/chat.tsx` is still a placeholder
- the repo already contains reusable primitives for sessions, messages, model selection, provider badges, settings, and a broad `ai-elements` library

The practical implication is that `/chat` should be built by composing existing local primitives into a new route shell, not by wiring backend logic first.

---

## Old App Structure

### Route entry points

The old UI lives in a Next App Router tree:

- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/app/chat/layout.tsx`
- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/app/chat/page.tsx`

Important observation:

- `src/app/chat/page.tsx` is only a stub (`Hello World`)
- the real UI shape is in `src/app/chat/layout.tsx`

That layout file contains two things:

- a large commented prototype for an earlier chat shell
- the final exported layout used by the app

### Final chat shell in the old app

`src/app/chat/layout.tsx` wraps the route in a `SidebarProvider` and builds a three-part page:

- `ChatSidebar` on the left
- `SidebarInset` as the main content frame
- a sticky header plus a scrolling child area for the route content

The final layout uses:

- `SidebarTrigger`
- `Breadcrumb` / `BreadcrumbPage`
- `Search` + `Input`
- `GitHubLink`
- `ThemeToggle`
- `Separator`

The visual pattern is:

- left rail for session navigation
- top bar for route identity and utility controls
- main canvas for the route body

Source:

- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/app/chat/layout.tsx`

### Old left sidebar

`ChatSidebar` is the main navigation chrome for the old UI:

- header contains `Logo`
- middle section contains `NavSessions`
- footer contains `Home`, `Popular`, and `NavUser`
- `SidebarRail` is present for collapsed behavior

The sidebar is not just a static list. It is a deliberately structured shell with:

- branding at the top
- session management in the middle
- account/navigation affordances at the bottom

Source:

- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/components/chat-sidebar.tsx`

### Session list behavior

`NavSessions` is where the old app encodes session-specific interaction:

- sessions are grouped into `Today`, `Yesterday`, `Last 7 Days`, `Last 30 Days`, and `Older`
- the list excludes branch-like sessions via `!session.parentID`
- sessions are sorted by `time.updated` descending
- a large `New Chat` button resets the active session
- each session item can show a delete action through `AlertDialog`

This file is important because it shows the old app’s mental model for history:

- session history is time-bucketed
- the active session is a selected item in the sidebar
- deletion is a first-class sidebar action, not a hidden settings action

Source:

- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/components/nav-sessions.tsx`

### Supporting chrome

The old sidebar footer uses two supporting pieces:

- `Logo` provides the product mark, with `git` and `overflow` split styling
- `NavUser` provides the account dropdown with avatar, email, and account actions

There is also a `SidebarRight` example in the old tree, but it is not part of the final `/chat` layout.

Sources:

- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/components/logo.tsx`
- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/components/nav-user.tsx`
- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/components/sidebar-right.tsx`

### The old app was mostly shell-first

The old `chat/page.tsx` does not implement chat content. It returns a placeholder.

That means the shell is the actual product artifact being studied here, not the page body.

Source:

- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/app/chat/page.tsx`

---

## Current Repo Status

### Route integration

The current repo is TanStack Router-based, not Next App Router-based:

- `src/router.tsx` creates the router from `routeTree.gen.ts`
- `src/routes/__root.tsx` defines the document shell and global styles
- `src/routes/index.tsx` currently mounts `AppShell`
- `src/routes/chat.tsx` is only a placeholder

This matters because the old file tree can be used as layout reference, but not copied mechanically into the new route system.

Sources:

- `/Users/jeremy/Developer/gitoverflow/src/router.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/routes/__root.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/routes/index.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/routes/chat.tsx`

### Existing shell in this repo

`src/components/app-shell.tsx` already implements the current app’s production shell:

- local bootstrap and session restore
- active session selection
- left sidebar session browser
- top header with model selector, provider badge, repo source badge, live/idle status, and settings button
- scrolling chat thread
- composer docked at the bottom
- settings dialog for providers, repo, proxy, and costs

This shell is structurally close to the old app, but visually and compositionally different.

Sources:

- `/Users/jeremy/Developer/gitoverflow/src/components/app-shell.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/session-sidebar.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/chat-thread.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/composer.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/model-picker.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/provider-badge.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/settings-dialog.tsx`

### Existing message and AI primitives

The repo already has a broad `ai-elements` surface under `src/components/ai-elements/`.

The important ones for a `/chat` UI are:

- `conversation.tsx` for stick-to-bottom chat framing and download support
- `message.tsx` for user/assistant message presentation, branching, and response rendering
- `prompt-input.tsx` for richer prompt/attachment composition
- `toolbar.tsx` for floating node/toolbars
- `artifact.tsx`, `tool.tsx`, `terminal.tsx`, `web-preview.tsx`, `code-block.tsx`, `plan.tsx`, `commit.tsx`, `sandbox.tsx`, `file-tree.tsx`, `task.tsx`, and related files for specialized assistant output

This library is the reason a `components/new/*` layer makes sense:

- the primitives already exist
- the new `/chat` screen should compose them into one route-specific layout
- we should avoid creating one-off rendering logic in the route itself

Sources:

- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/conversation.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/message.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/prompt-input.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/toolbar.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/artifact.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/tool.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/terminal.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/web-preview.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/code-block.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/plan.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/commit.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/sandbox.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/file-tree.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/task.tsx`

---

## Layout Findings

### Shared shape between old and current app

Both apps converge on the same high-level layout idea:

- left session/history rail
- center conversation area
- bottom composer
- top utility chrome

The old app expresses this shape in the route layout itself.
The current app expresses it in `AppShell`.

That is the key structural match.

### Differences that matter

The old UI is more shell-forward and route-forward:

- the sidebar and header are part of the page layout
- the session list is visibly date grouped
- the header contains direct utility controls
- the route page itself is thin

The current UI is more app-state-forward:

- `AppShell` owns active session bootstrap and runtime session wiring
- the header exposes model/provider/repo state directly
- the conversation body is centered around current session data

For `/chat`, the old layout should be treated as the visual target, while the current shell logic should be reused as the data source where possible.

### What is probably reusable as-is

From the current repo, the most reusable pieces for the new `/chat` composition are:

- `src/components/session-sidebar.tsx`
- `src/components/chat-thread.tsx`
- `src/components/composer.tsx`
- `src/components/model-picker.tsx`
- `src/components/provider-badge.tsx`
- `src/components/settings-dialog.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/breadcrumb.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/select.tsx`
- the `ai-elements` primitives listed above

### What probably needs to move into `components/new/*`

The old app suggests a route-specific shell layer rather than a universal shell:

- route header composition
- session sidebar composition
- session list grouping and actions
- chat body framing
- any route-specific top chrome

That is the place for a new `components/new` folder if you want the `/chat` route isolated from the current main shell.

---

## Recommended Implementation Notes

This research suggests the `/chat` route should be assembled as:

1. a route-specific shell component under `components/new/*`
2. a left sidebar built from the existing sidebar primitives
3. a header row that mirrors the old app’s `SidebarTrigger` / breadcrumb / utility controls pattern
4. a message body rendered from `ai-elements` rather than ad hoc divs
5. a bottom composer that can later be wired to the runtime

The route should not be wired to backend behavior yet, but it should already have the correct composition boundaries.

---

## Concrete Source Map

### Old UI sources

- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/app/chat/layout.tsx`
- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/app/chat/page.tsx`
- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/components/chat-sidebar.tsx`
- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/components/nav-sessions.tsx`
- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/components/logo.tsx`
- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/components/nav-user.tsx`
- `/Users/jeremy/Developer/v1/gitoverflow-v0/apps/web-old/src/components/sidebar-right.tsx`

### Current repo sources

- `/Users/jeremy/Developer/gitoverflow/src/routes/chat.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/routes/index.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/app-shell.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/session-sidebar.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/chat-thread.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/composer.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/model-picker.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/provider-badge.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/settings-dialog.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/conversation.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/message.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/prompt-input.tsx`
- `/Users/jeremy/Developer/gitoverflow/src/components/ai-elements/toolbar.tsx`

---

## Bottom Line

The old `web-old` folder is a layout study in shell composition, not a finished chat implementation. Its value is the structure:

- session history left rail
- sticky route header
- central conversation canvas
- composer dock
- settings and provider utilities

The current repo already has most of the data/runtime pieces, plus a broad `ai-elements` library. The clean next step is to build a dedicated `/chat` composition layer from those existing primitives, with the old app as the visual and structural reference.
