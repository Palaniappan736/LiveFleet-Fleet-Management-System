import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart,
} from 'recharts';
import { reportsAPI } from '../services/api';
import { useSystemMode } from '../context/SystemModeContext';
import { useTelemetry } from '../context/TelemetryContext';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const HEALTH_COLORS = { Healthy: '#10b981', Warning: '#f59e0b', Critical: '#ef4444' };

// Download CSV from backend with Auth header
const downloadCsvWithAuth = async (url, token, filename) => {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (e) { alert('CSV export failed: ' + e.message); }
};

const downloadTxtReport = (bus, report) => {
  if (!bus || !report) return;
  const s = report.summary;
  const month = s.month ?? report.month;
  const year  = s.year  ?? report.year;
  const lines = [
    '================================================================',
    '                   LIVEFLEET — MONTHLY REPORT                   ',
    '================================================================',
    '',
    `Vehicle       : ${bus.busName}`,
    `Registration  : ${bus.registrationNumber}`,
    `Route         : ${bus.route || 'N/A'}`,
    `Model         : ${bus.model || 'N/A'}`,
    `Report Period : ${MONTHS[month]} ${year}`,
    `Generated     : ${new Date().toLocaleString()}`,
    `Records Used  : ${s.recordCount ?? 0}`,
    '',
    '--- SUMMARY ',
    `  Active Days       : ${s.activeDays}`,
    `  Total Distance    : ${s.totalDistance} km`,
    `  Avg Speed         : ${s.avgSpeed} km/h`,
    `  Max Speed         : ${s.maxSpeed} km/h`,
    `  Avg RPM           : ${s.avgRpm}`,
    `  Avg Fuel Level    : ${s.avgFuelLevel} %`,
    `  Avg Coolant Temp  : ${s.avgCoolantTemp} C`,
    `  Avg Battery       : ${s.avgBattery} V`,
    `  Avg Engine Load   : ${s.avgEngineLoad} %`,
    `  Total Faults      : ${s.totalFaults}`,
    '',
    '--- DAILY BREAKDOWN ',
    'Date       | Rdgs | Avg Spd | Max Spd | Avg RPM | Fuel % | CoolC | Bat V | Load% | Faults',
    ...report.daily.map(d =>
      `${d.date} | ${String(d.readings).padStart(4)} | ${String(d.avgSpeed).padStart(7)} | ${String(d.maxSpeed).padStart(7)} | ${String(d.avgRpm).padStart(7)} | ${String(d.avgFuelLevel).padStart(6)} | ${String(d.avgCoolantTemp).padStart(6)} | ${String(d.avgBattery).padStart(5)} | ${String(d.avgEngineLoad).padStart(5)} |    ${d.faults}`
    ),
    '',
    '================================================================',
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `${bus.registrationNumber}-${MONTHS[month]}-${year}.txt`;
  link.click();
  URL.revokeObjectURL(url);
};

const exportHistoryCSV = (busId, records) => {
  if (!records.length) return;
  const hdr  = 'busId,timestamp,speed_kmh,rpm,fuelLevel_%,coolantTemp_C,batteryVoltage_V,engineLoad_%,ignition,odometer_km,lat,lng,faultCodes\n';
  const rows  = records.map(r =>
    [r.busId, r.timestamp, r.speed??'', r.rpm??'', r.fuelLevel??'', r.coolantTemp??'',
     r.batteryVoltage??'', r.engineLoad??'', r.ignition??'', r.odometer??'',
     r.lat??'', r.lng??'', `"${Array.isArray(r.faultCodes) ? r.faultCodes.join(';') : ''}"`].join(',')
  ).join('\n');
  const blob = new Blob([hdr + rows], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href  = URL.createObjectURL(blob);
  link.download = `${busId}-history.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const StatCard = ({ label, value, sub }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
    <p className="text-xl font-bold text-gray-900">{value}</p>
    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-gray-400">{sub}</p>}
  </div>
);

export const ReportsPage = () => {
  const navigate = useNavigate();
  const { isDemo, isReal } = useSystemMode();
  const [tab, setTab] = useState('monthly');

  const [buses, setBuses]       = useState([]);
  const [busError, setBusError] = useState(null);

  // monthly
  const [selectedBusId, setSelectedBusId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear,  setSelectedYear]  = useState(new Date().getFullYear());
  const [report, setReport]               = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError,   setReportError]   = useState(null);

  // history
  const [histBusId, setHistBusId]   = useState('');
  const [histFrom,  setHistFrom]    = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 16);
  });
  const [histTo,      setHistTo]      = useState(new Date().toISOString().slice(0, 16));
  const [histRecords, setHistRecords] = useState([]);
  const [histTotal,   setHistTotal]   = useState(0);
  const [histOffset,  setHistOffset]  = useState(0);
  const [histLoading, setHistLoading] = useState(false);
  const [histError,   setHistError]   = useState(null);

  const { buses: telemetryBuses } = useTelemetry();

  useEffect(() => {
    setBuses(telemetryBuses);
    setBusError(telemetryBuses.length === 0 && isReal ? null : null);
  }, [telemetryBuses, isReal]);

  const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);
  const histBus     = useMemo(() => buses.find(b => b.id === histBusId),     [buses, histBusId]);

  /* ── History chart data (formatted timestamps) ── */
  const histChartData = useMemo(() =>
    histRecords.map(r => ({
      ...r,
      time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    })),
    [histRecords]
  );

  const loadReport = async () => {
    if (!selectedBusId) return;
    setReportLoading(true); setReport(null); setReportError(null);
    try {
      const res = await reportsAPI.getMonthlyReport(selectedBusId, selectedMonth, selectedYear);
      setReport(res.data.report);
    } catch (e) {
      setReportError(e.response?.data?.error || 'Failed to load report');
    } finally { setReportLoading(false); }
  };

  const loadHistory = useCallback(async (offset = 0) => {
    if (!histBusId) return;
    setHistLoading(true); setHistError(null);
    try {
      const res = await reportsAPI.getHistory(histBusId, {
        from:   new Date(histFrom).toISOString(),
        to:     new Date(histTo).toISOString(),
        limit:  100, offset,
      });
      setHistRecords(res.data.records || []);
      setHistTotal(res.data.total || 0);
      setHistOffset(offset);
    } catch (e) {
      setHistError(e.response?.data?.error || 'Failed to load history');
    } finally { setHistLoading(false); }
  }, [histBusId, histFrom, histTo]);

  const handleMonthlyCSV = () => {
    if (!selectedBusId) return;
    const { url, token } = reportsAPI.getExportCsvUrl(selectedBusId, selectedMonth, selectedYear);
    downloadCsvWithAuth(url, token, `${selectedBus?.registrationNumber || selectedBusId}-${MONTHS[selectedMonth]}-${selectedYear}.csv`);
  };

  const daily = report?.daily || [];

  /* ── Computed data for advanced monthly analytics ── */
  const speedDistData = useMemo(() => {
    const d = report?.daily || [];
    if (!d.length) return [];
    let low = 0, med = 0, high = 0;
    d.forEach(day => {
      if (day.avgSpeed < 30) low++;
      else if (day.avgSpeed < 60) med++;
      else high++;
    });
    return [
      { name: 'Low (<30 km/h)', value: low },
      { name: 'Medium (30-60)', value: med },
      { name: 'High (>60 km/h)', value: high },
    ].filter(e => e.value > 0);
  }, [report]);

  const healthDistData = useMemo(() => {
    const d = report?.daily || [];
    if (!d.length) return [];
    let healthy = 0, warning = 0, critical = 0;
    d.forEach(day => {
      const issues = [
        day.avgCoolantTemp > 95,
        day.avgEngineLoad > 80,
        day.faults > 0,
        day.avgBattery < 12,
      ].filter(Boolean).length;
      if (issues >= 2) critical++;
      else if (issues === 1) warning++;
      else healthy++;
    });
    return [
      { name: 'Healthy', value: healthy },
      { name: 'Warning', value: warning },
      { name: 'Critical', value: critical },
    ].filter(e => e.value > 0);
  }, [report]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Historical OBD telemetry — monthly analysis & raw export</p>
          {isDemo && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold">
              Demo Mode — data is simulated
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('monthly')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab==='monthly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            Monthly Report
          </button>
          <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab==='history' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            Raw History
          </button>
        </div>
      </div>

      {busError && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{busError}</div>}

      {/*  MONTHLY TAB  */}
      {tab === 'monthly' && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">Generate Monthly Report</h2>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
                <select value={selectedBusId} onChange={e => { setSelectedBusId(e.target.value); setReport(null); }}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">-- Select --</option>
                  {buses.map(b => <option key={b.id} value={b.id}>{b.busName} ({b.registrationNumber})</option>)}
                </select>
              </div>
              <div className="min-w-[140px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
                <select value={selectedMonth} onChange={e => { setSelectedMonth(+e.target.value); setReport(null); }}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
              <div className="min-w-[100px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
                <select value={selectedYear} onChange={e => { setSelectedYear(+e.target.value); setReport(null); }}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button onClick={loadReport} disabled={!selectedBusId || reportLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg text-sm font-semibold transition">
                {reportLoading ? 'Loading' : 'Generate'}
              </button>
              {report && <>
                <button onClick={handleMonthlyCSV}
                  className="border border-green-500 text-green-700 hover:bg-green-50 px-4 py-2 rounded-lg text-sm font-semibold transition">
                   CSV
                </button>
                <button onClick={() => downloadTxtReport(selectedBus, report)}
                  className="border border-gray-400 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-semibold transition">
                   TXT
                </button>
              </>}
            </div>
          </div>

          {reportError && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{reportError}</div>}

          {report && (
            <>
              {selectedBus && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between">
                  <div>
                    <span className="cursor-pointer text-blue-600 font-bold hover:underline text-lg"
                      onClick={() => navigate(`/vehicles/${selectedBus.id}`)}>
                      {selectedBus.busName}
                    </span>
                    <p className="text-sm text-gray-500">{selectedBus.registrationNumber}  {selectedBus.model || 'N/A'}  {selectedBus.route || 'N/A'}</p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>{MONTHS[selectedMonth]} {selectedYear}</p>
                    <p>{report.summary.recordCount} records  {report.summary.activeDays} active days</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard label="Total Distance"   value={`${report.summary.totalDistance} km`} />
                <StatCard label="Avg Speed"        value={`${report.summary.avgSpeed} km/h`} sub={`Max ${report.summary.maxSpeed} km/h`} />
                <StatCard label="Avg Fuel Level"   value={`${report.summary.avgFuelLevel} %`} />
                <StatCard label="Avg Coolant Temp" value={`${report.summary.avgCoolantTemp} C`} />
                <StatCard label="Total Faults"     value={report.summary.totalFaults} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Avg RPM"         value={report.summary.avgRpm} />
                <StatCard label="Avg Engine Load" value={`${report.summary.avgEngineLoad} %`} />
                <StatCard label="Avg Battery"     value={`${report.summary.avgBattery} V`} />
                <StatCard label="Active Days"     value={report.summary.activeDays} />
              </div>

              {daily.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-bold text-gray-900 mb-3 text-sm">Speed (km/h) — Daily Avg & Max</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(8)} />
                        <YAxis tick={{ fontSize: 10 }} unit=" km/h" />
                        <Tooltip formatter={(v, n) => [`${v} km/h`, n === 'avgSpeed' ? 'Avg' : 'Max']} />
                        <Legend />
                        <Line type="monotone" dataKey="avgSpeed" name="Avg Speed" stroke="#3b82f6" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="maxSpeed" name="Max Speed" stroke="#ef4444" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-bold text-gray-900 mb-3 text-sm">Engine RPM — Daily Avg</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(8)} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={v => [`${v} RPM`, 'Avg RPM']} />
                        <Area type="monotone" dataKey="avgRpm" name="Avg RPM" stroke="#8b5cf6" fill="#ede9fe" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-bold text-gray-900 mb-3 text-sm">Fuel Level (%) — Daily Avg</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(8)} />
                        <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                        <Tooltip formatter={v => [`${v}%`, 'Fuel Level']} />
                        <Bar dataKey="avgFuelLevel" name="Fuel Level" fill="#f97316" radius={[2,2,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-bold text-gray-900 mb-3 text-sm">Coolant Temperature (C)</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(8)} />
                        <YAxis tick={{ fontSize: 10 }} unit="C" />
                        <Tooltip formatter={v => [`${v}C`, 'Coolant Temp']} />
                        <Line type="monotone" dataKey="avgCoolantTemp" stroke="#ef4444" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-bold text-gray-900 mb-3 text-sm">Engine Load (%) — Daily Avg</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(8)} />
                        <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                        <Tooltip formatter={v => [`${v}%`, 'Engine Load']} />
                        <Bar dataKey="avgEngineLoad" fill="#10b981" radius={[2,2,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-bold text-gray-900 mb-3 text-sm">Daily Fault Count</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(8)} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip formatter={v => [v, 'Faults']} />
                        <Bar dataKey="faults" fill="#ef4444" radius={[2,2,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg text-sm">
                  No OBD history for {MONTHS[selectedMonth]} {selectedYear}. Records are written every 3 minutes when a bus is active and transmitting via MQTT.
                </div>
              )}

              {/* ── Advanced Analytics Section ─── */}
              {daily.length > 0 && (
                <>
                  <div className="flex items-center gap-3 mt-2">
                    <h3 className="text-lg font-bold text-gray-900">Advanced Analytics</h3>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Battery Voltage Trend */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                      <h3 className="font-bold text-gray-900 mb-3 text-sm">Battery Voltage (V) — Daily Avg</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={daily}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(8)} />
                          <YAxis tick={{ fontSize: 10 }} unit=" V" domain={['auto', 'auto']} />
                          <Tooltip formatter={v => [`${v} V`, 'Battery']} />
                          <Line type="monotone" dataKey="avgBattery" stroke="#f59e0b" dot={false} strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Daily Distance */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                      <h3 className="font-bold text-gray-900 mb-3 text-sm">Daily Distance (km)</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={daily}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(8)} />
                          <YAxis tick={{ fontSize: 10 }} unit=" km" />
                          <Tooltip formatter={v => [`${v} km`, 'Distance']} />
                          <Bar dataKey="distance" fill="#8b5cf6" radius={[2,2,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Combined: Distance + Avg Speed */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                      <h3 className="font-bold text-gray-900 mb-3 text-sm">Distance vs Speed — Combined</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={daily}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(8)} />
                          <YAxis yAxisId="left" tick={{ fontSize: 10 }} unit=" km" />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit=" km/h" />
                          <Tooltip />
                          <Legend />
                          <Bar yAxisId="left" dataKey="distance" name="Distance (km)" fill="#8b5cf6" radius={[2,2,0,0]} opacity={0.7} />
                          <Line yAxisId="right" type="monotone" dataKey="avgSpeed" name="Avg Speed (km/h)" stroke="#3b82f6" dot={false} strokeWidth={2} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Daily OBD Readings Count */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                      <h3 className="font-bold text-gray-900 mb-3 text-sm">Daily OBD Readings Count</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={daily}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(8)} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                          <Tooltip formatter={v => [v, 'Readings']} />
                          <Bar dataKey="readings" fill="#06b6d4" radius={[2,2,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Speed Distribution Pie */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                      <h3 className="font-bold text-gray-900 mb-3 text-sm">Speed Distribution by Day</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={speedDistData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {speedDistData.map((entry, index) => (
                              <Cell key={`spd-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Vehicle Health Pie */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                      <h3 className="font-bold text-gray-900 mb-3 text-sm">Vehicle Health by Day</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={healthDistData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {healthDistData.map((entry) => (
                              <Cell key={entry.name} fill={HEALTH_COLORS[entry.name]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}

              {daily.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-sm">Daily Breakdown Table</h3>
                    <span className="text-xs text-gray-400">{daily.length} days with data</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                        <tr>
                          {['Date','Readings','Avg Spd','Max Spd','Avg RPM','Fuel %','Cool C','Bat V','Load %','Dist km','Faults'].map(h =>
                            <th key={h} className="px-3 py-2 text-right first:text-left whitespace-nowrap">{h}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {daily.map(d => (
                          <tr key={d.date} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-700">{d.date}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{d.readings}</td>
                            <td className="px-3 py-2 text-right">{d.avgSpeed}</td>
                            <td className="px-3 py-2 text-right">{d.maxSpeed}</td>
                            <td className="px-3 py-2 text-right">{d.avgRpm}</td>
                            <td className="px-3 py-2 text-right">{d.avgFuelLevel}</td>
                            <td className="px-3 py-2 text-right">{d.avgCoolantTemp}</td>
                            <td className="px-3 py-2 text-right">{d.avgBattery}</td>
                            <td className="px-3 py-2 text-right">{d.avgEngineLoad}</td>
                            <td className="px-3 py-2 text-right">{d.distance}</td>
                            <td className={`px-3 py-2 text-right font-medium ${d.faults > 0 ? 'text-red-600' : 'text-gray-400'}`}>{d.faults}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {!report && !reportLoading && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg font-medium">Select a vehicle, month and year — then click Generate</p>
              <p className="text-sm mt-1">Aggregates all OBD records for the month with 6 charts and a daily table</p>
            </div>
          )}
        </>
      )}

      {/*  HISTORY TAB  */}
      {tab === 'history' && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">Raw OBD History</h2>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
                <select value={histBusId} onChange={e => { setHistBusId(e.target.value); setHistRecords([]); }}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">-- Select --</option>
                  {buses.map(b => <option key={b.id} value={b.id}>{b.busName} ({b.registrationNumber})</option>)}
                </select>
              </div>
              <div className="min-w-[180px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                <input type="datetime-local" value={histFrom} onChange={e => setHistFrom(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="min-w-[180px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <input type="datetime-local" value={histTo} onChange={e => setHistTo(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <button onClick={() => loadHistory(0)} disabled={!histBusId || histLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg text-sm font-semibold transition">
                {histLoading ? 'Loading' : 'Load'}
              </button>
              {histRecords.length > 0 && (
                <button onClick={() => exportHistoryCSV(histBusId, histRecords)}
                  className="border border-green-500 text-green-700 hover:bg-green-50 px-4 py-2 rounded-lg text-sm font-semibold transition">
                   CSV ({histRecords.length} rows)
                </button>
              )}
            </div>
          </div>

          {histError && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{histError}</div>}

          {histRecords.length > 0 && (
            <>
              {/* ── History Visualization Charts ─── */}
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-gray-900">Telemetry Trends</h3>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">{histRecords.length} data points</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Speed & RPM */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 mb-3 text-sm">Speed & RPM Over Time</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={histChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} unit=" km/h" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="speed" name="Speed (km/h)" stroke="#3b82f6" dot={false} strokeWidth={2} />
                      <Area yAxisId="right" type="monotone" dataKey="rpm" name="RPM" stroke="#8b5cf6" fill="#ede9fe" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Fuel Level & Engine Load */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 mb-3 text-sm">Fuel Level & Engine Load</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={histChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="fuelLevel" name="Fuel Level (%)" stroke="#f97316" fill="#fff7ed" />
                      <Area type="monotone" dataKey="engineLoad" name="Engine Load (%)" stroke="#10b981" fill="#ecfdf5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Coolant Temp & Battery Voltage */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 mb-3 text-sm">Coolant Temp & Battery Voltage</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={histChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} unit=" C" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit=" V" />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="coolantTemp" name="Coolant Temp (C)" stroke="#ef4444" dot={false} strokeWidth={2} />
                      <Line yAxisId="right" type="monotone" dataKey="batteryVoltage" name="Battery (V)" stroke="#f59e0b" dot={false} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Speed Profile (standalone area) */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 mb-3 text-sm">Speed Profile</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={histChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} unit=" km/h" />
                      <Tooltip formatter={v => [`${v} km/h`, 'Speed']} />
                      <Area type="monotone" dataKey="speed" stroke="#3b82f6" fill="#dbeafe" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 text-sm">{histBus?.busName || histBusId} — Raw Records</h3>
                  <span className="text-xs text-gray-400">Showing {histOffset+1}–{histOffset+histRecords.length} of {histTotal} total</span>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide sticky top-0 z-10">
                      <tr>
                        {['Timestamp','Speed km/h','RPM','Fuel %','Cool C','Bat V','Load %','Ignition','Odo km','Lat','Lng','Faults'].map(h =>
                          <th key={h} className="px-3 py-2 text-right first:text-left whitespace-nowrap">{h}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {histRecords.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5 font-mono text-gray-600 whitespace-nowrap">{new Date(r.timestamp).toLocaleString()}</td>
                          <td className={`px-3 py-1.5 text-right ${r.speed > 80 ? 'text-orange-600 font-semibold' : ''}`}>{r.speed ?? '—'}</td>
                          <td className="px-3 py-1.5 text-right">{r.rpm ?? '—'}</td>
                          <td className={`px-3 py-1.5 text-right ${r.fuelLevel != null && r.fuelLevel < 20 ? 'text-red-600 font-semibold' : ''}`}>{r.fuelLevel ?? '—'}</td>
                          <td className={`px-3 py-1.5 text-right ${r.coolantTemp > 100 ? 'text-red-600 font-semibold' : ''}`}>{r.coolantTemp ?? '—'}</td>
                          <td className={`px-3 py-1.5 text-right ${r.batteryVoltage != null && r.batteryVoltage < 11.5 ? 'text-red-600 font-semibold' : ''}`}>{r.batteryVoltage ?? '—'}</td>
                          <td className="px-3 py-1.5 text-right">{r.engineLoad ?? '—'}</td>
                          <td className={`px-3 py-1.5 text-right ${r.ignition === true || r.ignition === 'ON' || r.ignition === 1 ? 'text-green-600' : 'text-gray-400'}`}>
                            {r.ignition === true || r.ignition === 'ON' || r.ignition === 1 ? 'ON' : r.ignition === false || r.ignition === 'OFF' || r.ignition === 0 ? 'OFF' : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right">{r.odometer ?? '—'}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{r.lat != null ? (+r.lat).toFixed(5) : '—'}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{r.lng != null ? (+r.lng).toFixed(5) : '—'}</td>
                          <td className={`px-3 py-1.5 text-right font-medium ${r.faultCodes?.length > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                            {r.faultCodes?.length > 0 ? r.faultCodes.map(f => typeof f === 'string' ? f : f.code).join(', ') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => loadHistory(Math.max(0, histOffset - 100))} disabled={histOffset === 0 || histLoading}
                  className="px-4 py-2 rounded-lg text-sm border disabled:opacity-40 hover:bg-gray-50">
                   Previous 100
                </button>
                <span className="text-sm text-gray-500">Page {Math.floor(histOffset/100)+1} / {Math.max(1, Math.ceil(histTotal/100))}</span>
                <button onClick={() => loadHistory(histOffset + 100)} disabled={histOffset + 100 >= histTotal || histLoading}
                  className="px-4 py-2 rounded-lg text-sm border disabled:opacity-40 hover:bg-gray-50">
                  Next 100 
                </button>
              </div>
            </>
          )}

          {histRecords.length === 0 && !histLoading && histBusId && (
            <div className="text-center py-12 text-gray-400">
              <p>No records found for the selected date range.</p>
              <p className="text-xs mt-1">OBD data is stored every 3 minutes when a bus is transmitting live telemetry.</p>
            </div>
          )}
          {!histBusId && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg font-medium">Select a vehicle and date range to view raw history</p>
              <p className="text-sm mt-1">All 12 OBD parameters shown  colour-coded thresholds  paginated 100 at a time  downloadable as CSV</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportsPage;