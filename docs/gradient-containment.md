# Gradient Containment Guide

This document covers two recurring UI issues with gradient backgrounds and how to prevent them.

---

## Issue 1: Gradient Spilling Onto Borders

### What causes it

When a gradient background sits behind a semi-transparent border (`border-white/60`, `border-white/10`, etc.), the gradient color bleeds through the border. This happens because:

- CSS borders are painted **on top of** the element's background
- If the border has any transparency (alpha < 1), the background underneath composites through
- An absolutely positioned gradient child at `inset-0` fills the padding box, which extends right up to the border's inner edge — the gradient and border overlap at sub-pixel level

### How to prevent it

Use the **frame + surface** pattern. Every element with a gradient background near a border must be split into two layers:

```
Outer frame (owns the border)
└── Inner surface (owns the gradient)
```

**The frame** needs:
- An **opaque solid background** — this is the key ingredient. Use `--surface-card` in light mode, `--surface-dark` in dark mode. The semi-transparent border composites against this solid color, producing a clean tinted edge instead of leaking the gradient.
- `overflow: hidden` and `contain: paint` to clip any child content at the padding box boundary
- `isolation: isolate` to create a stacking context
- `transform: translateZ(0)` and `backface-visibility: hidden` for GPU compositing (prevents sub-pixel rendering artifacts)

**The surface** needs:
- `border-radius: calc(<frame-radius> - <border-width>)` — ensures the inner radius matches the frame's inner border curve exactly
- `overflow: hidden` for its own content
- The gradient as its own `background` or `background-image`
- No border of its own

### Example (CSS)

```css
/* Frame: solid backing + border */
.my-card-frame {
  position: relative;
  isolation: isolate;
  contain: paint;
  overflow: hidden;
  transform: translateZ(0);
  backface-visibility: hidden;
  border-radius: 1.5rem;
  background: rgb(var(--surface-card));       /* opaque backing */
}

.dark .my-card-frame {
  background: rgb(var(--surface-dark));
}

/* Surface: gradient lives here */
.my-card-surface {
  border-radius: calc(1.5rem - 1px);          /* accounts for 1px border */
  overflow: hidden;
  transform: translateZ(0);
  backface-visibility: hidden;
  background: linear-gradient(...);            /* the gradient */
}
```

```html
<!-- Frame has the border via Tailwind, surface has the gradient -->
<div class="my-card-frame border border-gray-300 dark:border-white/10">
  <div class="my-card-surface">
    Content here
  </div>
</div>
```

### Existing examples in this codebase

| Component | Frame class | Surface class |
|-----------|------------|---------------|
| Billing card | `.glass-panel.billing-current-card` | `.billing-current-card-inner` |
| Consistency panel | `.consistency-panel-frame` | `.consistency-panel-inner` |
| Package tabs | `.owner-packages-tab-frame` | `.owner-packages-tab-surface` |
| Attendance cards | `.owner-home-attendance-frame` | `.owner-home-attendance-inner` |

### Common mistakes

1. **Putting gradient and border on the same element** — the gradient will always bleed through a semi-transparent border.
2. **Using `p-px` as a fake gradient border** — this exposes the gradient in the padding gap. If you want a colored border effect, use a real border with an opaque color, or use the frame's background as the "border color" with padding.
3. **Forgetting the opaque background on the frame** — without it, `dark:border-white/10` will composite against whatever is behind the element (usually the page gradient), causing unpredictable color bleed.
4. **Mismatched border-radius** — if the surface radius doesn't equal `frame-radius - border-width`, you get visible wedge-shaped gaps or overlaps at the corners.

---

## Issue 2: Gradient Colors Not Mixing on Small Elements

### What causes it

When a gradient uses percentage-based `background-size` (e.g., `68% 235%`), those percentages are relative to the element's own dimensions. A gradient that blends smoothly across a 200px-wide button will look clipped or abruptly cut off on a 70px-wide pill, because the absolute pixel coverage shrinks proportionally.

### How to prevent it

**When reusing a shared gradient class on a smaller element**, override `background-size` with larger percentages so the gradient layers overlap enough to blend.

**Rule of thumb**: if the element is less than half the width of the "typical" usage of that gradient class, increase each layer's width percentage by roughly `typical-width / actual-width`.

### Example

The `brand-duotone-button` class defines:

```css
background-size: 52% 185%, 68% 235%, 100% 100%;
```

This works well on standard buttons (~150px+). On the small `+ NEW` pill (~73px), the green layer at 68% only covers ~50px from the right, cutting off near the center. The fix is an inline override:

```jsx
<span
  className="brand-duotone-button"
  style={{ backgroundSize: '62% 185%, 86% 235%, 100% 100%' }}
/>
```

### General approach

1. Check the gradient's `background-size` and `background-position` values
2. Calculate the actual pixel coverage: `element-width * percentage`
3. If a gradient layer doesn't reach far enough to overlap with the other layers, increase its width percentage
4. Use an inline `style` override rather than modifying the shared class — this keeps the base class working for its standard use cases
