/**
 * Phase 19 — frontend route timer.
 *
 * Pages opt in by calling `routeTimer(routePath)` and then `.mark('firstRender')`,
 * `.mark('firstData')`, `.mark('hydrated')` at the right moments. When
 * `hydrated` is reported, the timer POSTs to /api/admin/health/route-perf
 * IFF total > threshold. The backend engine decides whether to record a
 * SCHEDULER_ROUTE_SLOW finding — frontend never decides "is this slow", it
 * only reports the timing.
 *
 * Failure semantics: any network error swallowed silently. Health reporting
 * must NEVER affect user-facing behavior.
 *
 * Use:
 *   const timer = routeTimer('/admin/scheduler')
 *   useEffect(() => { timer.mark('firstRender') }, [])
 *   useEffect(() => { if (data) timer.mark('firstData') }, [data])
 *   useEffect(() => { if (!loading) timer.mark('hydrated') }, [loading])
 */

const REPORT_THRESHOLD_MS = 1500;  // below this, never bother the backend
const now = () => (typeof performance !== 'undefined' && performance.now)
  ? performance.now()
  : Date.now();

export function routeTimer(routePath) {
  const t0 = now();
  const marks = { routeEnter: 0 };
  let reported = false;

  const mark = (label) => {
    if (marks[label] != null) return;
    marks[label] = Math.round(now() - t0);
    if (label === 'hydrated') maybeReport();
  };

  const maybeReport = async () => {
    if (reported) return;
    reported = true;
    const hydratedMs = marks.hydrated;
    if (typeof console !== 'undefined' && console.debug) {
      console.debug(`[routeTimer] ${routePath} hydrated in ${hydratedMs}ms`, marks);
    }
    if (hydratedMs < REPORT_THRESHOLD_MS) return;

    try {
      const token = (typeof localStorage !== 'undefined') ? localStorage.getItem('token') : null;
      if (!token) return;
      // Fire-and-forget. AbortController in case the page unloads mid-flight.
      const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      if (ctrl) setTimeout(() => ctrl.abort(), 4000);
      await fetch('/api/admin/health/route-perf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ routePath, hydratedMs, marks }),
        signal: ctrl?.signal,
      });
    } catch {
      // silent — perf reporting must not break the page
    }
  };

  return { mark, marks: () => ({ ...marks }) };
}

export const ROUTE_TIMER_REPORT_THRESHOLD_MS = REPORT_THRESHOLD_MS;
