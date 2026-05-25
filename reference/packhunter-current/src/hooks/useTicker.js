/**
 * useTicker — Wave 3
 *
 * Single shared 1-second timer for every component that needs to
 * re-render once per second (countdown UIs: trade timers, stamina
 * regen, request age). Previously each consumer ran its own
 * `setInterval(setTick, 1000)`. With 10 trade cards mounted that meant
 * 10 timers, 10 separate setState chains, 10 independent re-render
 * batches per second.
 *
 * Now: ONE module-level `setInterval` shared across all subscribers.
 * The interval is created on the first subscriber and cleared when the
 * last subscriber unmounts. Re-renders are still per-component (each
 * subscriber gets its own setState), but the wall clock is shared.
 *
 * Usage:
 *   const tick = useTicker()                  // re-render every 1s
 *   const tick = useTicker({ enabled: !done })// gated subscription
 *
 * Returned `tick` is a monotonically increasing integer — useful for
 * memo deps (`useMemo(() => …, [tick, …])`) when you want to recompute
 * on each tick. If the component just needs to re-render, the value
 * itself can be ignored.
 */

import { useEffect, useState } from 'react';

// Module-level shared timer state
const subscribers = new Set();
let tickInterval = null;
let globalTick = 0;

function emitTick() {
  globalTick++;
  // Snapshot to avoid mutation-during-iteration if a subscriber
  // unsubscribes itself in its callback.
  for (const sub of [...subscribers]) {
    try { sub(globalTick); } catch (e) { /* keep going */ }
  }
}

function startIntervalIfNeeded() {
  if (tickInterval || subscribers.size === 0) return;
  tickInterval = setInterval(emitTick, 1000);
}

function stopIntervalIfIdle() {
  if (tickInterval && subscribers.size === 0) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

/**
 * Subscribe to the shared 1s ticker. Returns the current tick count.
 * @param {{ enabled?: boolean }} [opts] - if enabled === false, no
 *   subscription is created and the returned value never changes.
 */
export function useTicker(opts = {}) {
  const enabled = opts.enabled !== false;
  const [tick, setTick] = useState(globalTick);

  useEffect(() => {
    if (!enabled) return;
    const sub = (n) => setTick(n);
    subscribers.add(sub);
    startIntervalIfNeeded();
    return () => {
      subscribers.delete(sub);
      stopIntervalIfIdle();
    };
  }, [enabled]);

  return tick;
}

// ── Test exports (don't depend on React) ──────────────────────────────
export const _testing = {
  subscribers,
  getInterval: () => tickInterval,
  emitTick,           // manual tick for tests
  reset: () => {
    subscribers.clear();
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
    globalTick = 0;
  },
};
