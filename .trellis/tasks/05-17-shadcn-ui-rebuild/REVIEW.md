# Review

## Status

Approved for the current implementation scope.

## Review Scope

Reviewed:

- shadcn config updates in `packages/ui` and `apps/web`.
- CLI-regenerated standard shadcn components in `packages/ui/src/components`.
- Shared global CSS theme and typography changes.
- UI package dependency changes.
- Trellis task and design-system spec updates.

Not reviewed as complete:

- Browser visual QA.
- Production build.

## Findings

### Fixed: config-only preset change was insufficient

Initial work only changed records and shared CSS. That did not constitute a real shadcn preset switch because standard component source remained Lyra. This was corrected by running shadcn CLI with `add ... --overwrite` in `packages/ui`, updating 55 standard shadcn component files.

### Fixed: accidental app-local shadcn setup

Running `shadcn init` in `apps/web` created `apps/web/src/lib/utils.ts` and changed app aliases toward local `@/components/ui`. This was not correct for the monorepo because the real shared components live in `packages/ui`. The accidental file was removed and aliases were restored to `@firefly/ui`.

### Fixed: react-day-picker class name mismatch

CLI output used `classNames.table`, but current `react-day-picker@10.0.1` uses `month_grid`. The component was patched to use `month_grid`, preserving styling and restoring type safety.

### Fixed: extensions, GitHub PAT, and costs panels had custom square cards

The extensions, GitHub PAT, and costs panels used custom markup, not standard shadcn components. They still had `rounded-none` / bare bordered card containers after the CLI refresh. These panels now compose existing shadcn components: `Card` for cards/rows, `Alert` for informational/loading/error states, `Empty` for empty states, and `Field` for the GitHub token form.

### Fixed: custom components now use Lucide

The remaining custom UI icon imports in `chat-empty-state.tsx` and `landing-page.tsx` were migrated to Lucide, allowing the legacy Phosphor React package to be removed from `packages/ui`.

### Residual: build command blocked by unrelated vite-plus/node issue

Production build is not verified because of an existing vite-plus/node binary issue. Type checking passes.

## Verification

Passed:

```bash
bun run check-types
```

Also ran:

```bash
bun run check
```

`bun run check` reported zero lint errors, but it formats the whole repository. Formatting-only changes outside the task scope were reverted.

## Diff Hygiene

After cleanup, the remaining dirty/staged files are scoped to:

- current task artifacts under `.trellis/tasks/05-17-shadcn-ui-rebuild`
- UI design-system spec updates
- shadcn config files
- UI package dependencies and lockfile
- CLI-regenerated standard shadcn components
- shared global styles

Unrelated `.pi`, other `.trellis/spec`, archived tasks, workspace, and `AGENTS.md` formatting changes were restored.
