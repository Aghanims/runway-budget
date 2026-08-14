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

test("isValid rejects calendar-impossible dates", () => {
  assert.strictEqual(P.isValid({ anchor: "2026-02-30" }), false);
  assert.strictEqual(P.isValid({ anchor: "9999-99-99" }), false);
  assert.strictEqual(P.isValid({ anchor: "2026-02-28" }), true);
  assert.strictEqual(P.isValid({ anchor: "2024-02-29" }), true, "2024 is a leap year");
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

test("the next period carries the current period's real leftover once", () => {
  const pay = { anchor: "2026-08-13", cycleDays: 14, expected: 1500 };
  // Today is in period 0: $1500 in, $20 out, so $1480 carries into period 1.
  const next = P.periodPot(pay, MONTHS_BASIC, 1, {}, "2026-08-13");
  assert.strictEqual(next.rolloverIn, 1480);
  assert.strictEqual(next.pot, 1480 + 1500);
});

test("later future periods do not compound unspent projected money", () => {
  const pay = { anchor: "2026-08-13", cycleDays: 14, expected: 1500 };
  // Period 3 is beyond the one-hop carry, so it is funded by the expected
  // paycheck alone rather than by three cycles of imaginary surplus.
  const far = P.periodPot(pay, MONTHS_BASIC, 3, {}, "2026-08-13");
  assert.strictEqual(far.rolloverIn, 0);
  assert.strictEqual(far.pot, 1500);
});

test("periodPot cache invalidates when todayISO changes", () => {
  const pay = { anchor: "2026-08-13", cycleDays: 14, expected: 1500 };
  const cache = {};
  // Today sits in period 0: period 3 is far future, funded by expected alone.
  const stale = P.periodPot(pay, MONTHS_BASIC, 3, cache, "2026-08-13");
  assert.strictEqual(stale.pot, 1500);

  // Real income lands in periods 1 and 2, and today advances into period 2.
  const monthsWithHistory = {
    "2026-08": { entries: [...MONTHS_BASIC["2026-08"].entries, E("income", "2026-08-27", 1000)] },
    "2026-09": { entries: [E("income", "2026-09-10", 1000)] },
  };
  const reused = P.periodPot(pay, monthsWithHistory, 3, cache, "2026-09-20");
  const fresh = P.periodPot(pay, monthsWithHistory, 3, {}, "2026-09-20");
  assert.strictEqual(fresh.pot, 4980, "sanity check on the fresh-cache computation");
  assert.strictEqual(reused.pot, fresh.pot, "a reused cache must not serve a stale projection");
});

test("periodPot treats a logged $0 income entry as real, not missing", () => {
  const pay = { anchor: "2026-08-13", cycleDays: 14, expected: 1500 };
  const months = { "2026-08": { entries: [E("income", "2026-08-13", 0, 0)] } };
  const pot = P.periodPot(pay, months, 0, {}, "2026-08-13");
  assert.strictEqual(pot.pot, 0, "a logged $0 paycheck must not fall back to expected");
  assert.strictEqual(pot.usedExpected, false);
});

test("idle historical periods do not mint phantom paychecks", () => {
  const pay = { anchor: "2026-08-14", cycleDays: 14, expected: 1500 };
  const months = {
    "2026-05": { entries: [
      E("income", "2026-05-08", 1500), E("expense", "2026-05-09", 60),
    ] },
    "2026-08": { entries: [
      E("income", "2026-08-14", 1500), E("expense", "2026-08-15", 60),
    ] },
  };
  const s = P.periodSeries(pay, months, P.periodIndexFor(pay, "2026-08-15"), "2026-08-15");
  assert.strictEqual(s.rolloverIn, 1440, "only May's real leftover carries");
  assert.strictEqual(s.pot, 2940, "1440 carried + 1500 actually logged");
});

test("the expected fallback still funds the current period before payday", () => {
  const pay = { anchor: "2026-08-14", cycleDays: 14, expected: 1500 };
  const months = { "2026-08": { entries: [] } };
  const s = P.periodSeries(pay, months, P.periodIndexFor(pay, "2026-08-15"), "2026-08-15");
  assert.strictEqual(s.pot, 1500);
  assert.strictEqual(s.usedExpected, true);
});

test("spec scenario: day 1 is pot/14, day 2 is remaining/13", () => {
  const s = P.periodSeries(PAY, MONTHS_BASIC, 0, "2026-08-13");
  near(s.series[0].budget, 107.142857, "day 1");
  near(s.series[1].budget, 113.846154, "day 2");
});

test("spec scenario: days 2 through 14 are all equal", () => {
  const s = P.periodSeries(PAY, MONTHS_BASIC, 0, "2026-08-13");
  for (let i = 2; i < 14; i++) near(s.series[i].budget, s.series[1].budget, "day " + (i + 1));
});

test("with nothing spent today, tomorrow absorbs today's whole allowance", () => {
  const months = { "2026-08": { entries: [E("income", "2026-08-13", 1500)] } };
  const s = P.periodSeries(PAY, months, 0, "2026-08-13");
  near(s.series[0].budget, 107.142857, "day 1 is the flat share");
  near(s.series[1].budget, 115.384615, "day 2 absorbs the unspent day 1");
  for (let i = 2; i < 14; i++) near(s.series[i].budget, 115.384615, "day " + (i + 1));
  assert.strictEqual(s.todayIdx, 0, "today is day 1, not -1");
  assert.strictEqual(s.today, 1);
});

test("a period with no spending still reports a usable today index", () => {
  const months = { "2026-08": { entries: [E("income", "2026-08-13", 1500)] } };
  const s = P.periodSeries(PAY, months, 0, "2026-08-16");
  assert.ok(s.today >= 1, "today must be 1-based and >= 1, got " + s.today);
  assert.ok(s.series[s.today - 1], "series[today - 1] must exist for the gauge card");
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

test("an early-posting paycheck suppresses the expected fallback", () => {
  const pay = { anchor: "2026-08-14", cycleDays: 14, expected: 1500 };
  const months = { "2026-07": { entries: [] }, "2026-08": { entries: [
    E("income", "2026-07-31", 1500), E("income", "2026-08-13", 1500), E("expense", "2026-08-15", 60),
  ] } };
  const s = P.periodSeries(pay, months, P.periodIndexFor(pay, "2026-08-15"), "2026-08-15");
  assert.strictEqual(s.usedExpected, false, "the check arrived, just a day early");
  assert.strictEqual(s.income, 0, "no estimate is added on top");
  assert.strictEqual(s.pot, 3000, "pot is what the period starts with, before spending");
  assert.strictEqual(s.left, 2940, "3000 received minus 60 spent");
});

test("pot always equals rolloverIn + income", () => {
  const pay = { anchor: "2026-08-14", cycleDays: 14, expected: 1500 };
  const cases = [
    { "2026-07": { entries: [] }, "2026-08": { entries: [
      E("income", "2026-07-31", 1500), E("income", "2026-08-13", 1500), E("expense", "2026-08-15", 60)] } },
    { "2026-08": { entries: [E("income", "2026-08-14", 1200), E("bill", "2026-08-16", 400)] } },
    { "2026-08": { entries: [] } },
  ];
  for (const months of cases) {
    const s = P.periodSeries(pay, months, P.periodIndexFor(pay, "2026-08-15"), "2026-08-15");
    assert.strictEqual(s.pot, s.rolloverIn + s.income, "pot must not net spending");
    assert.strictEqual(s.left, s.pot - s.spentSoFar, "left is pot minus spend to date");
  }
});

test("an on-time previous paycheck still leaves this period's estimate intact", () => {
  const pay = { anchor: "2026-08-14", cycleDays: 14, expected: 1500 };
  // Previous period's income lands on ITS start date (2026-07-31), far from
  // the current period's 2026-08-14 boundary, so it must not suppress.
  const months = { "2026-07": { entries: [] }, "2026-08": { entries: [
    E("income", "2026-07-31", 1500), E("expense", "2026-08-02", 100),
  ] } };
  const s = P.periodSeries(pay, months, P.periodIndexFor(pay, "2026-08-15"), "2026-08-15");
  assert.strictEqual(s.usedExpected, true, "no check has arrived for this period yet");
  assert.strictEqual(s.pot, 1400 + 1500, "prior leftover plus the estimate");
});

test("left equals pot minus spend to date", () => {
  const s = P.periodSeries(PAY, MONTHS_BASIC, 0, "2026-08-13");
  assert.strictEqual(s.pot, 1500);
  assert.strictEqual(s.spentSoFar, 20);
  assert.strictEqual(s.left, 1480);
});

console.log(`\n${passed} passing`);
