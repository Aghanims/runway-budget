/* ============================================================
   Runway — a budget planner inspired by Richmond's spreadsheet
   Vanilla JS · localStorage persistence · no dependencies
   ============================================================ */
"use strict";

/* ---------- constants ---------- */
const STORE_KEY = "runway-budget-v1";

const TYPES = {
  income:  { label: "Income",   color: "var(--c-income)",  soft: "var(--c-income-soft)",  emoji: "💵" },
  expense: { label: "Expenses", color: "var(--c-expense)", soft: "var(--c-expense-soft)", emoji: "🧾" },
  bill:    { label: "Bills",    color: "var(--c-bill)",    soft: "var(--c-bill-soft)",    emoji: "📌" },
  saving:  { label: "Savings",  color: "var(--c-saving)",  soft: "var(--c-saving-soft)",  emoji: "🏦" },
  debt:    { label: "Debt",     color: "var(--c-debt)",    soft: "var(--c-debt-soft)",    emoji: "💳" },
};

const EMOJI_RULES = [
  [/panera|bakery|cafe|pnra/i, "🥐"], [/dunkin|donut/i, "🍩"], [/subway|sbwy|sandwich/i, "🥪"],
  [/starbucks|strbks|coffee/i, "☕"], [/mcdonald|burger|charleys/i, "🍔"], [/olive garden|pasta/i, "🍝"],
  [/cava|bowl|chipotle/i, "🥙"], [/bonchon|chicken|chkfa|chkfila|chick/i, "🍗"],
  [/gas|fuel|shell|exxon/i, "⛽"], [/grocer|market|target|trgt/i, "🛒"], [/bike/i, "🚲"],
  [/bday|birthday|gift/i, "🎁"], [/no-spend/i, "🎉"], [/paycheck|salary|pay/i, "💰"],
  [/rent|mortgage/i, "🏠"], [/phone|internet|wifi/i, "📶"], [/tierra|taco|mi /i, "🌮"],
];

function emojiFor(name, type) {
  for (const [re, e] of EMOJI_RULES) if (re.test(name)) return e;
  return TYPES[type].emoji;
}

/* ---------- seed data (from the April 2025 spreadsheet) ---------- */
function seedState() {
  let n = 0;
  const id = () => "e" + Date.now().toString(36) + (n++).toString(36);
  const E = (type, date, name, planned, actual, paid) =>
    ({ id: id(), type, date, name, planned, actual, ...(type === "bill" ? { paid: !!paid } : {}) });

  const april = [
    E("income", "2025-04-03", "Paycheck", 568, 568),
    E("income", "2025-04-08", "Deposit", 300, 300),
    E("income", "2025-04-15", "Paycheck", 423.21, 423.21),
    E("income", "2025-04-22", "Paycheck", 383, 383),
    E("income", "2025-04-23", "Deposit", 311.76, 311.76),

    E("expense", "2025-04-01", "Panera", 58.50, 20.64),
    E("expense", "2025-04-02", "JM & McDonald's", 63.91, 49.25),
    E("expense", "2025-04-03", "Olive Garden", 66.35, 59.74),
    E("expense", "2025-04-04", "Panera", 67.67, 26.93),
    E("expense", "2025-04-05", "No-spend day", 77.86, 0),
    E("expense", "2025-04-06", "Panera, Chick-fil-A, Target", 103.81, 60.11),
    E("expense", "2025-04-07", "Panera & Veranca", 125.67, 48.18),
    E("expense", "2025-04-08", "Subway", 203.15, 88.53),
    E("expense", "2025-04-09", "Panera", 42.29, 15.93),
    E("expense", "2025-04-10", "Subway", 46.68, 43.70),
    E("expense", "2025-04-11", "Dunkin & Bike", 47.28, 32.29),
    E("expense", "2025-04-12", "Dunkin & Bike", 51.03, 30.15),
    E("expense", "2025-04-13", "Misc", 57.99, 57.99),
    E("expense", "2025-04-14", "Misc", 57.99, 57.99),
    E("expense", "2025-04-15", "Misc", 75.99, 75.99),
    E("expense", "2025-04-16", "Panera & Subway", 54.06, 54.05),
    E("expense", "2025-04-17", "Cava", 19.26, 19.26),
    E("expense", "2025-04-18", "Dunkin", 50.00, 25.58),
    E("expense", "2025-04-19", "Panera & Dunkin", 56.10, 59.00),
    E("expense", "2025-04-20", "No-spend day", 55.15, 0),
    E("expense", "2025-04-21", "Bonchon & Panera", 82.72, 63.67),
    E("expense", "2025-04-22", "Mi Tierra", 101.77, 39.74),
    E("expense", "2025-04-23", "Panera", 49.29, 18.16),
    E("expense", "2025-04-24", "Charleys (birthday)", 54.48, 50.24),
    E("expense", "2025-04-25", "Kabayan, Bike & Starbucks", 55.33, 49.90),
    E("expense", "2025-04-26", "Panera", 56.68, 43.65),
    E("expense", "2025-04-27", "Panera", 61.03, 21.40),
    E("expense", "2025-04-28", "Panera & Chick-fil-A", 80.84, 52.49),
    E("expense", "2025-04-29", "Cava & Panera", 109.19, 83.43),
    E("expense", "2025-04-30", "Misc", 30.25, 10.00),

    E("bill", "2025-04-01", "Gas budget", 100, 100, true),
    E("bill", "2025-04-08", "Gas budget", 100, 100, true),
    E("bill", "2025-04-15", "Gas budget", 100, 104.45, true),
    E("bill", "2025-04-23", "Gas budget", 100, 105.18, true),
  ];

  const may = [
    E("expense", "2025-05-01", "Panera", 33.63, 6.71),
    E("bill", "2025-05-01", "Gas budget", 100, 35, false),
  ];

  return {
    version: 1,
    theme: null, // null = follow system
    lastCelebratedStreak: 0,
    activeMonth: "2025-04",
    months: {
      "2025-04": { rollover: 0, entries: april },
      "2025-05": { rollover: 318.35, entries: may },
    },
    goals: [
      { id: id(), kind: "saving", name: "Emergency fund", icon: "🛟", target: 1500, current: 320, targetDate: "2025-12-31" },
      { id: id(), kind: "saving", name: "New bike", icon: "🚲", target: 600, current: 140, targetDate: "2025-09-01" },
      { id: id(), kind: "debt", name: "Credit card", icon: "💳", target: 800, current: 260, targetDate: "2025-11-30" },
    ],
  };
}

/* ---------- blank state (true zero, current month) ---------- */
function emptyState(keepTheme) {
  const key = todayKey();
  return {
    version: 1,
    theme: keepTheme ?? null,
    lastCelebratedStreak: 0,
    activeMonth: key,
    months: { [key]: { rollover: 0, entries: [] } },
    goals: [],
  };
}

/* ---------- storage health ---------- */
function storageWorks() {
  try {
    const k = "__runway_probe__";
    localStorage.setItem(k, "1");
    const ok = localStorage.getItem(k) === "1";
    localStorage.removeItem(k);
    return ok;
  } catch { return false; }
}
const STORAGE_OK = storageWorks();

/* ---------- state ---------- */
function normalizeState(s) {
  if (typeof s.lastCelebratedStreak !== "number") s.lastCelebratedStreak = 0;
  return s;
}
let state;
try {
  state = JSON.parse(localStorage.getItem(STORE_KEY)) || seedState();
  if (!state.months) state = seedState();
} catch { state = seedState(); }
normalizeState(state);

let saveFailed = false;
function save() {
  if (!applyingCloud) state.updatedAt = Date.now();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    saveFailed = false;
  } catch {
    if (!saveFailed) toast("⚠️ Couldn't save — back up to a file so nothing is lost");
    saveFailed = true;
  }
  queueCloudPush();
}

/* ---------- backup to / restore from a file (survives any browser storage issue) ---------- */
function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url; a.download = `runway-backup-${stamp}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast("Backup downloaded");
}
function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== "object" || !parsed.months) throw new Error("not a Runway backup");
      state = normalizeState(parsed);
      save(); applyTheme(); currentView = "dashboard"; render();
      toast("Backup restored");
    } catch {
      toast("That file doesn't look like a Runway backup");
    }
  };
  reader.readAsText(file);
}

/* ============================================================
   Cloud sync (Supabase, free tier) — dormant until configured.
   The anon key is PUBLIC by design and safe to commit: row-level
   security on the table means a signed-in user can only ever
   read/write their own row. Sign-in is by email magic link, so
   there are no passwords anywhere.
   Sync model: whole-state blob, last-write-wins by timestamp.
   ============================================================ */
const SUPABASE_URL = "https://cbpfpbfcpscrkiaxpdua.supabase.co";      // (Settings → API)
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNicGZwYmZjcHNjcmtpYXhwZHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMzA4MTQsImV4cCI6MjA5OTcwNjgxNH0.gn0WGbmXvTYboJrpXsQNcOrYTv3Y8HeJz6lmk3VJUHA"; // "anon public" key

let sb = null, cloudUser = null, pushTimer = null, applyingCloud = false;
let syncState = "idle"; // idle | syncing | synced | error
const cloudEnabled = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);

function setSync(s) { syncState = s; updateSyncUI(); }

function updateSyncUI() {
  const dot = $("#sync-dot"), label = $("#sync-label"), btn = $("#sync-account");
  if (!dot) return;
  dot.className = "sync-dot " + (cloudUser ? syncState : (cloudEnabled() ? "idle" : "off"));
  label.textContent = cloudUser
    ? ({ syncing: "Syncing…", error: "Sync error" }[syncState] || "Synced")
    : "Sync";
  btn.title = cloudUser ? `Signed in as ${cloudUser.email}` : "Sync your data across devices";
}

async function cloudInit() {
  if (!cloudEnabled()) { updateSyncUI(); return; }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { session } } = await sb.auth.getSession();
  cloudUser = session?.user || null;
  sb.auth.onAuthStateChange((_evt, sess) => {
    const wasId = cloudUser?.id;
    cloudUser = sess?.user || null;
    updateSyncUI();
    if (cloudUser && cloudUser.id !== wasId) pullThenPush();
  });
  updateSyncUI();
  if (cloudUser) pullThenPush();
  window.addEventListener("online", () => { if (cloudUser) queueCloudPush(); });
}

async function pullThenPush() {
  if (!sb || !cloudUser) return;
  try {
    setSync("syncing");
    const { data, error } = await sb.from("budgets")
      .select("data, updated_at").eq("user_id", cloudUser.id).maybeSingle();
    if (error) throw error;
    const cloudT = data ? Date.parse(data.updated_at) : 0;
    if (data && cloudT > (state.updatedAt || 0)) {
      applyingCloud = true;
      state = normalizeState(data.data);
      state.updatedAt = cloudT;
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
      applyTheme(); render();
      applyingCloud = false;
      toast("Synced from cloud ☁");
    } else {
      await pushCloud();
    }
    setSync("synced");
  } catch { setSync("error"); }
}

async function pushCloud() {
  if (!sb || !cloudUser) return;
  const { error } = await sb.from("budgets").upsert({
    user_id: cloudUser.id,
    data: state,
    updated_at: new Date(state.updatedAt || Date.now()).toISOString(),
  });
  if (error) throw error;
}

function queueCloudPush() {
  if (!sb || !cloudUser || applyingCloud) return;
  clearTimeout(pushTimer);
  setSync("syncing");
  pushTimer = setTimeout(async () => {
    try { await pushCloud(); setSync("synced"); }
    catch { setSync("error"); }
  }, 1200);
}

function openSyncModal() {
  const root = $("#modal-root");
  const close = () => (root.innerHTML = "");

  if (!cloudEnabled()) {
    root.innerHTML = `
      <div class="modal-backdrop" id="backdrop">
        <div class="modal">
          <h2>Cloud sync</h2>
          <div class="sync-meta">Sync isn't set up yet. It's free: create a project at
            <b>supabase.com</b>, then add the project URL and anon key at the top of the
            cloud-sync section in <code>app.js</code>. Until then, use
            <b>Backup to file</b> / <b>Restore from file</b> to move data between devices.</div>
          <div class="modal-actions"><button class="text-btn" id="m-cancel">Close</button></div>
        </div>
      </div>`;
  } else if (!cloudUser) {
    root.innerHTML = `
      <div class="modal-backdrop" id="backdrop">
        <div class="modal">
          <h2>Sign in to sync</h2>
          <div class="sync-meta">Enter your email and we'll send you a one-time sign-in link —
            no password needed. Use the same email on every device to share one budget.</div>
          <div class="form-field full">
            <label>Email</label>
            <input id="sync-email" type="email" placeholder="you@example.com" autocomplete="email">
          </div>
          <div id="sync-feedback" style="margin-top:12px"></div>
          <div class="modal-actions">
            <button class="text-btn" id="m-cancel">Cancel</button>
            <button class="primary-btn" id="sync-send">Send magic link</button>
          </div>
        </div>
      </div>`;
    $("#sync-send").addEventListener("click", async () => {
      const email = $("#sync-email").value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { toast("Enter a valid email"); return; }
      $("#sync-send").disabled = true;
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + location.pathname },
      });
      $("#sync-feedback").innerHTML = error
        ? `<div class="import-errors">${esc(error.message)}</div>`
        : `<div class="sync-sent">✓ Link sent to ${esc(email)} — open it on this device and you'll
           be signed in here. (Free-tier emails are rate-limited, so give it a minute.)</div>`;
      if (error) $("#sync-send").disabled = false;
    });
    setTimeout(() => $("#sync-email").focus(), 60);
  } else {
    const last = state.updatedAt ? new Date(state.updatedAt).toLocaleString() : "never";
    root.innerHTML = `
      <div class="modal-backdrop" id="backdrop">
        <div class="modal">
          <h2>Cloud sync</h2>
          <div class="sync-email">☁ ${esc(cloudUser.email)}</div>
          <div class="sync-meta">Changes sync automatically a moment after you make them.
            Last change: ${esc(last)}. Sign in with this same email on another device to see the same data.</div>
          <div class="modal-actions">
            <button class="text-btn" id="sync-out">Sign out</button>
            <button class="primary-btn" id="sync-now">Sync now</button>
          </div>
        </div>
      </div>`;
    $("#sync-now").addEventListener("click", async () => { close(); await pullThenPush(); toast("Sync complete"); });
    $("#sync-out").addEventListener("click", async () => {
      await sb.auth.signOut(); close(); updateSyncUI();
      toast("Signed out — data stays on this device");
    });
  }

  $("#m-cancel")?.addEventListener("click", close);
  $("#backdrop").addEventListener("click", (e) => { if (e.target.id === "backdrop") close(); });
}

/* ---------- utils ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const fmt = (n, dec = 2) =>
  "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtSigned = (n) => (n < 0 ? "-" : "") + fmt(n);
const fmt0 = (n) => "$" + Math.round(Math.abs(n)).toLocaleString("en-US");

function monthName(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function daysInMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function prettyDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- month math ---------- */
function getMonth(key) {
  if (!state.months[key]) {
    // lazily create, rolling over the previous month's leftover
    const prevKey = shiftMonth(key, -1);
    const prev = state.months[prevKey];
    const rollover = prev ? round2(monthTotals(prevKey).left) : 0;
    state.months[key] = { rollover, entries: [] };
    save();
  }
  return state.months[key];
}
const round2 = (n) => Math.round(n * 100) / 100;

function monthTotals(key) {
  const m = state.months[key] || { rollover: 0, entries: [] };
  const t = {};
  for (const type of Object.keys(TYPES)) t[type] = { planned: 0, actual: 0 };
  for (const e of m.entries) {
    t[e.type].planned += e.planned || 0;
    t[e.type].actual += e.actual || 0;
  }
  const spentActual = t.expense.actual + t.bill.actual + t.saving.actual + t.debt.actual;
  const spentPlanned = t.expense.planned + t.bill.planned + t.saving.planned + t.debt.planned;
  return {
    ...t,
    rollover: m.rollover || 0,
    spentActual, spentPlanned,
    left: (m.rollover || 0) + t.income.actual - spentActual,
    leftPlanned: (m.rollover || 0) + t.income.planned - spentPlanned,
  };
}

/* ---------- count-up animation ---------- */
const countMemory = new Map();
function countUp(el, target, format = fmtSigned) {
  const memKey = el.dataset.count || (el.dataset.count = "c" + Math.random().toString(36).slice(2));
  const from = countMemory.get(memKey) ?? 0;
  countMemory.set(memKey, target);
  if (from === target) { el.textContent = format(target); return; }
  const t0 = performance.now(), dur = 750;
  el.classList.add("counting");
  function tick(t) {
    const p = Math.min(1, (t - t0) / dur);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = format(from + (target - from) * ease);
    if (p < 1) requestAnimationFrame(tick);
    else el.classList.remove("counting");
  }
  requestAnimationFrame(tick);
}

/* ---------- toasts ---------- */
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  $("#toast-root").appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 320); }, 2200);
}

/* ---------- confetti ---------- */
function confetti() {
  const cv = $("#confetti"), ctx = cv.getContext("2d");
  cv.width = innerWidth; cv.height = innerHeight;
  const colors = ["#1c7a4c", "#c8452b", "#b98a2e", "#3a4f8c", "#a13a5c", "#2f9c66"];
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 200,
    y: innerHeight * 0.45,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 13 - 4,
    w: 5 + Math.random() * 6,
    h: 8 + Math.random() * 6,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: colors[(Math.random() * colors.length) | 0],
  }));
  let frame = 0;
  (function loop() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of parts) {
      p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, 1 - frame / 110);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (++frame < 120) requestAnimationFrame(loop);
    else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

/* ============================================================
   VIEWS
   ============================================================ */
let currentView = "dashboard";

function render() {
  $("#month-label").textContent = monthName(state.activeMonth);
  const totals = monthTotals(state.activeMonth);
  $("#mini-left").innerHTML =
    `Left to spend&ensp;<strong>${fmtSigned(round2(totals.left))}</strong>`;

  $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === currentView));
  const view = $("#view");
  view.scrollTop = 0;
  if (currentView === "dashboard") renderDashboard(view);
  else if (currentView === "transactions") renderTransactions(view);
  else if (currentView === "bills") renderBills(view);
  else if (currentView === "goals") renderGoals(view);
}

/* ---------- dashboard ---------- */
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

  const streak = isCurrent ? computeStreak() : 0;
  const STREAK_MILESTONES = [7, 14, 30, 60, 90];
  if (isCurrent && STREAK_MILESTONES.includes(streak) && state.lastCelebratedStreak < streak) {
    state.lastCelebratedStreak = streak;
    save();
    setTimeout(confetti, 350);
    setTimeout(() => toast(`${streak}-day streak!`), 350);
  }

  const kpis = ["income", "expense", "bill", "saving", "debt"].map((type, i) => {
    const { planned, actual } = t[type];
    const ratio = planned > 0 ? actual / planned : 0;
    const over = type !== "income" && planned > 0 && ratio > 1;
    const fillColor = over ? "var(--serious)" : TYPES[type].color;
    return `
      <div class="card kpi" style="animation-delay:${i * 55}ms">
        <div class="kpi-head">
          <span class="kpi-dot" style="background:${TYPES[type].color}"></span>
          <span class="kpi-label">${TYPES[type].label}</span>
        </div>
        <div class="kpi-value" data-kpi="${type}">${fmt(round2(actual))}</div>
        <div class="kpi-plan">of ${fmt0(planned)} planned${over ? " · <b style='color:var(--serious)'>over</b>" : ""}</div>
        <div class="kpi-meter"><div class="fill" data-w="${Math.min(100, ratio * 100)}" style="background:${fillColor}"></div></div>
      </div>`;
  }).join("");

  const deltaVsPlan = t.left - t.leftPlanned;

  view.innerHTML = `
    <div class="view-inner">
      <div class="hero">
        <div class="hero-left">
          <div class="eyebrow">Left to spend · ${monthName(key)}</div>
          <div class="hero-num ${t.left < 0 ? "neg" : ""}" id="hero-num">${fmtSigned(round2(t.left))}</div>
          <div class="hero-caption">
            ${t.rollover ? `includes ${fmt(t.rollover)} rolled over · ` : ""}
            <span class="${deltaVsPlan >= 0 ? "delta-good" : "delta-bad"}">
              ${deltaVsPlan >= 0 ? "▲ " + fmt0(deltaVsPlan) + " ahead of plan" : "▼ " + fmt0(-deltaVsPlan) + " behind plan"}
            </span>
          </div>
        </div>
        <div class="hero-days">
          ${isCurrent
            ? `<strong>${fmt(Math.max(0, todayBudget))}</strong>today's budget · ${daysLeft} day${daysLeft === 1 ? "" : "s"} of runway`
            : `<strong>${fmt(round2(t.spentActual))}</strong>spent this month`}
        </div>
      </div>
      <div class="month-meter" title="Day ${dayNow} of ${days}">
        <div class="fill" data-w="${(dayNow / days) * 100}"></div>
        <div class="centerline"></div>
        <div class="plane" data-x="${(dayNow / days) * 100}">${iconPlane(paneState)}</div>
      </div>

      <div class="dash-grid daily-grid">
        <div class="card daily-card" id="daily-card"></div>
        <div class="card chart-card">
          <div class="card-title">Daily budget flow</div>
          <div class="card-sub">Underspend rolls into tomorrow · overspend borrows from it</div>
          <div class="chart-wrap" id="daily-flow"></div>
          <div class="legend">
            <span class="legend-item"><span class="legend-swatch" style="background:var(--c-expense)"></span>Spent</span>
            <span class="legend-item"><span class="legend-swatch" style="background:var(--serious)"></span>Over that day's budget</span>
            <span class="legend-item"><span class="legend-line" style="background:var(--ink-2)"></span>That day's budget</span>
          </div>
        </div>
      </div>

      <div class="kpi-row">${kpis}</div>

      <div class="dash-grid">
        <div class="card chart-card">
          <div class="card-title">Spending pace</div>
          <div class="card-sub">Cumulative spend vs. your planned pace</div>
          <div class="chart-wrap" id="pace-chart"></div>
          <div class="legend">
            <span class="legend-item"><span class="legend-line" style="background:var(--c-expense)"></span>Spent so far</span>
            <span class="legend-item"><span class="legend-line" style="background:var(--baseline)"></span>Planned pace</span>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Top spending</div>
          <div class="card-sub">Biggest days this month</div>
          <div class="spend-bars" id="top-bars"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Where the money went</div>
        <div class="alloc-bar" id="alloc-bar"></div>
        <div class="legend" id="alloc-legend"></div>
      </div>
    </div>`;

  countUp($("#hero-num"), round2(t.left));
  ["income", "expense", "bill", "saving", "debt"].forEach((type) => {
    countUp($(`[data-kpi="${type}"]`), round2(t[type].actual), (n) => fmt(n));
  });

  requestAnimationFrame(() => {
    $$("[data-w]", view).forEach((el) => (el.style.width = el.dataset.w + "%"));
    $$("[data-x]", view).forEach((el) => (el.style.left = el.dataset.x + "%"));
    $$(".gauge-fill", view).forEach((el) => (el.style.strokeDashoffset = el.dataset.off));
  });

  renderDailyCard($("#daily-card"), sim, key, streak);
  drawDailyFlow($("#daily-flow"), sim, key);
  drawPaceChart($("#pace-chart"), key);
  drawTopBars($("#top-bars"), key);
  drawAllocation(t);
}

/* ============================================================
   Adaptive daily budget — the heart of the app.
   Each day's budget = (spendable remaining − carry) / days left + carry,
   where carry is yesterday's unspent surplus (or overspend deficit).
   Bills, savings and debt plans are reserved off the top, so the
   daily budget governs day-to-day expenses only.
   ============================================================ */
function dailyBudgetSeries(key) {
  const m = state.months[key] || { rollover: 0, entries: [] };
  const days = daysInMonth(key);
  const t = monthTotals(key);
  const incomeExpected = Math.max(t.income.planned, t.income.actual);
  const reserved = t.bill.planned + t.saving.planned + t.debt.planned;
  const spendable0 = (m.rollover || 0) + incomeExpected - reserved;

  const spentByDay = new Array(days + 1).fill(0);
  for (const e of m.entries) {
    if (e.type !== "expense") continue;
    const d = Number(e.date.split("-")[2]);
    if (d >= 1 && d <= days) spentByDay[d] += e.actual || 0;
  }

  const isCurrent = key === todayKey();
  const today = isCurrent ? Math.min(days, new Date().getDate()) : days;

  const series = [];
  let carry = 0, remaining = spendable0;
  for (let d = 1; d <= days; d++) {
    const daysLeft = days - d + 1;
    const base = (remaining - carry) / daysLeft;
    const budget = base + carry;
    const spent = spentByDay[d];
    series.push({ d, budget, spent, carryIn: carry });
    if (d <= today) { carry = budget - spent; remaining -= spent; }
    else { carry = 0; remaining -= budget; } // future: assume on-budget
  }
  return { series, today, isCurrent, spendable0, reserved, days };
}

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

/* --- today's budget gauge card --- */
function renderDailyCard(card, sim, key, streak) {
  const { series, today, isCurrent, spendable0, reserved, days } = sim;
  if (spendable0 <= 0) {
    card.innerHTML = `<div class="card-title">Daily budget</div>
      <div class="empty-state" style="padding:26px 10px"><div class="big">${iconCloud()}</div>
      <p>Add income (or a rollover) to unlock your daily budget.</p></div>`;
    return;
  }
  const C = 2 * Math.PI * 66;
  const gauge = (pct, color, big, small) => `
    <div class="gauge-wrap">
      <svg width="170" height="170" viewBox="0 0 170 170">
        <circle class="gauge-track" cx="85" cy="85" r="66" fill="none" stroke-width="13"/>
        <circle class="gauge-fill" cx="85" cy="85" r="66" fill="none" stroke="${color}" stroke-width="13"
          stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - Math.min(1, Math.max(0.004, pct)))}"
          style="filter:drop-shadow(0 0 7px ${color})"/>
      </svg>
      <div class="gauge-center"><div class="gauge-big">${big}</div><div class="gauge-small">${small}</div></div>
    </div>`;
  const [yy, mm] = key.split("-").map(Number);

  if (isCurrent) {
    const row = series[today - 1] || { budget: 0, spent: 0, carryIn: 0 };
    const budget = row.budget, spent = row.spent;
    const ratio = budget > 0 ? spent / budget : (spent > 0 ? 1.1 : 0);
    const left = budget - spent;
    const color = ratio > 1 ? "var(--critical)" : ratio > 0.9 ? "var(--serious)" : ratio > 0.7 ? "var(--warning)" : "var(--accent)";
    const tomorrow = today < days ? series[today] : null;
    const dateStr = new Date(yy, mm - 1, today).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    card.innerHTML = `
      <div class="card-title">Today's budget</div>
      <div class="card-sub">${dateStr}</div>
      ${gauge(ratio, color,
        left >= 0 ? fmt(left) : "−" + fmt(-left),
        left >= 0 ? "left today" : "over today")}
      <div class="gauge-sub">spent <b>${fmt(spent)}</b> of <b>${fmt(Math.max(0, budget))}</b> today</div>
      <div class="chip-row">
        ${streak > 0 ? `<span class="stat-chip streak-chip">${iconStreakFlame()}${streak} day streak</span>` : ""}
        ${Math.abs(row.carryIn) >= 0.5
          ? `<span class="stat-chip ${row.carryIn > 0 ? "pos" : "neg"}" style="animation-delay:.08s">${row.carryIn > 0
              ? "＋" + fmt(row.carryIn) + " rolled in from yesterday 🎁"
              : "−" + fmt(-row.carryIn) + " owed from yesterday"}</span>`
          : ""}
        ${tomorrow ? `<span class="stat-chip" style="animation-delay:.16s">tomorrow ≈ ${fmt(Math.max(0, tomorrow.budget))} if you stop now</span>` : ""}
      </div>`;
  } else {
    const totalSpent = series.reduce((s, r) => s + r.spent, 0);
    const ratio = totalSpent / spendable0;
    const leftover = spendable0 - totalSpent;
    const color = ratio > 1 ? "var(--critical)" : "var(--good)";
    card.innerHTML = `
      <div class="card-title">Budget performance</div>
      <div class="card-sub">${monthName(key)}</div>
      ${gauge(ratio, color, Math.round(ratio * 100) + "%", "of budget used")}
      <div class="gauge-sub">spent <b>${fmt(round2(totalSpent))}</b> of <b>${fmt(round2(spendable0))}</b> spendable</div>
      <div class="chip-row">
        <span class="stat-chip ${leftover >= 0 ? "pos" : "neg"}">${leftover >= 0
          ? "＋" + fmt(round2(leftover)) + " left unspent"
          : "−" + fmt(round2(-leftover)) + " overspent"}</span>
        ${reserved > 0 ? `<span class="stat-chip" style="animation-delay:.12s">${fmt0(reserved)} reserved for bills & goals</span>` : ""}
      </div>`;
  }
}

/* --- daily budget flow chart (bars vs adaptive budget ticks) --- */
function drawDailyFlow(wrap, sim, key) {
  const { series, today, isCurrent, days } = sim;
  const W = 640, H = 210, L = 48, R = 10, T = 12, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const lastBar = isCurrent ? today : days;

  let maxVal = 10;
  for (const r of series) maxVal = Math.max(maxVal, r.budget, r.spent);
  const rawStep = maxVal / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= rawStep) || rawStep;
  const nice = Math.ceil(maxVal / step) * step;

  const band = iw / days;
  const bw = Math.min(16, band * 0.62);
  const x = (d) => L + (d - 0.5) * band;
  const y = (v) => T + ih - (Math.max(0, v) / nice) * ih;

  let grid = "";
  for (let v = 0; v <= nice + 0.01; v += step)
    grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/>
      <text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--ink-3)" style="font-variant-numeric:tabular-nums">${v >= 1000 ? v / 1000 + "K" : Math.round(v)}</text>`;
  const xt = [1, 8, 15, 22, days].filter((v, i, a) => a.indexOf(v) === i)
    .map((d) => `<text x="${x(d)}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="var(--ink-3)">${d}</text>`).join("");

  let bars = "", ticks = "", hits = "";
  series.forEach((r, i) => {
    const d = r.d, cx = x(d);
    ticks += `<line x1="${cx - bw / 2 - 3}" x2="${cx + bw / 2 + 3}" y1="${y(r.budget)}" y2="${y(r.budget)}"
      stroke="var(--ink-2)" stroke-width="1.5" opacity="${d <= lastBar ? 0.9 : 0.3}"/>`;
    if (d <= lastBar && r.spent > 0) {
      const under = Math.min(r.spent, Math.max(0, r.budget));
      if (under > 0) bars += `<rect class="daybar" x="${cx - bw / 2}" y="${y(under)}" width="${bw}" height="${Math.max(0.5, y(0) - y(under))}" rx="2" fill="var(--c-expense)" style="animation-delay:${i * 16}ms"/>`;
      if (r.spent > r.budget) bars += `<rect class="daybar" x="${cx - bw / 2}" y="${y(r.spent)}" width="${bw}" height="${Math.max(0.5, y(Math.max(0, r.budget)) - y(r.spent))}" rx="2" fill="var(--serious)" style="animation-delay:${i * 16}ms"/>`;
    }
    hits += `<rect data-day="${d}" x="${L + (d - 1) * band}" y="${T}" width="${band}" height="${ih}" fill="transparent"/>`;
  });

  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily spending against each day's adaptive budget">
      ${grid}
      <line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--baseline)" stroke-width="1"/>
      ${xt}${bars}${ticks}${hits}
    </svg>
    <div class="chart-tip" id="flow-tip"></div>`;

  const tip = $("#flow-tip", wrap);
  const [yy, mm] = key.split("-").map(Number);
  $$("rect[data-day]", wrap).forEach((hr) => {
    hr.addEventListener("mousemove", () => {
      const d = Number(hr.dataset.day);
      const r = series[d - 1];
      const carryOut = r.budget - r.spent;
      const dateStr = new Date(yy, mm - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      tip.innerHTML = `<div class="tip-date">${dateStr}</div>
        <div class="tip-row">budget ${fmt(Math.max(0, r.budget))}</div>
        ${d <= lastBar
          ? `<div class="tip-row">spent ${fmt(r.spent)}</div>
             <div class="tip-row" style="color:${carryOut >= 0 ? "var(--good-ink)" : "var(--critical)"}">
               ${carryOut >= 0 ? "＋" + fmt(carryOut) + " rolls forward" : "−" + fmt(-carryOut) + " borrowed from tomorrow"}</div>`
          : `<div class="tip-row">projected</div>`}`;
      tip.style.left = ((x(d) / W) * 100) + "%";
      tip.style.top = ((y(Math.max(r.budget, r.spent)) / H) * 100) + "%";
      tip.classList.add("show");
    });
    hr.addEventListener("mouseleave", () => tip.classList.remove("show"));
  });
}

/* --- spending pace chart (SVG line + area, crosshair tooltip) --- */
function drawPaceChart(wrap, key) {
  const m = state.months[key] || { entries: [] };
  const days = daysInMonth(key);
  const spendTypes = ["expense", "bill", "saving", "debt"];

  const perDayActual = new Array(days + 1).fill(0);
  const perDayPlanned = new Array(days + 1).fill(0);
  let lastDataDay = 0;
  for (const e of m.entries) {
    if (!spendTypes.includes(e.type)) continue;
    const d = Number(e.date.split("-")[2]);
    if (d >= 1 && d <= days) {
      perDayPlanned[d] += e.planned || 0;
      if (e.actual) { perDayActual[d] += e.actual; lastDataDay = Math.max(lastDataDay, d); }
    }
  }
  if (key === todayKey()) lastDataDay = Math.max(lastDataDay, Math.min(days, new Date().getDate()));
  if (lastDataDay === 0) lastDataDay = days;

  const cumA = [0], cumP = [0];
  for (let d = 1; d <= days; d++) {
    cumA[d] = cumA[d - 1] + perDayActual[d];
    cumP[d] = cumP[d - 1] + perDayPlanned[d];
  }
  const maxVal = Math.max(cumA[days], cumP[days], 10);

  const W = 640, H = 240, L = 52, R = 18, T = 14, B = 28;
  const iw = W - L - R, ih = H - T - B;
  const x = (d) => L + ((d - 1) / (days - 1)) * iw;
  const y = (v) => T + ih - (v / niceMax) * ih;

  // clean axis ticks
  const rawStep = maxVal / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= rawStep) || rawStep;
  const niceMax = Math.ceil(maxVal / step) * step;

  const gridLines = [];
  for (let v = 0; v <= niceMax + 0.01; v += step) {
    gridLines.push(`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/>
      <text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--ink-3)" style="font-variant-numeric:tabular-nums">${v >= 1000 ? (v / 1000) + "K" : v}</text>`);
  }
  const xTicks = [1, 8, 15, 22, days].filter((v, i, a) => a.indexOf(v) === i)
    .map((d) => `<text x="${x(d)}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="var(--ink-3)">${d}</text>`);

  const pathFrom = (arr, upto) => {
    let p = "";
    for (let d = 1; d <= upto; d++) p += (d === 1 ? "M" : "L") + x(d).toFixed(1) + " " + y(arr[d]).toFixed(1);
    return p;
  };
  const actualPath = pathFrom(cumA, lastDataDay);
  const planPath = pathFrom(cumP, days);
  const areaPath = actualPath + `L${x(lastDataDay).toFixed(1)} ${y(0)}L${x(1).toFixed(1)} ${y(0)}Z`;

  const endX = x(lastDataDay), endY = y(cumA[lastDataDay]);
  const labelAnchor = lastDataDay > days * 0.82 ? "end" : "start";
  const labelDx = labelAnchor === "end" ? -10 : 10;

  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative spending versus planned pace">
      ${gridLines.join("")}
      <line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--baseline)" stroke-width="1"/>
      ${xTicks.join("")}
      <path d="${areaPath}" fill="var(--c-expense)" opacity="0.10"/>
      <path d="${planPath}" fill="none" stroke="var(--baseline)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${actualPath}" fill="none" stroke="var(--c-expense)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"
            pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1;animation:drawLine 1.1s cubic-bezier(.4,0,.2,1) .1s forwards"/>
      <circle cx="${endX}" cy="${endY}" r="6" fill="var(--surface)"/>
      <circle cx="${endX}" cy="${endY}" r="4" fill="var(--c-expense)"/>
      <text x="${endX + labelDx}" y="${endY - 8}" text-anchor="${labelAnchor}" font-size="11.5" font-weight="600" fill="var(--ink)">${fmt0(cumA[lastDataDay])}</text>
      <line id="crosshair" y1="${T}" y2="${T + ih}" stroke="var(--ink-3)" stroke-width="1" opacity="0"/>
      <circle id="hover-dot" r="4.5" fill="var(--c-expense)" stroke="var(--surface)" stroke-width="2" opacity="0"/>
    </svg>
    <div class="chart-tip" id="pace-tip"></div>
    <style>@keyframes drawLine{to{stroke-dashoffset:0}}</style>`;

  const svg = $("svg", wrap), tip = $("#pace-tip", wrap);
  const cross = $("#crosshair", wrap), dot = $("#hover-dot", wrap);
  svg.addEventListener("mousemove", (ev) => {
    const r = svg.getBoundingClientRect();
    const mx = ((ev.clientX - r.left) / r.width) * W;
    let d = Math.round(((mx - L) / iw) * (days - 1)) + 1;
    d = Math.max(1, Math.min(days, d));
    const cx = x(d);
    cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("opacity", "0.35");
    if (d <= lastDataDay) {
      dot.setAttribute("cx", cx); dot.setAttribute("cy", y(cumA[d])); dot.setAttribute("opacity", "1");
    } else dot.setAttribute("opacity", "0");
    const dateStr = new Date(...key.split("-").map(Number).map((v, i) => (i === 1 ? v - 1 : v)), d)
      .toLocaleDateString("en-US", { month: "short", day: "numeric" });
    tip.innerHTML = `<div class="tip-date">${dateStr}</div>
      ${d <= lastDataDay ? `<div class="tip-row"><span class="tip-swatch" style="background:var(--c-expense)"></span>Spent ${fmt(cumA[d])}</div>` : ""}
      <div class="tip-row"><span class="tip-swatch" style="background:var(--baseline)"></span>Pace ${fmt(cumP[d])}</div>`;
    tip.style.left = ((cx / W) * 100) + "%";
    tip.style.top = ((y(d <= lastDataDay ? cumA[d] : cumP[d]) / H) * 100) + "%";
    tip.classList.add("show");
  });
  svg.addEventListener("mouseleave", () => {
    tip.classList.remove("show"); cross.setAttribute("opacity", "0"); dot.setAttribute("opacity", "0");
  });
}

/* --- top spending horizontal bars --- */
function drawTopBars(wrap, key) {
  const m = state.months[key] || { entries: [] };
  const top = m.entries
    .filter((e) => e.type === "expense" && e.actual > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 6);
  if (!top.length) {
    wrap.innerHTML = `<div class="empty-state" style="padding:30px 10px"><div class="big">${iconSprout()}</div><p>No spending yet this month.</p></div>`;
    return;
  }
  const max = top[0].actual;
  wrap.innerHTML = top.map((e, i) => `
    <div class="spend-bar-row">
      <div class="spend-bar-name">${emojiFor(e.name, e.type)} ${esc(e.name)} · ${e.date.slice(5).replace("-", "/")}</div>
      <div class="spend-bar-track"><div class="spend-bar-fill" data-w="${(e.actual / max) * 100}" style="transition-delay:${i * 70}ms"></div></div>
      <div class="spend-bar-val">${fmt(e.actual)}</div>
    </div>`).join("");
  requestAnimationFrame(() =>
    $$(".spend-bar-fill", wrap).forEach((el) => (el.style.width = el.dataset.w + "%")));
}

/* --- allocation stacked bar --- */
function drawAllocation(t) {
  const parts = [
    ["expense", t.expense.actual], ["bill", t.bill.actual],
    ["saving", t.saving.actual], ["debt", t.debt.actual],
  ].filter(([, v]) => v > 0);
  const total = parts.reduce((s, [, v]) => s + v, 0);
  const bar = $("#alloc-bar"), legend = $("#alloc-legend");
  if (!total) {
    bar.innerHTML = ""; legend.innerHTML = `<span class="legend-item">Nothing spent yet.</span>`;
    return;
  }
  bar.innerHTML = parts.map(([type, v]) =>
    `<div class="alloc-seg" style="flex:${v} ${v} 0%;background:${TYPES[type].color}" title="${TYPES[type].label} ${fmt(v)}"></div>`).join("");
  legend.innerHTML = parts.map(([type, v]) =>
    `<span class="legend-item"><span class="legend-swatch" style="background:${TYPES[type].color}"></span>${TYPES[type].label} · <b>${fmt(round2(v))}</b> (${Math.round((v / total) * 100)}%)</span>`).join("");
}

/* ---------- transactions ---------- */
let txFilter = "all";
function renderTransactions(view) {
  const m = getMonth(state.activeMonth);
  const list = m.entries
    .filter((e) => txFilter === "all" || e.type === txFilter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const groups = new Map();
  for (const e of list) {
    if (!groups.has(e.date)) groups.set(e.date, []);
    groups.get(e.date).push(e);
  }

  const chips = ["all", ...Object.keys(TYPES)].map((f) =>
    `<button class="chip ${txFilter === f ? "active" : ""}" data-filter="${f}">
      ${f === "all" ? "All" : TYPES[f].label}</button>`).join("");

  let body = "";
  if (!list.length) {
    body = `<div class="empty-state"><div class="big">${iconNotepad()}</div>
      <p>No ${txFilter === "all" ? "entries" : TYPES[txFilter].label.toLowerCase()} in ${monthName(state.activeMonth)} yet.</p>
      <button class="primary-btn" onclick="openEntryModal()">＋ Add your first entry</button></div>`;
  } else {
    let i = 0;
    for (const [date, entries] of groups) {
      const dayTotal = entries.reduce((s, e) => s + (e.type === "income" ? 0 : e.actual || 0), 0);
      body += `<div class="day-group">
        <div class="day-head"><span>${prettyDate(date).toUpperCase()}</span>
          ${dayTotal ? `<span>spent ${fmt(round2(dayTotal))}</span>` : ""}</div>
        <div class="tx-list">
          ${entries.map((e) => `
            <div class="tx-row" data-id="${e.id}" style="animation-delay:${Math.min(i++ * 30, 400)}ms">
              <div class="tx-ico" style="background:${TYPES[e.type].soft}">${emojiFor(e.name, e.type)}</div>
              <div class="tx-body">
                <div class="tx-name">${esc(e.name)}</div>
                <div class="tx-meta">${TYPES[e.type].label}${e.type === "bill" ? (e.paid ? " · ✓ paid" : " · unpaid") : ""}</div>
              </div>
              <div class="tx-amounts">
                <div class="tx-actual ${e.type === "income" ? "income-amt" : ""}">${e.type === "income" ? "+" : "−"}${fmt(e.actual || 0)}</div>
                <div class="tx-planned">planned ${fmt0(e.planned || 0)}</div>
              </div>
              <button class="tx-del" data-del="${e.id}" title="Delete">✕</button>
            </div>`).join("")}
        </div>
      </div>`;
    }
  }

  view.innerHTML = `<div class="view-inner">
    <div class="section-head">
      <div><h1>Transactions</h1>
        <div class="sub">${list.length} entr${list.length === 1 ? "y" : "ies"} · ${monthName(state.activeMonth)}</div></div>
    </div>
    <div class="filter-row">${chips}</div>
    ${body}
  </div>`;

  $$(".chip", view).forEach((c) =>
    c.addEventListener("click", () => { txFilter = c.dataset.filter; renderTransactions(view); }));
  $$("[data-del]", view).forEach((b) =>
    b.addEventListener("click", (ev) => { ev.stopPropagation(); deleteEntry(b.dataset.del); }));
  $$(".tx-row", view).forEach((row) =>
    row.addEventListener("click", () => {
      const e = getMonth(state.activeMonth).entries.find((x) => x.id === row.dataset.id);
      if (e) openEntryModal(e);
    }));
}

function deleteEntry(id) {
  const m = getMonth(state.activeMonth);
  const row = $(`.tx-row[data-id="${id}"]`);
  const doDelete = () => {
    m.entries = m.entries.filter((e) => e.id !== id);
    save(); render(); toast("Entry deleted");
  };
  if (row) { row.classList.add("removing"); setTimeout(doDelete, 250); } else doDelete();
}

/* ---------- bills ---------- */
function renderBills(view) {
  const m = getMonth(state.activeMonth);
  const bills = m.entries.filter((e) => e.type === "bill").sort((a, b) => a.date.localeCompare(b.date));
  const paidCount = bills.filter((b) => b.paid).length;
  const t = monthTotals(state.activeMonth);

  view.innerHTML = `<div class="view-inner">
    <div class="section-head">
      <div><h1>Bills</h1>
        <div class="sub">${paidCount} of ${bills.length} paid · ${fmt(round2(t.bill.actual))} of ${fmt0(t.bill.planned)} planned</div></div>
    </div>
    ${bills.length ? `<div class="bill-grid">
      ${bills.map((b, i) => {
        const ratio = b.planned > 0 ? (b.actual || 0) / b.planned : 0;
        const over = ratio > 1;
        return `<div class="card bill-card" style="animation-delay:${i * 60}ms">
          <div class="bill-top">
            <div>
              <div class="bill-name">${emojiFor(b.name, "bill")} ${esc(b.name)}</div>
              <div class="bill-due">due ${prettyDate(b.date)}</div>
            </div>
            <button class="paid-toggle ${b.paid ? "on" : ""}" data-pay="${b.id}" title="${b.paid ? "Mark unpaid" : "Mark paid"}">✓</button>
          </div>
          <div class="bill-amts">
            <span class="bill-actual">${fmt(b.actual || 0)}</span>
            <span class="bill-of">of ${fmt0(b.planned || 0)}</span>
          </div>
          <div class="bill-meter"><div class="fill" data-w="${Math.min(100, ratio * 100)}" ${over ? 'style="background:var(--serious)"' : ""}></div></div>
          <div class="bill-status" style="color:${b.paid ? "var(--good-ink)" : over ? "var(--serious)" : "var(--ink-3)"}">
            ${b.paid ? "✓ Paid" : over ? "Over budget" : "Awaiting payment"}</div>
        </div>`;
      }).join("")}
    </div>`
    : `<div class="empty-state"><div class="big">${iconInbox()}</div><p>No bills for ${monthName(state.activeMonth)}.</p>
       <button class="primary-btn" onclick="openEntryModal(null,'bill')">＋ Add a bill</button></div>`}
  </div>`;

  requestAnimationFrame(() =>
    $$("[data-w]", view).forEach((el) => (el.style.width = el.dataset.w + "%")));

  $$("[data-pay]", view).forEach((btn) =>
    btn.addEventListener("click", () => {
      const bill = getMonth(state.activeMonth).entries.find((e) => e.id === btn.dataset.pay);
      bill.paid = !bill.paid;
      if (bill.paid && !bill.actual) bill.actual = bill.planned; // sensible default
      save(); renderBills(view);
      const totals = monthTotals(state.activeMonth);
      $("#mini-left").innerHTML = `Left to spend&ensp;<strong>${fmtSigned(round2(totals.left))}</strong>`;
      toast(bill.paid ? `${bill.name} marked paid ✓` : `${bill.name} marked unpaid`);
    }));
}

/* ---------- goals ---------- */
function renderGoals(view) {
  const sections = [
    ["saving", "🏦 Savings goals", "var(--c-saving)"],
    ["debt", "💳 Debt payoff", "var(--c-debt)"],
  ];

  view.innerHTML = `<div class="view-inner">
    <div class="section-head">
      <div><h1>Goals</h1><div class="sub">Long-term targets, across all months</div></div>
      <button class="primary-btn" id="add-goal">＋ New goal</button>
    </div>
    ${sections.map(([kind, title, color]) => {
      const goals = state.goals.filter((g) => g.kind === kind);
      return `<div class="goal-section-title">${title}</div>
      ${goals.length ? `<div class="goal-grid">
        ${goals.map((g, i) => {
          const pct = Math.min(1, g.target > 0 ? g.current / g.target : 0);
          const C = 2 * Math.PI * 38;
          const done = pct >= 1;
          return `<div class="card goal-card" style="animation-delay:${i * 70}ms">
            <div class="goal-ring">
              <svg width="88" height="88" viewBox="0 0 88 88">
                <circle class="ring-track" cx="44" cy="44" r="38" fill="none" stroke-width="8"/>
                <circle class="ring-fill" cx="44" cy="44" r="38" fill="none" stroke="${done ? "var(--good)" : color}" stroke-width="8"
                  stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - pct)}"/>
              </svg>
              <div class="ring-pct">${Math.round(pct * 100)}%</div>
              <div class="ring-emoji">${g.icon || (kind === "saving" ? "🏦" : "💳")}</div>
            </div>
            <div class="goal-body">
              <div class="goal-name">${esc(g.name)}</div>
              <div class="goal-nums"><strong>${fmt0(g.current)}</strong> of ${fmt0(g.target)} ${kind === "saving" ? "saved" : "paid off"}</div>
              ${g.targetDate ? `<div class="goal-date">target ${prettyDate(g.targetDate)}</div>` : ""}
              ${done
                ? `<div class="goal-complete">🎉 Goal complete!</div>
                   <div class="goal-actions"><button class="mini-btn danger" data-goal-del="${g.id}">Remove</button></div>`
                : `<div class="goal-actions">
                     <button class="mini-btn" data-goal-fund="${g.id}">＋ Add funds</button>
                     <button class="mini-btn danger" data-goal-del="${g.id}">Remove</button>
                   </div>
                   <div class="goal-fund-input" data-fund-input="${g.id}" style="display:none">
                     <input type="number" min="0" step="0.01" placeholder="Amount">
                     <button class="mini-btn" data-fund-save="${g.id}">Add</button>
                   </div>`}
            </div>
          </div>`;
        }).join("")}
      </div>` : `<div class="empty-state" style="padding:30px"><p>No ${kind === "saving" ? "savings goals" : "debts tracked"} yet.</p></div>`}`;
    }).join("")}
  </div>`;

  requestAnimationFrame(() =>
    $$(".ring-fill", view).forEach((el) => (el.style.strokeDashoffset = el.dataset.off)));

  $("#add-goal").addEventListener("click", openGoalModal);
  $$("[data-goal-del]", view).forEach((b) =>
    b.addEventListener("click", () => {
      state.goals = state.goals.filter((g) => g.id !== b.dataset.goalDel);
      save(); renderGoals(view); toast("Goal removed");
    }));
  $$("[data-goal-fund]", view).forEach((b) =>
    b.addEventListener("click", () => {
      const box = $(`[data-fund-input="${b.dataset.goalFund}"]`, view);
      box.style.display = box.style.display === "none" ? "flex" : "none";
      $("input", box).focus();
    }));
  $$("[data-fund-save]", view).forEach((b) =>
    b.addEventListener("click", () => {
      const box = $(`[data-fund-input="${b.dataset.fundSave}"]`, view);
      const amt = parseFloat($("input", box).value);
      if (!amt || amt <= 0) return;
      const g = state.goals.find((x) => x.id === b.dataset.fundSave);
      const wasDone = g.current >= g.target;
      g.current = round2(g.current + amt);
      save(); renderGoals(view);
      toast(`${fmt(amt)} added to ${g.name}`);
      if (!wasDone && g.current >= g.target) setTimeout(confetti, 350);
    }));
}

/* ---------- entry modal (add / edit) ---------- */
function openEntryModal(existing = null, presetType = null) {
  const isEdit = !!existing;
  const type0 = existing?.type || presetType || "expense";
  const [y, m] = state.activeMonth.split("-");
  const defaultDate = existing?.date ||
    (state.activeMonth === todayKey()
      ? new Date().toISOString().slice(0, 10)
      : `${y}-${m}-01`);

  const root = $("#modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" id="backdrop">
      <div class="modal">
        <h2>${isEdit ? "Edit entry" : "Add entry"}</h2>
        <div class="seg-row" id="type-segs">
          ${Object.entries(TYPES).map(([k, v]) =>
            `<button class="seg ${k === type0 ? "active" : ""}" data-type="${k}">${v.emoji} ${v.label}</button>`).join("")}
        </div>
        <div class="form-grid">
          <div class="form-field full">
            <label>Name</label>
            <input id="f-name" type="text" placeholder="e.g. Panera, Paycheck, Gas budget" value="${existing ? esc(existing.name) : ""}">
          </div>
          <div class="form-field">
            <label>Date</label>
            <input id="f-date" type="date" value="${defaultDate}">
          </div>
          <div class="form-field" id="paid-field" style="${type0 === "bill" ? "" : "display:none"}">
            <label>Status</label>
            <select id="f-paid">
              <option value="no" ${existing?.paid ? "" : "selected"}>Unpaid</option>
              <option value="yes" ${existing?.paid ? "selected" : ""}>Paid</option>
            </select>
          </div>
          <div class="form-field">
            <label>Planned ($)</label>
            <input id="f-planned" type="number" min="0" step="0.01" placeholder="0.00" value="${existing?.planned ?? ""}">
          </div>
          <div class="form-field">
            <label>Actual ($)</label>
            <input id="f-actual" type="number" min="0" step="0.01" placeholder="0.00" value="${existing?.actual ?? ""}">
          </div>
        </div>
        <div class="modal-actions">
          <button class="text-btn" id="m-cancel">Cancel</button>
          <button class="primary-btn" id="m-save">${isEdit ? "Save changes" : "Add entry"}</button>
        </div>
      </div>
    </div>`;

  let type = type0;
  $$(".seg", root).forEach((s) =>
    s.addEventListener("click", () => {
      type = s.dataset.type;
      $$(".seg", root).forEach((x) => x.classList.toggle("active", x === s));
      $("#paid-field").style.display = type === "bill" ? "" : "none";
    }));

  const close = () => (root.innerHTML = "");
  $("#m-cancel").addEventListener("click", close);
  $("#backdrop").addEventListener("click", (e) => { if (e.target.id === "backdrop") close(); });
  document.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", onEsc); }
  });

  $("#m-save").addEventListener("click", () => {
    const name = $("#f-name").value.trim() || TYPES[type].label;
    const date = $("#f-date").value;
    const planned = parseFloat($("#f-planned").value) || 0;
    const actual = parseFloat($("#f-actual").value) || 0;
    if (!date) { toast("Pick a date"); return; }

    const mKey = date.slice(0, 7);
    const target = getMonth(mKey);
    if (isEdit) {
      // move between months if the date changed
      const oldMonth = getMonth(state.activeMonth);
      oldMonth.entries = oldMonth.entries.filter((e) => e.id !== existing.id);
      target.entries.push({
        ...existing, type, name, date, planned, actual,
        ...(type === "bill" ? { paid: $("#f-paid").value === "yes" } : {}),
      });
    } else {
      target.entries.push({
        id: "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        type, name, date, planned, actual,
        ...(type === "bill" ? { paid: $("#f-paid").value === "yes" } : {}),
      });
    }
    if (mKey !== state.activeMonth) state.activeMonth = mKey;
    save(); close(); render();
    toast(isEdit ? "Entry updated" : `${name} added ${emojiFor(name, type)}`);
  });

  setTimeout(() => $("#f-name").focus(), 60);
}
window.openEntryModal = openEntryModal;

/* ---------- goal modal ---------- */
function openGoalModal() {
  const root = $("#modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" id="backdrop">
      <div class="modal">
        <h2>New goal</h2>
        <div class="seg-row" id="goal-segs">
          <button class="seg active" data-kind="saving">🏦 Savings goal</button>
          <button class="seg" data-kind="debt">💳 Debt payoff</button>
        </div>
        <div class="form-grid">
          <div class="form-field full">
            <label>Name</label>
            <input id="g-name" type="text" placeholder="e.g. Emergency fund, Car loan">
          </div>
          <div class="form-field">
            <label>Icon (emoji)</label>
            <input id="g-icon" type="text" maxlength="4" placeholder="🛟">
          </div>
          <div class="form-field">
            <label>Target date</label>
            <input id="g-date" type="date">
          </div>
          <div class="form-field">
            <label>Target ($)</label>
            <input id="g-target" type="number" min="0" step="0.01" placeholder="1000">
          </div>
          <div class="form-field">
            <label>Already saved / paid ($)</label>
            <input id="g-current" type="number" min="0" step="0.01" placeholder="0">
          </div>
        </div>
        <div class="modal-actions">
          <button class="text-btn" id="m-cancel">Cancel</button>
          <button class="primary-btn" id="m-save">Create goal</button>
        </div>
      </div>
    </div>`;

  let kind = "saving";
  $$(".seg", root).forEach((s) =>
    s.addEventListener("click", () => {
      kind = s.dataset.kind;
      $$(".seg", root).forEach((x) => x.classList.toggle("active", x === s));
    }));

  const close = () => (root.innerHTML = "");
  $("#m-cancel").addEventListener("click", close);
  $("#backdrop").addEventListener("click", (e) => { if (e.target.id === "backdrop") close(); });

  $("#m-save").addEventListener("click", () => {
    const name = $("#g-name").value.trim();
    const target = parseFloat($("#g-target").value);
    if (!name || !target) { toast("Name and target are required"); return; }
    state.goals.push({
      id: "g" + Date.now().toString(36),
      kind, name,
      icon: $("#g-icon").value.trim() || (kind === "saving" ? "🏦" : "💳"),
      target,
      current: parseFloat($("#g-current").value) || 0,
      targetDate: $("#g-date").value || null,
    });
    save(); close(); render(); toast(`Goal "${name}" created`);
  });
  setTimeout(() => $("#g-name").focus(), 60);
}

/* ---------- bulk import (bank statement paste) ---------- */
const IMPORT_TEMPLATE = `# One entry per line: type|date|name|planned|actual|paid(bills only)
# type is one of: income, expense, bill, saving, debt
# Edit, delete, or add lines below, then click Import.
expense|2026-07-13|Vivi Bubble Tea (Chicago, pending, confirm date)|17.13|17.13`;

function parseImportText(text) {
  const errors = [];
  const entries = [];
  const lines = text.split("\n");
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 5) { errors.push(`Line ${i + 1}: expected at least 5 fields, got ${parts.length}`); return; }
    const [type, date, name, plannedStr, actualStr, paidStr] = parts;
    if (!TYPES[type]) { errors.push(`Line ${i + 1}: unknown type "${type}"`); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`Line ${i + 1}: date "${date}" isn't YYYY-MM-DD`); return; }
    if (!name) { errors.push(`Line ${i + 1}: missing a name`); return; }
    const planned = parseFloat(plannedStr), actual = parseFloat(actualStr);
    if (Number.isNaN(planned) || Number.isNaN(actual)) { errors.push(`Line ${i + 1}: planned/actual must be numbers`); return; }
    entries.push({
      id: "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type, date, name, planned, actual,
      ...(type === "bill" ? { paid: /^(y|yes|true)$/i.test(paidStr || "") } : {}),
    });
  });
  return { entries, errors };
}

function openImportModal() {
  const root = $("#modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" id="backdrop">
      <div class="modal" style="width:min(620px, calc(100vw - 32px))">
        <h2>Import transactions</h2>
        <div class="import-help">
          One entry per line: <code>type|date|name|planned|actual</code> — type is
          <code>income</code>, <code>expense</code>, <code>bill</code>, <code>saving</code>, or <code>debt</code>.
          Lines starting with <code>#</code> are ignored. Add a 6th field (<code>yes</code>/<code>no</code>) on bill lines for paid status.
          Entries land in whichever month their date falls in.
        </div>
        <textarea id="import-textarea" spellcheck="false">${esc(IMPORT_TEMPLATE)}</textarea>
        <div id="import-feedback"></div>
        <div class="modal-actions">
          <button class="text-btn" id="m-cancel">Cancel</button>
          <button class="primary-btn" id="m-save">Import</button>
        </div>
      </div>
    </div>`;

  const close = () => (root.innerHTML = "");
  $("#m-cancel").addEventListener("click", close);
  $("#backdrop").addEventListener("click", (e) => { if (e.target.id === "backdrop") close(); });

  $("#m-save").addEventListener("click", () => {
    const { entries, errors } = parseImportText($("#import-textarea").value);
    const feedback = $("#import-feedback");
    if (errors.length) {
      feedback.innerHTML = `<div class="import-errors"><b>Fix these lines first:</b><br>${errors.map(esc).join("<br>")}</div>`;
      return;
    }
    if (!entries.length) { feedback.innerHTML = `<div class="import-errors">No entries to import.</div>`; return; }

    const byMonth = {};
    let latestMonth = null;
    for (const e of entries) {
      const mKey = e.date.slice(0, 7);
      getMonth(mKey).entries.push(e);
      byMonth[mKey] = (byMonth[mKey] || 0) + 1;
      if (!latestMonth || mKey > latestMonth) latestMonth = mKey;
    }
    state.activeMonth = latestMonth;
    save();

    const summary = Object.entries(byMonth).map(([m, n]) => `${n} to ${monthName(m)}`).join(", ");
    feedback.innerHTML = `<div class="import-summary">✓ Imported ${entries.length} entr${entries.length === 1 ? "y" : "ies"} — ${esc(summary)}</div>`;
    setTimeout(() => { close(); render(); toast(`${entries.length} transactions imported`); }, 700);
  });
}
window.openImportModal = openImportModal;

/* ---------- theme ---------- */
function applyTheme() {
  const sysDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const mode = state.theme || (sysDark ? "dark" : "light");
  document.documentElement.dataset.theme = mode;
}
$("#theme-toggle").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme;
  state.theme = cur === "dark" ? "light" : "dark";
  save(); applyTheme();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

/* ---------- global wiring ---------- */
$$(".nav-btn").forEach((b) =>
  b.addEventListener("click", () => { currentView = b.dataset.view; render(); }));

$("#month-prev").addEventListener("click", () => {
  state.activeMonth = shiftMonth(state.activeMonth, -1);
  getMonth(state.activeMonth); save(); render();
});
$("#month-next").addEventListener("click", () => {
  state.activeMonth = shiftMonth(state.activeMonth, 1);
  getMonth(state.activeMonth); save(); render();
});
$("#month-label").addEventListener("click", () => {
  state.activeMonth = todayKey();
  getMonth(state.activeMonth); save(); render();
  toast("Jumped to " + monthName(state.activeMonth));
});
$("#add-entry").addEventListener("click", () => openEntryModal());
$("#import-entries").addEventListener("click", () => openImportModal());

$("#reset-demo").addEventListener("click", () => {
  if (confirm("Replace everything with the April 2025 sample data?")) {
    state = seedState(); save(); applyTheme(); render(); toast("Sample data restored");
  }
});

$("#start-fresh").addEventListener("click", () => {
  if (confirm("Clear all entries and goals and start at zero? This can't be undone.")) {
    state = emptyState(state.theme); save(); applyTheme(); currentView = "dashboard"; render();
    toast("Starting fresh — everything's at zero");
  }
});

$("#sync-account").addEventListener("click", openSyncModal);
$("#backup-file").addEventListener("click", exportBackup);
$("#restore-file").addEventListener("click", () => $("#restore-input").click());
$("#restore-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) importBackup(file);
  e.target.value = "";
});

/* ---------- boot ---------- */
applyTheme();
render();
if (!STORAGE_OK) $("#storage-warning").hidden = false;
cloudInit();
