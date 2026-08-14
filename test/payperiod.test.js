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
