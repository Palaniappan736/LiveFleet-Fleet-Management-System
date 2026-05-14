import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelemetry } from '../context/TelemetryContext';
import { useSystemMode } from '../context/SystemModeContext';

export const VehiclesPage = () => {
  const [search, setSearch] = useState('');
  const { buses: rawBuses, error, loading } = useTelemetry();
  const { isReal } = useSystemMode();
  const navigate = useNavigate();

  /* ── Stabilize bus list to prevent scroll-to-top on every poll ──── */
  const [displayBuses, setDisplayBuses] = useState([]);
  const prevFingerprintRef = useRef('');
  const pendingScrollRestoreRef = useRef(false);
  const scrollYRef = useRef(0);

  useEffect(() => {
    // Only update displayBuses when visible card data actually changes
    const fp = JSON.stringify(rawBuses.map(b => [
      b.id, b.status, b.busName, b.registrationNumber, b.route, b.driverName,
      Math.round(b.obd?.parameters?.speed || 0),
      Math.round(b.obd?.parameters?.fuelLevel || 0),
    ]));
    if (fp !== prevFingerprintRef.current) {
      prevFingerprintRef.current = fp;
      // Keep current page position stable while cards refresh from polling.
      scrollYRef.current = window.scrollY || 0;
      pendingScrollRestoreRef.current = true;
      setDisplayBuses(rawBuses);
    }
  }, [rawBuses]);

  useEffect(() => {
    if (!pendingScrollRestoreRef.current) return;
    pendingScrollRestoreRef.current = false;
    window.scrollTo({ top: scrollYRef.current, left: 0, behavior: 'auto' });
  }, [displayBuses]);

  const filtered = useMemo(() => {
    if (!search) return displayBuses;
    const term = search.toLowerCase();
    return displayBuses.filter((bus) =>
      bus.busName?.toLowerCase().includes(term) ||
      bus.registrationNumber?.toLowerCase().includes(term) ||
      bus.route?.toLowerCase().includes(term)
    );
  }, [displayBuses, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vehicles</h1>
          <p className="text-sm text-gray-500 mt-1">Track and monitor all fleet vehicles</p>
        </div>
        <div className="bg-white border rounded-lg px-3 py-2 shadow-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="outline-none text-sm"
            placeholder="Search by name, registration, or route"
          />
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>}

      {/* Real mode — no MQTT buses connected */}
      {isReal && !loading && displayBuses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
          </svg>
          <p className="text-lg font-semibold text-gray-700">Not connected to any buses</p>
          <p className="text-sm text-gray-400 mt-1">Connect your MQTT broker using the connection bar at the top to see real-time vehicle data.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((bus) => {
          const speed = Math.round(bus.obd?.parameters?.speed || 0);
          const fuel = Math.round(bus.obd?.parameters?.fuelLevel || 0);
          return (
            <div
              key={bus.id}
              onClick={() => navigate(`/vehicles/${bus.id}`)}
              className="bg-white rounded-xl shadow-sm p-5 cursor-pointer hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{bus.registrationNumber}</p>
                  <h3 className="text-lg font-bold text-gray-900">{bus.busName}</h3>
                  <p className="text-xs text-gray-500">{bus.route}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${bus.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {bus.status}
                </span>
              </div>
              <div className="mt-3 text-sm text-gray-600">
                <p>Driver: <span className="font-semibold text-gray-900">{bus.driverName || 'N/A'}</span></p>
                <p>Speed: <span className="font-semibold text-gray-900">{speed} km/h</span></p>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Fuel Level</span>
                  <span>{fuel}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full mt-1">
                  <div className={`h-2 rounded-full ${fuel > 30 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${fuel}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

export default VehiclesPage;
