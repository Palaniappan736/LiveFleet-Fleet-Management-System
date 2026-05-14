/**
 * ConnectionBar — Sticky header bar visible on all manager pages in real mode.
 *
 * Shows live MQTT + Appwrite status.
 * "Connect" button opens an inline panel — no page navigation needed.
 * State comes from ConnectionContext so it NEVER resets on page switch.
 */
import React, { useState } from 'react';
import { useConnection } from '../context/ConnectionContext';
import { useSystemMode } from '../context/SystemModeContext';
import { useAuth } from '../context/AuthContext';

const Dot = ({ status }) => {
  const cls =
    status === 'connected'   ? 'bg-green-500' :
    status === 'connecting'  ? 'bg-yellow-400 animate-pulse' :
    status === 'error'       ? 'bg-red-500' :
    'bg-gray-400';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls} flex-shrink-0`} />;
};

const StatusLabel = ({ status }) => {
  if (status === 'connected')  return <span className="text-green-600 font-semibold">Connected</span>;
  if (status === 'connecting') return <span className="text-yellow-600 font-semibold">Connecting…</span>;
  if (status === 'error')      return <span className="text-red-600 font-semibold">Error</span>;
  return <span className="text-gray-500">Disconnected</span>;
};

export function ConnectionBar() {
  const { isReal, isDemo } = useSystemMode();
  const { user } = useAuth();
  const {
    mqttStatus, mqttBusCount, mqttBuses,
    dbStatus, dbLatency,
    mqttConfig, setMqttConfig,
    connect, disconnect, testDb,
    connecting, error,
  } = useConnection();

  const [open, setOpen] = useState(false);

  // Only show for managers/admins — students have no connections to manage
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  if (!isManager) return null;

  // In demo mode show a small informational chip only
  if (isDemo) {
    return (
      <div className="bg-blue-50 border-b border-blue-100 px-4 py-1.5 flex items-center gap-2 text-xs text-blue-700">
        <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
        Demo Mode — simulated data, no live connections required
      </div>
    );
  }

  // ── Real mode bar ────────────────────────────────────────────────────
  return (
    <div className="bg-gray-950 text-white border-b border-gray-800">
      {/* Status row */}
      <div className="px-4 py-2 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {/* MQTT status */}
        <div className="flex items-center gap-1.5 text-xs">
          <Dot status={mqttStatus} />
          <span className="text-gray-400">MQTT:</span>
          <StatusLabel status={mqttStatus} />
          {mqttStatus === 'connected' && mqttBusCount > 0 && (
            <span className="text-gray-400 ml-1">({mqttBusCount} bus{mqttBusCount !== 1 ? 'es' : ''})</span>
          )}
        </div>

        {/* Divider */}
        <span className="text-gray-700 hidden sm:inline">|</span>

        {/* Appwrite status */}
        <div className="flex items-center gap-1.5 text-xs">
          <Dot status={dbStatus} />
          <span className="text-gray-400">Cloud DB:</span>
          <StatusLabel status={dbStatus} />
          {dbStatus === 'connected' && dbLatency && (
            <span className="text-gray-500 ml-1">{dbLatency}ms</span>
          )}
          <button
            onClick={testDb}
            className="ml-1 text-gray-500 hover:text-gray-300 transition text-xs underline underline-offset-2"
          >
            test
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        {mqttStatus === 'connected' ? (
          <button
            onClick={disconnect}
            className="text-xs px-3 py-1 rounded bg-red-800 hover:bg-red-700 text-red-200 transition font-medium"
          >
            Disconnect MQTT
          </button>
        ) : (
          <button
            onClick={() => setOpen(o => !o)}
            className="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition font-semibold flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Connect MQTT & Cloud
          </button>
        )}
      </div>

      {/* Expanded connect form */}
      {open && mqttStatus !== 'connected' && (
        <div className="border-t border-gray-800 bg-gray-900 px-4 py-4">
          <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">MQTT Broker Configuration</p>

          {error && (
            <div className="mb-3 text-xs text-red-400 bg-red-900/30 border border-red-800 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-3">
            <div className="col-span-2 sm:col-span-1 lg:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Broker URL</label>
              <input
                value={mqttConfig.brokerUrl}
                onChange={e => setMqttConfig({ brokerUrl: e.target.value })}
                placeholder="broker.hivemq.com"
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-green-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Port</label>
              <input
                value={mqttConfig.port}
                onChange={e => setMqttConfig({ port: e.target.value })}
                placeholder="1883"
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-green-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Username</label>
              <input
                value={mqttConfig.username}
                onChange={e => setMqttConfig({ username: e.target.value })}
                placeholder="optional"
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-green-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Password</label>
              <input
                type="password"
                value={mqttConfig.password}
                onChange={e => setMqttConfig({ password: e.target.value })}
                placeholder="optional"
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-green-500 outline-none"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">Topics (comma-separated)</label>
            <input
              value={mqttConfig.topic}
              onChange={e => setMqttConfig({ topic: e.target.value })}
              placeholder="fleet/+/telemetry,fleet/+/obd"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-green-500 outline-none"
            />
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={connect}
              disabled={connecting || !mqttConfig.brokerUrl}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-1.5 rounded transition flex items-center gap-1.5"
            >
              {connecting ? (
                <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Connecting…</>
              ) : (
                'Connect'
              )}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-gray-300 text-xs transition px-2"
            >
              Cancel
            </button>
            {mqttStatus === 'connecting' && (
              <span className="text-yellow-400 text-xs animate-pulse">Waiting for broker response…</span>
            )}
          </div>
        </div>
      )}

      {/* Connected — show active buses */}
      {mqttStatus === 'connected' && mqttBuses.length > 0 && (
        <div className="border-t border-gray-800 px-4 py-1.5 flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-gray-500">Live buses:</span>
          {mqttBuses.map(id => (
            <span key={id} className="bg-green-900/60 text-green-300 text-xs px-2 py-0.5 rounded-full border border-green-800">{id}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default ConnectionBar;
