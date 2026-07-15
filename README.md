# Runway — Budget Planner

Runway is a single-page personal budget planner that runs in your browser. It's built around an **adaptive daily budget**: instead of a fixed monthly cap, it works out how much you can spend *today*, rolls unspent money forward, and borrows from tomorrow when you overspend — so you always know what's actually left.

Live at **https://aghanims.github.io/runway-budget/**

## Features

- **Adaptive daily budget** — each day's allowance is `(remaining spendable ÷ days left) + yesterday's carryover`. Underspend rolls into tomorrow; overspend is subtracted from it. A gauge shows what's left today, and a "runway" strip tracks how far into the month you are.
- **Dashboard** — what's left to spend this month at a glance, a daily budget-flow chart, a spending-pace line, and per-category breakdowns (income, expenses, bills, savings, debt).
- **Transactions** — log income and expenses, or bulk-import many at once by pasting `type|date|name|planned|actual` lines.
- **Bills** — track recurring bills and mark them paid.
- **Goals** — set savings targets and debt-payoff goals and watch progress.
- **Months** — step between months to review the past or plan ahead; leftover budget rolls over.
- **Light / dark theme.**

## Your data

Data is stored **locally in your browser** by default — nothing leaves your device unless you turn on sync.

- **Backup / Restore** — export everything to a JSON file and restore it later. This is the simplest way to move data between devices, and a good safety net.
- **Cloud sync (optional)** — sign in with a magic link (email, no password) to sync one budget across devices. Sync is off until you sign in.

If your browser is set to clear site data on exit, Runway will warn you — use Backup to file, or turn on sync, so nothing is lost.

## Getting started

Open `index.html` in your browser, or double-click `Start Runway.bat` on Windows to serve it locally. No build step and no install.

## Tech

Plain HTML, CSS, and JavaScript — no framework, no build. State lives in `localStorage`, with JSON backup/restore for portability. Optional cross-device sync uses [Supabase](https://supabase.com) (magic-link auth + a single row per user, protected by row-level security).

> **Forking?** The Supabase URL and anon key in `app.js` point at this project's own backend. The anon key is public by design and row-level security keeps each user's data private, but to run your own sync you'll want to create your own free Supabase project and swap in its URL and anon key at the top of the cloud-sync section in `app.js`. Leave them blank and the app works fully in local-only mode.
