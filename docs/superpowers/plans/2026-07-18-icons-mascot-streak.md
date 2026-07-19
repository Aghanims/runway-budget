# Custom Icons, Reactive Plane Mascot & Streak Hook — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Runway's emoji/Unicode app-chrome with a custom inline-SVG icon set, make the runway-strip plane visually react to today's spending pace, and add a cross-month streak counter with milestone celebrations.

**Architecture:** Three additive, mostly-independent slices layered on `runway-budget`'s existing static HTML/CSS/JS app (no build step, no framework). Dynamic icons (empty-states, the plane, the streak flame) live in a new `icons.js` file of plain template-string functions, loaded before `app.js`. Static chrome icons (nav, brand mark) are inlined directly into `index.html` since they never change at runtime. The plane's reactive state and the streak count are both derived at render time from data `dailyBudgetSeries()` already computes — no new persisted state except one integer (`state.lastCelebratedStreak`) that prevents milestone confetti from re-firing.

**Tech Stack:** Vanilla HTML/CSS/JS, inline SVG, localStorage. No dependencies added.

## Global Constraints

- No build tooling, no icon font, no external icon library, no generated raster images for icons (spec: hand-authored inline SVG only).
- Do not modify `TYPES[type].emoji`, `emojiFor()`, or the goal-icon `<input>` — those are a separate, out-of-scope content layer (see spec §Non-goals).
- Icons use `stroke="currentColor"` / `fill="currentColor"` so they repaint automatically across the light/dark theme toggle — never hardcode a color inside an icon's SVG markup.
- `--ease-cel` stays reserved for celebratory bursts only (goal-complete, streak milestones) — never used for persistent UI-state transitions.
- Streak count and plane state are both derived fresh at render time; neither is cached in `state` beyond `lastCelebratedStreak`.

Reference spec: `docs/superpowers/specs/2026-07-18-icons-mascot-streak-design.md`

---

## File Structure

- **Create `icons.js`** — plain functions returning SVG template strings: `iconCloud()`, `iconSprout()`, `iconNotepad()`, `iconInbox()`, `iconStreakFlame()`, `iconPlane(state)`. Loaded via `<script>` before `app.js`.
- **Modify `index.html`** — add the `icons.js` script tag; replace the 4 nav-icon glyphs and the brand-mark emoji with inline SVG (static markup, no JS involved).
- **Modify `app.js`** — swap 4 empty-state emoji for `icons.js` calls; add `computeStreak()`; compute the plane's pace state and the streak count in `renderDashboard`; display the streak chip and fire milestone confetti; add `lastCelebratedStreak` to `seedState()`/`emptyState()` plus a load-time backfill for existing saved data.
- **Modify `styles.css`** — `.brand-mark` color for the new SVG; `.plane-ico` base/state/wobble rules; `.stat-chip.streak-chip` styling.

---

### Task 1: Empty-state icon set

**Files:**
- Create: `icons.js`
- Modify: `app.js:637`, `app.js:877`, `app.js:929`, `app.js:1022`
- Modify: `index.html` (add script tag)

**Interfaces:**
- Produces: `iconCloud()`, `iconSprout()`, `iconNotepad()`, `iconInbox()` — each takes no arguments, returns an SVG markup string sized 40×40, using `stroke="currentColor"`. Consumed by `app.js` empty-state template strings.

- [ ] **Step 1: Create `icons.js` with the four empty-state icon functions**

```js
"use strict";
/* ============================================================
   Runway — icon helpers
   Inline SVG for dynamically-rendered UI (empty states, the
   runway-strip plane mascot, the streak chip). Static chrome
   icons (nav, brand mark) live directly in index.html since
   they never change at runtime.
   ============================================================ */

function iconCloud() {
  return `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 26a6 6 0 0 1-1-11.9A8 8 0 0 1 26 12a6.5 6.5 0 0 1 1 14H12z"/>
  </svg>`;
}

function iconSprout() {
  return `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M20 30V17"/>
    <path d="M20 19c0-5-4-8-9-8 0 5 4 9 9 9"/>
    <path d="M20 15c0-4 3-7 8-7 0 4-3 7-8 7"/>
  </svg>`;
}

function iconNotepad() {
  return `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="10" y="7" width="20" height="26" rx="2"/>
    <path d="M15 16h10M15 21h10M15 26h6"/>
  </svg>`;
}

function iconInbox() {
  return `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M8 20l4-11h16l4 11"/>
    <path d="M8 20v9a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2v-9"/>
    <path d="M8 20h7l2 4h6l2-4h7"/>
  </svg>`;
}
```

- [ ] **Step 2: Load `icons.js` before `app.js` in `index.html`**

Old (`index.html`):
```html
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="app.js"></script>
```

New:
```html
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="icons.js"></script>
  <script src="app.js"></script>
```

- [ ] **Step 3: Swap the 4 empty-state emoji in `app.js` for icon calls**

Old (`app.js:637`, inside `renderDailyCard`):
```js
      <div class="empty-state" style="padding:26px 10px"><div class="big">🌫️</div>
```
New:
```js
      <div class="empty-state" style="padding:26px 10px"><div class="big">${iconCloud()}</div>
```

Old (`app.js:877`):
```js
    wrap.innerHTML = `<div class="empty-state" style="padding:30px 10px"><div class="big">🌱</div><p>No spending yet this month.</p></div>`;
```
New:
```js
    wrap.innerHTML = `<div class="empty-state" style="padding:30px 10px"><div class="big">${iconSprout()}</div><p>No spending yet this month.</p></div>`;
```

Old (`app.js:929`):
```js
    body = `<div class="empty-state"><div class="big">🗒️</div>
```
New:
```js
    body = `<div class="empty-state"><div class="big">${iconNotepad()}</div>
```

Old (`app.js:1022`):
```js
    : `<div class="empty-state"><div class="big">📮</div><p>No bills for ${monthName(state.activeMonth)}.</p>
```
New:
```js
    : `<div class="empty-state"><div class="big">${iconInbox()}</div><p>No bills for ${monthName(state.activeMonth)}.</p>
```

- [ ] **Step 4: Verify in browser**

Open `index.html` (double-click `Start Runway.bat`, or open the file directly). In the sidebar, click **"Start fresh"** and confirm the dialog — this clears all data and puts every view into its empty state.

Open DevTools console and run:
```js
document.querySelectorAll('.empty-state .big svg').length
```
Expected: `2` on the Dashboard view — the "no daily budget" cloud state (`renderDailyCard`, no income configured) and the "no spending yet" sprout state (`drawTopBars`, no expense entries) both render at once on a freshly-reset budget. Click **Transactions** and **Bills** in the nav; each should show its own custom line-icon (notepad, inbox). Confirm no emoji (🌫️🌱🗒️📮) remain anywhere in the empty states, and that the icons repaint correctly when toggling the theme button (dark ↔ light).

Click **"Reset sample data"** afterward to restore the April demo data for later tasks.

- [ ] **Step 5: Commit**

```bash
git add icons.js index.html app.js
git commit -m "feat: add custom SVG icon set for empty states"
```

---

### Task 2: Static chrome icons (nav + brand mark)

**Files:**
- Modify: `index.html` (nav buttons, brand mark)
- Modify: `styles.css:93-98` (`.brand-mark`)

**Interfaces:**
- None (pure markup/CSS, no JS functions involved — these icons never re-render).

- [ ] **Step 1: Replace the 4 nav-icon glyphs in `index.html`**

Old:
```html
      <nav class="nav">
        <button class="nav-btn active" data-view="dashboard">
          <span class="nav-ico">◧</span><span>Dashboard</span>
        </button>
        <button class="nav-btn" data-view="transactions">
          <span class="nav-ico">⇅</span><span>Transactions</span>
        </button>
        <button class="nav-btn" data-view="bills">
          <span class="nav-ico">✓</span><span>Bills</span>
        </button>
        <button class="nav-btn" data-view="goals">
          <span class="nav-ico">◎</span><span>Goals</span>
        </button>
      </nav>
```

New:
```html
      <nav class="nav">
        <button class="nav-btn active" data-view="dashboard">
          <span class="nav-ico"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.5"/><rect x="11" y="2.5" width="6.5" height="6.5" rx="1.5"/><rect x="2.5" y="11" width="6.5" height="6.5" rx="1.5"/><rect x="11" y="11" width="6.5" height="6.5" rx="1.5"/></svg></span><span>Dashboard</span>
        </button>
        <button class="nav-btn" data-view="transactions">
          <span class="nav-ico"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3v13"/><path d="M3 7l3-3 3 3"/><path d="M14 17V4"/><path d="M17 13l-3 3-3-3"/></svg></span><span>Transactions</span>
        </button>
        <button class="nav-btn" data-view="bills">
          <span class="nav-ico"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><path d="M6.5 10.2l2.3 2.3 4.7-5"/></svg></span><span>Bills</span>
        </button>
        <button class="nav-btn" data-view="goals">
          <span class="nav-ico"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4.3"/><circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none"/></svg></span><span>Goals</span>
        </button>
      </nav>
```

- [ ] **Step 2: Replace the brand-mark emoji in `index.html`**

Old:
```html
        <div class="brand-mark">🛫</div>
```

New:
```html
        <div class="brand-mark"><svg viewBox="0 0 32 20" width="26" height="16" fill="currentColor" style="transform:rotate(-18deg)" aria-hidden="true"><path d="M14 4 L28 10 L14 16 L18 10 Z"/></svg></div>
```

- [ ] **Step 3: Give `.brand-mark` a text color so the SVG is visible against its solid fill**

Old (`styles.css:93-98`):
```css
.brand-mark {
  width: 40px; height: 40px; border-radius: var(--radius-sm);
  background: var(--accent);
  display: grid; place-items: center; font-size: 19px;
  box-shadow: var(--shadow);
}
```

New:
```css
.brand-mark {
  width: 40px; height: 40px; border-radius: var(--radius-sm);
  background: var(--accent);
  display: grid; place-items: center; color: var(--surface);
  box-shadow: var(--shadow);
}
```

- [ ] **Step 4: Verify in browser**

Reload the app. In DevTools console:
```js
document.querySelectorAll('.nav-ico svg').length
```
Expected: `4`.
```js
document.querySelector('.brand-mark svg') !== null
```
Expected: `true`.

Visually confirm: all 4 nav icons render as clean line-icons (not broken/invisible), the active nav item (Dashboard) still shows its green left-rail highlight, hover still lifts the icon (`.nav-btn:hover .nav-ico` translateY is unaffected since it targets the `.nav-ico` wrapper, not the svg), and the brand mark in the top-left shows a light-colored paper-plane silhouette clearly visible against the green square. Toggle dark/light theme and confirm both still look correct (icons use `currentColor`, so `.nav-ico` text color and `.brand-mark`'s new `color: var(--surface)` should carry through automatically).

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css
git commit -m "feat: replace nav and brand-mark emoji with custom SVG icons"
```

---

### Task 3: Reactive plane mascot

**Files:**
- Modify: `icons.js` (add `iconPlane`)
- Modify: `app.js:481-533` (`renderDashboard`)
- Modify: `styles.css` (new `.plane-ico` rules, near `.month-meter .plane` at `styles.css:359-372`)

**Interfaces:**
- Consumes: `sim.series[n]` rows (`{ d, budget, spent, carryIn }`) and `sim.spendable0`, both already produced by `dailyBudgetSeries()` ([app.js:600](app.js#L600)) — no changes to that function.
- Produces: `iconPlane(state)` where `state` is `"climbing" | "cruising" | "descending"`, returning an SVG string whose root `<svg>` carries classes `plane-ico state-${state}`. Consumed by `renderDashboard`'s month-meter markup and, indirectly, by Task 4 (which does not use this function but shares the same `sim` data).

- [ ] **Step 1: Add `iconPlane(state)` to `icons.js`**

Append to `icons.js`:
```js
/* states: "climbing" | "cruising" | "descending" */
function iconPlane(state) {
  return `<svg class="plane-ico state-${state}" viewBox="0 0 32 20" width="22" height="14" fill="none" aria-hidden="true">
    <path class="plane-trail" d="M2 10 H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path class="plane-body" d="M14 4 L28 10 L14 16 L18 10 Z" fill="currentColor"/>
  </svg>`;
}
```

- [ ] **Step 2: Compute the plane's pace state in `renderDashboard`**

Old (`app.js:481-489`):
```js
function renderDashboard(view) {
  const key = state.activeMonth;
  const t = monthTotals(key);
  const days = daysInMonth(key);
  const isCurrent = key === todayKey();
  const sim = dailyBudgetSeries(key);
  const dayNow = sim.today;
  const daysLeft = isCurrent ? days - dayNow + 1 : 0;
  const todayBudget = sim.series[dayNow - 1]?.budget ?? 0;
```

New:
```js
function renderDashboard(view) {
  const key = state.activeMonth;
  const t = monthTotals(key);
  const days = daysInMonth(key);
  const isCurrent = key === todayKey();
  const sim = dailyBudgetSeries(key);
  const dayNow = sim.today;
  const daysLeft = isCurrent ? days - dayNow + 1 : 0;
  const todayRow = sim.series[dayNow - 1] || { budget: 0, spent: 0, carryIn: 0 };
  const todayBudget = todayRow.budget ?? 0;
  const paceBand = 0.10 * Math.max(0, todayRow.budget);
  const paneState = (!isCurrent || sim.spendable0 <= 0) ? "cruising"
    : todayRow.carryIn > paceBand ? "climbing"
    : todayRow.carryIn < -paceBand ? "descending"
    : "cruising";
```

(This replaces the old single-purpose `todayBudget` line with one derived from the now-shared `todayRow`, and adds `paneState`. No other line in the function references `todayRow`/`todayBudget` differently than before — `todayBudget` keeps the same value it always had.)

- [ ] **Step 3: Use `iconPlane(paneState)` in the month-meter markup**

Old (`app.js:532`):
```js
        <div class="plane" data-x="${(dayNow / days) * 100}">✈️</div>
```

New:
```js
        <div class="plane" data-x="${(dayNow / days) * 100}">${iconPlane(paneState)}</div>
```

- [ ] **Step 4: Add CSS for the plane's states**

Add to `styles.css`, directly after the existing `@keyframes planeBob { ... }` block (`styles.css:369-372`):
```css
.plane-ico {
  display: block; color: var(--ink-2);
  transform: rotate(0deg);
  transition: color .3s var(--ease-out), transform .4s var(--ease-out);
}
.plane-ico .plane-trail { opacity: .55; }
.plane-ico.state-climbing { color: var(--c-income); transform: rotate(-14deg); }
.plane-ico.state-descending {
  color: var(--c-expense);
  animation: planeWobble 1.4s var(--ease-in-out) infinite;
}
@keyframes planeWobble {
  0%, 100% { transform: rotate(14deg); }
  50% { transform: rotate(19deg); }
}
```

(Note: the *outer* `.month-meter .plane` div keeps its existing `planeBob` position/bob animation untouched — the tilt and wobble live on the inner `.plane-ico` SVG so the two animations never fight over the same element's `transform`. `prefers-reduced-motion` already neutralizes `planeWobble` via the existing universal `*, *::before, *::after { animation-duration: .01ms !important; ... }` rule at `styles.css:703-710` — no changes needed there.)

- [ ] **Step 5: Verify in browser**

Reload with the April sample data active (click "Reset sample data" if needed, then navigate Dashboard to the current month — sample data is April/May 2025, so the reactive plane won't show unless `state.activeMonth` is today's real month; for this check, temporarily add a same-day entry to today's month instead — see below).

In DevTools console, force a climbing state to confirm the CSS path works even without real today-data: navigate to Dashboard, then run:
```js
document.querySelector('.plane-ico').outerHTML
```
Expected: an `<svg class="plane-ico state-...">` string (not the old `✈️` emoji).

Then confirm state-switching visually: use "Add entry" to log a small expense for today in the *current* month (create one if `state.activeMonth` isn't today's month — switch to it via the month-switch arrows first). With little spent relative to today's budget, the plane should render `state-climbing` (green, nose-up). Add a large expense that exceeds today's budget and re-render (switch views and back, or reload); confirm it flips to `state-descending` (red, nose-down, subtly wobbling — reduced-motion users won't see the wobble). Toggle `prefers-reduced-motion` via DevTools' Rendering panel and confirm the wobble stops.

Afterward, click "Reset sample data" to restore clean demo data for Task 4.

- [ ] **Step 6: Commit**

```bash
git add icons.js app.js styles.css
git commit -m "feat: reactive plane mascot reflects today's spending pace"
```

---

### Task 4: Streak counter with milestone celebration

**Files:**
- Modify: `icons.js` (add `iconStreakFlame`)
- Modify: `app.js:88-133` (`seedState`, `emptyState`, state load) — add `lastCelebratedStreak`
- Modify: `app.js` (after `dailyBudgetSeries`, `app.js:630`) — add `computeStreak()`
- Modify: `app.js:481-591` (`renderDashboard`) — compute streak, trigger milestone
- Modify: `app.js:632-694` (`renderDailyCard`) — accept and display streak
- Modify: `styles.css` (new `.stat-chip.streak-chip` rule, near `styles.css:406-408`)

**Interfaces:**
- Produces: `computeStreak()` — no arguments, reads `state.months` directly, returns a non-negative integer: the count of consecutive complete days (ending yesterday) where that day's `spent <= budget`, stopping at the first day with no recorded activity anywhere in `state`. Pure function — no DOM access, no mutation.
- Produces: `iconStreakFlame()` — no arguments, returns a 13×13 SVG string meant to be inlined before text inside a `.stat-chip`.
- Consumes (in `renderDailyCard`): a new 4th parameter `streak` (integer), used only for display — the milestone/confetti decision moves to `renderDashboard`, keeping `renderDailyCard` a pure render function.

- [ ] **Step 1: Add `iconStreakFlame()` to `icons.js`**

Append to `icons.js`:
```js
function iconStreakFlame() {
  return `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px">
    <path d="M8 14c-3 0-4.5-2-4.5-4.3C3.5 7 6 5.5 6 3c1.8 1 3 2.8 3 5 .8-.6 1.2-1.6 1.2-2.6C11.8 6.5 12.5 8 12.5 9.7 12.5 12 10.9 14 8 14z"/>
  </svg>`;
}
```

- [ ] **Step 2: Add `lastCelebratedStreak` to both state constructors**

Old (`app.js:87-90`, inside `seedState()`):
```js
  return {
    version: 1,
    theme: null, // null = follow system
    activeMonth: "2025-04",
```
New:
```js
  return {
    version: 1,
    theme: null, // null = follow system
    lastCelebratedStreak: 0,
    activeMonth: "2025-04",
```

Old (`app.js:106-110`, inside `emptyState()`):
```js
  return {
    version: 1,
    theme: keepTheme ?? null,
    activeMonth: key,
```
New:
```js
  return {
    version: 1,
    theme: keepTheme ?? null,
    lastCelebratedStreak: 0,
    activeMonth: key,
```

- [ ] **Step 3: Backfill the field for existing saved state**

Old (`app.js:129-133`):
```js
let state;
try {
  state = JSON.parse(localStorage.getItem(STORE_KEY)) || seedState();
  if (!state.months) state = seedState();
} catch { state = seedState(); }
```
New:
```js
let state;
try {
  state = JSON.parse(localStorage.getItem(STORE_KEY)) || seedState();
  if (!state.months) state = seedState();
} catch { state = seedState(); }
if (typeof state.lastCelebratedStreak !== "number") state.lastCelebratedStreak = 0;
```

- [ ] **Step 4: Add `computeStreak()` after `dailyBudgetSeries()`**

Insert after the closing `}` of `dailyBudgetSeries` (`app.js:630`, right before the `/* --- today's budget gauge card --- */` comment):
```js
/* ---------- streak: consecutive on-budget days, ending yesterday ---------- */
function computeStreak() {
  let firstDate = null;
  for (const key in state.months) {
    for (const e of state.months[key].entries) {
      if (!firstDate || e.date < firstDate) firstDate = e.date;
    }
  }
  if (!firstDate) return 0;

  let count = 0;
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 1); // start at yesterday; today isn't finished yet
  let cachedKey = null, cachedSim = null;
  for (let i = 0; i < 3650; i++) {
    const y = cursor.getFullYear(), mo = cursor.getMonth() + 1, d = cursor.getDate();
    const key = `${y}-${String(mo).padStart(2, "0")}`;
    const iso = `${key}-${String(d).padStart(2, "0")}`;
    if (iso < firstDate) break; // before any recorded activity — stop, don't break the streak

    if (key !== cachedKey) { cachedSim = dailyBudgetSeries(key); cachedKey = key; }
    if (cachedSim.spendable0 > 0) {
      const row = cachedSim.series[d - 1];
      if (!row || row.spent > row.budget) break; // overspent — streak broken
      count++;
    }
    // spendable0 <= 0: no budget configured that day — skip without counting or breaking

    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}
```

- [ ] **Step 5: Compute the streak and trigger milestone celebration in `renderDashboard`**

Old (`app.js`, immediately after the `paneState` block added in Task 3, still inside `renderDashboard` before `const kpis = ...`):
```js
  const paneState = (!isCurrent || sim.spendable0 <= 0) ? "cruising"
    : todayRow.carryIn > paceBand ? "climbing"
    : todayRow.carryIn < -paceBand ? "descending"
    : "cruising";
```
New (add directly below it):
```js
  const paneState = (!isCurrent || sim.spendable0 <= 0) ? "cruising"
    : todayRow.carryIn > paceBand ? "climbing"
    : todayRow.carryIn < -paceBand ? "descending"
    : "cruising";

  const streak = isCurrent ? computeStreak() : 0;
  const STREAK_MILESTONES = [7, 14, 30, 60, 90];
  if (isCurrent && STREAK_MILESTONES.includes(streak) && state.lastCelebratedStreak < streak) {
    state.lastCelebratedStreak = streak;
    save();
    setTimeout(confetti, 350);
    setTimeout(() => toast(`${streak}-day streak!`), 350);
  }
```

- [ ] **Step 6: Pass `streak` into `renderDailyCard`**

Old (`app.js:586`):
```js
  renderDailyCard($("#daily-card"), sim, key);
```
New:
```js
  renderDailyCard($("#daily-card"), sim, key, streak);
```

- [ ] **Step 7: Display the streak chip in `renderDailyCard`**

Old (`app.js:633-676`):
```js
function renderDailyCard(card, sim, key) {
  const { series, today, isCurrent, spendable0, reserved, days } = sim;
```
New:
```js
function renderDailyCard(card, sim, key, streak) {
  const { series, today, isCurrent, spendable0, reserved, days } = sim;
```

Old (`app.js:669-676`, the `chip-row` inside the `isCurrent` branch):
```js
      <div class="chip-row">
        ${Math.abs(row.carryIn) >= 0.5
          ? `<span class="stat-chip ${row.carryIn > 0 ? "pos" : "neg"}">${row.carryIn > 0
              ? "＋" + fmt(row.carryIn) + " rolled in from yesterday 🎁"
              : "−" + fmt(-row.carryIn) + " owed from yesterday"}</span>`
          : ""}
        ${tomorrow ? `<span class="stat-chip" style="animation-delay:.12s">tomorrow ≈ ${fmt(Math.max(0, tomorrow.budget))} if you stop now</span>` : ""}
      </div>`;
```
New:
```js
      <div class="chip-row">
        ${streak > 0 ? `<span class="stat-chip streak-chip">${iconStreakFlame()}${streak} day streak</span>` : ""}
        ${Math.abs(row.carryIn) >= 0.5
          ? `<span class="stat-chip ${row.carryIn > 0 ? "pos" : "neg"}" style="animation-delay:.08s">${row.carryIn > 0
              ? "＋" + fmt(row.carryIn) + " rolled in from yesterday 🎁"
              : "−" + fmt(-row.carryIn) + " owed from yesterday"}</span>`
          : ""}
        ${tomorrow ? `<span class="stat-chip" style="animation-delay:.16s">tomorrow ≈ ${fmt(Math.max(0, tomorrow.budget))} if you stop now</span>` : ""}
      </div>`;
```

- [ ] **Step 8: Style the streak chip**

Add to `styles.css`, directly after `@keyframes chipIn { from { opacity: 0; transform: translateY(6px); } }` (`styles.css:408`):
```css
.stat-chip.streak-chip { background: var(--c-bill-soft); color: var(--ink); border-color: transparent; }
```

- [ ] **Step 9: Verify in browser**

This needs entries dated around *today's* real date, so temporarily build a short streak by hand:

1. Reload the app. Use the month-switch arrows to navigate to the current real month (create it if needed — Runway lazily creates months you visit).
2. Add an income entry for today large enough to fund a budget (e.g. `type=income, date=today, name=Test, planned=500, actual=500`).
3. Add small expense entries for each of the last 3 days (yesterday, 2 days ago, 3 days ago) with `actual` clearly under what a ~500/30 daily budget would allow (e.g. $5 each). Leave today itself without an expense (today doesn't count toward the streak yet).
4. In DevTools console, run:
   ```js
   computeStreak()
   ```
   Expected: `3`.
5. Confirm the Dashboard's daily-budget card shows a chip reading "3 day streak" with the flame icon, appearing before the "rolled in from yesterday" / "tomorrow ≈" chips.
6. Add expenses for 4 more prior days (so 7 consecutive on-budget days exist total) and reload. Confirm `computeStreak()` returns `7`, the chip updates to "7 day streak", the confetti canvas fires once, and a toast reading "7-day streak!" appears. Reload again without changing data — confirm confetti does **not** re-fire (check via `state.lastCelebratedStreak === 7` in the console) and the chip still correctly reads "7 day streak".
7. Add one more expense on one of those prior days that exceeds its budget (breaking the streak). Confirm `computeStreak()` drops back down accordingly and the chip updates (or disappears entirely if it drops to 0).
8. Click "Reset sample data" to restore clean demo data when finished.

- [ ] **Step 10: Commit**

```bash
git add icons.js app.js styles.css
git commit -m "feat: cross-month streak counter with milestone celebration"
```
