# shadcn UI Rebuild

## Goal

Rebuild Firefly's shared shadcn/ui layer for a more comfortable AI coding assistant experience: softer ergonomics than Lyra, better long-session readability, clearer visual hierarchy, and a real preset/source update rather than config-only changes.

## User Need

Firefly is used by developers for reading AI responses, prompts, code, tool output, and dense navigation for long periods. The UI should feel professional and focused without the overly harsh square-edge look of the previous Lyra + neutral grayscale setup.

## Prior State

- shadcn style: `radix-lyra`
- base color: `neutral`
- icon library: Phosphor for standard shadcn components
- typography: Geist Sans body, Inter headings, Geist Pixel Square mono
- radius: `0`
- global styles: Tailwind v4 `@theme inline`, OKLCH tokens
- shared UI location: `packages/ui`
- app config location: `apps/web/components.json`

## Decision

Use the modern balanced direction:

- shadcn style: `radix-nova`
- base color: `zinc`
- primary theme: default shadcn neutral theme colors
- body and headings: Geist Sans
- code font: JetBrains Mono
- accent font: Geist Pixel Square retained only for terminal/special UI
- standard shadcn component icons: Lucide
- primitive base: Radix, not Base UI

## Scope

In scope:

- Update both shadcn config files.
- Use shadcn CLI to regenerate installed standard shadcn component source for the Nova preset.
- Update shared global CSS tokens for Zinc/default theme + typography.
- Add required UI package dependency for JetBrains Mono.
- Keep monorepo aliases pointing app code to `@firefly/ui`.
- Fix type issues introduced by CLI output if they are dependency-version compatibility issues.
- Align existing settings panels that hardcoded square cards by composing existing shadcn components (`Card`, `Alert`, `Empty`, `Field`).
- Record design-system decisions in `.trellis/spec/ui/frontend/design-system.md`.

Out of scope:

- Rewriting custom AI/chat component logic.
- Full migration of custom components from Phosphor to Lucide.
- Switching from Radix UI to Base UI.
- Large layout redesign or animation system changes.
- Fixing the unrelated vite-plus build/node binary issue.

## Implementation Requirements

- The preset switch must be done with shadcn CLI, not by only editing `components.json`.
- Use the repository package runner: `bunx --bun shadcn@latest`.
- Standard shadcn components in `packages/ui/src/components` must be overwritten from the `radix-nova` registry output.
- Preserve custom project components that are not standard shadcn registry components.
- Keep `apps/web/components.json` aliases aligned with the monorepo:
  - `ui`: `@firefly/ui/components`
  - `utils`: `@firefly/ui/lib/utils`
- `packages/ui/src/styles/globals.css` must remain the single shared Tailwind v4 CSS entry.
- Preserve shadcn default OKLCH theme tokens unless a future task explicitly calls for brand-color customization.
- Use `@fontsource-variable/jetbrains-mono` from `packages/ui`, not root-only dependencies.

## Acceptance Criteria

Completed:

- [x] `packages/ui/components.json` uses `radix-nova`, `zinc`, and `lucide`.
- [x] `apps/web/components.json` uses `radix-nova`, `zinc`, and `lucide` while preserving monorepo aliases.
- [x] shadcn CLI overwrote 55 standard shadcn components in `packages/ui`.
- [x] Standard shadcn components show Nova source characteristics such as `rounded-lg`, `rounded-xl`, and `ring-3`.
- [x] Standard shadcn components use `lucide-react` instead of the previous Phosphor React package.
- [x] Shared global CSS uses Zinc base colors and default shadcn OKLCH theme tokens.
- [x] Shared global CSS uses Geist Sans for UI/headings and JetBrains Mono for `code`/`pre`.
- [x] Extensions, GitHub PAT, and costs settings panels use shadcn `Card`, `Alert`, `Empty`, and `Field` instead of hardcoded square containers.
- [x] `Calendar` type issue from CLI output is fixed for current `react-day-picker@10.0.1` by using `month_grid` instead of `table`.
- [x] `bun run check-types` passes.

Pending / not claimed complete:

- [ ] Production build passes; currently blocked by unrelated vite-plus/node binary issue.
- [ ] Manual visual verification in browser.
- [x] Custom components migrated remaining Phosphor imports to Lucide.
- [ ] Browser-level WCAG/focus-state verification.
- [ ] Font loading and CSS bundle performance check.

## Verification Commands

Required verification for this task:

```bash
bun run check-types
```

Useful but write-producing command:

```bash
bun run check
```

Note: `bun run check` runs `vp fmt --write`, which formats unrelated repository files. If used, unrelated formatting changes must be reverted before review/commit.

## Follow-Up Work

- Continue auditing other custom settings panels for hardcoded square containers, e.g. provider/proxy/data panels if visually inconsistent.
- Run browser visual QA once dev server/build environment is healthy.
- Resolve vite-plus/node binary build issue separately.

## References

- [IMPLEMENTATION.md](IMPLEMENTATION.md)
- [VERIFICATION.md](VERIFICATION.md)
- [REVIEW.md](REVIEW.md)
- [research/ai-tool-design-patterns.md](research/ai-tool-design-patterns.md)
- [research/shadcn-presets.md](research/shadcn-presets.md)
- [research/icon-libraries.md](research/icon-libraries.md)
- [research/typography-for-dev-tools.md](research/typography-for-dev-tools.md)
