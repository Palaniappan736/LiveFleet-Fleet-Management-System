import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelemetry } from '../context/TelemetryContext';
import { useSystemMode } from '../context/SystemModeContext';

const generateAlerts = (buses) => {
  const alerts = [];
  const now = Date.now();

  buses.forEach((bus) => {
    const obd = bus.obd?.parameters || {};
    const driver = bus.features?.driverBehavior || {};

    if (obd.speed > 80) {
      alerts.push({
        id: `${bus.id}-overspeed`,
        vehicleId: bus.id,
        vehicleName: bus.busName,
        registration: bus.registrationNumber,
        type: 'Overspeed',
        severity: 'critical',
        message: `Vehicle is moving at ${Math.round(obd.speed)} km/h — exceeds 80 km/h limit`,
        timestamp: now - Math.round(Math.random() * 300000),
      });
    }

    if (obd.fuelLevel < 20) {
      alerts.push({
        id: `${bus.id}-lowfuel`,
        vehicleId: bus.id,
        vehicleName: bus.busName,
        registration: bus.registrationNumber,
        type: 'Low Fuel',
        severity: obd.fuelLevel < 10 ? 'critical' : 'warning',
        message: `Fuel level at ${Math.round(obd.fuelLevel)}% — refueling recommended`,
        timestamp: now - Math.round(Math.random() * 600000),
      });
    }

    if (obd.engineTemperature > 100) {
      alerts.push({
        id: `${bus.id}-overtemp`,
        vehicleId: bus.id,
        vehicleName: bus.busName,
        registration: bus.registrationNumber,
        type: 'Engine Overheating',
        severity: obd.engineTemperature > 110 ? 'critical' : 'warning',
        message: `Engine temperature at ${Math.round(obd.engineTemperature)}°C — exceeds safe threshold`,
        timestamp: now - Math.round(Math.random() * 400000),
      });
    }

    if (bus.status !== 'active') {
      alerts.push({
        id: `${bus.id}-offline`,
        vehicleId: bus.id,
        vehicleName: bus.busName,
        registration: bus.registrationNumber,
        type: 'Vehicle Offline',
        severity: 'info',
        message: `Vehicle is currently ${bus.status || 'offline'}`,
        timestamp: now - Math.round(Math.random() * 1200000),
      });
    }

    if ((bus.obd?.faultCodes || []).length > 0) {
      alerts.push({
        id: `${bus.id}-dtc`,
        vehicleId: bus.id,
        vehicleName: bus.busName,
        registration: bus.registrationNumber,
        type: 'Diagnostic Trouble Code',
        severity: 'warning',
        message: `Active fault codes: ${bus.obd.faultCodes.map(f => f.code).join(', ')}`,
        timestamp: now - Math.round(Math.random() * 900000),
      });
    }

    if (driver.harshBraking > 3) {
      alerts.push({
        id: `${bus.id}-harshbrake`,
        vehicleId: bus.id,
        vehicleName: bus.busName,
        registration: bus.registrationNumber,
        type: 'Harsh Braking',
        severity: 'warning',
        message: `Driver has ${driver.harshBraking} harsh braking events — review needed`,
        timestamp: now - Math.round(Math.random() * 500000),
      });
    }

    if (obd.rpm > 4000) {
      alerts.push({
        id: `${bus.id}-highrpm`,
        vehicleId: bus.id,
        vehicleName: bus.busName,
        registration: bus.registrationNumber,
        type: 'High RPM',
        severity: 'warning',
        message: `Engine RPM at ${Math.round(obd.rpm)} — above optimal range`,
        timestamp: now - Math.round(Math.random() * 700000),
      });
    }
  });

  return alerts.sort((a, b) => b.timestamp - a.timestamp);
};

const severityConfig = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700', icon: '🔴' },
  warning:  { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700', icon: '🟡' },
  info:     { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', icon: '🔵' },
};

const timeAgo = (ts) => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const AlertsPage = () => {
  const { buses, error, loading } = useTelemetry();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { isReal } = useSystemMode();

  const allAlerts = generateAlerts(buses);

  const filtered = allAlerts.filter(a => {
    if (filter !== 'all' && a.severity !== filter) return false;
    if (search && !a.vehicleName.toLowerCase().includes(search.toLowerCase()) &&
        !a.registration.toLowerCase().includes(search.toLowerCase()) &&
        !a.type.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: allAlerts.length,
    critical: allAlerts.filter(a => a.severity === 'critical').length,
    warning: allAlerts.filter(a => a.severity === 'warning').length,
    info: allAlerts.filter(a => a.severity === 'info').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time fleet alert monitoring</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>}

      {/* Real mode — no MQTT buses connected */}
      {isReal && !loading && buses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
          </svg>
          <p className="text-lg font-semibold text-gray-700">Not connected to any buses</p>
          <p className="text-sm text-gray-400 mt-1">Connect your MQTT broker to see real-time alerts from connected buses.</p>
        </div>
      ) : (
      <>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { key: 'all', label: 'Total Alerts', color: 'bg-gray-900 text-white' },
          { key: 'critical', label: 'Critical', color: 'bg-red-600 text-white' },
          { key: 'warning', label: 'Warning', color: 'bg-yellow-500 text-white' },
          { key: 'info', label: 'Info', color: 'bg-blue-500 text-white' },
        ].map(card => (
          <button
            key={card.key}
            onClick={() => setFilter(card.key)}
            className={`rounded-xl p-4 text-left transition shadow-sm ${
              filter === card.key ? card.color : 'bg-white border border-gray-100 hover:border-gray-300'
            }`}
          >
            <p className={`text-2xl font-bold ${filter === card.key ? '' : 'text-gray-900'}`}>{counts[card.key]}</p>
            <p className={`text-sm ${filter === card.key ? 'opacity-80' : 'text-gray-500'}`}>{card.label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search alerts by vehicle name, registration, or type..."
          className="flex-1 outline-none text-sm"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            <p className="text-lg font-medium">No alerts found</p>
            <p className="text-sm mt-1">All systems operating normally</p>
          </div>
        ) : (
          filtered.map(alert => {
            const cfg = severityConfig[alert.severity] || severityConfig.info;
            return (
              <div key={alert.id} className={`${cfg.bg} ${cfg.border} border rounded-xl p-4 flex items-start gap-4`}>
                <span className="text-xl mt-0.5">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>{alert.type}</span>
                    <span className="text-xs text-gray-500">{timeAgo(alert.timestamp)}</span>
                  </div>
                  <p className={`text-sm font-medium ${cfg.text}`}>{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    <span
                      className="font-semibold text-blue-600 cursor-pointer hover:underline"
                      onClick={() => navigate(`/vehicles/${alert.vehicleId}`)}
                    >
                      {alert.vehicleName}
                    </span>
                    {' '}&middot; {alert.registration}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/vehicles/${alert.vehicleId}`)}
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                  title="View vehicle"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            );
          })
        )}
      </div>
      </>
      )}
    </div>
  );
};

export default AlertsPage;
