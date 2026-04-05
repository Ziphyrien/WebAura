# Auth UX overhaul plan

## Phase 1 — Core auth UX fixes

- [x] Prevent stale pending auth actions from silently resuming later
- [x] Add guided two-step private repo access flow with progress feedback
- [x] Simplify auth language foundations across core flows

## Phase 2 — Main auth entry-point improvements

- [x] Replace misleading primary CTA logic in GitHub settings
- [x] Add a global auth status chip in the header
- [x] Clarify sign-out behavior when a local PAT is still saved

## Phase 3 — Trust and recovery improvements

- [x] Redesign auth dialog hierarchy and copy for each auth reason
- [x] Unify privacy and storage copy across auth surfaces
- [x] Improve auth recovery and error messaging

## Phase 4 — Guest-path resolution

- [x] Make the guest first-message flow fully intentional and consistent

## Verification

- [x] Continuous typechecks pass after each implementation phase
- [x] Final typecheck passes with all phases complete
