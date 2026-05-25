/**
 * computeAutoRestartState — canonical selector for the effective
 * container auto-restart authority (2026-04-24).
 *
 * Replaces the prior split between:
 *   - env-only check `engine.autoRetryFlag` (used by Hunt Ops banner)
 *   - mode-derived `effectiveAutoRetryEnabled` (used by Fleet Health)
 * which showed operators two contradicting truths on sibling pages.
 *
 * Contract: "effective" = envEnabled OR modeAllows. The recovery mode
 * can ALWAYS override an env=0 per Phase 25H on the backend; the env
 * flag cannot block a mode that authorizes execution. We mirror that
 * logic here so UI reasoning matches runtime behavior 1:1.
 *
 * Usage (pattern for every consumer):
 *   const autoRestart = computeAutoRestartState(recoveryData)
 *   if (autoRestart.effective) { ... }
 *   if (autoRestart.isOverride) { // yellow "ENABLED (override)" pill }
 *
 * Inputs: the `/admin/recovery/container-status` payload, which now
 * carries the canonical `autoRestart` object. When present we pass it
 * through unchanged. When absent (stale backend), we best-effort
 * recompute from engine.autoRetryFlag + effectiveAutoRetryEnabled so
 * no page renders blank during a partial rollout.
 */

const AUTO_RESTART_LABELS = {
  enabled:  'Auto-restart: ENABLED',
  override: 'Auto-restart: ENABLED (Recovery Mode Override)',
  off:      'Auto-restart: OFF',
  unknown:  'Auto-restart: UNKNOWN',
}

const AUTO_RESTART_SUBTEXT = {
  enabled:  '',
  override: 'Env flag is OFF but recovery mode permits restart actions.',
  off:      'Manual intervention required.',
  unknown:  'Recovery status could not be determined.',
}

/**
 * @param {object|null} recovery — /admin/recovery/container-status payload
 * @returns {{ effective, envEnabled, modeAllows, isOverride,
 *             state: 'enabled'|'override'|'off'|'unknown',
 *             label: string, subtext: string }}
 */
export function computeAutoRestartState(recovery) {
  if (!recovery) {
    return {
      effective: false, envEnabled: false, modeAllows: false, isOverride: false,
      state: 'unknown',
      label: AUTO_RESTART_LABELS.unknown,
      subtext: AUTO_RESTART_SUBTEXT.unknown,
    }
  }
  // Prefer the canonical block when the backend provides it.
  let envEnabled, modeAllows
  if (recovery.autoRestart) {
    envEnabled = !!recovery.autoRestart.envEnabled
    modeAllows = !!recovery.autoRestart.modeAllows
  } else {
    // Fallback for older backend builds that only expose pieces.
    envEnabled = !!(recovery.engine && recovery.engine.autoRetryFlag)
    // `effectiveAutoRetryEnabled` on the admin route is mode-derived,
    // so it's a valid modeAllows proxy when autoRestart is missing.
    modeAllows = !!recovery.effectiveAutoRetryEnabled && !envEnabled
                 || !!recovery.effectiveAutoRetryEnabled
  }
  const effective  = envEnabled || modeAllows
  const isOverride = !envEnabled && modeAllows
  const state = !effective ? 'off'
             : isOverride   ? 'override'
             :                'enabled'
  return {
    effective, envEnabled, modeAllows, isOverride,
    state,
    label:   AUTO_RESTART_LABELS[state],
    subtext: AUTO_RESTART_SUBTEXT[state],
  }
}

// Tooltip copy — high-value single string, kept here so every consumer
// uses the identical wording.
export const AUTO_RESTART_TOOLTIP =
  'Auto-restart is controlled by both environment config and recovery mode. '
  + 'Recovery mode can override env settings.'
