/**
 * SystemModeContext — Global Demo / Real mode toggle.
 * Exposes { mode, setMode, isDemo, isReal } to all components.
 * Persisted in localStorage so the state survives page refresh.
 */
import { createContext, useContext, useState, useCallback } from "react";

const SystemModeContext = createContext(null);

export function SystemModeProvider({ children }) {
  const [mode, setModeState] = useState(
    () => localStorage.getItem("fleetMode") || "demo"
  );

  const setMode = useCallback((m) => {
    const next = m === "real" ? "real" : "demo";
    localStorage.setItem("fleetMode", next);
    setModeState(next);
  }, []);

  // updateMode — async alias used by SettingsPage; always resolves to true
  const updateMode = useCallback(async (m) => {
    setMode(m);
    return true;
  }, [setMode]);

  return (
    <SystemModeContext.Provider
      value={{
        mode,
        setMode,
        updateMode,
        locked: false,         // no lock in demo; real mode could gate this
        isDemo: mode === "demo",
        isReal: mode === "real",
      }}
    >
      {children}
    </SystemModeContext.Provider>
  );
}

export function useSystemMode() {
  const ctx = useContext(SystemModeContext);
  if (!ctx) throw new Error("useSystemMode must be inside <SystemModeProvider>");
  return ctx;
}

export default SystemModeContext;
