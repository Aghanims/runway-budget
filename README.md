# Runway — Budget Planner

Runway is a single-page budget planner that runs entirely in your browser. The idea behind it is simple: instead of handing you one big number for the whole month, it works out an adaptive daily budget — how much you can actually spend today. Underspend and the leftover rolls into tomorrow; overspend and it gets borrowed back from tomorrow. So instead of guessing, you always know what's really left to spend right now.

You can try it live at https://aghanims.github.io/runway-budget/

## Features

- **Adaptive daily budget** — each day's allowance works out to (remaining spendable ÷ days left) + yesterday's carryover. Spend less than that and it carries into tomorrow; spend more and it comes out of tomorrow's budget instead. A gauge shows what's left today, and a "runway" strip gives you a sense of how far into the month you are.
- **Dashboard** — a quick view of what's left to spend this month, plus a daily budget-flow chart, a spending-pace line, and breakdowns by category (income, expenses, bills, savings, debt).
- **Transactions** — log income and expenses one by one, or paste in a batch of `type|date|name|planned|actual` lines to import a bunch at once.
- **Bills** — keep track of recurring bills and check them off once they're paid.
- **Goals** — set savings targets or debt payoff goals and watch your progress add up.
- **Months** — move between months to look back or plan ahead; whatever's left over rolls forward automatically.
- **Light / dark theme** — pick your side.

## Your data

By default, everything stays local in your browser — none of it leaves your device unless you turn sync on yourself.

- **Backup / Restore** — export everything to a JSON file whenever you like and restore it later. It's the easiest way to move your data between devices, and it works as a safety net too.
- **Cloud sync (optional)** — sign in with a magic link (just your email, no password needed) to keep one budget synced across devices. It stays off until you actually sign in.

One thing worth knowing: if your browser is set to clear site data when it closes, Runway will warn you about it — just back up to a file or turn on sync so nothing gets lost.

## Getting started

Open index.html in your browser, or on Windows, double-click Start Runway.bat to serve it locally. There's no build step and nothing to install — it just runs.

## Tech

Under the hood it's plain HTML, CSS, and JavaScript — no framework, no build process. State lives in localStorage, with JSON backup/restore so your data isn't stuck in one place. The optional cross-device sync runs on Supabase, using magic-link auth and a single row per user, kept private with row-level security.

Thinking about forking this? The Supabase URL and anon key in app.js point at my own backend. That anon key is public by design, and row-level security keeps everyone's data separate, but if you want to run your own sync, spin up a free Supabase project and swap in its URL and anon key near the top of the cloud-sync section in app.js. Leave those blank and the app still works fine, just in local-only mode.
