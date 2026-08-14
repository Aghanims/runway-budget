# Pay-Period Daily Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the month-anchored, carry-forward daily budget with a pay-period engine where `budget = remaining / daysLeft`, so underspend spreads evenly across every remaining day instead of dumping onto tomorrow.

**Architecture:** A new pure-function module `payperiod.js` holds all period math with no DOM or global-state access, loaded before `app.js` and dual-exported so Node can test it. `app.js` gains a thin adapter that feeds it `state` and swaps the dashboard hero, gauge card, and flow chart onto period data when `state.pay` is configured. Absent `state.pay`, every code path falls back to the existing month engine untouched.

**Tech Stack:** Vanilla JS (ES2020), no build step, no framework. Tests are plain `node:assert` scripts run directly with `node`. Browser globals via `<script>` tags.

**Spec:** [docs/superpowers/specs/2026-08-13-paycheck-daily-budget-design.md](../specs/2026-08-13-paycheck-daily-budget-design.md)

## Global Constraints

- Branch: `paycheck-daily-budget`. All commits land there.
- No build step, no `package.json`, no npm dependencies. Tests run with bare `node`.
- No changes to Bills, Goals, or Transactions views.
- No changes to `monthTotals()`, `getMonth()`, or the per-month `rollover` field.
- `state.pay` absent → period mode fully off; the app must render byte-identically to today.
- `payperiod.js` is pure: no `document`, no `window`, no reads of the `state` global, no mutation of arguments.
- ISO dates parse to local **noon** (`new Date(y, m-1, d, 12)`) before any day arithmetic.
- `cycleDays` clamped to 1–60. Rollover chain capped at 60 periods.
- Money math stays signed; only display clamps with `Math.max(0, …)`.
- Existing file style: 2-space indent, double-quoted strings, semicolons, `/* ---------- section ---------- */` comment banners.

## File Structure

| File | Responsibility |
|---|---|
| `payperiod.js` (new) | All period math. Date helpers, period indexing, entry gathering, pot/rollover chain, the daily series. Pure. |
| `test/payperiod.test.js` (new) | Node assertions covering every branch of the above. |
| `index.html` (modify) | One `<script>` tag; one more-panel button. |
| `app.js` (modify) | Adapter (`isoToday`, `payPeriodSim`), hero + meter wiring, gauge card, flow chart, pay-schedule modal. |

---

### Task 1: Date helpers and period indexing

**Files:**
- Create: `payperiod.js`
- Test: `test/payperiod.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `PayPeriod.parseISO(iso) -> Date`, `PayPeriod.toISO(date) -> string`, `PayPeriod.addDays(iso, n) -> string`, `PayPeriod.daysBetween(fromISO, toISO) -> number`, `PayPeriod.isValid(pay) -> boolean`, `PayPeriod.cycleOf(pay) -> number`, `PayPeriod.periodIndexFor(pay, iso) -> number`, `PayPeriod.periodRange(pay, index) -> {index, startISO, endISO, days}`, `PayPeriod.currentPeriod(pay, todayISO) -> same shape`. `pay` is `{anchor: string, cycleDays: number, expected: number}`.

- [ ] **Step 1: Write the failing test**

Create `test/payperiod.test.js`:

```js
"use strict";
const assert = require("assert");
const P = require("../payperiod.js");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (err) { console.error("FAIL  " + name + "\n      " + err.message); process.exitCode = 1; }
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: expected ~${b}, got ${a}`);

const PAY = { anchor: "2026-08-13", cycleDays: 14, expected: 0 };

test("addDays crosses a month boundary", () => {
  assert.strictEqual(P.addDays("2026-08-28", 5), "2026-09-02");
});

test("daysBetween counts whole days", () => {
  assert.strictEqual(P.daysBetween("2026-08-13", "2026-08-27"), 14);
});

test("daysBetween is exact across the March DST transition", () => {
  assert.strictEqual(P.daysBetween("2026-03-06", "2026-03-10"), 4);
});

test("daysBetween is exact across the November DST transition", () => {
  assert.strictEqual(P.daysBetween("2026-10-30", "2026-11-03"), 4);
});

test("cycleOf clamps to 1..60 and defaults to 14", () => {
  assert.strictEqual(P.cycleOf({ cycleDays: 14 }), 14);
  assert.strictEqual(P.cycleOf({ cycleDays: 0 }), 1);
  assert.strictEqual(P.cycleOf({ cycleDays: 900 }), 60);
  assert.strictEqual(P.cycleOf({}), 14);
});

test("isValid rejects missing and malformed anchors", () => {
  assert.strictEqual(P.isValid(null), false);
  assert.strictEqual(P.isValid({}), false);
  assert.strictEqual(P.isValid({ anchor: "not-a-date" }), false);
  assert.strictEqual(P.isValid({ anchor: "2026-08-13" }), true);
});

test("periodIndexFor returns 0 on the anchor and inside period 0", () => {
  assert.strictEqual(P.periodIndexFor(PAY, "2026-08-13"), 0);
  assert.strictEqual(P.periodIndexFor(PAY, "2026-08-26"), 0);
});

test("periodIndexFor advances on the next payday", () => {
  assert.strictEqual(P.periodIndexFor(PAY, "2026-08-27"), 1);
});

test("periodIndexFor floors negatively before the anchor", () => {
  assert.strictEqual(P.periodIndexFor(PAY, "2026-08-12"), -1);
  assert.strictEqual(P.periodIndexFor(PAY, "2026-07-30"), -1);
  assert.strictEqual(P.periodIndexFor(PAY, "2026-07-29"), -2);
});

test("periodRange spans cycleDays inclusive", () => {
  const r = P.periodRange(PAY, 0);
  assert.strictEqual(r.startISO, "2026-08-13");
  assert.strictEqual(r.endISO, "2026-08-26");
  assert.strictEqual(r.days, 14);
});

test("currentPeriod resolves the period containing today", () => {
  assert.strictEqual(P.currentPeriod(PAY, "2026-09-01").index, 1);
  assert.strictEqual(P.currentPeriod(PAY, "2026-09-01").startISO, "2026-08-27");
});

console.log(`\n${passed} passing`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/payperiod.test.js`
Expected: FAIL — `Cannot find module '../payperiod.js'`

- [ ] **Step 3: Write minimal implementation**

Create `payperiod.js`:

```js
/* ============================================================
   Runway — pay-period math.
   Pure functions only: no DOM, no globals, no argument mutation.
   Loaded as window.PayPeriod in the browser, require()d in tests.
   ============================================================ */
(function (root) {
  "use strict";

  const MS_DAY = 86400000;
  const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

  /* Parse at local noon. Midnight would make daysBetween off by one
     across the two DST transitions each year, silently shifting
     period boundaries. */
  function parseISO(iso) {
    const [y, m, d] = String(iso).split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }

  function toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function addDays(iso, n) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  /* Math.round absorbs the ±1h DST wobble around the noon anchor. */
  function daysBetween(fromISO, toISOStr) {
    return Math.round((parseISO(toISOStr) - parseISO(fromISO)) / MS_DAY);
  }

  function isValid(pay) {
    if (!pay || typeof pay.anchor !== "string" || !ISO_RE.test(pay.anchor)) return false;
    return !Number.isNaN(parseISO(pay.anchor).getTime());
  }

  function cycleOf(pay) {
    const n = Math.round(Number(pay && pay.cycleDays));
    if (!Number.isFinite(n)) return 14;
    return Math.min(60, Math.max(1, n));
  }

  function periodIndexFor(pay, iso) {
    return Math.floor(daysBetween(pay.anchor, iso) / cycleOf(pay));
  }

  function periodRange(pay, index) {
    const days = cycleOf(pay);
    const startISO = addDays(pay.anchor, index * days);
    return { index, startISO, endISO: addDays(startISO, days - 1), days };
  }

  function currentPeriod(pay, todayISO) {
    return periodRange(pay, periodIndexFor(pay, todayISO));
  }

  const PayPeriod = {
    parseISO, toISO, addDays, daysBetween,
    isValid, cycleOf, periodIndexFor, periodRange, currentPeriod,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = PayPeriod;
  else root.PayPeriod = PayPeriod;
})(typeof globalThis !== "undefined" ? globalThis : this);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/payperiod.test.js`
Expected: PASS — `11 passing`, exit code 0

- [ ] **Step 5: Commit**

```bash
git add payperiod.js test/payperiod.test.js
git commit -m "feat: add pay-period date helpers and indexing"
```

---

### Task 2: Entry gathering, pot, and the rollover chain

**Files:**
- Modify: `payperiod.js` (append before the `PayPeriod` object literal)
- Test: `test/payperiod.test.js` (append before the final `console.log`)

**Interfaces:**
- Consumes: `periodRange`, `daysBetween`, `cycleOf` from Task 1.
- Produces: `PayPeriod.monthKeysFor(startISO, endISO) -> string[]`, `PayPeriod.entriesInRange(months, startISO, endISO) -> entry[]`, `PayPeriod.incomeIn(entries) -> number`, `PayPeriod.outflowIn(entries) -> number`, `PayPeriod.periodPot(pay, months, index, cache, todayISO) -> {index, income, rolloverIn, pot, usedExpected}`. `months` is the `state.months` object, shaped `{ "YYYY-MM": { rollover, entries: [{id,type,date,name,planned,actual}] } }`.

**Note — signature refinement vs. spec:** the spec lists `periodPot(pay, months, index, cache)`. A fifth `todayISO` argument is added here. Without it, browsing a future period chains rollover through periods that have no entries yet, so unspent *projected* money compounds and inflates the future pot. `todayISO` caps the chain at the current period.

- [ ] **Step 1: Write the failing test**

Append to `test/payperiod.test.js`, immediately before the final `console.log`:

```js
/* ---------- fixtures ---------- */
const E = (type, date, actual, planned) =>
  ({ id: type + date, type, date, name: type, planned: planned ?? actual, actual });

// $1500 paycheck on the anchor, $20 spent that same day.
const MONTHS_BASIC = {
  "2026-08": { rollover: 0, entries: [
    E("income", "2026-08-13", 1500),
    E("expense", "2026-08-13", 20),
  ] },
};

test("monthKeysFor returns one key inside a single month", () => {
  assert.deepStrictEqual(P.monthKeysFor("2026-08-13", "2026-08-26"), ["2026-08"]);
});

test("monthKeysFor spans a month boundary", () => {
  assert.deepStrictEqual(P.monthKeysFor("2026-08-28", "2026-09-10"), ["2026-08", "2026-09"]);
});

test("monthKeysFor spans a year boundary", () => {
  assert.deepStrictEqual(P.monthKeysFor("2026-12-28", "2027-01-10"), ["2026-12", "2027-01"]);
});

test("entriesInRange collects across both month buckets", () => {
  const months = {
    "2026-08": { entries: [E("expense", "2026-08-30", 10), E("expense", "2026-08-01", 99)] },
    "2026-09": { entries: [E("expense", "2026-09-02", 20)] },
  };
  const got = P.entriesInRange(months, "2026-08-28", "2026-09-10");
  assert.strictEqual(got.length, 2, "the Aug 1 entry is outside the range");
  assert.strictEqual(P.outflowIn(got), 30);
});

test("entriesInRange tolerates missing month buckets", () => {
  assert.deepStrictEqual(P.entriesInRange({}, "2026-08-13", "2026-08-26"), []);
  assert.deepStrictEqual(P.entriesInRange(null, "2026-08-13", "2026-08-26"), []);
});

test("incomeIn prefers actual, falls back to planned", () => {
  assert.strictEqual(P.incomeIn([E("income", "2026-08-13", 0, 500)]), 500);
  assert.strictEqual(P.incomeIn([E("income", "2026-08-13", 480, 500)]), 480);
});

test("outflowIn counts expense, bill, saving and debt but not income", () => {
  const entries = [
    E("income", "2026-08-13", 1000), E("expense", "2026-08-14", 10),
    E("bill", "2026-08-15", 100), E("saving", "2026-08-16", 50), E("debt", "2026-08-17", 25),
  ];
  assert.strictEqual(P.outflowIn(entries), 185);
});

test("periodPot uses logged income", () => {
  const pot = P.periodPot(PAY, MONTHS_BASIC, 0, {}, "2026-08-13");
  assert.strictEqual(pot.pot, 1500);
  assert.strictEqual(pot.rolloverIn, 0);
  assert.strictEqual(pot.usedExpected, false);
});

test("periodPot falls back to expected when no income is logged", () => {
  const pay = { anchor: "2026-08-13", cycleDays: 14, expected: 1500 };
  const pot = P.periodPot(pay, { "2026-08": { entries: [] } }, 0, {}, "2026-08-13");
  assert.strictEqual(pot.pot, 1500);
  assert.strictEqual(pot.usedExpected, true);
});

test("logged income wins over expected once present", () => {
  const pay = { anchor: "2026-08-13", cycleDays: 14, expected: 1500 };
  const pot = P.periodPot(pay, { "2026-08": { entries: [E("income", "2026-08-13", 1600)] } }, 0, {}, "2026-08-13");
  assert.strictEqual(pot.pot, 1600);
  assert.strictEqual(pot.usedExpected, false);
});

test("rollover chains across three consecutive periods", () => {
  // P0: 1000 in, 400 out -> 600 carries. P1: 1000 in + 600 = 1600, 100 out -> 1500 carries.
  const months = {
    "2026-08": { entries: [
      E("income", "2026-08-13", 1000), E("expense", "2026-08-14", 400),
      E("income", "2026-08-27", 1000), E("expense", "2026-08-28", 100),
    ] },
    "2026-09": { entries: [E("income", "2026-09-10", 1000)] },
  };
  const cache = {};
  assert.strictEqual(P.periodPot(PAY, months, 0, cache, "2026-09-20").pot, 1000);
  assert.strictEqual(P.periodPot(PAY, months, 1, cache, "2026-09-20").pot, 1600);
  const p2 = P.periodPot(PAY, months, 2, cache, "2026-09-20");
  assert.strictEqual(p2.rolloverIn, 1500);
  assert.strictEqual(p2.pot, 2500);
});

test("rollover chain terminates for a far-past anchor", () => {
  const pay = { anchor: "2019-01-02", cycleDays: 14, expected: 0 };
  const pot = P.periodPot(pay, MONTHS_BASIC, 200, {}, "2026-08-13");
  assert.ok(Number.isFinite(pot.pot), "pot must be finite, got " + pot.pot);
});

test("future periods do not compound unspent projected money", () => {
  const pay = { anchor: "2026-08-13", cycleDays: 14, expected: 1500 };
  // Today is in period 0. Period 3 is far in the future and has no entries.
  const future = P.periodPot(pay, MONTHS_BASIC, 3, {}, "2026-08-13");
  assert.strictEqual(future.pot, 1500 + 1480, "carries period 0's real leftover once, not repeatedly");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/payperiod.test.js`
Expected: FAIL — `TypeError: P.monthKeysFor is not a function`

- [ ] **Step 3: Write minimal implementation**

In `payperiod.js`, insert immediately after `currentPeriod` and before `const PayPeriod = {`:

```js
  const OUTFLOW = { expense: true, bill: true, saving: true, debt: true };
  const ROLLOVER_CAP = 60;

  function monthKeysFor(startISO, endISO) {
    const keys = [];
    const end = endISO.slice(0, 7);
    let y = Number(startISO.slice(0, 4));
    let m = Number(startISO.slice(5, 7));
    for (let guard = 0; guard < 24; guard++) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      keys.push(key);
      if (key === end) break;
      if (++m > 12) { m = 1; y += 1; }
    }
    return keys;
  }

  /* ISO date strings sort lexicographically, so string compares are
     safe here and avoid parsing every entry. */
  function entriesInRange(months, startISO, endISO) {
    const out = [];
    if (!months) return out;
    for (const key of monthKeysFor(startISO, endISO)) {
      const bucket = months[key];
      if (!bucket || !bucket.entries) continue;
      for (const e of bucket.entries) {
        if (e.date >= startISO && e.date <= endISO) out.push(e);
      }
    }
    return out;
  }

  function incomeIn(entries) {
    let sum = 0;
    for (const e of entries) {
      if (e.type !== "income") continue;
      sum += (e.actual || 0) !== 0 ? e.actual : (e.planned || 0);
    }
    return sum;
  }

  function outflowIn(entries) {
    let sum = 0;
    for (const e of entries) if (OUTFLOW[e.type]) sum += e.actual || 0;
    return sum;
  }

  function periodHasEntries(pay, months, index) {
    const r = periodRange(pay, index);
    return entriesInRange(months, r.startISO, r.endISO).length > 0;
  }

  /* Oldest period worth chaining from: the earliest entry-bearing
     period within ROLLOVER_CAP, else `index` itself. */
  function earliestDataIndex(pay, months, index) {
    let earliest = index;
    for (let back = 1; back <= ROLLOVER_CAP; back++) {
      if (periodHasEntries(pay, months, index - back)) earliest = index - back;
    }
    return earliest;
  }

  function periodPot(pay, months, index, cache, todayISO) {
    const store = cache || {};
    if (store[index]) return store[index];

    /* Chain only through periods that have actually happened. Past the
       current period there is no real spending to net off, so carrying
       a projected pot forward would compound it every cycle. */
    const currentIndex = todayISO ? periodIndexFor(pay, todayISO) : index;
    const stop = Math.min(index, currentIndex);
    const start = Math.min(earliestDataIndex(pay, months, stop), stop);
    const expected = Number(pay.expected) || 0;

    let rolloverIn = 0;
    for (let i = start; i <= stop; i++) {
      const r = periodRange(pay, i);
      const entries = entriesInRange(months, r.startISO, r.endISO);
      const logged = incomeIn(entries);
      const usedExpected = logged === 0 && expected > 0;
      const income = usedExpected ? expected : logged;
      const pot = rolloverIn + income;
      store[i] = { index: i, income, rolloverIn, pot, usedExpected };
      rolloverIn = pot - outflowIn(entries);
    }

    /* Future periods: one hop off the current period's real leftover,
       funded by the expected paycheck. */
    for (let i = stop + 1; i <= index; i++) {
      const carry = i === stop + 1 ? rolloverIn : 0;
      store[i] = {
        index: i, income: expected, rolloverIn: carry,
        pot: carry + expected, usedExpected: expected > 0,
      };
    }
    return store[index];
  }
```

Then extend the exported object:

```js
  const PayPeriod = {
    parseISO, toISO, addDays, daysBetween,
    isValid, cycleOf, periodIndexFor, periodRange, currentPeriod,
    monthKeysFor, entriesInRange, incomeIn, outflowIn, periodPot,
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/payperiod.test.js`
Expected: PASS — `24 passing`, exit code 0

- [ ] **Step 5: Commit**

```bash
git add payperiod.js test/payperiod.test.js
git commit -m "feat: add pay-period pot and rollover chain"
```

---

### Task 3: The daily series

**Files:**
- Modify: `payperiod.js`
- Test: `test/payperiod.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1–2.
- Produces: `PayPeriod.periodSeries(pay, months, index, todayISO)` returning `{series, todayIdx, today, days, pot, rolloverIn, income, usedExpected, spentSoFar, left, isCurrent, startISO, endISO, index, spread}`, where `series[i]` is `{d, dayISO, budget, spent}` with `d` 1-based.

`today`, `days`, `series[].d`, `series[].budget`, `series[].spent` and `isCurrent` deliberately mirror the shape of the existing `dailyBudgetSeries()` return so `drawDailyFlow()` and `renderDailyCard()` can consume either. `spread: true` marks the object as period-mode for the copy that differs.

- [ ] **Step 1: Write the failing test**

Append to `test/payperiod.test.js`, before the final `console.log`:

```js
test("spec scenario: day 1 is pot/14, day 2 is remaining/13", () => {
  const s = P.periodSeries(PAY, MONTHS_BASIC, 0, "2026-08-13");
  near(s.series[0].budget, 107.142857, "day 1");
  near(s.series[1].budget, 113.846154, "day 2");
});

test("spec scenario: days 2 through 14 are all equal", () => {
  const s = P.periodSeries(PAY, MONTHS_BASIC, 0, "2026-08-13");
  for (let i = 2; i < 14; i++) near(s.series[i].budget, s.series[1].budget, "day " + (i + 1));
});

test("zero spend leaves every day at pot/14", () => {
  const months = { "2026-08": { entries: [E("income", "2026-08-13", 1500)] } };
  const s = P.periodSeries(PAY, months, 0, "2026-08-13");
  for (let i = 0; i < 14; i++) near(s.series[i].budget, 107.142857, "day " + (i + 1));
});

test("overspending spreads the deficit", () => {
  const months = { "2026-08": { entries: [
    E("income", "2026-08-13", 1500), E("expense", "2026-08-13", 300),
  ] } };
  const s = P.periodSeries(PAY, months, 0, "2026-08-13");
  near(s.series[1].budget, 92.307692, "day 2 after a $300 day 1");
});

test("exhausting the pot yields non-positive budgets without NaN", () => {
  const months = { "2026-08": { entries: [
    E("income", "2026-08-13", 1500), E("expense", "2026-08-13", 2000),
  ] } };
  const s = P.periodSeries(PAY, months, 0, "2026-08-13");
  assert.ok(Number.isFinite(s.series[1].budget), "budget must be finite");
  assert.ok(s.series[1].budget < 0, "budget should be negative, got " + s.series[1].budget);
  assert.strictEqual(s.left, -500);
});

test("bills draw down the pot, unlike the month engine", () => {
  const months = { "2026-08": { entries: [
    E("income", "2026-08-13", 1500), E("bill", "2026-08-13", 400),
  ] } };
  const s = P.periodSeries(PAY, months, 0, "2026-08-13");
  near(s.series[1].budget, 84.615385, "day 2 after a $400 bill");
  assert.strictEqual(s.spentSoFar, 400);
});

test("todayIdx positions today inside the current period", () => {
  const s = P.periodSeries(PAY, MONTHS_BASIC, 0, "2026-08-16");
  assert.strictEqual(s.todayIdx, 3);
  assert.strictEqual(s.today, 4);
  assert.strictEqual(s.isCurrent, true);
});

test("a past period treats every day as actual", () => {
  const s = P.periodSeries(PAY, MONTHS_BASIC, 0, "2026-09-20");
  assert.strictEqual(s.todayIdx, 13);
  assert.strictEqual(s.isCurrent, false);
});

test("a future period projects every day", () => {
  const pay = { anchor: "2026-08-13", cycleDays: 14, expected: 1400 };
  const s = P.periodSeries(pay, MONTHS_BASIC, 2, "2026-08-13");
  assert.strictEqual(s.todayIdx, -1);
  assert.strictEqual(s.spentSoFar, 0);
  assert.strictEqual(s.isCurrent, false);
});

test("series rows carry their own ISO date across a month boundary", () => {
  const s = P.periodSeries(PAY, MONTHS_BASIC, 1, "2026-09-01");
  assert.strictEqual(s.series[0].dayISO, "2026-08-27");
  assert.strictEqual(s.series[13].dayISO, "2026-09-09");
  assert.strictEqual(s.series[0].d, 1);
});

test("left equals pot minus spend to date", () => {
  const s = P.periodSeries(PAY, MONTHS_BASIC, 0, "2026-08-13");
  assert.strictEqual(s.pot, 1500);
  assert.strictEqual(s.spentSoFar, 20);
  assert.strictEqual(s.left, 1480);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/payperiod.test.js`
Expected: FAIL — `TypeError: P.periodSeries is not a function`

- [ ] **Step 3: Write minimal implementation**

In `payperiod.js`, insert after `periodPot` and before `const PayPeriod = {`:

```js
  function periodSeries(pay, months, index, todayISO) {
    const r = periodRange(pay, index);
    const days = r.days;
    const entries = entriesInRange(months, r.startISO, r.endISO);
    const potInfo = periodPot(pay, months, index, {}, todayISO);

    const spent = new Array(days).fill(0);
    for (const e of entries) {
      if (!OUTFLOW[e.type]) continue;
      const i = daysBetween(r.startISO, e.date);
      if (i >= 0 && i < days) spent[i] += e.actual || 0;
    }

    const currentIndex = periodIndexFor(pay, todayISO);
    let todayIdx;
    if (index === currentIndex) todayIdx = daysBetween(r.startISO, todayISO);
    else if (index < currentIndex) todayIdx = days - 1;
    else todayIdx = -1;

    /* budget = remaining / daysLeft. On a day already lived, the real
       spend comes off; on a projected day the budget itself comes off,
       which leaves every later day at the same figure. */
    const series = [];
    let remaining = potInfo.pot;
    for (let i = 0; i < days; i++) {
      const budget = remaining / (days - i);
      series.push({ d: i + 1, dayISO: addDays(r.startISO, i), budget, spent: spent[i] });
      remaining -= i <= todayIdx ? spent[i] : budget;
    }

    let spentSoFar = 0;
    for (let i = 0; i <= todayIdx; i++) spentSoFar += spent[i];

    return {
      series, todayIdx, today: todayIdx + 1, days,
      pot: potInfo.pot, rolloverIn: potInfo.rolloverIn,
      income: potInfo.income, usedExpected: potInfo.usedExpected,
      spentSoFar, left: potInfo.pot - spentSoFar,
      isCurrent: index === currentIndex,
      startISO: r.startISO, endISO: r.endISO, index,
      spread: true,
    };
  }
```

Extend the export:

```js
    monthKeysFor, entriesInRange, incomeIn, outflowIn, periodPot, periodSeries,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/payperiod.test.js`
Expected: PASS — `35 passing`, exit code 0

- [ ] **Step 5: Commit**

```bash
git add payperiod.js test/payperiod.test.js
git commit -m "feat: add pay-period daily series"
```

---

### Task 4: Load the module and wire the dashboard hero

**Files:**
- Modify: `index.html:92`
- Modify: `app.js` (add helpers after `todayKey()` at line 361; replace hero block at lines 481–538)

**Interfaces:**
- Consumes: `PayPeriod.isValid`, `PayPeriod.periodIndexFor`, `PayPeriod.periodSeries`.
- Produces: `isoToday() -> string`, `payPeriodSim() -> object|null` (the Task 3 return shape, or `null` when period mode is off), `prettyShortISO(iso) -> string`.

- [ ] **Step 1: Add the script tag**

In `index.html`, replace line 92:

```html
  <script src="app.js"></script>
```

with:

```html
  <script src="payperiod.js"></script>
  <script src="app.js"></script>
```

- [ ] **Step 2: Add the adapter helpers**

In `app.js`, insert immediately after `todayKey()` (which ends at line 361) and before `prettyDate`:

```js
function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function prettyShortISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
/* Period mode is off until a valid state.pay exists; every caller
   treats null as "fall back to the month engine". */
function payPeriodSim() {
  if (typeof PayPeriod === "undefined" || !PayPeriod.isValid(state.pay)) return null;
  const today = isoToday();
  return PayPeriod.periodSeries(state.pay, state.months, PayPeriod.periodIndexFor(state.pay, today), today);
}
```

- [ ] **Step 3: Replace the hero and progress meter**

In `app.js`, in `renderDashboard()`, add this line immediately after `const todayBudget = sim.series[dayNow - 1]?.budget ?? 0;` (line 489):

```js
  const psim = payPeriodSim();
```

Then replace the whole block from `<div class="hero-left">` through the closing `</div>` of `.month-meter` (lines 518–538) with:

```html
        <div class="hero-left">
          <div class="eyebrow">Left to spend · ${psim
            ? `${prettyShortISO(psim.startISO)} – ${prettyShortISO(psim.endISO)}`
            : monthName(key)}</div>
          <div class="hero-num ${(psim ? psim.left : t.left) < 0 ? "neg" : ""}" id="hero-num">${fmtSigned(round2(psim ? psim.left : t.left))}</div>
          <div class="hero-caption">
            ${psim
              ? `${psim.rolloverIn ? `includes ${fmt(round2(psim.rolloverIn))} rolled over from last period · ` : ""}${psim.usedExpected ? `<span class="delta-bad">estimated — paycheck not logged yet</span>` : `${psim.days}-day pay cycle`}`
              : `${t.rollover ? `includes ${fmt(t.rollover)} rolled over · ` : ""}
                 <span class="${deltaVsPlan >= 0 ? "delta-good" : "delta-bad"}">
                   ${deltaVsPlan >= 0 ? "▲ " + fmt0(deltaVsPlan) + " ahead of plan" : "▼ " + fmt0(-deltaVsPlan) + " behind plan"}
                 </span>`}
          </div>
        </div>
        <div class="hero-days">
          ${psim
            ? `<strong>${fmt(Math.max(0, psim.series[Math.max(0, psim.todayIdx)].budget))}</strong>today's budget · ${psim.days - psim.todayIdx} day${psim.days - psim.todayIdx === 1 ? "" : "s"} to payday`
            : isCurrent
              ? `<strong>${fmt(Math.max(0, todayBudget))}</strong>today's budget · ${daysLeft} day${daysLeft === 1 ? "" : "s"} of runway`
              : `<strong>${fmt(round2(t.spentActual))}</strong>spent this month`}
        </div>
      </div>
      <div class="month-meter" title="${psim ? `Day ${psim.today} of ${psim.days}` : `Day ${dayNow} of ${days}`}">
        <div class="fill" data-w="${psim ? (psim.today / psim.days) * 100 : (dayNow / days) * 100}"></div>
        <div class="centerline"></div>
        <div class="plane" data-x="${psim ? (psim.today / psim.days) * 100 : (dayNow / days) * 100}">✈️</div>
      </div>
```

- [ ] **Step 4: Update the hero count-up**

In `app.js`, replace line 580:

```js
  countUp($("#hero-num"), round2(t.left));
```

with:

```js
  countUp($("#hero-num"), round2(psim ? psim.left : t.left));
```

- [ ] **Step 5: Label the month section**

In `app.js`, replace `<div class="kpi-row">${kpis}</div>` (line 554) with:

```html
      <div class="section-label">This month · ${monthName(key)}</div>
      <div class="kpi-row">${kpis}</div>
```

Append to `styles.css`:

```css
/* Separates the pay-period hero above from the month-scoped cards below. */
.section-label {
  font-size: 12px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin: 26px 0 -6px;
}
```

- [ ] **Step 6: Verify in the browser**

Open `index.html`. With no `state.pay` set, the dashboard must look exactly as before except for the new `THIS MONTH · <name>` label above the KPI row. Then in the console:

```js
state.pay = { anchor: new Date().toISOString().slice(0,10), cycleDays: 14, expected: 1500 };
render();
```

Expected: the hero eyebrow becomes a date range, the hero right reads `today's budget · 14 days to payday`, and the meter tooltip reads `Day 1 of 14`.

- [ ] **Step 7: Commit**

```bash
git add index.html app.js styles.css
git commit -m "feat: wire pay-period data into the dashboard hero"
```

---

### Task 5: Period-aware gauge card

**Files:**
- Modify: `app.js:591` (call site), `app.js:638-699` (`renderDailyCard`)

**Interfaces:**
- Consumes: `payPeriodSim()` from Task 4; the `spread`, `pot`, `days`, `todayIdx` fields from Task 3.
- Produces: no new exports.

- [ ] **Step 1: Pass the period sim to the card**

In `app.js`, replace lines 591–592:

```js
  renderDailyCard($("#daily-card"), sim, key);
  drawDailyFlow($("#daily-flow"), sim, key);
```

with:

```js
  renderDailyCard($("#daily-card"), psim || sim, key);
  drawDailyFlow($("#daily-flow"), psim || sim, key);
```

- [ ] **Step 2: Guard the empty state on the period pot**

In `renderDailyCard`, replace line 639–640:

```js
  const { series, today, isCurrent, spendable0, reserved, days } = sim;
  if (spendable0 <= 0) {
```

with:

```js
  const { series, today, isCurrent, spendable0, reserved, days, spread } = sim;
  const pot = spread ? sim.pot : spendable0;
  if (pot <= 0) {
```

- [ ] **Step 3: Swap the carry chip for the spread chip**

In `renderDailyCard`, inside the `if (isCurrent)` branch, replace the date line and the chip row (lines 666–681) with:

```js
    const dateStr = spread
      ? new Date(...series[today - 1].dayISO.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))))
          .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
      : new Date(yy, mm - 1, today).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    /* In spread mode nothing arrives from yesterday specifically — the
       surplus is shared by every earlier day — so the chip reports the
       per-day gain over the flat baseline instead. */
    const gain = spread ? budget - sim.pot / days : row.carryIn;
    const gainLabel = spread
      ? (gain > 0 ? "＋" + fmt(gain) + "/day from underspending" : "−" + fmt(-gain) + "/day from overspending")
      : (gain > 0 ? "＋" + fmt(gain) + " rolled in from yesterday 🎁" : "−" + fmt(-gain) + " owed from yesterday");
    card.innerHTML = `
      <div class="card-title">Today's budget</div>
      <div class="card-sub">${dateStr}</div>
      ${gauge(ratio, color,
        left >= 0 ? fmt(left) : "−" + fmt(-left),
        left >= 0 ? "left today" : "over today")}
      <div class="gauge-sub">spent <b>${fmt(spent)}</b> of <b>${fmt(Math.max(0, budget))}</b> today</div>
      <div class="chip-row">
        ${Math.abs(gain) >= 0.5 ? `<span class="stat-chip ${gain > 0 ? "pos" : "neg"}">${gainLabel}</span>` : ""}
        ${tomorrow ? `<span class="stat-chip" style="animation-delay:.12s">tomorrow ≈ ${fmt(Math.max(0, tomorrow.budget))} if you stop now</span>` : ""}
      </div>`;
```

- [ ] **Step 4: Fix the non-current branch**

In `renderDailyCard`, replace line 684 and 691 references to `spendable0` with `pot`:

```js
    const ratio = totalSpent / pot;
    const leftover = pot - totalSpent;
```

and

```js
      <div class="gauge-sub">spent <b>${fmt(round2(totalSpent))}</b> of <b>${fmt(round2(pot))}</b> spendable</div>
```

Also guard the reserved chip, which has no period equivalent — replace line 696:

```js
        ${reserved > 0 ? `<span class="stat-chip" style="animation-delay:.12s">${fmt0(reserved)} reserved for bills & goals</span>` : ""}
```

with:

```js
        ${!spread && reserved > 0 ? `<span class="stat-chip" style="animation-delay:.12s">${fmt0(reserved)} reserved for bills & goals</span>` : ""}
```

- [ ] **Step 5: Verify in the browser**

Open `index.html`, set `state.pay` as in Task 4 Step 6, add an expense of 20 dated today via **＋ Add entry**, then check the gauge card. Expected: gauge reads `$87.14 left today`, sub-line reads `spent $20.00 of $107.14 today`, and the chip reads `tomorrow ≈ $113.85 if you stop now`. Wait one simulated day by setting `state.pay.anchor` to yesterday's date and re-rendering; the spread chip should then read `＋$6.71/day from underspending`.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: make the gauge card pay-period aware"
```

---

### Task 6: Period-aware flow chart

**Files:**
- Modify: `app.js:605-635` (`dailyBudgetSeries` — add `dayISO`), `app.js:702-769` (`drawDailyFlow`), `app.js:544` (card sub copy)

**Interfaces:**
- Consumes: `series[].dayISO` and `spread` from Task 3.
- Produces: no new exports.

- [ ] **Step 1: Give the month engine rows a dayISO too**

So the chart has one date path rather than two, in `dailyBudgetSeries` replace line 630:

```js
    series.push({ d, budget, spent, carryIn: carry });
```

with:

```js
    const dayISO = `${key}-${String(d).padStart(2, "0")}`;
    series.push({ d, dayISO, budget, spent, carryIn: carry });
```

- [ ] **Step 2: Scale the x-axis ticks to the period length**

In `drawDailyFlow`, replace lines 724–725:

```js
  const xt = [1, 8, 15, 22, days].filter((v, i, a) => a.indexOf(v) === i)
```

with:

```js
  const tickDays = days <= 16 ? [1, 4, 8, 12, days] : [1, 8, 15, 22, days];
  const xt = tickDays.filter((v, i, a) => a.indexOf(v) === i && v <= days)
```

- [ ] **Step 3: Use dayISO in the tooltip and fix the carry copy**

In `drawDailyFlow`, replace lines 748–762 (from `const tip =` through the closing backtick of the tooltip template) with:

```js
  const tip = $("#flow-tip", wrap);
  const spread = !!sim.spread;
  $$("rect[data-day]", wrap).forEach((hr) => {
    hr.addEventListener("mousemove", () => {
      const d = Number(hr.dataset.day);
      const r = series[d - 1];
      const carryOut = r.budget - r.spent;
      const daysLeftAfter = days - d;
      tip.innerHTML = `<div class="tip-date">${prettyShortISO(r.dayISO)}</div>
        <div class="tip-row">budget ${fmt(Math.max(0, r.budget))}</div>
        ${d <= lastBar
          ? `<div class="tip-row">spent ${fmt(r.spent)}</div>
             <div class="tip-row" style="color:${carryOut >= 0 ? "var(--good-ink)" : "var(--critical)"}">
               ${spread
                 ? (daysLeftAfter > 0
                     ? (carryOut >= 0 ? "＋" : "−") + fmt(Math.abs(carryOut) / daysLeftAfter) + "/day across " + daysLeftAfter + " days left"
                     : (carryOut >= 0 ? "＋" + fmt(carryOut) + " left over" : "−" + fmt(-carryOut) + " overspent"))
                 : (carryOut >= 0 ? "＋" + fmt(carryOut) + " rolls forward" : "−" + fmt(-carryOut) + " borrowed from tomorrow")}</div>`
          : `<div class="tip-row">projected</div>`}`;
      tip.style.left = ((x(d) / W) * 100) + "%";
      tip.style.top = ((y(Math.max(r.budget, r.spent)) / H) * 100) + "%";
      tip.classList.add("show");
    });
    hr.addEventListener("mouseleave", () => tip.classList.remove("show"));
  });
}
```

This deletes the now-unused `const [yy, mm] = key.split("-").map(Number);` line — remove it.

- [ ] **Step 4: Update the chart's subtitle**

In `renderDashboard`, replace line 544:

```html
          <div class="card-sub">Underspend rolls into tomorrow · overspend borrows from it</div>
```

with:

```html
          <div class="card-sub">${psim ? "Underspend spreads evenly across the days left" : "Underspend rolls into tomorrow · overspend borrows from it"}</div>
```

- [ ] **Step 5: Verify in the browser**

Open `index.html` with `state.pay` set. Expected: the flow chart shows **14** bar slots, x-axis ticks read `1 4 8 12 14`, and hovering day 1 (after a $20 spend) shows `＋$6.71/day across 13 days left`. Unset `state.pay` (`delete state.pay; render()`) and confirm the chart returns to 28–31 slots with the original `rolls forward` copy.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: make the daily flow chart pay-period aware"
```

---

### Task 7: Pay schedule settings modal

**Files:**
- Modify: `index.html:57` (more-panel button)
- Modify: `app.js` (add `openPayModal()` after `openGoalModal()` at line 1292; wire the button near line 1442)
- Modify: `app.js` (empty-state prompt in `renderDashboard`)

**Interfaces:**
- Consumes: `PayPeriod.isValid`, `payPeriodSim()`, existing `save()`, `render()`, `toast()`.
- Produces: `openPayModal()`.

- [ ] **Step 1: Add the more-panel button**

In `index.html`, insert immediately after line 57 (`<button id="start-fresh" …>`… no — insert *before* it, so destructive actions stay last), i.e. after the `restore-input` line 56:

```html
              <button id="pay-schedule" class="ghost-btn" title="Set your paycheck cycle">🗓 Pay schedule</button>
```

- [ ] **Step 2: Write the modal**

In `app.js`, insert after `openGoalModal()` ends (line 1292):

```js
/* ---------- pay schedule ---------- */
function openPayModal() {
  const root = $("#modal-root");
  const pay = state.pay || {};
  root.innerHTML = `
    <div class="modal-backdrop" id="backdrop">
      <div class="modal">
        <h2>Pay schedule</h2>
        <div class="import-help">
          Your daily budget is your remaining money divided by the days left
          until your next paycheck. Underspend on any day and the surplus
          spreads evenly across every day that's left.
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Next payday</label>
            <input id="p-anchor" type="date" value="${esc(pay.anchor || "")}">
          </div>
          <div class="form-field">
            <label>Cycle</label>
            <select id="p-cycle">
              <option value="7"${pay.cycleDays === 7 ? " selected" : ""}>Every 7 days</option>
              <option value="14"${(pay.cycleDays ?? 14) === 14 ? " selected" : ""}>Every 14 days</option>
              <option value="28"${pay.cycleDays === 28 ? " selected" : ""}>Every 28 days</option>
            </select>
          </div>
          <div class="form-field full">
            <label>Expected paycheck ($) — optional</label>
            <input id="p-expected" type="number" min="0" step="0.01" placeholder="1500"
              value="${pay.expected ? esc(pay.expected) : ""}">
          </div>
        </div>
        <div class="modal-actions">
          ${state.pay ? `<button class="text-btn" id="m-off">Turn off</button>` : ""}
          <button class="text-btn" id="m-cancel">Cancel</button>
          <button class="primary-btn" id="m-save">Save schedule</button>
        </div>
      </div>
    </div>`;

  const close = () => (root.innerHTML = "");
  $("#m-cancel").addEventListener("click", close);
  $("#backdrop").addEventListener("click", (e) => { if (e.target.id === "backdrop") close(); });

  if (state.pay) {
    $("#m-off").addEventListener("click", () => {
      delete state.pay;
      save(); close(); render(); toast("Pay schedule off — back to monthly budgeting");
    });
  }

  $("#m-save").addEventListener("click", () => {
    const anchor = $("#p-anchor").value;
    const cycleDays = Number($("#p-cycle").value);
    if (!PayPeriod.isValid({ anchor })) { toast("Pick your next payday first"); return; }
    if (!(cycleDays >= 1 && cycleDays <= 60)) { toast("Cycle must be between 1 and 60 days"); return; }
    state.pay = { anchor, cycleDays, expected: parseFloat($("#p-expected").value) || 0 };
    save(); close(); render(); toast(`Pay schedule set — every ${cycleDays} days`);
  });

  setTimeout(() => $("#p-anchor").focus(), 60);
}
```

- [ ] **Step 3: Wire the button**

In `app.js`, after line 1442 (`$("#import-entries")…`), add:

```js
$("#pay-schedule").addEventListener("click", openPayModal);
```

- [ ] **Step 4: Add the first-run prompt**

In `renderDashboard`, replace the `.month-meter` block added in Task 4 by appending this directly after its closing `</div>`:

```html
      ${psim ? "" : `<button class="pay-prompt" id="pay-prompt">🗓 Paid biweekly? Set your pay schedule to get a daily budget that matches your paycheck.</button>`}
```

Then, in the `requestAnimationFrame` block at the end of `renderDashboard` (after line 588), add:

```js
  const prompt = $("#pay-prompt", view);
  if (prompt) prompt.addEventListener("click", openPayModal);
```

Append to `styles.css`:

```css
.pay-prompt {
  display: block;
  width: 100%;
  margin: 14px 0 0;
  padding: 12px 16px;
  font: inherit;
  font-size: 13.5px;
  text-align: left;
  color: var(--ink-2);
  background: var(--card);
  border: 1px dashed var(--grid);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color .18s, color .18s;
}
.pay-prompt:hover { border-color: var(--accent); color: var(--ink); }
```

- [ ] **Step 5: Verify end to end**

Run: `node test/payperiod.test.js` — expected PASS, `35 passing`.

Then open `index.html` in a fresh profile (or run `delete state.pay; save(); render()` in the console):
1. The dashboard shows the dashed **Set your pay schedule** prompt; everything else is the month view.
2. Click it, set next payday to today, cycle 14, expected 1500, save.
3. Add an income entry of 1500 dated today and an expense of 20 dated today.
4. Hero reads `$1,480.00`, eyebrow shows the 14-day range, right side reads `$107.14 today's budget · 14 days to payday`.
5. Gauge reads `$87.14 left today`; the tomorrow chip reads `≈ $113.85`.
6. Reload the page — the schedule persists.
7. Open the modal, click **Turn off** — the dashboard returns to the month view unchanged.

- [ ] **Step 6: Commit**

```bash
git add index.html app.js styles.css
git commit -m "feat: add the pay schedule settings modal"
```

---

## Self-Review

**Spec coverage.** Every section maps to a task: §1 module boundary → Task 1 (wrapper + purity); §2 state and the absent-`state.pay` fallback → Task 4 Step 2 and Task 7; §3 the math, spend categories, rollover chain, and DST → Tasks 1–3; §4 all nine dashboard rows → Tasks 4–6; §5 settings → Task 7; §6 error handling → `isValid`/`cycleOf` clamps (Task 1), `pot <= 0` empty state (Task 5 Step 2), negative index (Task 1 test), rollover cap (Task 2); §7 all twelve test cases → Tasks 1–3.

**Deviations from the spec, both deliberate:**
1. `periodPot` takes a fifth `todayISO` argument, so projected future periods can't compound an unspent pot. Flagged in Task 2.
2. `dailyBudgetSeries` gains a `dayISO` field on its rows. Not in the spec, but it lets `drawDailyFlow` keep one date path instead of branching, and it changes no behaviour.

**Type consistency.** `pot` is the single name for period money across Tasks 2, 3, and 5 (`spendable0` remains the month engine's name and is aliased at the one place both meet). `todayIdx` is 0-based everywhere; `today` is 1-based everywhere and exists only for shape-compatibility with the month engine. `series[].d` is 1-based in both engines. `spread` is the only period-mode flag.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-13-paycheck-daily-budget.md`. Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, reviewed between tasks, fast iteration.

**2. Inline Execution** — tasks run in this session using executing-plans, batched with checkpoints.
