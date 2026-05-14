/**
 * DashboardLayout — Persistent layout with left sidebar + top header + status bar.
 * Wraps all authenticated pages. Sidebar stays fixed on navigation.
 */
import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSystemMode } from '../context/SystemModeContext';
import { useConnection } from '../context/ConnectionContext';
import { useTelemetry } from '../context/TelemetryContext';

/* ── Icon components (inline SVG for zero dependencies) ──────────────── */
const Icon = ({ d, className = '' }) => (
  <svg className={`w-5 h-5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1',
    roles: ['manager', 'admin'],
  },
  {
    to: '/student-dashboard',
    label: 'My Dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1',
    roles: ['student'],
  },
  {
    to: '/vehicles',
    label: 'Vehicles',
    icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
    roles: ['manager', 'admin'],
  },
  {
    to: '/fleet-analysis',
    label: 'Fleet Analysis',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    roles: ['manager', 'admin'],
  },
  {
    to: '/alerts',
    label: 'Alerts',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    roles: ['manager', 'admin'],
  },
  {
    to: '/reports',
    label: 'Reports',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    roles: ['manager', 'admin'],
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    roles: ['manager', 'admin'],
  },
];

/* ── Page title mapping ─────────────────────────────────────────────── */
const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/student-dashboard': 'Student Dashboard',
  '/vehicles': 'Vehicles',
  '/fleet-analysis': 'Fleet Analysis',
  '/alerts': 'Alerts',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

/* ── Tiny status dot ─────────────────────────────────────────────────── */
const StatusDot = ({ status }) => {
  const cls =
    status === 'connected'  ? 'bg-emerald-400' :
    status === 'connecting' ? 'bg-amber-400 animate-pulse' :
    status === 'error'      ? 'bg-red-400' :
    'bg-gray-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
};

const StatusText = ({ status }) => {
  const map = {
    connected:  { text: 'Connected',    cls: 'text-emerald-600 font-semibold' },
    connecting: { text: 'Connecting…',  cls: 'text-amber-600 font-semibold' },
    error:      { text: 'Error',        cls: 'text-red-600 font-semibold' },
  };
  const s = map[status] || { text: 'Disconnected', cls: 'text-gray-500' };
  return <span className={`text-xs ${s.cls}`}>{s.text}</span>;
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { mode, isDemo } = useSystemMode();
  const { mqttStatus, mqttBusCount, dbStatus, dbLatency, testDb } = useConnection();
  const { buses } = useTelemetry();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const role = user?.role || 'student';
  const isManager = role === 'manager' || role === 'admin';

  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(role));

  const currentTitle = (() => {
    if (location.pathname.startsWith('/vehicles/') && location.pathname !== '/vehicles') {
      return 'Vehicle Details';
    }
    return PAGE_TITLES[location.pathname] || 'LiveFleet';
  })();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = (user?.name || user?.email || 'U')
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('');

  const activeBuses = buses.filter(b => b.status === 'active').length;
  const faultBuses = buses.filter(b => (b.obd?.faultCodes || []).length > 0).length;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Mobile overlay ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════
          LEFT SIDEBAR
         ══════════════════════════════════════════════════════════════ */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-gray-900 text-white flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-bold text-sm shadow-lg shadow-emerald-500/20">
            LF
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">LiveFleet</h1>
            <p className="text-[10px] text-gray-400 font-medium tracking-wider uppercase mt-0.5">Fleet Management</p>
          </div>
          {/* Mobile close */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-gray-400 hover:text-white p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Navigation
          </p>
          {visibleNav.map(item => {
            const active = location.pathname === item.to ||
              (item.to === '/vehicles' && location.pathname.startsWith('/vehicles'));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200 group
                  ${active
                    ? 'bg-emerald-600/20 text-emerald-400 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                  }
                `}
              >
                <span className={`transition-colors ${active ? 'text-emerald-400' : 'text-gray-500 group-hover:text-gray-300'}`}>
                  <Icon d={item.icon} />
                </span>
                {item.label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer — connection status + mode */}
        <div className="px-3 py-4 border-t border-gray-800 space-y-3">
          {/* Mode */}
          <div className="flex items-center justify-between px-3">
            <span className="text-xs text-gray-500">Mode</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
              mode === 'demo'
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}>
              {mode === 'demo' ? '◆ Demo' : '● Live'}
            </span>
          </div>

          {/* Fleet stats */}
          <div className="bg-gray-800/60 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50" />
              <span className="text-gray-400">Fleet:</span>
              <span className="font-semibold text-blue-400">{buses.length} vehicles</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 ml-4">
              {activeBuses} active now
            </p>
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════
          MAIN CONTENT AREA (right side)
         ══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ══════════════════════════════════════════════════════════════
            REAL-TIME STATUS BAR — Always visible at the very top
           ══════════════════════════════════════════════════════════════ */}
        <div className="bg-gray-950 text-white px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 shrink-0 z-40">
          {/* MQTT Status */}
          <div className="flex items-center gap-1.5 text-xs">
            <StatusDot status={mqttStatus} />
            <span className="text-gray-400">MQTT:</span>
            <StatusText status={mqttStatus} />
            {mqttStatus === 'connected' && mqttBusCount > 0 && (
              <span className="text-gray-500 ml-0.5">({mqttBusCount} bus{mqttBusCount !== 1 ? 'es' : ''})</span>
            )}
          </div>

          <span className="text-gray-700 hidden sm:inline">|</span>

          {/* Appwrite DB Status */}
          <div className="flex items-center gap-1.5 text-xs">
            <StatusDot status={dbStatus} />
            <span className="text-gray-400">Cloud DB:</span>
            <StatusText status={dbStatus} />
            {dbStatus === 'connected' && dbLatency != null && (
              <span className="text-gray-500 ml-0.5">{dbLatency}ms</span>
            )}
            {typeof testDb === 'function' && (
              <button
                onClick={testDb}
                className="ml-1 text-gray-500 hover:text-gray-300 transition text-xs underline underline-offset-2"
              >
                test
              </button>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Quick actions */}
          {isManager && !isDemo && mqttStatus !== 'connected' && (
            <Link
              to="/settings"
              className="text-xs px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white transition font-semibold flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Connect MQTT
            </Link>
          )}
        </div>

        {/* ── TOP HEADER BAR ─────────────────────────────────────────── */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center gap-4 shrink-0 shadow-sm z-30">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700 p-1 -ml-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Page title */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{currentTitle}</h2>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            {/* Active vehicles count */}
            <div className="hidden md:flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-gray-600">
                {activeBuses} Active
              </span>
            </div>

            {/* Notifications bell */}
            <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {faultBuses > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            {/* User profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(o => !o)}
                className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg hover:bg-gray-100 transition border border-transparent hover:border-gray-200"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {initials}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-gray-800 leading-tight truncate max-w-[120px]">
                    {user?.name || user?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-[10px] text-gray-400 capitalize">{role}</p>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown menu */}
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-50" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-800">{user?.name || 'User'}</p>
                      <p className="text-xs text-gray-400">{user?.email || ''}</p>
                    </div>
                    <div className="py-1">
                      <Link
                        to="/settings"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                      >
                        <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" className="w-4 h-4 text-gray-400" />
                        Settings
                      </Link>
                    </div>
                    <div className="border-t border-gray-100 py-1">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── PAGE CONTENT ────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
