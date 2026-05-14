import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { demoAPI } from '../services/api';
import { useTelemetry } from '../context/TelemetryContext';
import { useSystemMode } from '../context/SystemModeContext';
import LeafletMap from '../components/LeafletMap';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const DEMO_REFRESH_MS = 3000;    // 3 s — responsive demo feel

const formatValue = (key, value) => {
  if (value === null || value === undefined) return 'N/A';
  if (key.includes('emperature') || key.includes('Temp')) return `${value.toFixed(1)} °C`;
  if (key.includes('oltage')) return `${value.toFixed(2)} V`;
  if (key.includes('rpm') || key === 'rpm') return `${Math.round(value)} RPM`;
  if (key.includes('speed')) return `${Math.round(value)} km/h`;
  if (key.includes('uel') && key.includes('evel')) return `${value.toFixed(1)}%`;
  if (key.includes('ressure')) return `${value.toFixed(1)} kPa`;
  if (key.includes('oad')) return `${value.toFixed(1)}%`;
  if (key.includes('hrottle')) return `${value.toFixed(1)}%`;
  return typeof value === 'number' ? value.toFixed(2) : String(value);
};

const formatLabel = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());

const VehicleDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bus, setBus] = useState(null);
  const [error, setError] = useState(null);
  const { telemetry, buses } = useTelemetry();
  const { isDemo, isReal } = useSystemMode();

  /* In real mode: get bus from TelemetryContext (MQTT-only).
     In demo mode: poll demo API for this specific bus. */
  useEffect(() => {
    setBus(null);
    setError(null);

    if (isReal) {
      // Real mode — bus comes from TelemetryContext (MQTT data)
      const mqttBus = buses.find(b => b.id === id);
      if (mqttBus) {
        setBus(mqttBus);
      } else {
        setError('This bus is not currently connected via MQTT');
      }
      return;
    }

    // Demo mode — poll for updates
    let intervalId;
    const refresh = async () => {
      try {
        const res = await demoAPI.getDemoBusById(id);
        const nextBus = res.data?.bus || res.data;
        if (nextBus) { setBus(nextBus); setError(null); }
        else { setError('Vehicle not found'); }
      } catch { setError('Failed to load vehicle data'); }
    };
    refresh();
    intervalId = setInterval(refresh, DEMO_REFRESH_MS);
    return () => clearInterval(intervalId);
  }, [id, isDemo, isReal, buses]);

  /* Live telemetry overlay (both modes) */
  useEffect(() => {
    const live = telemetry[id];
    if (!live) return;
    setBus((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        location: live.location || prev.location,
        obd: {
          ...prev.obd,
          parameters: live.parameters || prev.obd?.parameters,
          faultCodes: live.faultCodes || prev.obd?.faultCodes
        }
      };
    });
  }, [telemetry, id]);

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/vehicles')} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Vehicles
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  if (!bus) {
    return <div className="text-center py-12 text-gray-500">Loading vehicle data...</div>;
  }

  const obd = bus.obd?.parameters || {};
  const faults = bus.obd?.faultCodes || [];
  const features = bus.features || {};
  const trips = features.trips || [];
  const maint = features.maintenance || {};
  const driver = features.driverBehavior || {};
  const trend = bus.obdTrend || [];

  const speed = Math.round(obd.speed || 0);
  const fuel = Math.round(obd.fuelLevel || 0);

  const conditionScore = Math.round(
    (obd.fuelLevel > 30 ? 20 : 10) +
    (obd.engineTemperature < 100 ? 20 : 5) +
    (driver.score > 70 ? 20 : 10) +
    (obd.rpm < 2500 ? 15 : 5) +
    (obd.engineLoad < 70 ? 15 : 5) +
    (obd.throttlePosition < 75 ? 10 : 5)
  );
  const conditionLabel = conditionScore > 80 ? 'Good' : conditionScore > 60 ? 'Fair' : 'Needs Attention';
  const conditionColor = conditionScore > 80 ? 'text-green-600' : conditionScore > 60 ? 'text-yellow-600' : 'text-red-600';

  const totalTripDist = trips.reduce((s, t) => s + (t.distance || 0), 0);
  const totalTripDur = trips.reduce((s, t) => s + (t.duration || 0), 0);
  const idleTime = driver.idleTime || 0;

  return (
    <div className="space-y-6">
      {/* Back & Header */}
      <button onClick={() => navigate('/vehicles')} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Vehicles
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{bus.busName}</h1>
          <p className="text-sm text-gray-500">{bus.registrationNumber} &middot; {bus.model || 'N/A'}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
          bus.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        }`}>{bus.status === 'active' ? 'Active' : 'Maintenance'}</span>
      </div>

      {/* Top: Info + Route Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Vehicle Info */}
        <div className="space-y-4">
          {/* Speed & Fuel */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Vehicle Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Speed</p>
                <p className={`text-2xl font-bold ${speed > 60 ? 'text-red-600' : 'text-gray-900'}`}>{speed} km/h</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Driver</p>
                <p className="text-lg font-semibold text-gray-900">{bus.driverName || 'Unassigned'}</p>
              </div>
              <div className="col-span-2">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-500">Fuel Level</span>
                  <span className="font-semibold">{fuel}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className={`h-3 rounded-full transition-all ${fuel > 50 ? 'bg-green-500' : fuel > 20 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${fuel}%` }} />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Route</p>
                <p className="font-semibold text-gray-900">{bus.route || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Mileage</p>
                <p className="font-semibold text-gray-900">{(bus.mileage || 0).toLocaleString()} km</p>
              </div>
            </div>
          </div>

          {/* Condition Analysis */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Condition Analysis</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className={`text-3xl font-bold ${conditionColor}`}>{conditionScore}%</div>
              <div>
                <p className={`font-semibold ${conditionColor}`}>{conditionLabel}</p>
                <p className="text-xs text-gray-500">Based on OBD parameters</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: 'Fuel Efficiency', val: fuel > 30 ? 'Good' : 'Low', ok: fuel > 30 },
                { label: 'Idle Time', val: `${idleTime}%`, ok: idleTime < 25 },
                { label: 'Driver Behavior', val: `${driver.score || 0}%`, ok: (driver.score || 0) > 70 },
                { label: 'Engine RPM', val: `${Math.round(obd.rpm || 0)}`, ok: (obd.rpm || 0) < 2500 },
                { label: 'Coolant Temp', val: `${Math.round(obd.coolantTemp || obd.engineTemperature || 0)}-°C`, ok: (obd.engineTemperature || 0) < 100 },
                { label: 'Engine Load', val: `${Math.round(obd.engineLoad || 0)}%`, ok: (obd.engineLoad || 0) < 70 },
                { label: 'Throttle', val: `${Math.round(obd.throttlePosition || 0)}%`, ok: (obd.throttlePosition || 0) < 75 },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <span className="text-gray-600">{item.label}</span>
                  <span className={`font-semibold ${item.ok ? 'text-green-600' : 'text-red-600'}`}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Route Map */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Route Visualization</h2>
            <div className="h-[320px] rounded-lg overflow-hidden border border-gray-200">
              <LeafletMap buses={[bus]} center={[bus.location?.lat || 28.7041, bus.location?.lng || 77.1025]} zoom={14} />
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full"/>Current Position</span>
              <span>Lat: {(bus.location?.lat || 0).toFixed(4)}</span>
              <span>Lng: {(bus.location?.lng || 0).toFixed(4)}</span>
            </div>
          </div>

          {/* Trip Performance */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Trip Performance</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center border rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-900">{totalTripDist}</p>
                <p className="text-xs text-gray-500">Distance (km)</p>
              </div>
              <div className="text-center border rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-900">{totalTripDur}</p>
                <p className="text-xs text-gray-500">Duration (min)</p>
              </div>
              <div className="text-center border rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-900">{idleTime}%</p>
                <p className="text-xs text-gray-500">Idle Time</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {trips.map(trip => (
                <div key={trip.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                  <div>
                    <span className="font-medium text-gray-900">{trip.start}</span>
                    <span className="text-gray-400 mx-2">&rarr;</span>
                    <span className="font-medium text-gray-900">{trip.end}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">{trip.distance} km</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      trip.status === 'live' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>{trip.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* OBD Diagnostic Data */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4">OBD Diagnostic Data</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(obd).map(([key, val]) => (
            <div key={key} className="border rounded-lg p-3">
              <p className="text-xs text-gray-500 truncate">{formatLabel(key)}</p>
              <p className="font-semibold text-gray-900 mt-1">{formatValue(key, val)}</p>
            </div>
          ))}
        </div>
        {faults.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-red-600 mb-2">Active Fault Codes</p>
            <div className="flex gap-2 flex-wrap">
              {faults.map((f, i) => {
                const label = typeof f === 'string' ? f : f.code || JSON.stringify(f);
                const desc = typeof f === 'object' ? f.desc : null;
                return (
                  <span key={label + i} className="bg-red-50 border border-red-200 text-red-700 px-3 py-1 rounded-full text-xs font-semibold" title={desc || ''}>
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* OBD Trend Chart */}
      {trend.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Parameter Trends</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="engineTemp" stroke="#ef4444" name="Engine Temp (-°C)" dot={false} />
              <Line type="monotone" dataKey="rpm" stroke="#3b82f6" name="RPM" dot={false} />
              <Line type="monotone" dataKey="fuelLevel" stroke="#10b981" name="Fuel (%)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Maintenance Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Maintenance</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Next Service In</span><span className="font-semibold">{maint.nextServiceKm || 0} km</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Last Service</span><span className="font-semibold">{maint.lastServiceDate || 'N/A'}</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Downtime (30d)</span><span className="font-semibold">{maint.downtimeHours || 0} hrs</span></div>
            <div>
              <span className="text-gray-500">Open Issues</span>
              <ul className="list-disc list-inside mt-1 text-gray-700">
                {(maint.openIssues || []).map(issue => <li key={issue}>{issue}</li>)}
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Driver Behavior</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Safety Score</span><span className={`font-semibold ${(driver.score || 0) > 70 ? 'text-green-600' : 'text-red-600'}`}>{driver.score || 0}%</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Overspeed Events</span><span className="font-semibold">{driver.overspeedEvents || 0}</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Harsh Braking</span><span className="font-semibold">{driver.harshBraking || 0}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Idle Time</span><span className="font-semibold">{driver.idleTime || 0}%</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleDetailPage;


