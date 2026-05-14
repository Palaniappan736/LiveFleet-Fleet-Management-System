/**
 * systemModeService.js
 * ─────────────────────────────────────────────────────────────────
 * Determines the backend operating mode (demo / real).
 *
 * Mode sources (priority):
 *   1. DEMO_ONLY=true env var → locked to demo (cannot override)
 *   2. Runtime override via setSystemMode() (called from Settings API)
 *   3. Default → 'real'
 *
 * Demo logins are ALWAYS allowed so students can toggle modes freely.
 */

let runtimeMode = null; // null = use env, 'demo' | 'real' = override

export const isDemoMode = () => {
  if (process.env.DEMO_ONLY === 'true') return true;
  if (runtimeMode) return runtimeMode === 'demo';
  return false;
};

// Demo tokens always accepted — students & managers can use demo mode anytime
export const isDemoLoginAllowed = () => true;

export const getSystemMode = () => (isDemoMode() ? 'demo' : 'real');

export const setSystemMode = (mode) => {
  if (process.env.DEMO_ONLY === 'true') return false; // locked by env
  runtimeMode = mode === 'demo' ? 'demo' : 'real';
  console.log(`[system] Mode changed to: ${runtimeMode}`);
  return true;
};
