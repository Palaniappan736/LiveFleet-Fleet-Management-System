/**
 * SettingsPage — System configuration panel.
 *
 * MQTT + Cloud connection state comes from ConnectionContext (global, persists
 * across all page navigations). No more local-only state.
 */
import React, { useRef, useState, useCallback } from 'react';
import { useSystemMode } from '../context/SystemModeContext';
import { useConnection } from '../context/ConnectionContext';

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const APPWRITE_PROJECT  = import.meta.env.VITE_APPWRITE_PROJECT_ID || '6999d3e40018ddea5615';

const InputField = ({ label, value, onChange, placeholder, type = 'text', disabled = false }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
    />
  </div>
);

const Dot = ({ status }) => {
  const cls =
    status === 'connected'  ? 'bg-green-500' :
    status === 'connecting' ? 'bg-yellow-400 animate-pulse' :
    status === 'error'      ? 'bg-red-500' : 'bg-gray-400';
  return <span className={`inline-block w-3 h-3 rounded-full ${cls}`} />;
};

const StatusLabel = ({ status }) => {
  if (status === 'connected')  return <span className="text-green-600 font-semibold">Connected</span>;
  if (status === 'connecting') return <span className="text-yellow-600 font-semibold">Connecting…</span>;
  if (status === 'error')      return <span className="text-red-600 font-semibold">Error</span>;
  return <span className="text-gray-500">Disconnected</span>;
};

export const SettingsPage = () => {
  const { mode, locked, updateMode } = useSystemMode();
  const {
    mqttStatus, mqttBusCount, mqttBuses,
    dbStatus, dbLatency,
    mqttConfig, setMqttConfig,
    connect, disconnect, testDb,
    connecting, error: connError,
  } = useConnection();

  const [logs, setLogs] = useState([
    { ts: Date.now(), type: 'system', msg: `LiveFleet Settings loaded — mode: ${mode.toUpperCase()}` },
  ]);
  const [saved, setSaved] = useState(false);
  const logsEndRef = useRef(null);

  const addLog = useCallback((type, msg) => {
    setLogs(prev => [...prev.slice(-200), { ts: Date.now(), type, msg }]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const handleModeSwitch = async (newMode) => {
    if (newMode === mode) return;
    await updateMode(newMode);
    addLog('system', `Mode switched to ${newMode.toUpperCase()}`);
  };

  const handleConnect = async () => {
    addLog('mqtt', `Connecting to ${mqttConfig.brokerUrl}…`);
    await connect();
    addLog(connError ? 'error' : 'mqtt',
      connError ? `Connection failed: ${connError}` : 'Connection initiated — waiting for broker…');
  };

  const handleDisconnect = async () => {
    addLog('mqtt', 'Disconnecting MQTT…');
    await disconnect();
    addLog('mqtt', 'MQTT disconnected');
  };

  const handleTestDb = async () => {
    addLog('appwrite', 'Testing Appwrite connectivity…');
    await testDb();
    addLog(dbStatus === 'error' ? 'error' : 'appwrite',
      dbStatus === 'connected'
        ? `Appwrite connected — latency ${dbLatency ?? '?'}ms`
        : 'Appwrite connectivity test failed');
  };

  const handleSave = () => {
    setSaved(true);
    addLog('system', 'Settings saved');
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">System configuration and connection management</p>
        </div>
        <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition">
          Save Settings
        </button>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm font-medium">
          Settings saved!
        </div>
      )}

      {/* ── System Mode ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">System Mode</h2>
        <p className="text-sm text-gray-500 mb-4">
          Demo simulates fleet data locally. Real mode requires MQTT + Cloud below.
        </p>
        {locked && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm rounded-lg p-3 mb-4">
            Real mode is locked by server configuration.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              val: 'demo', label: 'Demo Mode',
              desc: '10 simulated buses, 25+ OBD-II PIDs updating every 3s. No connections required.',
              active: 'border-blue-600 bg-blue-50', dot: 'border-blue-600 bg-blue-600',
            },
            {
              val: 'real', label: 'Real Mode',
              desc: 'Live OBD-II data from real buses via MQTT. Persisted to cloud every 3 minutes.',
              active: 'border-green-600 bg-green-50', dot: 'border-green-600 bg-green-600',
            },
          ].map(opt => (
            <button
              key={opt.val}
              onClick={() => handleModeSwitch(opt.val)}
              disabled={locked && opt.val === 'real'}
              className={`border-2 rounded-xl p-5 text-left transition disabled:opacity-50
                ${mode === opt.val ? opt.active : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                  ${mode === opt.val ? opt.dot : 'border-gray-400'}`}>
                  {mode === opt.val && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <span className="font-bold text-gray-900">{opt.label}</span>
              </div>
              <p className="text-sm text-gray-500 ml-7">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── MQTT Broker ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">MQTT Broker Connection</h2>
            <p className="text-sm text-gray-500">Real-time OBD-II telemetry from your bus fleet</p>
          </div>
          <div className="flex items-center gap-2">
            <Dot status={mqttStatus} />
            <StatusLabel status={mqttStatus} />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 mb-4 text-xs text-blue-700">
          Connection is managed globally — navigating to other pages will not disconnect.
        </div>

        {mqttStatus === 'connected' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-sm">
            <div className="flex flex-wrap gap-6">
              <div><span className="text-gray-500">Buses via MQTT:</span>{' '}
                <span className="font-bold text-green-700">{mqttBusCount}</span>
              </div>
              {mqttBuses.length > 0 && (
                <div><span className="text-gray-500">Active:</span>{' '}
                  <span className="font-semibold text-green-700">{mqttBuses.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {connError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm font-medium">
            {connError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <InputField
            label="Broker URL" value={mqttConfig.brokerUrl}
            onChange={v => setMqttConfig({ brokerUrl: v })}
            placeholder="broker.hivemq.com" disabled={mqttStatus === 'connected'} />
          <InputField
            label="Port" value={mqttConfig.port}
            onChange={v => setMqttConfig({ port: v })}
            placeholder="1883" disabled={mqttStatus === 'connected'} />
          <InputField
            label="Username" value={mqttConfig.username}
            onChange={v => setMqttConfig({ username: v })}
            placeholder="(optional)" disabled={mqttStatus === 'connected'} />
          <InputField
            label="Password" value={mqttConfig.password}
            onChange={v => setMqttConfig({ password: v })}
            type="password" placeholder="(optional)" disabled={mqttStatus === 'connected'} />
          <InputField
            label="Topics (comma-separated)" value={mqttConfig.topic}
            onChange={v => setMqttConfig({ topic: v })}
            placeholder="fleet/+/telemetry,fleet/+/obd" disabled={mqttStatus === 'connected'} />
        </div>

        <div className="flex gap-3">
          {mqttStatus !== 'connected' ? (
            <button
              onClick={handleConnect}
              disabled={connecting || !mqttConfig.brokerUrl}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition flex items-center gap-2"
            >
              {connecting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  Connecting…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Connect to MQTT Broker
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Disconnect MQTT
            </button>
          )}
        </div>
      </div>

      {/* ── Appwrite Database ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Appwrite Cloud Database</h2>
            <p className="text-sm text-gray-500">Authentication and fleet database backend</p>
          </div>
          <div className="flex items-center gap-2">
            <Dot status={dbStatus} />
            <StatusLabel status={dbStatus} />
            {dbStatus === 'connected' && dbLatency && (
              <span className="text-xs text-gray-400 ml-1">{dbLatency}ms</span>
            )}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 space-y-2 mb-4">
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Endpoint:</span>
            <code className="text-blue-700 text-xs break-all">{APPWRITE_ENDPOINT}</code>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Project ID:</span>
            <code className="text-blue-700 text-xs">{APPWRITE_PROJECT}</code>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Database:</span>
            <code className="text-blue-700 text-xs">livefleet</code>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Collections:</span>
            <code className="text-blue-700 text-xs">buses, users, obd_history</code>
          </div>
        </div>

        <button
          onClick={handleTestDb}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
          Test Database Connectivity
        </button>
      </div>

      {/* ── Demo info (demo mode only) ───────────────────────────────── */}
      {mode === 'demo' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Demo Data Engine</h2>
          <p className="text-sm text-gray-500">
            10 buses · 25+ OBD-II PIDs · realistic jitter every 3s · no connection required.
          </p>
        </div>
      )}

      {/* ── System Logs ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">System Logs</h2>
          <button onClick={() => setLogs([])} className="text-sm text-gray-500 hover:text-gray-700">
            Clear
          </button>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 h-56 overflow-y-auto font-mono text-xs leading-relaxed">
          {logs.length === 0
            ? <p className="text-gray-500">No logs.</p>
            : logs.map((log, i) => (
                <div key={i} className="text-gray-300 mb-0.5">
                  <span className="text-gray-600">[{new Date(log.ts).toLocaleTimeString()}]</span>{' '}
                  <span className={
                    log.type === 'error'    ? 'text-red-400'    :
                    log.type === 'mqtt'     ? 'text-green-400'  :
                    log.type === 'appwrite' ? 'text-orange-400' : 'text-gray-400'
                  }>
                    [{log.type.toUpperCase()}]
                  </span>{' '}
                  <span className={log.type === 'error' ? 'text-red-300' : 'text-gray-300'}>
                    {log.msg}
                  </span>
                </div>
              ))
          }
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
