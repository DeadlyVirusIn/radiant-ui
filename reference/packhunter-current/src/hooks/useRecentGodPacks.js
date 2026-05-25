/**
 * useRecentGodPacks — Wave 4.1
 *
 * Module-level singleton for the Dashboard's recent-godpacks poll.
 * Guarantees ONE `setInterval` globally regardless of how many
 * Dashboard instances are mounted (e.g., StrictMode double-invoke,
 * accidental remount via route Suspense, or multiple tabs reusing
 * the same window — each mount adds a subscriber, not a timer).
 *
 * Why this instead of a per-instance `useRef` guard?
 *   A ref only prevents duplicate timers WITHIN a single React mount.
 *   Production evidence showed multiple pause-log emissions, which
 *   means multiple mounts each ran their own timer + breaker. Only a
 *   module-level singleton can guarantee the single-interval invariant.
 *
 * Circuit breaker (preserved from Wave 4):
 *   - 3 consecutive failures → pause 60s
 *   - Any success resets the counter
 *   - Paused calls skip the network op entirely
 *
 * Exported hook:
 *   const { godpacks, status } = useRecentGodPacks()
 *   // status: 'idle' | 'polling' | 'paused' | 'error'
 */

import { useEffect, useState } from 'react';
import { hunt } from '../services/api';

const POLL_INTERVAL_MS = 30_000;
const FAILURE_THRESHOLD = 3;
const PAUSE_MS = 60_000;

// ── Singleton state ─────────────────────────────────────────────────
const subscribers = new Set();  // Set<(godpacks) => void>
let intervalId = null;
let latestGodpacks = [];
let consecutiveFailures = 0;
let pausedUntil = 0;
let inFlight = false;           // prevent overlapping fetches

// Diagnostic: emits a single warning if a start() is ever triggered
// while a timer already exists (should be impossible by construction).
let duplicateStartWarned = false;

async function fetchOnce() {
  if (inFlight) return;
  if (Date.now() < pausedUntil) return;
  inFlight = true;
  try {
    const data = await hunt.getGodpacks(5);
    latestGodpacks = data.godpacks || [];
    consecutiveFailures = 0;
    // Notify all subscribers with the fresh list
    for (const sub of [...subscribers]) {
      try { sub(latestGodpacks); } catch {}
    }
  } catch {
    consecutiveFailures += 1;
    if (consecutiveFailures >= FAILURE_THRESHOLD) {
      pausedUntil = Date.now() + PAUSE_MS;
      // Exactly one pause log regardless of subscriber count — the
      // whole point of the singleton.
      console.warn('[Dashboard] recent godpacks: paused 60s after 3 consecutive failures');
    }
  } finally {
    inFlight = false;
  }
}

function startPolling() {
  if (intervalId) {
    if (!duplicateStartWarned) {
      console.warn('[useRecentGodPacks] startPolling called while interval already active — singleton guard held');
      duplicateStartWarned = true;
    }
    return;
  }
  // Immediate first fetch, then 30s cadence
  fetchOnce();
  intervalId = setInterval(fetchOnce, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  // Reset breaker on last-unsubscribe too, so a reopened session
  // doesn't inherit a stale paused state.
  consecutiveFailures = 0;
  pausedUntil = 0;
  inFlight = false;
}

/**
 * Hook: subscribe to the singleton poll. Returns the latest godpacks.
 */
export function useRecentGodPacks() {
  const [godpacks, setGodpacks] = useState(latestGodpacks);

  useEffect(() => {
    subscribers.add(setGodpacks);
    // First subscriber kicks off the timer; subsequent subscribers just
    // piggyback on the existing one.
    if (subscribers.size === 1) startPolling();
    // Seed the subscriber with the cached latest snapshot, so a late
    // mount doesn't wait 30s to see data.
    setGodpacks(latestGodpacks);
    return () => {
      subscribers.delete(setGodpacks);
      if (subscribers.size === 0) stopPolling();
    };
  }, []);

  return godpacks;
}

// ── Test hooks (not part of public API) ─────────────────────────────
export const _testing = {
  getState: () => ({
    subscriberCount: subscribers.size,
    hasInterval: intervalId != null,
    latestGodpacks,
    consecutiveFailures,
    pausedUntil,
    inFlight,
  }),
  reset: () => {
    subscribers.clear();
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    latestGodpacks = [];
    consecutiveFailures = 0;
    pausedUntil = 0;
    inFlight = false;
    duplicateStartWarned = false;
  },
  fetchOnce,
  startPolling,
  stopPolling,
};
