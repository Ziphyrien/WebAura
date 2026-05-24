# Font Pairing and Typography Research

## Current Firefly Typography

**Configuration**:

- **Sans (Body)**: Geist Variable
- **Heading**: Inter Variable
- **Monospace**: Geist Pixel Square

**Assessment**: This is a solid, modern pairing with good contrast between body and headings.

## Font Analysis

### Geist (Current Body Font)

**Origin**: Developed by Vercel in collaboration with Basement Studio

**Characteristics**:

- Geometric precision with "cool" aesthetic
- Swiss design heritage (inspired by Univers and Helvetica)
- Optimized vertical metrics for perfect alignment in UI components
- High-contrast legibility on high-density displays (Retina/OLED)
- Short descenders and generous x-height
- Grid-based structure with subtle modern refinements

**Best for**:

- Technical and developer-focused interfaces
- SaaS platforms and dashboards
- Products communicating "speed" and "innovation"

**2026 Updates**:

- "Geist Pixel" variant for bitmap-inspired, futuristic headlines
- Seamless integration between Geist Sans and Geist Mono

**Why it works for Firefly**:

- Developer-focused aesthetic
- Excellent readability in data-heavy interfaces
- Modern, technical feel aligns with AI/dev tool positioning

### Inter (Current Heading Font)

**Characteristics**:

- Rational, linear sans-serif
- Widely used for UI design (possibly overused)
- Works best for small UI text and copy
- Can look generic or dull in large headings
- Inter 4.0 includes display style optimized for larger sizes

**Strengths**:

- Extremely versatile and professional
- Excellent readability at small sizes
- Widely supported and tested

**Weaknesses**:

- Very common (risk of looking generic)
- Less expressive in headings

**Pairing recommendations for Inter**:

1. **Bricolage Grotesque** - Quirky, softer, more expressive (free)
2. **Bebas Neue** - Bold, condensed, striking for large headings (free)
3. **Inter Display** (Inter 4.0) - Refined for larger sizes

### Geist Pixel Square (Current Monospace)

**Characteristics**:

- Bitmap-inspired, pixel aesthetic
- Weight: 800 (bold)
- Distinctive, futuristic feel

**Assessment**: Excellent choice for a developer tool. Adds personality and reinforces technical positioning.

## Alternative Font Pairings

### Option 1: Keep Current (Geist + Inter)

**Pros**:

- Already implemented and working
- Good contrast between body and headings
- Professional and modern
- Excellent readability

**Cons**:

- Inter is very common (generic risk)
- Could be more distinctive

**Recommendation**: Keep but consider upgrading to Inter Display for headings (Inter 4.0)

### Option 2: Geist + Geist (Single-Family System)

**Configuration**:

- Sans: Geist Variable
- Heading: Geist Variable (with display variant)
- Monospace: Geist Mono

**Pros**:

- Maximum cohesion
- Seamless integration between variants
- Strong brand consistency
- Geist Pixel variant available for special headings

**Cons**:

- Less typographic hierarchy
- May need more weight/size contrast

**Best for**: Unified, technical aesthetic

### Option 3: Inter + Inter (Single-Family System)

**Configuration**:

- Sans: Inter Variable
- Heading: Inter Display (4.0)
- Monospace: Inter Mono (if available) or JetBrains Mono

**Pros**:

- Extremely versatile
- Inter Display optimized for headings
- Professional and safe

**Cons**:

- Very common
- Less distinctive

**Best for**: Maximum professionalism, broad appeal

### Option 4: Geist + Bricolage Grotesque

**Configuration**:

- Sans: Geist Variable
- Heading: Bricolage Grotesque
- Monospace: Geist Pixel Square

**Pros**:

- More expressive headings
- Softer, friendlier feel
- Still maintains technical credibility
- Free font

**Cons**:

- Less common (may need custom integration)
- Quirky style may not fit all contexts

**Best for**: Balancing technical precision with approachability

### Option 5: Geist + Bebas Neue

**Configuration**:

- Sans: Geist Variable
- Heading: Bebas Neue (or Bebas Neue Pro)
- Monospace: Geist Pixel Square

**Pros**:

- Bold, striking headings
- High contrast with body text
- Condensed style saves space
- Free (basic version)

**Cons**:

- All-caps aesthetic (may be too aggressive)
- Free version has limited weights
- Very bold style may overwhelm

**Best for**: Bold, attention-grabbing interfaces

### Option 6: Plus Jakarta Sans (Single-Family)

**Configuration**:

- Sans: Plus Jakarta Sans Variable
- Heading: Plus Jakarta Sans Variable (bold weights)
- Monospace: JetBrains Mono

**Pros**:

- Rounded, friendly aesthetic
- Good for consumer-facing products
- Versatile weight range

**Cons**:

- Less technical feel
- May be too soft for developer tools

**Best for**: Approachable, consumer-friendly interfaces

### Option 7: Onest (Single-Family)

**Configuration**:

- Sans: Onest Variable
- Heading: Onest Variable
- Monospace: JetBrains Mono

**Pros**:

- Modern geometric sans
- Clean, professional
- Good weight range

**Cons**:

- Less distinctive
- May need custom integration

**Best for**: Modern, balanced interfaces

## Typography Hierarchy Best Practices

### Scale and Weights

**Recommended hierarchy**:

```css
/* Headings */
h1: 2.5rem (40px), font-semibold or bold
h2: 2rem (32px), font-semibold
h3: 1.5rem (24px), font-semibold
h4: 1.25rem (20px), font-semibold

/* Body */
body: 1rem (16px), font-normal
large: 1.125rem (18px), font-normal
small: 0.875rem (14px), font-medium
muted: 0.875rem (14px), font-normal

/* Code */
code: 0.875rem (14px), font-mono
```

### Contrast Strategies

1. **Weight contrast**: Use bold headings with regular body
2. **Size contrast**: Significant size jumps between levels
3. **Font contrast**: Different typeface for headings vs body
4. **Color contrast**: Use semantic tokens (foreground vs muted-foreground)

### Current Firefly Hierarchy

From `globals.css`:

```css
--font-sans: "Geist Variable", sans-serif;
--font-heading: "Inter Variable", sans-serif;
```

**Applied via**:

- Body: `font-sans` class
- Headings: Would need explicit `font-heading` class (not automatically applied)

**Issue**: Inter is set as `--font-heading` but may not be consistently applied to heading elements. Need to verify usage in components.

## Font Loading Strategy

### Current Implementation

```css
@import "@fontsource-variable/geist";
@import "@fontsource-variable/inter";

@font-face {
  font-family: "Geist Pixel Square";
  src: url("../../../../node_modules/geist/dist/fonts/geist-pixel/GeistPixel-Square.woff2")
    format("woff2");
  font-style: normal;
  font-weight: 800;
  font-display: swap;
}
```

**Assessment**:

- Using `@fontsource-variable` packages (good for self-hosting)
- `font-display: swap` prevents FOIT (Flash of Invisible Text)
- Variable fonts reduce file size

### Performance Considerations

**Variable fonts benefits**:

- Single file for all weights
- Smaller total download
- Smooth weight transitions

**Current setup is optimal**: Self-hosted variable fonts with swap display.

## shadcn/ui Font Integration

### Available Built-in Fonts (17 total)

From shadcn CLI v4:

| Name                  | Font Family             | CSS Variable  |
| --------------------- | ----------------------- | ------------- |
| `font-geist`          | Geist Variable          | `--font-sans` |
| `font-inter`          | Inter Variable          | `--font-sans` |
| `font-noto-sans`      | Noto Sans Variable      | `--font-sans` |
| `font-nunito-sans`    | Nunito Sans Variable    | `--font-sans` |
| `font-figtree`        | Figtree Variable        | `--font-sans` |
| `font-roboto`         | Roboto Variable         | `--font-sans` |
| `font-raleway`        | Raleway Variable        | `--font-sans` |
| `font-dm-sans`        | DM Sans Variable        | `--font-sans` |
| `font-public-sans`    | Public Sans Variable    | `--font-sans` |
| `font-outfit`         | Outfit Variable         | `--font-sans` |
| `font-jetbrains-mono` | JetBrains Mono Variable | `--font-mono` |

### Font Registry System

shadcn/ui v4 introduced `registry:font` type for font management:

```json
{
  "name": "font-geist",
  "title": "Geist",
  "type": "registry:font",
  "font": {
    "family": "'Geist Variable', sans-serif",
    "provider": "google",
    "variable": "--font-sans",
    "subsets": ["latin"],
    "import": "Geist"
  }
}
```

**CLI handles**:

- Font imports (Next.js vs Vite)
- CSS variable setup
- Tailwind configuration

## Recommendations for Firefly

### Recommendation 1: Keep Current with Refinements (Low Risk)

**Action**:

- Keep Geist Variable for body
- Keep Inter Variable for headings
- Keep Geist Pixel Square for monospace
- Ensure `font-heading` is properly applied to heading elements
- Consider upgrading to Inter Display for h1/h2

**Pros**: No breaking changes, already working
**Cons**: Inter is common

### Recommendation 2: Unified Geist System (Medium Risk)

**Action**:

- Use Geist Variable for both body and headings
- Use Geist Mono for code (instead of Pixel Square for body code)
- Reserve Geist Pixel Square for special display text

**Pros**: Maximum cohesion, strong technical identity
**Cons**: Less typographic contrast

### Recommendation 3: Add Expressive Headings (Medium Risk)

**Action**:

- Keep Geist Variable for body
- Switch to Bricolage Grotesque or custom display font for headings
- Keep Geist Pixel Square for monospace

**Pros**: More distinctive, better hierarchy
**Cons**: Requires custom font integration

## Typography Testing Checklist

When changing fonts:

- [ ] Test at all heading levels (h1-h6)
- [ ] Test body text at various lengths
- [ ] Test in buttons and UI components
- [ ] Test code blocks and inline code
- [ ] Test in tables and data displays
- [ ] Test in sidebar and navigation
- [ ] Test in dialogs and modals
- [ ] Verify font loading performance
- [ ] Check dark mode rendering
- [ ] Test on different screen densities
- [ ] Verify accessibility (contrast ratios)

## References

- [Geist Font Overview (2026)](https://www.zignuts.com/blog/modern-fonts-for-2025)
- [Inter Font Pairings](https://pimpmytype.com/inter-pairings/)
- [shadcn/ui Typography Docs](https://ui.shadcn.com/docs/components/radix/typography)
- [shadcn CLI v4 Font Registry](https://shadcnstudio.com/blog/shadcn-cli-v4-registry-base-and-registry-font)
