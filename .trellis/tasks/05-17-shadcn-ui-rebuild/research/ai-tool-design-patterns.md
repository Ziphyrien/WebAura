# AI Coding Assistant UI Design Patterns

Research on design patterns, color schemes, typography, and visual hierarchy used in modern AI coding assistants (Claude, Cursor, GitHub Copilot Chat, Windsurf, Cline, etc.).

## Executive Summary

AI coding assistants share common design principles optimized for long-form reading, code display, and extended work sessions:

1. **Semantic color systems** with clear intent-based tokens (not just primitive colors)
2. **Reduced saturation** in dark mode to prevent eye strain
3. **Monospace fonts optimized for code** with high x-height and clear character distinction
4. **Strict WCAG AA compliance** (4.5:1 contrast minimum for text)
5. **Visual hierarchy through opacity/weight** rather than color alone
6. **Inline context** over separate chat windows where possible

---

## Color System Patterns

### Semantic Token Architecture

Modern AI tools use **two-layer token systems**:

1. **Primitive tokens**: Raw color values (`--blue-500`, `--gray-200`)
2. **Semantic tokens**: Intent-based references (`--color-interactive`, `--text-default`)

**Why this matters for AI tools:**

- Semantic tokens tell the system _what_ a color is for, not just what it looks like
- Enables consistent theming across light/dark modes
- Reduces cognitive load when scanning interface elements

**Example structure:**

```css
/* Primitive */
--primary-600: #8534f3;

/* Semantic */
--color-interactive: var(--primary-600);
--color-interactive-hover: var(--primary-700);
--text-default: var(--gray-900); /* light mode */
--text-default: var(--gray-100); /* dark mode */
```

### GitHub Copilot Color Strategy

**Brand palette:**

- **Copilot Purple**: `#8534F3` (primary brand color)
- **Purple range**: 6 shades from `#C898FD` (light) to `#160048` (dark)
- **Orange accents**: `#F4A876` to `#801E0F` (for warnings, highlights)
- **Pink accents**: Used sparingly for AI-specific features

**Application principles:**

- Purple overlaid on neutral backgrounds (not competing with GitHub Green)
- 80% Black/White, 10% Neutral, 5% Green, 5% Purple (brand guideline)
- Thoughtful injection of purple to highlight AI features without overwhelming

**Dark mode specifics:**

- Desaturated purples for reduced eye strain
- Inline code gets primary-color tint against surface background
- Code blocks use monospace with proper padding and borders

### Design Token Best Practices (from research)

**Semantic color categories:**

```css
--color-background
--color-background-subtle
--color-surface
--color-surface-raised (with shadow)
--color-text-primary
--color-text-secondary
--color-text-muted
--color-text-on-primary
--color-border
--color-border-strong
--color-interactive
--color-interactive-hover
--color-interactive-active
```

**Supporting semantic colors:**

```css
--color-feedback-error
--color-feedback-success
--color-feedback-warning
--color-feedback-info
```

**Hierarchy through tokens:**

- Primary, secondary, tertiary levels
- Each with hover/pressed states
- Focus states always in brand color

---

## Dark Mode Strategies

### Contrast Requirements (WCAG AA)

**Minimum ratios:**

- Normal text: **4.5:1**
- Large text (18pt+): **3:1**
- UI components: **3:1**

**Dark mode challenges:**

- Light text on dark backgrounds appears thicker (irradiation illusion)
- Pure white (`#FFFFFF`) creates glare and eye strain
- Saturated colors (especially blues) are hard to focus on

### Material Design Dark Theme Approach

**Surface color:** `#121212` (not pure black)

- Pure black causes "smearing" on OLED screens
- Slightly elevated surfaces use lighter shades
- Minimum 15.8:1 contrast between surface and white text

**Text opacity hierarchy:**

- High emphasis (headings): **87% white**
- Medium emphasis (body): **60% white**
- Disabled text: **38% white**

**Why opacity over solid grays:**

- Text blends with background regardless of specific shade
- Creates harmonious look across different surface elevations
- Easier to maintain consistency

### Color Desaturation in Dark Mode

**Primary colors must be desaturated:**

- Mix brand colors with 20-40% white to create pastel tones
- Maintains brand identity without harsh contrast
- Avoid pure saturated blues (hard to focus on)

**Example:**

```css
/* Light mode */
--primary: #8534f3; /* Full saturation */

/* Dark mode */
--primary: #b870ff; /* Desaturated, lighter */
```

### Elevation Through Contrast (Not Shadows)

**Modern approach:**

- Slightly lighter background layers signal depth
- Subtle borders or tonal shifts
- Shadows are minimal or absent in dark mode

**Why:**

- Shadows on dark backgrounds are hard to see
- Contrast-based elevation is clearer and more predictable
- Easier to scan for users relying on visual structure

---

## Typography Patterns

### Monospace Font Selection

**Top choices for AI coding tools:**

1. **JetBrains Mono** (most popular)
   - Increased x-height for easier reading
   - Narrower than others (more code on screen)
   - Full ligature support
   - Variable font (100-900 weights)
   - Excellent for long coding sessions

2. **Fira Code**
   - First major font with ligatures
   - Rounded, friendly appearance
   - Good for mixed code/prose interfaces

3. **Geist Mono** (Vercel)
   - Functional, professional character
   - Variable font
   - No italics (intentional design choice)
   - Clean, modern aesthetic

4. **Hack**
   - Maximum character distinction
   - Best for systems programming (pointers, operators)
   - No ligatures (by design)
   - Excellent for terminal use

5. **Source Code Pro** (Adobe)
   - Wide but not heavy
   - Clear bracket distinction
   - Reliable, professional

**Key characteristics for code fonts:**

- **Monospaced** (equal character width)
- **High x-height** (tall lowercase letters)
- **Clear character distinction** (0/O, 1/l/I, etc.)
- **Ligature support** (optional, for `=>`, `!=`, etc.)
- **Variable font** (flexible weight adjustment)

### Sans-Serif for UI Text

**Common choices:**

- **Inter** (most popular for UI)
  - Excellent readability at small sizes
  - Variable font
  - Designed for screens
  - Used by: Linear, Vercel, many modern tools

- **Geist Sans** (Vercel)
  - Pairs with Geist Mono
  - Clean, modern
  - Variable font

- **System fonts** (fallback)
  - `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`
  - Zero load time
  - Native feel

**Why not use monospace for UI text:**

- Harder to read in paragraphs
- Takes more horizontal space
- Feels "technical" rather than friendly

### Typography Adjustments for Dark Mode

**Font weight:**

- Light text on dark appears thicker (irradiation illusion)
- Consider using lighter weights (Regular instead of Medium)
- Avoid Bold (700) for large text blocks

**Letter spacing (tracking):**

- Slightly increase tracking in dark mode
- Prevents characters from visually bleeding together
- Improves readability

**Line height:**

- Maintain 1.5-1.6 for body text
- Code blocks: 1.4-1.5 (tighter for density)
- Headings: 1.2-1.3

---

## Visual Hierarchy Patterns

### Inline AI Patterns (Cursor, Cline, Copilot)

**Design approach:**

- AI lives inside the context (not separate window)
- Ghost text, tooltips, inline suggestions
- Slash commands for invoking actions
- Real-time co-creation with visible feedback
- Easy undo/accept of changes

**Why this works:**

- Reduces context switching
- Maintains flow state
- Changes are visible before applying
- User stays in their workspace

### Side Panel Copilot Pattern

**Structure:**

- Side panel that "sees" current screen
- Offers short actions based on selection
- Mode switching (explain, generate, review)
- Preserves conversation history

**Best for:**

- Complex tools (dashboards, IDEs)
- Multi-step workflows
- When context needs to persist

### Chat Interface Patterns

**Key elements:**

- Prompt scaffolding with suggested inputs
- Conversational memory/history view
- Visual feedback (typing indicators, animations)
- Role-based personas (tutor, coach, assistant)
- Transparent context windows

**Markdown rendering:**

- Inline code with primary-color tint
- Code blocks with monospace, padding, borders
- Tables readable without spreadsheet feel
- Lists with clear hierarchy

### Component Hierarchy

**Elevation levels (from research):**

1. **Background** (lowest)
2. **Surface** (cards, panels)
3. **Surface raised** (modals, dropdowns)
4. **Overlay** (tooltips, popovers)

**Signaling through:**

- Brightness (lighter = higher in dark mode)
- Borders (subtle, not heavy)
- Shadows (minimal in dark mode)

---

## Accessibility Considerations

### Contrast Testing

**Must test:**

- Body text vs background
- Secondary text vs background
- Disabled states
- Text on colored buttons
- Interactive elements
- Focus indicators

**Tools:**

- Browser DevTools contrast checker
- Online contrast checkers (WebAIM, etc.)
- Automated testing in CI/CD

### Focus States

**Requirements:**

- Visible focus indicator (3:1 contrast minimum)
- Consistent across all interactive elements
- Often uses brand color
- Should work in both light/dark modes

### Color Independence

**Don't rely on color alone:**

- Use icons + color for status
- Text labels for important states
- Patterns/textures as secondary indicators

---

## Performance Considerations

### Font Loading Strategy

**Best practices:**

1. **Variable fonts** reduce file count
2. **Subset fonts** to needed characters
3. **Preload critical fonts** in `<head>`
4. **Font-display: swap** for graceful fallback

**Example:**

```css
@font-face {
  font-family: "Geist Mono";
  src: url("/fonts/geist-mono.woff2") format("woff2-variations");
  font-weight: 100 900;
  font-display: swap;
}
```

### CSS Token Performance

**Optimization:**

- Use CSS custom properties (fast)
- Minimize token count (avoid over-engineering)
- Group related tokens
- Use `@layer` for cascade control (Tailwind v4)

---

## Key Takeaways for Firefly

### Color System

1. **Adopt semantic token layer** on top of primitives
2. **Desaturate primary colors** for dark mode (20-40% white mix)
3. **Use opacity-based text hierarchy** (87%, 60%, 38%)
4. **Maintain 4.5:1 contrast minimum** for all text
5. **Introduce meaningful color** (not just neutral grays)

### Typography

1. **Keep monospace for code** (JetBrains Mono or Geist Mono recommended)
2. **Use Inter or Geist Sans for UI** (not Inter for headings if too neutral)
3. **Adjust font weight for dark mode** (lighter weights)
4. **Increase letter spacing slightly** in dark mode
5. **Variable fonts** for flexibility and performance

### Visual Hierarchy

1. **Elevation through contrast** (not heavy shadows)
2. **Inline AI patterns** where possible (reduce context switching)
3. **Clear focus states** with brand color
4. **Consistent spacing scale** (4px, 8px, 12px, 16px, 24px, 32px, etc.)

### Dark Mode

1. **Surface color: `#121212`** (not pure black)
2. **Text: 87% white for emphasis**, 60% for body
3. **Desaturate all brand colors**
4. **Test contrast ratios** for every text/background combo
5. **Minimal shadows**, rely on brightness differences

---

## References

- GitHub Copilot Brand Guidelines: <https://brand.github.com/brand-identity/copilot>
- Material Design Dark Theme: <https://m2.material.io/design/color/dark-theme.html>
- WCAG Contrast Guidelines: <https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html>
- JetBrains Mono: <https://www.jetbrains.com/lp/mono/>
- Design Token Systems: <https://www.contentful.com/blog/design-token-system/>
- AI Design System Prompts: <https://0xminds.com/blog/guides/ai-design-system-prompts-tokens-guide>
