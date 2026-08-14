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
    const d = parseISO(pay.anchor);
    if (Number.isNaN(d.getTime())) return false;
    /* parseISO silently rolls over out-of-range values (e.g. Feb 30 -> Mar 2),
       so a round-trip through toISO is the only way to catch a calendar-
       impossible date. */
    return toISO(d) === pay.anchor;
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

    /* Cache contract: store[i] memoizes period i's pot, but that pot depends
       on todayISO (it decides which periods are real history vs. projected
       future). Stamp the resolving todayISO under a non-numeric key and wipe
       any memoized entries when a caller passes a different one, so a cache
       object reused across two todayISO values can't hand back a projection
       that has since become real, spent-against history. */
    if (store.__todayISO !== todayISO) {
      for (const key of Object.keys(store)) delete store[key];
      store.__todayISO = todayISO;
    }
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
      const hasIncomeEntry = entries.some((e) => e.type === "income");
      /* The expected fallback exists solely so the current period doesn't
         read $0 while the user waits for a paycheck to land. Applying it to
         every idle historical period would mint a phantom paycheck for each
         one, so it's scoped to i === stop (the period containing todayISO). */
      let usedExpected = i === stop && !hasIncomeEntry && expected > 0;
      /* Paydays drift around weekends and holidays: a check that posts one
         day early lands in the previous period instead of this one. If it
         did, the fallback would mint a phantom paycheck on top of money
         that already arrived. Only a paycheck dated in the 3 days right
         before this period's start counts as "early" — an on-time paycheck
         from a normal previous period must not suppress this estimate. */
      let earlyPaycheck = false;
      if (usedExpected) {
        const prevRange = periodRange(pay, i - 1);
        const prevEntries = entriesInRange(months, prevRange.startISO, prevRange.endISO);
        const lookback = addDays(r.startISO, -3);
        earlyPaycheck = prevEntries.some((e) => e.type === "income" && e.date >= lookback);
        if (earlyPaycheck) usedExpected = false;
      }
      const income = usedExpected ? expected : logged;
      const outflow = outflowIn(entries);
      /* When the paycheck arrived early, this period has no income event of
         its own — it behaves like the pass-through periods in the chain, so
         its own outflow is netted immediately into `pot` rather than left
         for the caller to subtract later. `rawPot` keeps the un-netted total
         (rolloverIn + income) alongside it: periodSeries still needs that
         true total to compute `left` and the daily series, since its own
         spend-to-date walk (via entriesInRange) will independently subtract
         this same outflow — netting it into `pot` too would double-count it. */
      const rawPot = rolloverIn + income;
      const pot = earlyPaycheck ? rawPot - outflow : rawPot;
      store[i] = { index: i, income, rolloverIn, pot, rawPot, usedExpected };
      rolloverIn = earlyPaycheck ? pot : pot - outflow;
    }

    /* Future periods: one hop off the current period's real leftover,
       funded by the expected paycheck. */
    for (let i = stop + 1; i <= index; i++) {
      const carry = i === stop + 1 ? rolloverIn : 0;
      store[i] = {
        index: i, income: expected, rolloverIn: carry, rawPot: carry + expected,
        pot: carry + expected, usedExpected: expected > 0,
      };
    }
    return store[index];
  }

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
    if (index === currentIndex) {
      todayIdx = daysBetween(r.startISO, todayISO);
    } else if (index < currentIndex) {
      todayIdx = days - 1;
    } else {
      todayIdx = -1;
    }

    /* budget = remaining / daysLeft. On a day already lived, the real
       spend comes off; on a projected day the budget itself comes off,
       which leaves every later day at the same figure. */
    /* Walk off rawPot (the un-netted rolloverIn + income), not the exposed
       `pot`: when an early paycheck has already netted this period's
       outflow into `pot` (see periodPot), this same-period spend is about
       to be subtracted again below via `spent[]`/spentSoFar — walking off
       rawPot keeps that a single subtraction instead of two. */
    const series = [];
    let remaining = potInfo.rawPot;
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
      spentSoFar, left: potInfo.rawPot - spentSoFar,
      isCurrent: index === currentIndex,
      startISO: r.startISO, endISO: r.endISO, index,
      spread: true,
    };
  }

  const PayPeriod = {
    parseISO, toISO, addDays, daysBetween,
    isValid, cycleOf, periodIndexFor, periodRange, currentPeriod,
    monthKeysFor, entriesInRange, incomeIn, outflowIn, periodPot, periodSeries,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = PayPeriod;
  else root.PayPeriod = PayPeriod;
})(typeof globalThis !== "undefined" ? globalThis : this);
