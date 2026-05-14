import React, { useMemo } from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { useSystemMode } from '../context/SystemModeContext';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

const FleetAnalysisPage = () => {
  const { buses, error, loading } = useTelemetry();
  const { isReal } = useSystemMode();

  const analysis = useMemo(() => {
    if (buses.length === 0) return null;

    const categorized = buses.map(bus => {
      const obd = bus.obd?.parameters || {};
      const score = bus.features?.driverBehavior?.score || 70;
      const fuel = obd.fuelLevel || 50;
      const temp = obd.engineTemperature || 80;
      const faults = bus.obd?.faultCodes || [];

      let condition = 'Normal';
      if (faults.length > 0 || temp > 105 || fuel < 15 || score < 60) condition = 'Critical';
      else if (temp > 95 || fuel < 30 || score < 75) condition = 'Attention';

      return { ...bus, condition, score, fuel: Math.round(fuel), temp: Math.round(temp) };
    });

    const normal = categorized.filter(b => b.condition === 'Normal');
    const attention = categorized.filter(b => b.condition === 'Attention');
    const critical = categorized.filter(b => b.condition === 'Critical');

    const donutData = [
      { name: 'Normal', value: normal.length },
      { name: 'Attention', value: attention.length },
      { name: 'Critical', value: critical.length },
    ].filter(d => d.value > 0);

    const fuelEfficiency = [...categorized]
      .sort((a, b) => a.fuel - b.fuel)
      .slice(0, 6)
      .map(b => ({
        name: b.registrationNumber?.split('-').pop() || b.id,
        fuel: b.fuel,
        full: b.registrationNumber
      }));

    return { categorized, normal, attention, critical, donutData, fuelEfficiency };
  }, [buses]);

  if (!analysis) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fleet Analysis</h1>
          <p className="text-sm text-gray-500 mt-1">Performance overview of the entire fleet</p>
        </div>
        {isReal && !loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
            </svg>
            <p className="text-lg font-semibold text-gray-700">Not connected to any buses</p>
            <p className="text-sm text-gray-400 mt-1">Connect your MQTT broker using the connection bar at the top to see fleet analysis.</p>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">Loading fleet analysis…</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Fleet Analysis</h1>
        <p className="text-sm text-gray-500 mt-1">Performance overview of the entire fleet</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Operating Normally</p>
              <p className="text-3xl font-bold text-green-600">{analysis.normal.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Requires Attention</p>
              <p className="text-3xl font-bold text-yellow-600">{analysis.attention.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Critical</p>
              <p className="text-3xl font-bold text-red-600">{analysis.critical.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Donut Chart + Vehicle Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Fleet Health Distribution</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={analysis.donutData}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {analysis.donutData.map((entry, idx) => (
                  <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Vehicle Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Vehicle Status Overview</h2>
          <div className="overflow-auto max-h-[340px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-left">
                  <th className="p-2 text-gray-500 font-medium">Vehicle</th>
                  <th className="p-2 text-gray-500 font-medium">Registration</th>
                  <th className="p-2 text-gray-500 font-medium">Condition</th>
                  <th className="p-2 text-gray-500 font-medium">Status</th>
                  <th className="p-2 text-gray-500 font-medium">Fuel</th>
                  <th className="p-2 text-gray-500 font-medium">Temp</th>
                </tr>
              </thead>
              <tbody>
                {analysis.categorized.map(bus => (
                  <tr key={bus.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium text-gray-900">{bus.busName}</td>
                    <td className="p-2 text-gray-600">{bus.registrationNumber}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        bus.condition === 'Normal' ? 'bg-green-100 text-green-700' :
                        bus.condition === 'Attention' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>{bus.condition}</span>
                    </td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        bus.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>{bus.status}</span>
                    </td>
                    <td className="p-2 font-medium">{bus.fuel}%</td>
                    <td className="p-2 font-medium">{bus.temp}°C</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Lowest Fuel Efficiency */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Vehicles with Lowest Fuel Levels</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={analysis.fuelEfficiency}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(val) => [`${val}%`, 'Fuel Level']} labelFormatter={(label) => {
              const item = analysis.fuelEfficiency.find(f => f.name === label);
              return item?.full || label;
            }} />
            <Bar dataKey="fuel" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default FleetAnalysisPage;
