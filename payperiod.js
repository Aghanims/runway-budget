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
