I am working on a mobile first web app. the requirement is to show the attendance data (particular dates) for a range of days (upto several months). I want a panel which has continuous week date grid with the attended dates having a sort of pill around them to mark. There is a month and week column label which is non-scrollable and only the inner date grid is scrollable. The important part of the design is the way to show to the user the current month that is in focus. the dates are all continuous and the way to show month in focus is to have white/black text for the month in focus and remaining dates greyed out. there is supposed to be a fade transition linked to the inner viewport scroll which changes based on which month is in focus. need an exact definition for calculating "month in focus" based on continuous smooth scroll.

---

This is a highly polished, premium UX pattern. You are essentially building an "infinite continuous calendar" where the timeline flows seamlessly, but the contextual focus (the month) dynamically anchors the user. 

To make this feel native and performant on mobile, we must avoid heavy DOM manipulation during the scroll cycle. The transition must be driven by continuous math tied directly to the scroll position, manipulating CSS custom properties via JavaScript to ensure 60fps performance.

Here is the deep-dive breakdown of the requirements and the exact mathematical model for implementation.

---

### 1. Requirements Definition

**Functional & Layout Requirements:**
* **Viewport Constraints:** Fixed header containing the current dominant "Month" label and "Week" column labels (Sun, Mon, Tue, etc.). Only the inner container holding the dates is scrollable.
* **Continuous Grid:** The dates must form an unbroken 7-column grid. A month ending on a Tuesday must be immediately followed by the next month starting on a Wednesday on the same row.
* **Attendance Indicators:** Specific dates will be wrapped in a styling "pill" (background color + border radius) to indicate attendance.

**Visual & Transition Requirements:**
* **Focus State:** The "month in focus" has its dates rendered in high-contrast text (e.g., **#000000** or **#FFFFFF** depending on dark/light mode).
* **Unfocused State:** Dates belonging to other months are greyed out (e.g., **#A0A0A0**).
* **Smooth Fade:** As the user scrolls, the dates of the outgoing month must smoothly fade to grey, while the incoming month's dates smoothly fade to high-contrast. This fade must be directly proportional to the scroll depth, not a time-based CSS animation.
* **Header Update:** The fixed "Month" label in the header updates to reflect the month currently in focus.

---

### 2. Exact Definition: "Month in Focus" Mathematical Model

To calculate a smooth, continuous fade based on scroll, we must define a **Read Line** and a **Transition Zone** within the viewport. 

Let the scrollable container's height be $V_h$. 
Let the vertical position of the boundary (the line separating Month A and Month B) relative to the top of the viewport be $Y_b$.

**Step 1: Define the Read Line and Zone**
Instead of transitioning over the entire screen, the fade should happen as the month boundary crosses a specific "Read Line" (usually placed slightly above the center of the screen, where the user's eye naturally rests). 
* **Read Line ($L_r$):** Set at 30% of the viewport height: $L_r = 0.3 \times V_h$
* **Transition Zone ($Z_h$):** A spatial window around the Read Line where the crossfade occurs (e.g., 20% of the viewport height): $Z_h = 0.2 \times V_h$
* **Zone Boundaries:** * Top bound: $Z_{top} = L_r - \frac{Z_h}{2}$
    * Bottom bound: $Z_{bot} = L_r + \frac{Z_h}{2}$

**Step 2: The Interpolation Function**
As the boundary $Y_b$ between Month 1 (top) and Month 2 (bottom) moves vertically through the Transition Zone, we calculate a focus intensity $\alpha \in [0, 1]$ for Month 2.

$$
\alpha_{month2} = 
\begin{cases} 
0 & \text{if } Y_b > Z_{bot} \text{ (Month 1 fully in focus)} \\
\frac{Z_{bot} - Y_b}{Z_{bot} - Z_{top}} & \text{if } Z_{top} \le Y_b \le Z_{bot} \text{ (Crossfade actively happening)} \\
1 & \text{if } Y_b < Z_{top} \text{ (Month 2 fully in focus)} 
\end{cases}
$$

The focus intensity for Month 1 is simply the inverse:
$$\alpha_{month1} = 1 - \alpha_{month2}$$

*Note: The fixed "Month" label in the non-scrolling header should abruptly swap its text to Month 2 exactly when $\alpha_{month2} > 0.5$.*

---

### 3. Implementation Plan

To implement this without breaking the 7-column grid and without causing scroll lag (jank), we will use a combination of CSS `display: contents`, CSS Custom Properties (variables), and an optimized `requestAnimationFrame` scroll loop.

#### Phase 1: DOM Architecture
Group the dates logically by month using a wrapper, but use `display: contents` so the wrapper doesn't disrupt the CSS Grid.

```html
<div class="tracker-container">
  <div class="fixed-header">
    <h2 id="current-month-label">January 2026</h2>
    <div class="week-labels">
      <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
    </div>
  </div>

  <div class="date-scroll-viewport" id="scroll-viewport">
    <div class="date-grid">
      
      <div class="month-group" id="month-2026-01" style="--focus-alpha: 1;">
        <div class="date empty"></div> <div class="date attended"><div class="pill">1</div></div>
        <div class="date">2</div>
        </div>

      <div class="month-group" id="month-2026-02" style="--focus-alpha: 0;">
        <div class="date">1</div>
        </div>

    </div>
  </div>
</div>
```

#### Phase 2: CSS Architecture
Use the newer `color-mix()` CSS function (widely supported in modern mobile browsers) to smoothly blend the text color based purely on the `--focus-alpha` CSS variable.

```css
.date-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.month-group {
  display: contents; /* MAGIC: Keeps dates in the parent 7-column grid */
}

.date {
  /* Interpolate between Grey and Black based on the math variable */
  color: color-mix(
    in srgb, 
    var(--active-text-color, #000000) calc(var(--focus-alpha) * 100%), 
    var(--inactive-text-color, #A0A0A0)
  );
  display: flex;
  justify-content: center;
  align-items: center;
}

.date.attended .pill {
  background-color: #E0F7FA;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
}
```

#### Phase 3: JavaScript Scroll Engine
Bind a highly optimized scroll listener that executes our math model and updates the CSS variables.

1.  **Initialize Variables:** Cache the viewport height ($V_h$) and calculate $Z_{top}$ and $Z_{bot}$. Update these on window resize.
2.  **Scroll Listener with RAF:** Attach a scroll listener to `.date-scroll-viewport`. Inside the listener, use `requestAnimationFrame` to decouple the math calculation from the browser's paint cycle.
3.  **Find the Active Boundary:** * Query all `.month-group` DOM nodes. 
    * Since `display: contents` elements don't have a bounding box, you must track the *first child* (the 1st of the month) of each `.month-group` to represent the boundary $Y_b$.
    * Find the specific month whose first child's `getBoundingClientRect().top` is closest to the Transition Zone.
4.  **Apply the Math:**
    * Calculate $\alpha$ using the piecewise formula above.
    * Apply `element.style.setProperty('--focus-alpha', alpha)` to the incoming month's `.month-group`.
    * Apply `element.style.setProperty('--focus-alpha', 1 - alpha)` to the outgoing month's `.month-group`.
5.  **Update the Header:**
    * If $\alpha > 0.5$, update the inner text of `#current-month-label` to the incoming month's name. Otherwise, keep it as the outgoing month.

#### Phase 4: Performance Guardrails
* **Do not modify classes on scroll.** Changing classes on hundreds of date elements during a scroll triggers massive style recalculations. Updating a single CSS variable on a parent container is infinitely cheaper.
* **Intersection Observer (Optional but Recommended):** If rendering "several months" turns into rendering a full year, use an `IntersectionObserver` to set `--focus-alpha: 0` for months far outside the viewport, completely bypassing the math loop for them. Only run calculations for the two months currently intersecting the Transition Zone.
