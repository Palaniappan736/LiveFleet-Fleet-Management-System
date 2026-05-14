/**
 * ConnectionContext — Global MQTT + Appwrite connection state.
 *
 * Lives at the top of the provider tree so it NEVER resets on page navigation.
 * All manager pages read connection status from here.
 *
 * Exposes:
 *   mqttStatus     — 'connected' | 'connecting' | 'disconnected'
 *   mqttBusCount   — number of buses seen via MQTT
 *   mqttBuses      — array of bus IDs
 *   dbStatus       — 'connected' | 'error' | 'unknown'
 *   dbLatency      — ms or null
 *   mqttConfig     — { brokerUrl, port, username, password, topic }
 *   setMqttConfig  — update config fields
 *   connect()      — call backend /mqtt/connect
 *   disconnect()   — call backend /mqtt/disconnect
 *   testDb()       — call backend /db/status
 *   connecting     — boolean, request in-flight
 *   error          — last error string or null
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { mqttAPI } from '../services/api';
import { useSystemMode } from './SystemModeContext';

const ConnectionContext = createContext(null);

const POLL_MS = 5000; // poll backend MQTT status every 5 s in real mode

export function ConnectionProvider({ children }) {
  const { isReal } = useSystemMode();

  const [mqttStatus,   setMqttStatus]   = useState('disconnected');
  const [mqttBusCount, setMqttBusCount] = useState(0);
  const [mqttBuses,    setMqttBuses]    = useState([]);
  const [dbStatus,     setDbStatus]     = useState('unknown');
  const [dbLatency,    setDbLatency]    = useState(null);
  const [connecting,   setConnecting]   = useState(false);
  const [error,        setError]        = useState(null);

  // Persisted config (survives page switch via state; localStorage keeps it across refresh)
  const [mqttConfig, setMqttConfigState] = useState(() => {
    try {
      const saved = localStorage.getItem('mqttConfig');
      return saved ? JSON.parse(saved) : {
        brokerUrl: '', port: '1883', username: '', password: '',
        topic: 'fleet/+/telemetry,fleet/+/obd',
      };
    } catch { return { brokerUrl: '', port: '1883', username: '', password: '', topic: 'fleet/+/telemetry,fleet/+/obd' }; }
  });

  const setMqttConfig = useCallback((patch) => {
    setMqttConfigState(prev => {
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
      localStorage.setItem('mqttConfig', JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Poll backend MQTT status (always, so status bar stays current) ───
  const pollRef = useRef(null);

  const pollStatus = useCallback(async () => {
    try {
      const res = await mqttAPI.getStatus();
      const s = res.data;
      setMqttStatus(s.connected ? 'connected' : s.configured ? 'connecting' : 'disconnected');
      setMqttBusCount(s.busCount || 0);
      setMqttBuses(s.connectedBuses || []);
      // Backfill brokerUrl if backend reports one and we have none
      if (s.brokerUrl && !mqttConfig.brokerUrl) {
        setMqttConfig({ brokerUrl: s.brokerUrl });
      }
    } catch { /* backend unreachable — leave state as-is */ }
  }, [mqttConfig.brokerUrl, setMqttConfig]);

  useEffect(() => {
    pollStatus();
    pollRef.current = setInterval(pollStatus, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [pollStatus]);

  // ── Connect to MQTT broker via backend ────────────────────────────────
  const connect = useCallback(async () => {
    if (!mqttConfig.brokerUrl) { setError('Broker URL is required'); return; }
    setConnecting(true);
    setError(null);
    setMqttStatus('connecting');

    try {
      const url = mqttConfig.brokerUrl.includes('://')
        ? mqttConfig.brokerUrl
        : `mqtt://${mqttConfig.brokerUrl}:${mqttConfig.port || '1883'}`;

      const res = await mqttAPI.connect({
        brokerUrl: url,
        username:  mqttConfig.username || undefined,
        password:  mqttConfig.password || undefined,
        topic:     mqttConfig.topic || 'fleet/+/telemetry,fleet/+/obd',
      });
      const d = res.data;
      if (d.success) {
        const s = d.status || {};
        setMqttStatus(s.connected ? 'connected' : 'connecting');
        setMqttBusCount(s.busCount || 0);
        setMqttBuses(s.connectedBuses || []);
        setError(null);
      } else {
        setMqttStatus('disconnected');
        setError(d.error || 'Connection failed');
      }
    } catch (e) {
      setMqttStatus('disconnected');
      setError(e.response?.data?.error || e.message);
    } finally {
      setConnecting(false);
    }
  }, [mqttConfig]);

  // ── Disconnect from MQTT broker ───────────────────────────────────────
  const disconnect = useCallback(async () => {
    try {
      await mqttAPI.disconnect();
      setMqttStatus('disconnected');
      setMqttBusCount(0);
      setMqttBuses([]);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // ── Test Appwrite DB ──────────────────────────────────────────────────
  const testDb = useCallback(async () => {
    setDbStatus('connecting');
    try {
      const res = await mqttAPI.getDbStatus();
      const d = res.data;
      setDbStatus(d.ok ? 'connected' : 'error');
      setDbLatency(d.latencyMs || null);
    } catch {
      setDbStatus('error');
      setDbLatency(null);
    }
  }, []);

  // Auto-test DB once on mount
  useEffect(() => { testDb(); }, [testDb]);

  return (
    <ConnectionContext.Provider value={{
      mqttStatus, mqttBusCount, mqttBuses,
      dbStatus, dbLatency,
      mqttConfig, setMqttConfig,
      connect, disconnect, testDb,
      connecting, error,
    }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error('useConnection must be inside <ConnectionProvider>');
  return ctx;
}

export default ConnectionContext;
