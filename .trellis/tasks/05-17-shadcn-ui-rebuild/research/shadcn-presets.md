# shadcn/ui Preset Research

## Overview

shadcn/ui now offers a comprehensive customization system through **presets** that control visual styles, component libraries, colors, fonts, and icons. As of December 2025, the system has evolved beyond simple theming to rewrite component code based on configuration.

## Component Styles (Visual Treatments)

shadcn/ui provides **5 named visual styles** that control border radius, padding, spacing, and overall density. Each style can be combined with either Radix UI or Base UI as the underlying primitive library.

### 1. Vega (Default)

- **Characteristics**: Classic shadcn/ui look, medium border radius, balanced spacing
- **Previously known as**: "New York"
- **Best for**: General-purpose applications, standard web apps
- **Preset codes**: `radix-vega`, `base-vega`
- **Visual feel**: Balanced, familiar, professional

### 2. Nova

- **Characteristics**: Tighter padding, reduced margins, compact layout
- **Best for**: Dashboards, admin panels, data-heavy interfaces
- **Preset codes**: `radix-nova`, `base-nova`
- **Visual feel**: Efficient, information-dense without feeling cramped
- **Use case**: When you need more content on screen

### 3. Maia

- **Characteristics**: Larger border radii (often fully rounded), generous spacing
- **Best for**: Consumer-facing products, landing pages, marketing sites
- **Preset codes**: `radix-maia`, `base-maia`
- **Visual feel**: Soft, relaxed, friendly, approachable
- **Use case**: When you want the UI to feel warm and inviting

### 4. Lyra (Current Firefly Style)

- **Characteristics**: Zero border radius, sharp edges, boxy and precise
- **Best for**: Developer tools, terminals, technical interfaces, code editors
- **Preset codes**: `radix-lyra`, `base-lyra`
- **Visual feel**: Sharp, technical, precise, brutalist
- **Typography pairing**: Works great with monospace fonts
- **Use case**: Technical products, developer-focused UIs

### 5. Mira

- **Characteristics**: Most compact option, minimal spacing
- **Best for**: Complex dashboards, spreadsheet-style layouts, data tables
- **Preset codes**: `radix-mira`, `base-mira`
- **Visual feel**: Dense, information-heavy, every pixel counts
- **Use case**: When screen real estate is critical

## Component Library Choice

### Radix UI vs Base UI

Both are headless primitive libraries. shadcn/ui rebuilt every component for Base UI while maintaining the same API.

**Radix UI**:

- Mature, battle-tested (older library)
- Larger community, more Stack Overflow answers
- Uses `asChild` prop for custom triggers
- Current Firefly choice

**Base UI**:

- Newer (started 2024), built by team from Radix, MUI, and Floating UI
- More modern API, some enhanced components (e.g., better Combobox/Autocomplete)
- Uses `render` prop for custom triggers
- Considered the "safer long-term bet" by community

**Firefly Status**: Currently using Radix UI. Switching would require component updates but is supported by the CLI.

## Base Colors (Gray Palettes)

shadcn/ui offers **7 base gray colors** that control the neutral tones throughout the theme. All use OKLCH color space for perceptually uniform lightness.

### Available Base Colors

1. **Neutral** (Current Firefly)
   - Pure achromatic gray (hue = 0, chroma = 0)
   - No color undertones
   - Most versatile, works with any accent color
   - Best for: Maximum flexibility, no color bias

2. **Zinc**
   - Slightly cool undertone
   - Popular default in many projects
   - Best for: Modern, tech-focused interfaces

3. **Slate**
   - Blue-gray undertone
   - Cooler than zinc
   - Best for: Professional, corporate applications

4. **Stone**
   - Warm brown-gray undertone
   - Earthy, organic feel
   - Best for: Content-heavy sites, blogs, documentation

5. **Mauve**
   - Subtle violet-pink undertone (hue ~322-326°)
   - Most purple-adjacent
   - Chroma peaks around 0.034
   - Best for: Creative, design-focused applications

6. **Olive**
   - Yellow-green undertone (hue ~106-107°)
   - "Military-meets-nature" aesthetic
   - Best for: Outdoor, sustainability, eco-focused brands

7. **Mist**
   - Cold blue-teal undertone (hue 197-229°)
   - Best for: Clean, airy interfaces

8. **Taupe**
   - Warm brownish-gray
   - Neutral earthy option
   - Best for: Warm, approachable interfaces

### OKLCH Color Space

All shadcn/ui colors use OKLCH (Oklab Lightness Chroma Hue):

- **Lightness**: 0-100% (perceptually uniform)
- **Chroma**: ~0-0.4 (saturation)
- **Hue**: 0-360° (color angle)

**Key advantage**: Lightness steps feel visually even across the scale. Neutral base colors have chroma near zero (0.031-0.034 max) to stay in neutral territory while maintaining subtle hue.

## Current Firefly Configuration

From `packages/ui/components.json` and `globals.css`:

```json
{
  "style": "radix-lyra",
  "base": "radix",
  "baseColor": "neutral",
  "theme": "neutral",
  "iconLibrary": "phosphor",
  "font": "geist",
  "fontHeading": "inter",
  "radius": "none"
}
```

**Visual characteristics**:

- Zero border radius (--radius: 0)
- Pure neutral gray (no color undertones)
- Sharp, boxy aesthetic
- Geist Variable for body text
- Inter Variable for headings
- Geist Pixel Square for monospace

## Font Options

shadcn/ui supports multiple font families through the preset system:

**Common choices**:

- **Geist** (Current Firefly): Modern, clean, excellent readability
- **Inter**: Versatile, professional, widely used
- **JetBrains Mono**: Monospace, developer-focused
- **Plus Jakarta Sans**: Rounded, friendly
- **Onest**: Modern geometric sans
- **Manrope**: Balanced, professional

**Current Firefly pairing**:

- Sans: Geist Variable (body text)
- Heading: Inter Variable (headings)
- Monospace: Geist Pixel Square (code)

This is a solid pairing with good contrast between body and headings.

## Icon Libraries

**Current**: Phosphor Icons
**Alternatives**: Lucide, Tabler Icons, HugeIcons

Phosphor is a good choice with consistent stroke width and comprehensive coverage.

## Theme Tokens

shadcn/ui uses semantic color tokens that map to CSS variables:

**Core tokens**:

- `background` / `foreground` - Default app surface and text
- `card` / `card-foreground` - Elevated surfaces
- `popover` / `popover-foreground` - Floating surfaces
- `primary` / `primary-foreground` - High-emphasis actions
- `secondary` / `secondary-foreground` - Lower-emphasis actions
- `muted` / `muted-foreground` - Subtle surfaces and helper text
- `accent` / `accent-foreground` - Interactive hover/focus states
- `destructive` - Error/destructive actions
- `border`, `input`, `ring` - Borders and focus rings
- `chart-1` through `chart-5` - Chart palette
- `sidebar-*` - Sidebar-specific tokens

**Current Firefly issue**: All colors are achromatic (chroma = 0), resulting in a purely grayscale interface with no color personality.

## Preset Codes

shadcn/ui encodes entire configurations into 7-character base62 strings (e.g., `bJzmtL6J8`).

**Current Firefly preset**: `bJzmtL6J8`

**Encoding includes**:

- menuColor (3 bits)
- menuAccent (3 bits)
- radius (4 bits)
- font (6 bits)
- iconLibrary (6 bits)
- theme (6 bits)
- baseColor (6 bits)
- style (6 bits)

## Switching Presets

The CLI offers three strategies:

1. **Reinstall** (destructive):

   ```bash
   npx shadcn@latest init --preset <code> --force --reinstall
   ```

   Overwrites all components with new style.

2. **Merge** (smart):

   ```bash
   npx shadcn@latest init --preset <code> --force --no-reinstall
   # Then for each component:
   npx shadcn@latest add <component> --dry-run
   npx shadcn@latest add <component> --diff <file>
   ```

   Updates config and CSS, then selectively merges components.

3. **Skip** (config-only):

   ```bash
   npx shadcn@latest init --preset <code> --force --no-reinstall
   ```

   Only updates `components.json` and CSS variables, leaves component code unchanged.

## Recommendations for Firefly

### Visual Style Options

**Option 1: Keep Lyra (Current)**

- Maintains sharp, technical aesthetic
- Consistent with developer-tool positioning
- No component changes needed
- Consider: Add color to break up monotony

**Option 2: Switch to Nova**

- More balanced than Lyra (not as harsh)
- Still efficient and compact
- Better for mixed audiences (developers + non-developers)
- Requires component reinstall or merge

**Option 3: Switch to Vega**

- Most familiar to users
- Balanced, professional
- Softer than Lyra without being too casual
- Requires component reinstall or merge

### Base Color Options

**Option 1: Keep Neutral**

- Maximum flexibility
- Works with any accent color
- Consider: Add a primary color theme (blue, purple, green) to break monotony

**Option 2: Switch to Zinc**

- Subtle cool undertone
- Modern, tech-focused
- Most popular choice in the ecosystem

**Option 3: Switch to Mauve**

- Adds subtle warmth and personality
- Creative, design-forward
- Differentiates from typical gray interfaces

### Color Strategy

**Current problem**: Pure grayscale (chroma = 0) lacks visual interest.

**Solutions**:

1. Keep neutral base, add a colored `primary` theme (e.g., blue, purple, teal)
2. Switch to a tinted base color (zinc, mauve, mist)
3. Customize chart colors to add visual interest to data displays

### Font Recommendations

**Current pairing is solid**: Geist + Inter works well.

**Alternative pairings to consider**:

- **Onest + Onest**: Single-family system, very cohesive
- **Plus Jakarta Sans + Plus Jakarta Sans**: Friendly, rounded, approachable
- **Inter + Inter**: Single-family, professional, safe choice

**Keep**: Geist Pixel Square for monospace (distinctive, on-brand for dev tools)

## Next Steps

1. **Decide on visual direction**: Technical (keep Lyra) vs. Balanced (Nova/Vega) vs. Friendly (Maia)
2. **Choose color strategy**: Add color to neutral vs. switch to tinted base
3. **Test preset changes**: Use `--dry-run` and `--diff` to preview impact
4. **Update both configs**: `packages/ui/components.json` and `apps/web/components.json`
5. **Verify components**: Ensure no regressions after style changes

## References

- [shadcn/ui Theming Docs](https://ui.shadcn.com/docs/theming)
- [shadcn/ui Create](https://ui.shadcn.com/create)
- [Component Styles Blog Post](https://www.shadcnblocks.com/blog/shadcn-component-styles-vega-nova-maia-lyra-mira)
- [December 2025 Changelog](https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create)
- [OKLCH Color Space](https://oklch.com/)
