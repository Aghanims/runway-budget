# Pay-period daily budget

## Context

Runway (`C:\Code_Files\runway-budget`) is a static HTML/CSS/JS budget planner — no build step, no framework, no test tooling. State lives in `localStorage` under `runway-budget-v1`, with optional Supabase sync and JSON backup/restore.

The app's daily budget engine is currently anchored to the **calendar month** and uses a **carry-forward** rollover rule. Both are wrong for a user paid biweekly.

### Problem 1: rollover dumps onto tomorrow instead of spreading

[`dailyBudgetSeries()`](../../../app.js#L605) computes:

```js
const base = (remaining - carry) / daysLeft;
const budget = base + carry;
```

`carry` is yesterday's entire unspent surplus, added whole onto the next single day. With $1500 over 14 days, spending $20 on day 1 produces:

| | current engine | desired |
|---|---|---|
| Day 1 | $107.14 | $107.14 |
| Day 2 | **$194.28** | **$113.85** |
| Day 3 (if day 2 untouched) | **$301.42** | **$123.33** |

The surplus snowballs onto whichever day follows an underspend, rather than being shared across the days that remain.

### Problem 2: the period is the calendar month

`daysInMonth(key)` drives `daysLeft`, so a mid-month paycheck is divided across whatever days happen to remain in the month. The user is paid every 14 days; the two cycles do not line up and drift apart continuously.

### The desired rule is one line

The user's stated formula — take today's leftover, divide it by the remaining days, add it to the base — is algebraically identical to *remaining money ÷ remaining days*:

```
107.14 + (87.14 / 13) = 113.85 = 1480 / 13
```

So the entire feature reduces to `budget = remaining / daysLeft`, evaluated over a pay period rather than a month.

## Decisions made during design

| Question | Decision |
|---|---|
| How far does the pay period reach? | **Period drives the daily budget; the month stays** for KPIs, bills, goals, transactions, and the secondary charts. |
| How does the app learn the pay schedule? | **Set once** — an anchor payday plus a cycle length, auto-advancing forever. |
| Are bills/savings/debt reserved off the top? | **No.** The whole paycheck is divided; bills draw the pot down like any other spending. |
| Where does the period's pot come from? | **Logged transactions + rollover**, with an editable *expected paycheck* used as a fallback until the real income entry is logged. |

## Non-goals

- No change to Bills, Goals, or Transactions views — all remain month-scoped.
- No change to the existing per-month `rollover` field or `monthTotals()`. The period engine computes its own rollover chain independently; the two do not interact.
- No cycle types beyond a fixed day count. "1st and 15th" semi-monthly schedules cannot be expressed as a fixed day count and are explicitly out of scope.
- No backend/Supabase schema changes — `state.pay` rides along in the existing single-row JSON blob.
- No build tooling and no test framework dependency.

## 1. Module boundary

New file `payperiod.js`, loaded from [`index.html`](../../../index.html) **before** `app.js`.

It contains pure functions only: no DOM access, no reads of the global `state`, no mutation. Every input arrives as an argument and every result is returned. This is the only structure in which the money math is testable, and the money math is the part that must be correct.

Dual-target wrapper so the same file runs in the browser and under Node with no build step:

```js
(function (root) {
  const PayPeriod = { /* ... */ };
  if (typeof module !== "undefined") module.exports = PayPeriod;
  else root.PayPeriod = PayPeriod;
})(this);
```

### Exported surface

| Function | Returns |
|---|---|
| `periodIndexFor(pay, isoDate)` | integer index of the period containing `isoDate`, negative for dates before the anchor |
| `periodRange(pay, index)` | `{ index, startISO, endISO, days }` |
| `currentPeriod(pay, todayISO)` | `periodRange` for the period containing today |
| `entriesInRange(months, startISO, endISO)` | flat array of entries across the 1–2 month keys the range touches |
| `periodPot(pay, months, index, cache)` | `{ income, rolloverIn, pot, usedExpected }` |
| `periodSeries(pay, months, index, todayISO)` | `{ series, todayIdx, days, pot, spentSoFar, left, isCurrent }` |

`series[i]` is `{ dayISO, budget, spent }`.

`todayIdx` positions "now" inside the requested period and is defined for all three cases:

| Period requested | `todayIdx` | Effect on the loop |
|---|---|---|
| Contains today | `0 .. days-1` | Days up to today use actuals; later days are projected |
| Entirely in the past | `days - 1` | Every day uses actuals |
| Entirely in the future | `-1` | Every day is projected; `spent` is ignored |

## 2. State

One new top-level key, added alongside `activeMonth` / `months` / `theme`:

```js
state.pay = {
  anchor: "2026-08-14",  // any known payday, ISO — not necessarily the next one
  cycleDays: 14,
  expected: 1500         // 0 or null = no fallback
}
```

**`state.pay` absent → every period feature is off and the app renders exactly as it does today.** This is the entire migration story:

- Old backups load unchanged — [`importBackup()`](../../../app.js#L159) validates only `parsed.months`, and an absent `pay` key reads as "off".
- Cloud sync carries the new key for free; [`pushCloud()`](../../../app.js#L241) serialises whole `state`.
- No data conversion, no version bump, no migration code.

While `state.pay` is unset, the dashboard shows a "Set your pay schedule" prompt in place of the period hero.

`anchor` is *any* payday rather than specifically the next one — that is what allows the schedule to roll forward indefinitely and to describe past periods:

```js
periodIndexFor = Math.floor(daysBetween(anchor, date) / cycleDays)
```

`Math.floor` gives the correct result for negative values (`Math.floor(-1.2) === -2`), so periods before the anchor resolve correctly.

## 3. The math

```js
let remaining = pot;
for (let i = 0; i < cycleDays; i++) {
  const daysLeft = cycleDays - i;
  budget[i] = remaining / daysLeft;
  remaining -= (i <= todayIdx) ? spent[i] : budget[i];
}
```

where

```
pot = rolloverIn + income
income = sum of income entries dated in the period
         (entry.actual when non-zero, else entry.planned)
       || pay.expected        // fallback when nothing is logged yet
```

### Worked example — $1500, 14 days, $20 spent on day 1

| | daysLeft | budget | spent | remaining after |
|---|---|---|---|---|
| Day 1 | 14 | **$107.14** | $20.00 | $1480.00 |
| Day 2 | 13 | **$113.85** | — | — |
| Day 3 | 12 | **$113.85** | — | — |
| … | … | **$113.85** | — | — |
| Day 14 | 1 | **$113.85** | — | — |

Days 2–14 are all equal, as required. This falls out of the formula without a special case: on an untouched future day, subtracting `budget[i]` from `remaining` leaves `remaining / daysLeft` unchanged for the following day.

### Overspending

No special case. $300 spent on day 1 leaves $1200 over 13 days → day 2 reads **$92.31**. The deficit is spread on exactly the same terms as a surplus.

If `remaining` goes negative, `budget` goes negative. The math stays signed; display clamps with `Math.max(0, budget)` as the current gauge already does at [app.js:673](../../../app.js#L673).

### What counts as spending

Because the whole paycheck is divided rather than net-of-bills, `spent[i]` sums **expense, bill, saving, and debt** actuals. This differs from the current engine, which counts expenses only ([app.js:615](../../../app.js#L615)).

**Known consequence:** on the day a large bill clears, that day shows a large overspend and every remaining day's budget steps down. This is arithmetically correct and was chosen deliberately, but it makes the daily figure swing around bill dates.

### Cross-period rollover

`rolloverIn(index) = pot(index - 1) − totalSpent(index - 1)`, which is recursive. It is resolved by walking **forward** from the earliest period containing any entry, memoised into a cache object passed by the caller and rebuilt per render.

Guards:
- Walk capped at 60 periods; beyond that `rolloverIn` is 0. Prevents a far-past anchor date from hanging the page.
- `rolloverIn` for the earliest data-bearing period is 0.

This chain is entirely separate from `state.months[key].rollover`, which continues to serve `monthTotals()` and the month views unchanged. The two never combine, so no double-counting is possible.

### Date handling

ISO date strings are parsed to local `Date` at **noon** (`new Date(y, m-1, d, 12)`) before any day arithmetic. Parsing at midnight makes `daysBetween` off by one across DST transitions, which would silently shift period boundaries twice a year.

## 4. Dashboard changes

All within [`renderDashboard()`](../../../app.js#L481) and [`renderDailyCard()`](../../../app.js#L638).

| Element | Now | After |
|---|---|---|
| Hero eyebrow | `Left to spend · August 2026` | `Left to spend · Aug 14 – Aug 27` |
| Hero number | month `left` | period `left` = `pot − spentSoFar` |
| Hero caption | `▲ $X ahead of plan` | date range + `includes $X rolled over from last period` |
| Hero right | `N days of runway` (month) | `$107.14 today's budget · N days to payday` |
| Hero estimate marker | — | `estimated — paycheck not logged yet` when `usedExpected` |
| Progress meter | `Day 19 of 31` | `Day 3 of 14` |
| Gauge card | month-scoped series | period-scoped series |
| Gauge chip | `+$87 rolled in from yesterday 🎁` | `+$6.71/day from underspending` |
| Flow chart | 31 bars, *"Underspend rolls into tomorrow"* | 14 bars, *"Underspend spreads evenly across the days left"* |
| KPI row, pace chart, top days, allocation | month | **unchanged**, under a new `This month` section header |
| Bills, Goals, Transactions | month | **unchanged** |

*Days to payday* is `days − todayIdx`, i.e. the same `daysLeft` the loop uses for today — inclusive of today. On day 1 of 14 it reads `14 days to payday`; on the final day it reads `1 day to payday`, meaning the next paycheck lands tomorrow. The progress meter's `Day 3 of 14` uses `todayIdx + 1` and stays consistent with it.

The `rolled in from yesterday` chip is deleted rather than reworded: under the new rule nothing arrives from yesterday specifically. Its replacement is `budget[todayIdx] − pot / cycleDays` — the amount per day that accumulated underspending has bought, shown only when it exceeds $0.50 in absolute value (matching the existing chip threshold at [app.js:675](../../../app.js#L675)).

The `ahead of plan` delta is dropped from the hero rather than ported. It compares actual against planned across a month; there is no meaningful period equivalent, and the date range plus rollover note is more useful in that slot.

### Known cost of this layout

The hero displays a **pay-period** figure while the KPI row directly beneath displays **month** figures — two dollar amounts, differently scoped, in close proximity. Mitigated by the date range in the hero eyebrow and an explicit `This month` header above the KPI row. This is the accepted trade-off of keeping the month; if it proves confusing in use, the remedy is widening to full period mode, which the `payperiod.js` boundary is designed to permit.

## 5. Pay schedule settings

A modal reached from the existing more-panel, following the structure of [`openGoalModal()`](../../../app.js#L1227):

| Field | Control | Writes |
|---|---|---|
| Next payday | date input | `pay.anchor` |
| Cycle | select: 7 / 14 / 28 days (default 14) | `pay.cycleDays` |
| Expected paycheck | amount input, blank allowed | `pay.expected` |

The field is labelled *Next payday* because that is the date a user can state without thinking, but it is stored as a plain anchor — any date on the pay cycle produces identical periods, so the label is a convenience rather than a constraint. When payday shifts (a holiday, a job change), the user re-enters the new date and all subsequent periods realign from it.

Saving calls the existing `save()` and `queueCloudPush()`.

## 6. Error handling

| Condition | Behaviour |
|---|---|
| `state.pay` absent or `anchor` missing/unparseable | Period mode off; dashboard renders as today, with the "Set your pay schedule" prompt |
| `cycleDays` outside 1–60 | Rejected in the modal with an inline message; clamped defensively in `payperiod.js` |
| `pot <= 0` | Existing empty state — *"Add income (or a rollover) to unlock your daily budget"* ([app.js:640](../../../app.js#L640)) |
| Date before anchor | Handled by `Math.floor` on a negative quotient |
| Rollover chain exceeds 60 periods | Truncated; `rolloverIn` treated as 0 at the cap |

## 7. Testing

`test/payperiod.test.js`, run with `node test/payperiod.test.js`. Node's built-in `assert`, no dependencies, no `package.json`, no test framework. Exits non-zero on failure.

| Case | Assertion |
|---|---|
| Spec scenario | $1500 / 14 days, $20 on day 1 → day 1 = $107.14, day 2 = $113.85 |
| Flat tail | Days 2–14 in that scenario are all equal |
| Zero spend | Every day = $107.14 |
| Overspend | $300 on day 1 → day 2 = $92.31; no throw, no NaN |
| Pot exhausted | Spending the full pot early yields non-positive later budgets without NaN |
| Month boundary | A period spanning Aug 28 – Sep 10 collects entries from both `months` keys |
| Negative index | `periodIndexFor` for a date one cycle before the anchor returns −1 |
| Rollover chain | Three consecutive periods; period 3's `rolloverIn` reflects both prior leftovers |
| Rollover cap | An anchor 200 periods in the past terminates and returns 0 |
| Expected fallback | No logged income → pot uses `pay.expected`; once logged, the entry wins |
| Spend categories | A bill entry reduces `remaining` (unlike the current expense-only engine) |
| DST | Day counts across the March and November transitions are exact |
