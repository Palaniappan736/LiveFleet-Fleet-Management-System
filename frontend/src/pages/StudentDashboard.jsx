/**
 * StudentDashboard — Restricted view for college students.
 * Shows: live map, bus locations, ETA, driver name, route.
 * Does NOT show: OBD diagnostics, fuel levels, engine data, analytics.
 *
 * Real mode: uses TelemetryContext (MQTT-only buses).
 * Demo mode: uses TelemetryContext (demo buses).
 */
import React, { useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTelemetry } from "../context/TelemetryContext";
import { useAuth } from "../context/AuthContext";
import { useSystemMode } from "../context/SystemModeContext";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const DEMO_REFRESH_MS = 3000;   // 3 s — responsive demo polling
const REAL_REFRESH_MS = 180000; // 3 min — real mode interval

const STATUS = {
  active:  { badge: "bg-green-100 text-green-800",  label: "Moving"  },
  idle:    { badge: "bg-yellow-100 text-yellow-800", label: "Idle"    },
  stopped: { badge: "bg-red-100 text-red-800",       label: "Stopped" },
};

function BusCard({ bus }) {
  const s = STATUS[bus.status] || STATUS.idle;
  const eta = bus.etaMinutes;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-2 hover:shadow-md transition">
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-800 text-sm">{bus.busName}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.badge}`}>{s.label}</span>
      </div>
      <p className="text-xs text-gray-500">Route: {bus.route || "N/A"}</p>
      <p className="text-xs text-gray-500">Driver: {bus.driverName || "N/A"}</p>
      <div className="bg-blue-50 rounded-lg px-3 py-2 text-center">
        <p className="text-xs text-blue-500 font-medium">Estimated Arrival</p>
        <p className={`text-xl font-bold ${typeof eta === "number" && eta <= 5 ? "text-green-600" : "text-blue-700"}`}>
          {typeof eta === "number" ? `${eta} min` : "N/A"}
        </p>
      </div>
      <p className="text-xs text-gray-400 text-right">Capacity: {bus.capacity ?? "–"} seats</p>
    </div>
  );
}

const StudentDashboard = () => {
  const { user } = useAuth();
  const { isReal } = useSystemMode();
  const { buses, error, loading } = useTelemetry();
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");

  // Track last update time
  useMemo(() => { if (buses.length > 0) setLastUpdated(new Date()); }, [buses]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return buses.filter(
      (b) => !q || b.busName?.toLowerCase().includes(q) || b.route?.toLowerCase().includes(q) || b.driverName?.toLowerCase().includes(q) || b.registrationNumber?.toLowerCase().includes(q)
    );
  }, [buses, search]);

  const mapCenter = useMemo(() => {
    if (!buses.length) return [28.5355, 77.391];
    const lats = buses.map((b) => b.location?.latitude ?? b.location?.lat ?? 28.5355);
    const lngs = buses.map((b) => b.location?.longitude ?? b.location?.lng ?? 77.391);
    return [lats.reduce((a, b) => a + b, 0) / lats.length, lngs.reduce((a, b) => a + b, 0) / lngs.length];
  }, [buses]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.name || user?.email?.split("@")[0] || "Student"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Live bus tracking — Map and arrival times</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-gray-600">Live updates every 3s</span>
          </span>
          {lastUpdated && <span className="text-gray-400">Last: {lastUpdated.toLocaleTimeString()}</span>}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {/* Real mode — no MQTT buses connected */}
      {isReal && !loading && buses.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
          </svg>
          <p className="text-lg font-semibold text-gray-700">Not connected to any buses</p>
          <p className="text-sm text-gray-400 mt-1">No buses are currently broadcasting via MQTT. Please check back later.</p>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        {[
          { label: "Total Buses", value: buses.length, color: "blue" },
          { label: "Moving Now", value: buses.filter((b) => b.status === "active").length, color: "green" },
          { label: "Within 10 min", value: buses.filter((b) => typeof b.etaMinutes === "number" && b.etaMinutes <= 10).length, color: "amber" },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className={`w-8 h-8 ${
              c.color === "blue" ? "bg-blue-100 text-blue-600" :
              c.color === "green" ? "bg-green-100 text-green-600" :
              "bg-amber-100 text-amber-700"
            } rounded-lg flex items-center justify-center font-bold text-sm`}>{c.value}</div>
            <p className="text-sm font-semibold text-gray-700">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Live Bus Locations</h2>
          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
          </span>
        </div>
        <div style={{ height: 360 }}>
          {buses.length > 0 ? (
            <MapContainer center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {buses.map((bus) => {
                const lat = bus.location?.latitude ?? bus.location?.lat ?? 28.5355;
                const lng = bus.location?.longitude ?? bus.location?.lng ?? 77.391;
                return (
                  <Marker key={bus.id} position={[lat, lng]}>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold text-blue-700">{bus.busName}</p>
                        <p className="text-xs font-semibold text-blue-600">Bus No: {bus.registrationNumber || 'N/A'}</p>
                        <p>Route: {bus.route}</p>
                        <p>Driver: {bus.driverName}</p>
                        <p className="text-xs text-gray-500">Location: {lat.toFixed(4)}, {lng.toFixed(4)}</p>
                        {typeof bus.etaMinutes === "number" && <p className="font-semibold text-green-700">ETA: {bus.etaMinutes} min</p>}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">{error ? "Map unavailable" : "Loading map"}</div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold text-gray-800">Bus Arrivals</h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bus no, route or name" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-52" />
        </div>
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No buses found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((bus) => <BusCard key={bus.id} bus={bus} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;