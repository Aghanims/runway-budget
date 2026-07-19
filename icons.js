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
