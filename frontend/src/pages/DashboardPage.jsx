import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelemetry } from '../context/TelemetryContext';
import { useSystemMode } from '../context/SystemModeContext';
import LeafletMap from '../components/LeafletMap';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const DashboardPage = () => {
  /* TelemetryContext is the SINGLE source of truth:
     Demo mode → demo buses,  Real mode → MQTT-only buses */
  const { buses: displayBuses, error, loading } = useTelemetry();
  const { isReal } = useSystemMode();
  const navigate = useNavigate();

  const activeBuses = useMemo(() => displayBuses.filter(b => b.status === 'active'), [displayBuses]);
  const avgSpeed = useMemo(() => {
    if (activeBuses.length === 0) return 0;
    const total = activeBuses.reduce((s, b) => s + (b.obd?.parameters?.speed || 0), 0);
    return Math.round(total / activeBuses.length);
  }, [activeBuses]);
  const dailyMileage = useMemo(() => Math.round(avgSpeed * 8 * activeBuses.length), [avgSpeed, activeBuses]);

  const fuelData = useMemo(() =>
    displayBuses.slice(0, 8).map(b => ({
      name: b.registrationNumber?.split('-').pop() || b.id,
      fuel: Math.round(b.obd?.parameters?.fuelLevel || 0)
    }))
  , [displayBuses]);

  const statusCards = useMemo(() => {
    return displayBuses.slice(0, 4).map(bus => {
      const speed = Math.round(bus.obd?.parameters?.speed || 0);
      const fuel = Math.round(bus.obd?.parameters?.fuelLevel || 0);
      const isOverspeed = speed > 60;
      const isLowFuel = fuel < 20;
      return { ...bus, speed, fuel, isOverspeed, isLowFuel };
    });
  }, [displayBuses]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time status of fleet vehicles</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border rounded-lg px-4 py-2 shadow-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-gray-700">{activeBuses.length} Active Vehicles</span>
          </div>
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>}

      {/* Real mode — no MQTT buses connected */}
      {isReal && !loading && displayBuses.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
          </svg>
          <p className="text-lg font-semibold text-gray-700">Not connected to any buses</p>
          <p className="text-sm text-gray-400 mt-1">Connect your MQTT broker using the connection bar at the top to see real-time bus data.</p>
        </div>
      )}

      {/* Vehicle Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statusCards.map(bus => (
          <div key={bus.id} onClick={() => navigate(`/vehicles/${bus.id}`)} className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{bus.busName}</p>
                <p className="text-lg font-bold text-gray-900">{bus.speed} km/h</p>
              </div>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${bus.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {bus.status}
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Fuel</span>
                <span>{bus.fuel}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full mt-1">
                <div className={`h-2 rounded-full ${bus.fuel > 30 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${bus.fuel}%` }} />
              </div>
            </div>
            {(bus.isOverspeed || bus.isLowFuel) && (
              <div className="mt-2 text-xs font-semibold text-red-600">
                {bus.isOverspeed && 'Overspeed '}{bus.isLowFuel && 'Low Fuel'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Live Map */}
      <div className="bg-white rounded-xl shadow-sm p-4 h-[420px]">
        <LeafletMap buses={displayBuses} />
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-600">Average Speed</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">{avgSpeed} km/h</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-600">Daily Mileage</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">{dailyMileage} km</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-600">Fleet Status</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">{displayBuses.length} Vehicles</p>
        </div>
      </div>

      {/* Fuel Comparison */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Fuel Comparison</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={fuelData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="fuel" fill="#60a5fa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DashboardPage;
