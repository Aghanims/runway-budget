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

/* states: "climbing" | "cruising" | "descending" */
function iconPlane(state) {
  return `<svg class="plane-ico state-${state}" viewBox="0 0 32 20" width="22" height="14" fill="none" aria-hidden="true">
    <path class="plane-trail" d="M2 10 H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path class="plane-body" d="M14 4 L28 10 L14 16 L18 10 Z" fill="currentColor"/>
  </svg>`;
}

function iconStreakFlame() {
  return `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px">
    <path d="M8 14c-3 0-4.5-2-4.5-4.3C3.5 7 6 5.5 6 3c1.8 1 3 2.8 3 5 .8-.6 1.2-1.6 1.2-2.6C11.8 6.5 12.5 8 12.5 9.7 12.5 12 10.9 14 8 14z"/>
  </svg>`;
}
