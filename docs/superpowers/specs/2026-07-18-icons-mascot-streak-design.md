# Custom icon set, reactive plane mascot, and streak hook

## Context

Runway (`C:\Code_Files\runway-budget`) is a static HTML/CSS/JS budget planner (no build step, no framework, no test tooling). `tokens.css` and `styles.css` already carry two prior `hallmark` design passes — theme "Ledger" (paper/money-green/brass palette, oklch tokens, Source Serif 4 / IBM Plex fonts) and "Ledger (elevated)" (paper-grain texture, cascading section-entrance choreography, tinted float-shadows, a gauge halo, a runway contrail, and `--ease-cel` reserved for one-off celebratory bursts like goal-complete). Motion is already deep; it is not the gap.

The actual gap: every icon in the app is a raw emoji or Unicode glyph — nav icons (`◧ ⇅ ✓ ◎`), the sidebar brand mark (`🛫`), the runway-strip plane (`✈️`), and empty-state glyphs (`🌫️ 🌱 🗒️ 📮`). None of it is custom-drawn, and none of it is reactive to app state.

This spec covers three additions, all built on data the app already computes in `dailyBudgetSeries()` ([app.js:600](app.js#L600)) — no new persisted state beyond one small celebration marker:

1. A custom inline-SVG icon set replacing the emoji/Unicode chrome.
2. A reactive plane mascot on the runway strip that visually reflects today's spending pace.
3. A cross-month streak counter with milestone celebrations, reusing the existing confetti system.

## Non-goals

- No new illustration/artwork beyond icons (no generated raster images — see rationale below).
- No changes to the goal-icon emoji `<input>` ([app.js:1239](app.js#L1239)) — that's user-entered content, not app chrome.
- No changes to `TYPES[type].emoji` or the vendor-detecting `emojiFor()` system (transaction rows, category badges, add-entry type picker — [app.js:10-30](app.js#L10)). That's expressive per-item content (Panera → 🥐, Starbucks → ☕, etc.) that already works well and is a different layer from the app-chrome icons this spec targets. In scope here is chrome only: nav, brand mark, empty states, and the runway plane.
- No new build tooling, no icon font, no external icon library.
- No backend/Supabase changes.
- Streak does not persist its count — it's derived fresh from transaction data every render, so it can never drift out of sync with the ledger.

## 1. Custom icon set

**Approach:** hand-authored inline SVG (`<svg>` directly in the HTML/template strings), not raster output from an image-generation tool. These are small (~15-20px), monochrome, geometric UI icons — a chart square, up/down arrows, a checkmark, target rings, a plane. Inline SVG inherits `currentColor` / `var(--ink)` so it repaints automatically across light/dark theme and hover states for free, stays pixel-crisp at any size, and adds negligible weight. Image generation is the right tool for textured/illustrative art; it's the wrong tool for crisp small UI iconography, so this deviates from the image-gen approach discussed earlier in favor of directly coded SVG.

**Style:** ~1.5px stroke, rounded line joins/caps, no fill (outline style) to match the "ink-precise ledger" vibe already established by the type and color system.

**Icons to draw and their call sites:**

| Icon | Replaces | Location |
|---|---|---|
| Dashboard (grid/ledger-page glyph) | `◧` | `.nav-btn[data-view="dashboard"]` nav icon |
| Transactions (up/down arrows) | `⇅` | `.nav-btn[data-view="transactions"]` |
| Bills (checkmark in circle) | `✓` | `.nav-btn[data-view="bills"]` |
| Goals (target rings) | `◎` | `.nav-btn[data-view="goals"]` |
| Brand mark (paper plane / runway mark) | `🛫` | `.brand-mark` in sidebar |
| Empty: no daily budget (cloud/fog) | `🌫️` | `renderDailyCard` empty state ([app.js:637](app.js#L637)) |
| Empty: no spending yet (sprout) | `🌱` | dashboard spending empty state ([app.js:877](app.js#L877)) |
| Empty: no transactions (notepad) | `🗒️` | transactions empty state ([app.js:929](app.js#L929)) |
| Empty: no bills (inbox) | `📮` | bills empty state ([app.js:1022](app.js#L1022)) |

Each is a small template-string-returning helper (e.g. `iconDashboard()`) colocated near the top of `app.js` or in a new `icons.js` partial included before `app.js` — final placement decided during planning based on file-size/readability trade-offs (`app.js` is already ~66KB).

## 2. Reactive plane mascot

The runway strip already renders a plane positioned by day-of-month progress (`data-x="${(dayNow / days) * 100}"`, [app.js:532](app.js#L532)) with an idle bob (`planeBob` keyframe, [styles.css:369](styles.css#L369)). It currently has one visual state. This adds three, driven by the pace signal `dailyBudgetSeries()` already computes per day (`carryIn`: positive = running a surplus, negative = running a deficit).

**State derivation (render-time only, nothing persisted):**
- Only active when viewing the current month (`sim.isCurrent === true`); other months keep the existing neutral look, since "today's pace" doesn't apply retroactively.
- Let `pace = series[today].carryIn` (today's entering carry) and `band = 0.10 * series[today].budget`.
  - `pace > band` → **climbing**
  - `pace < -band` → **descending**
  - otherwise → **cruising** (current/default behavior, unchanged)
- The 10%-of-budget band exists so trivial cent-level differences don't flip the state every render.

**Visual treatment (CSS classes toggled on the existing `.plane` element, SVG swapped for the emoji):**
- Cruising: current appearance, unchanged.
- Climbing: SVG nose tilted up a few degrees, contrail lengthened and tinted `var(--c-income)`.
- Descending: SVG nose tilted down, contrail shortened and tinted `var(--c-expense)`/`var(--critical)`, plus a brief low-amplitude wobble (reuses `--ease-in-out`, a short `--dur-*` token — not `--ease-cel`, which stays reserved for celebratory bursts per the existing convention).

## 3. Streak counter with milestones

**Definition:** consecutive complete days, walking backward from *yesterday* (today is still in progress and excluded), where `spent <= budget` for that day. This is the "you stayed on pace" streak, distinct from the plane's live "how's today going" signal.

**Cross-month, not calendar-boxed.** A streak that silently resets to 0 on the 1st of every month regardless of behavior is a weak hook and a known bad gamification pattern. Instead, the backward walk crosses month boundaries using the existing `dailyBudgetSeries(key)` for whatever month a given day falls in.

**Algorithm (derived at render time, no persisted counter):**
1. Start at `yesterday` relative to `todayKey()`.
2. For each day walking backward:
   - If its month key does not exist in `state.months` at all → **stop** (this is "before the user had data here," not a broken streak). Streak = days counted so far.
   - Else if that day's `spent > budget` → **stop** (streak broken). Streak = days counted so far.
   - Else → increment streak, move to the previous day (crossing into the prior month via `daysInMonth`/`todayKey`-style arithmetic when needed).
3. Hard safety cap at 3650 iterations (10 years) to guarantee termination regardless of data shape.

**Display:** a `stat-chip`-styled badge near the daily gauge (reuses the existing `chipIn` entrance animation and chip visual language), showing the custom streak icon + day count, e.g. "12 day streak."

**Milestones:** at 7 / 14 / 30 / 60 / 90 days, fire the existing `confetti()` once. To avoid re-firing every render at the same count, add one small piece of persisted state: `state.lastCelebratedStreak` (a single integer, global — not per-month, since the streak itself is now cross-month). Compare the freshly-derived streak against it; if a new milestone has been crossed, celebrate and update it.

## Edge cases

- **No income configured yet** (`spendable0 <= 0`): daily card already shows its own empty state; plane stays neutral, streak walk stops immediately (no month data to evaluate against).
- **First day of app usage**: backward walk hits a month key that doesn't exist and stops cleanly at streak = 0, without treating "no history" as "broken streak."
- **Viewing a past or future month**: plane renders in its existing neutral style; streak (which is always relative to *today*, not the viewed month) is unaffected by which month is currently displayed.

## Verification

No test framework exists in this project (static HTML/CSS/JS, no `package.json`). Verification is manual in-browser:
- Use the existing "Reset sample data" button to get consistent demo data.
- Confirm all four nav icons, brand mark, and four empty-state icons render correctly in both light and dark theme.
- Manually adjust sample transactions (or add entries via the UI) to trigger each plane state (climbing/cruising/descending) and confirm the visual + contrail color changes.
- Manually construct a run of on-budget days (including across a month boundary) to confirm the streak counts correctly and stops at a genuine overspend day or at the start of data.
- Confirm milestone confetti fires once at a threshold and does not refire on subsequent renders at the same streak count.
