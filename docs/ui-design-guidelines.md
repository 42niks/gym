# BASE UI Design Guidelines

## Core Philosophy: Ambient Color, Not Saturated Color

The BASE design language uses brand colors as atmosphere, not as paint. Full-saturation color is reserved for data and emphasis; surfaces and interactive elements carry color at low opacity so the palette feels cohesive rather than loud.

### The Logo Card Rule

The logo card is the reference object for "correct loudness." It achieves its look by layering semi-transparent radial gradients over a neutral base:

```
bg-white (or bg-surface-dark in dark mode)
+ radial-gradient top-left: rgba(255, 81, 250, 0.28)   ← accent/pink
+ radial-gradient bottom-right: rgba(0, 237, 180, 0.28) ← brand/mint
```

Any element that should have the same visual weight as the logo — including primary CTAs — should use the **same gradient recipe**, not the full-saturation palette values.

---

## Color System

Three brand hues, each with a defined role:

| Token | Hex (500) | Role |
|-------|-----------|------|
| `brand` | `#00EDB4` (mint/teal) | Primary actions, success, positive states |
| `accent` | `#FF51FA` (magenta/pink) | Energy, highlights, decorative gradients |
| `energy` | `#DCFC00` (electric yellow-green) | High-urgency states, badges |

### Usage tiers

- **Opacity 10–30%** — Surface tints, gradient overlays on cards and buttons. This is the default for anything that covers a large area.
- **Opacity 50–70%** — Focus rings, active borders, subtle icons.
- **Full opacity** — Small badges, data points, inline text links. Never large fills.

---

## Gradients

### The standard radial mesh

Used on the logo card, primary buttons, and hero areas. Always two radial gradients on a neutral base:

```css
/* Light */
radial-gradient(circle at top left,  rgba(255, 81, 250, 0.28), transparent 42%),
radial-gradient(circle at bottom right, rgba(0, 237, 180, 0.28), transparent 48%)
+ background-color: white

/* Dark */
radial-gradient(circle at top left,  rgba(255, 81, 250, 0.34), transparent 42%),
radial-gradient(circle at bottom right, rgba(0, 237, 180, 0.30), transparent 48%)
+ background-color: surface-dark
```

Tailwind tokens: `bg-brand-gradient` / `dark:bg-brand-gradient-dark`

### Body background

The page shell carries a lighter version of the same mesh (lower opacity) so the full hierarchy reads: page → card → button, each one a stop richer than the last.

```css
/* Light */
radial-gradient(circle at top left,  rgba(255, 81, 250, 0.18), transparent 24%),
radial-gradient(circle at top right, rgba(0, 253, 193,  0.26), transparent 26%)
+ background-color: surface-shell
```

---

## Hierarchy of Color Intensity

Visual weight should increase as elements become more interactive or prominent. Never skip levels.

```
Page background     ← lightest  (~0.11–0.18 opacity tints)
  └── Glass panel   ← +1 stop   (bg-white/80 or surface-dark/80, backdrop blur)
        └── Logo / primary button ← +1 stop (0.28–0.34 opacity radial mesh on solid base)
              └── Data / badges  ← full opacity, small area only
```

If an element reads as too loud, step it back one level. If it disappears, step it forward one. Never reach for full-saturation fills on large surfaces.

---

## Surfaces

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `bg-shell` | `#EBEBEF` | `#070708` | Page background |
| `bg-page` | `#F8F8F8` | `#0F0F11` | Content area |
| `bg-surface` | `#FFFFFF` | `#161619` | Cards |
| `bg-surface-raised` | `#F4F4F4` | `#1D1D21` | Elevated cards, popovers |
| `bg-surface-dark` | `#1A191B` | `#121214` | Logo card base, button base in dark |

### Glass panel

The standard card treatment. Use the `.glass-panel` utility class:

```css
rounded-[1.5rem] border border-white/60 bg-white/80 shadow-panel backdrop-blur-md
dark:border-white/10 dark:bg-surface-dark/80
```

---

## Typography

| Role | Font | Style |
|------|------|-------|
| Headlines, page titles | Space Grotesk | `font-black uppercase tracking-tight italic` |
| Labels, buttons, eyebrows | Space Grotesk | `font-bold uppercase tracking-[0.28em] italic` |
| Body, data | Manrope | Regular / medium |

### Eyebrow labels

Use the `.section-eyebrow` utility for section headers above content:

```css
font-label text-[0.7rem] font-bold italic uppercase tracking-[0.32em] text-gray-500
```

---

## Interactive Elements

### Primary button

Same gradient recipe as the logo card. The button should feel like a sibling of the logo, not a separate design language:

```
bg-brand-gradient dark:bg-brand-gradient-dark
bg-white dark:bg-surface-dark          ← base color under the transparent gradient
border border-white/70 dark:border-white/10
shadow-panel
```

Hover: `hover:-translate-y-0.5` — a subtle lift. No ambient glow in the resting state; glow (if used) is hover-only feedback.

### Inputs

```
rounded-2xl border border-line bg-white/90 px-4 py-3.5
focus:border-brand-300 focus:ring-4 focus:ring-brand-300/25
dark:bg-gray-900/80
```

---

## Shadows

| Token | Value | Use |
|-------|-------|-----|
| `shadow-panel` | `0 18px 50px rgba(14,14,15,0.08)` | Cards, logo card, primary button |
| `shadow-glass` | `0 10px 30px rgba(14,14,15,0.08)` | Lighter floating elements |
| `shadow-glow-brand` | `0 18px 38px rgba(0,237,180,0.13)` | Hover state on primary button |
| `shadow-glow-accent` | `0 18px 38px rgba(255,81,250,0.12)` | Hover accents (use sparingly) |

Glow shadows should only appear on `:hover`, never in the resting state. A glowing button on a muted page reads as broken, not branded.

---

## Dark Mode

Dark mode is a first-class concern, not an afterthought. Rules:

- Every surface token has an explicit dark value — never rely on `dark:invert` or ad-hoc overrides.
- Gradient opacities increase slightly in dark mode (`+0.06–0.10`) to compensate for dark surfaces absorbing more light.
- Text on gradient surfaces: `text-gray-900` in light (gradient is light), `text-white` in dark (gradient is dark).
- Border opacity drops in dark (`border-white/70` → `dark:border-white/10`) — white borders on dark read as lines, not structure.
