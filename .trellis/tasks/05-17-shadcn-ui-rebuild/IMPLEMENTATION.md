# Implementation Notes

## Summary

The shadcn UI rebuild was implemented as a real CLI-driven preset/source update for the shared UI package, followed by project-specific typography customization while keeping shadcn's default neutral theme colors.

## Commands Used

### Inspect shadcn context

```bash
cd packages/ui
bunx --bun shadcn@latest info --json
```

Confirmed:

- framework: Manual
- style: `radix-nova`
- base: `radix`
- baseColor: `zinc`
- iconLibrary: `lucide`
- UI path: `packages/ui/src/components`

### Regenerate standard shadcn components

```bash
cd packages/ui
bunx --bun shadcn@latest add accordion alert-dialog alert avatar badge breadcrumb button-group button calendar card carousel chart checkbox collapsible combobox command context-menu dialog direction drawer dropdown-menu empty field hover-card input-group input-otp input item kbd label menubar native-select navigation-menu pagination popover progress radio-group resizable scroll-area select separator sheet sidebar skeleton slider sonner spinner switch table tabs textarea toggle-group toggle tooltip --overwrite -y
```

Result:

- 55 standard shadcn component files updated by CLI.
- `packages/ui/src/hooks/use-mobile.ts` updated by CLI.
- Standard component icons moved to `lucide-react`.
- Nova source styles landed in components, e.g. `rounded-lg`, `rounded-xl`, `ring-3`.

## Files Changed

Core implementation:

- `apps/web/components.json`
- `packages/ui/components.json`
- `packages/ui/package.json`
- `packages/ui/src/styles/globals.css`
- `packages/ui/src/components/*.tsx` standard shadcn files
- `packages/ui/src/components/extensions-settings.tsx`
- `packages/ui/src/components/costs-panel.tsx`
- `packages/extensions/src/github/settings-panel.tsx`
- `packages/ui/src/hooks/use-mobile.ts`
- `bun.lock`

Trellis/spec records:

- `.trellis/tasks/05-17-shadcn-ui-rebuild/*`
- `.trellis/spec/ui/frontend/design-system.md`
- `.trellis/spec/ui/frontend/index.md`

## Config Changes

### `packages/ui/components.json`

- `style`: `radix-lyra` -> `radix-nova`
- `tailwind.baseColor`: `neutral` -> `zinc`
- `iconLibrary`: `phosphor` -> `lucide`

### `apps/web/components.json`

- `style`: `radix-lyra` -> `radix-nova`
- `tailwind.baseColor`: `neutral` -> `zinc`
- `iconLibrary`: `phosphor` -> `lucide`
- monorepo aliases preserved:
  - `ui`: `@firefly/ui/components`
  - `utils`: `@firefly/ui/lib/utils`

## Theme Changes

File: `packages/ui/src/styles/globals.css`

- Imports `@fontsource-variable/geist`.
- Imports `@fontsource-variable/jetbrains-mono`.
- Keeps `Geist Pixel Square` custom `@font-face` for accent usage.
- Sets Nova radius: `--radius: 0.625rem`.
- Uses Zinc-toned OKLCH neutrals.
- Keeps default shadcn neutral primary, ring, chart, and sidebar tokens.
- Maps `--font-heading` to Geist Sans, not Inter.
- Maps `--font-mono` to JetBrains Mono.
- Applies JetBrains Mono to `code` and `pre`.

## Dependency Changes

`packages/ui/package.json`:

- Adds `@fontsource-variable/jetbrains-mono`.
- Keeps `lucide-react`, required by regenerated standard shadcn components.
- Removes the legacy Phosphor React package after migrating the remaining custom UI icon imports to Lucide.
- shadcn CLI also updated some related UI dependencies in `packages/ui/package.json` and `bun.lock`.

Root `package.json` is intentionally not part of this task after cleanup; UI-only dependencies live in `packages/ui`.

## Compatibility Fix

The CLI-generated `calendar.tsx` used `classNames.table`, but the installed `react-day-picker@10.0.1` type surface uses `month_grid` instead.

Fix applied:

```tsx
month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
```

This preserves the intended table/grid styling while satisfying current types.

## Custom Panel Component Alignment

The extensions, GitHub PAT, and costs settings panels were not all standard shadcn registry components, so the CLI could not update their hardcoded square containers.

Updated:

- `packages/ui/src/components/extensions-settings.tsx`: replaced hand-rolled bordered cards/loading/empty/error states with shadcn `Card`, `Alert`, and `Empty` composition.
- `packages/ui/src/components/costs-panel.tsx`: replaced hand-rolled cost cards and daily rows with shadcn `Card`, and used `Alert`/`Empty` for informational and empty states.
- `packages/extensions/src/github/settings-panel.tsx`: replaced the hand-rolled GitHub Personal Access Token panel with shadcn `Card`, `Alert`, `FieldGroup`, `Field`, `FieldLabel`, and `FieldDescription`.

## Cleanup Performed

- Removed the accidental `apps/web/src/lib/utils.ts` created by running `shadcn init` in the app package.
- Restored unrelated files formatted by `vp fmt --write` so the final diff only contains task-related changes.

## Notes

`bun run check` is useful for linting, but it runs `vp fmt --write` across the repository. Do not leave unrelated formatting-only files in this task diff.
