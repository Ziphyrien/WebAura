# Design System Guidelines

> Executable design-system conventions for `packages/ui`.

---

## Scope

These rules apply to the shared UI package (`packages/ui`) and the shared Tailwind v4 CSS entry at `packages/ui/src/styles/globals.css`.

This spec documents current project conventions, not aspirational alternatives.

---

## shadcn Preset Contract

### Current Preset

The shared UI package uses:

```json
{
  "style": "radix-nova",
  "tailwind": {
    "baseColor": "zinc"
  },
  "iconLibrary": "lucide"
}
```

### Rules

- Use shadcn CLI for preset/source changes. Do not claim a preset migration is complete if only `components.json` or CSS tokens changed.
- Use the project runner for shadcn commands: `bunx --bun shadcn@latest`.
- Standard shadcn components live in `packages/ui/src/components`.
- App-level shadcn config in `apps/web/components.json` must keep monorepo aliases pointing to `@firefly/ui`.

### Correct CLI Pattern

```bash
cd packages/ui
bunx --bun shadcn@latest add <installed-components> --overwrite -y
```

Use this when intentionally refreshing standard shadcn component source from the selected preset.

### Wrong vs Correct

Wrong:

```text
Edit components.json to radix-nova and stop.
```

Correct:

```text
Update config, then regenerate standard component source with shadcn CLI so files contain Nova source characteristics such as rounded-lg, rounded-xl, and ring-3.
```

---

## Color System

### Token Format

Use OKLCH values for theme tokens in `globals.css`.

```css
--primary: oklch(0.205 0 0);
```

### Current Theme

Use shadcn's default neutral theme tokens with the Nova radius scale. Do not introduce a brand accent color unless a future task explicitly asks for one.

Light mode primary:

```css
--primary: oklch(0.205 0 0);
--ring: oklch(0.708 0 0);
```

Dark mode primary:

```css
--primary: oklch(0.922 0 0);
--ring: oklch(0.556 0 0);
```

### Rules

- Keep Zinc-toned neutral values for base UI surfaces when `baseColor` is `zinc`.
- Keep default shadcn neutral primary, ring, chart, and sidebar tokens unless the user explicitly requests brand-color customization.
- Prefer semantic classes (`bg-primary`, `text-muted-foreground`, `border-border`) over raw Tailwind color classes.

### Common Mistake: Adding Custom Primary Without User Direction

Wrong:

```text
Replace default neutral primary with a custom colored brand token during a preset refresh.
```

Correct:

```css
:root {
  --primary: oklch(0.205 0 0);
}
```

Keep custom brand-color work in a separate explicit design task.

---

## Typography

### Current Font Contract

```css
@import "@fontsource-variable/geist";
@import "@fontsource-variable/jetbrains-mono";

@theme inline {
  --font-sans: "Geist Variable", sans-serif;
  --font-heading: "Geist Variable", sans-serif;
  --font-mono: "JetBrains Mono Variable", "Geist Mono", monospace;
}
```

### Rules

- Use Geist Sans for UI and headings.
- Use JetBrains Mono for `code` and `pre`.
- Keep Geist Pixel Square only for terminal/special accent UI via `.font-geist-pixel-square`.
- Keep font dependencies in `packages/ui/package.json` when the shared CSS imports them.

### Common Mistake: Root-Only Font Dependency

Wrong:

```text
Install @fontsource-variable/jetbrains-mono only in the root package.json while importing it from packages/ui/src/styles/globals.css.
```

Correct:

```text
Install @fontsource-variable/jetbrains-mono in packages/ui because globals.css belongs to @firefly/ui.
```

---

## Radius Scale

The Nova preset currently uses:

```css
--radius: 0.625rem;
--radius-sm: calc(var(--radius) * 0.6);
--radius-md: calc(var(--radius) * 0.8);
--radius-lg: var(--radius);
--radius-xl: calc(var(--radius) * 1.4);
--radius-2xl: calc(var(--radius) * 1.8);
--radius-3xl: calc(var(--radius) * 2.2);
--radius-4xl: calc(var(--radius) * 2.6);
```

### Rules

- Use radius tokens/classes generated from this scale.
- Do not hardcode one-off pixel radius values in shared components unless the shadcn registry output requires it.

---

## Icon Library

### Current Contract

- Standard shadcn components use `lucide-react`.
- Custom UI components should also use Lucide unless a future task explicitly introduces a second icon library.

### Rules

- Do not mix icon libraries inside a single standard shadcn component.
- For shadcn registry updates, preserve the icon library emitted by the CLI for the active `iconLibrary` setting.
- When replacing custom Phosphor icons, update props as needed because Phosphor `weight` does not map directly to Lucide.

### Current Migration Status

As of the shadcn UI rebuild task, `packages/ui` no longer depends on the legacy Phosphor React package.

---

## Compatibility Notes

### react-day-picker Class Names

With `react-day-picker@10.0.1`, the grid class key is `month_grid`, not `table`.

Correct:

```tsx
month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
```

If future shadcn CLI output reintroduces `table`, update it to `month_grid` or adjust the dependency version intentionally.

---

## Verification Checklist

Before completing design-system changes:

- [ ] `bun run check-types` passes.
- [ ] Standard shadcn component source was updated by CLI when changing preset/source style.
- [ ] `apps/web/components.json` aliases still point to `@firefly/ui` for shared UI.
- [ ] `globals.css` remains the single shared Tailwind v4 CSS entry.
- [ ] Font imports are backed by dependencies in `packages/ui/package.json`.
- [ ] Unrelated formatting-only files from `vp fmt --write` are reverted.

---

**Last Updated**: 2026-05-17 (shadcn UI rebuild)
